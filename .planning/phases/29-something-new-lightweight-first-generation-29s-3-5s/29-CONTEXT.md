# Phase 29: "Something New" lightweight-first generation — Context

**Gathered:** 2026-06-09
**Status:** Ready for planning
**Source:** LIVE telemetry (Fly logs) + a thorough read-only Explore flow map + user decision (lightweight-first + background hydration).

<domain>
## Phase Boundary

Cut the "Something New" generation wait (the *"…finding great meals from your pantry"* skeleton in `SomethingNewResults.tsx`) from ~29s to 3-5s.

**Hard evidence:** `POST /api/v1/recipes/search` measured at **28,942ms** in production — a SINGLE Gemini call (no retry — the 27-04 MALFORMED warn did NOT fire) generating 3 COMPLETE recipes (heavy `ingredients[]` + `steps[]`) before any card renders. Recipe Box library is fine (277ms DB / 25KB). Image gen is ~6.5s, async, secondary.

**Approach (user-chosen):** `/search` returns LIGHTWEIGHT previews fast; full ingredients+steps hydrate in the BACKGROUND, mirroring the existing image-fill pattern (card shows instantly, content fills in).

**Out of scope:** streaming the full generation, Recipe Box (already fast), image-gen changes (Phase 27/28 handled), new screens beyond loading affordances.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### D1 — Server: split discovery into a LIGHTWEIGHT generation
`packages/server/src/services/recipeDiscovery.ts` `suggestRecipesSchema` (lines 110-192) currently REQUIRES (line 187) heavy `ingredients[]` {name,quantity,unit,notes} + `steps[]` for every recipe — the cost driver. Create a light variant:
- Drop `ingredients` and `steps` from `required` (and ideally from properties) for the initial /search generation.
- Remove the "Return full recipes with structured ingredients ... and ordered steps" instruction from `buildDiscoveryPrompt` (lines 320-322, tool description 196-197) in light mode.
- KEEP (all LIGHT, cheap): title, description, prep/cook/total_time, servings, difficulty, practiced_skills, skill_note, calories_per_serving, protein_grams_per_serving.
- **Pantry-match nuance:** the card's pantry badge (`SomethingNewResults.tsx:269-272 pantryMatchCount`) reduces over `recipe.ingredients`. Options for the planner: (a) include a LIGHT `ingredient_names: string[]` (names only, no quantity/unit/notes — much cheaper than full ingredient objects + steps) so the badge still works, OR (b) accept the badge reads 0 until hydration. PREFER (a) if it doesn't materially slow generation; the dominant cost is `steps` + full ingredient detail, not bare names.
- Keep maxTokens but expect the light generation to finish well under the 8192 ceiling fast. Light mode applies to the initial pantryOnly load AND the load-more append.

### D2 — Server: parallelize the 4 serial pre-call DB fetches
In `packages/server/src/routes/recipes.ts` /search handler (~192-336): members (229), profile (238), pantry (273, conditional on pantryOnly), library getRecipes (298) are awaited SEQUENTIALLY before the Gemini call. Promise.all the independent ones (members/profile/library always; pantry when pantryOnly). Saves ~1-2s. `existingTitles` (library AVOID list + cache key) still needed — but only `.title` is used, so a title-only fetch is enough if cheap.

### D3 — Server: a hydration endpoint reusing the proven parseText engine
Add `POST /recipes/hydrate` that takes a light preview `{ title, description, difficulty, prep/cook/total_time, cuisine, ingredient_names? }` and returns full `{ ingredients, steps, nutrition }`. REUSE the existing single-call full-recipe primitive: `applyRemixVariation` (`recipeParser.ts:435-476`) already does "title + light context → full ParsedRecipe with ingredients+steps+nutrition" via one `callAIParseRecipeText('recipe.parseText', ...)` call (gemini flash, taskRouting.ts:30). Model the hydrate handler on it. Content-address/cache the result (mirror recipeImageGen's cache) so re-hydrating the same preview is cheap.

### D4 — Client: background hydration hook (mirror useGeneratedRecipeImage)
Add a `useHydratedRecipeContent(preview)` hook (or a `hydrateSearchResult(index)` store action) that mirrors `useGeneratedRecipeImage.ts` EXACTLY: module-level `Map<key,{...,inflight,attempted}>` cache, the **MAX_CONCURRENT=2 FIFO limiter** (lines 78-112), AsyncStorage persistence, inflight coalescing, returns `{ ingredients, steps, status: 'loading'|'resolved'|'failed' }`. After `searchRecipes` sets lightweight `searchResults`, background-hydrate each (throttled 2-at-a-time), patching `searchResults[i]` with ingredients/steps as they land. A `prefetchHydration(preview)` analog (like prefetchGeneratedRecipeImage) is a plus.

### D5 — Gate Save/Cook/Favorite until hydrated (CRITICAL — hard dependency)
`POST /api/v1/recipes` HARD-REQUIRES non-empty ingredients AND steps (`recipes.ts:454` → 400 "Missing required fields"). Every save path spreads `...recipe` (SomethingNewResults.tsx:306/335/370, kitchen.tsx:796). So Save / Cook Now / Save+Favorite MUST be disabled (or await hydration) until that recipe's `status==='resolved'`. This is non-negotiable — an un-hydrated save 400s. If the user taps before hydration, either await the in-flight hydration then proceed, or disable with a subtle loading state.

### D6 — PreviewSheet loading affordances
PreviewSheet (`apps/mobile/src/app/recipes/discover.tsx`, exported line 344):
- Steps: WIRE the EXISTING `stepsLoading` prop (param 365, render 735-739 "Generating steps…" + spinner) — pass `stepsLoading={status!=='resolved'}`. The affordance already exists, just not triggered.
- Ingredients: NO `ingredientsLoading` prop exists (hardcoded "No ingredients listed." at 693). Add an analogous affordance so un-hydrated ingredients show a loader, not a bald empty state.

### D7 — Persistence safety for un-hydrated previews
`suggestionsStore.partialize` (249-254) persists `searchResults`. An un-hydrated preview persisted then relaunched = empty ingredients/steps with NO in-flight hydration → tap/save breaks (D5) with no recovery. Handle ONE of: (a) re-trigger hydration on store rehydrate for any un-hydrated `searchResults`, (b) mark cards `_hydrated` and re-hydrate missing on mount, or (c) exclude un-hydrated previews from persistence. Planner picks; (a) or (b) preferred so persisted previews stay usable.

### D8 — Telemetry to confirm the win
Add discovery sub-stage timing: in /search, log Gemini ms vs total (so we can SEE the light generation is ~3-5s). Wrap the client `searchRecipes` round-trip in `withBudget('suggestions.search', ...)` (new budget). Record hydration timing per recipe via logAiEvent (mirror the per-image event). This confirms 29s→3-5s with data.

### Claude's Discretion
- Whether the light schema keeps `ingredient_names` (D1a) — decide by reasoning about token cost; prefer keeping names for the pantry badge.
- Exact hydrate endpoint contract + whether hydration is per-recipe or batched (per-recipe + 2-concurrent mirrors the image pattern and lets the first card hydrate first).
- Whether to hydrate ALL previews eagerly in the background vs lazily on first tap+prefetch-top. PREFER eager background hydration of all visible previews (throttled) so taps are usually instant.
- Cache key/TTL for hydration.
</decisions>

<canonical_refs>
## Canonical References (downstream agents MUST read before planning/implementing)

### The flow map (this phase's source of truth — re-derive from these files)
- `packages/server/src/services/recipeDiscovery.ts` — suggestRecipesSchema (110-192, `required` at 187), Gemini call (373-382, maxTokens 8192), count logic (353-371), buildDiscoveryPrompt (208-325, full-detail instruction 320-322).
- `packages/server/src/routes/recipes.ts` — /search handler (192-336): serial awaits members 229 / profile 238 / pantry 273 / library 298; getOrComputeDiscovery 307-329; POST / save requires ingredients+steps at 454.
- `packages/server/src/services/recipeParser.ts` — applyRemixVariation (435-476) = the single-call full-recipe engine to reuse for hydrate; callAIParseRecipeText('recipe.parseText').
- `packages/server/src/services/discoveryCache.ts` — cache key (excludeTitles excluded, libraryDigest included), 12min TTL, coalescing.
- `apps/mobile/src/hooks/useGeneratedRecipeImage.ts` — the EXACT pattern to mirror for content hydration (Map cache 65, MAX_CONCURRENT limiter 78-112, AsyncStorage 188-230, prefetch 366-386).
- `apps/mobile/src/stores/suggestionsStore.ts` — searchResults (28), searchRecipes (122-165), appendSearchResults (167-231, count:2 load-more), partialize (249-254).
- `apps/mobile/src/components/suggestions/SomethingNewResults.tsx` — PreviewRecipeCard (244-433), pantryMatchCount uses ingredients (269-272), save handlers spread ...recipe (306/335/370), RecipeCard preview mode (393-409).
- `apps/mobile/src/app/recipes/discover.tsx` — PreviewSheet (344): ingredients render (692-729, no loading state), steps render (733-751 with existing `stepsLoading` 735-739), save/cook/remix sites.
- `apps/mobile/src/stores/recipeStore.ts` — saveRecipe (202-212) sends full recipe; server requires ingredients+steps.
- `apps/mobile/src/types/recipe.ts` — ParsedRecipe shape (32).

### Telemetry plumbing (Phase 28 lit these up — reuse)
- `apps/mobile/src/lib/perfBudgets.ts` (withBudget, add SUGGESTIONS_SEARCH_MS), `apps/mobile/src/ai/telemetry.ts` (logAiEvent), `packages/server/src/ai/aiTelemetry.ts` (recordAiCall), `packages/server/src/middleware/requestLogging.ts`.
</canonical_refs>

<specifics>
## Specific Ideas
- The dominant cost is the Gemini generation of heavy ingredients+steps for 3 recipes. Dropping those from the REQUIRED initial generation is the core win; everything else (DB parallelize, telemetry, affordances) supports it.
- This phase ENDS with deploy (Fly + EAS build #26) + measure: confirm `/recipes/search` drops to ~3-5s in the Fly logs and that hydration fills content without breaking save. Data-driven + human-gated.
- The hydration engine (applyRemixVariation / recipe.parseText) and the throttle pattern (useGeneratedRecipeImage) already exist and are proven — this is mostly composition, not greenfield AI work.
</specifics>

<deferred>
## Deferred
- Streaming the discovery response (user chose lightweight-first instead).
- Prefetching suggestions before the user opens the tab (possible follow-up once the base flow is fast).
- A dedicated `ingredientsLoading` design polish beyond a basic loader.
</deferred>

---

*Phase: 29-something-new-lightweight-first-generation-29s-3-5s*
*Context gathered: 2026-06-09 from live telemetry + Explore flow map + user decision*
