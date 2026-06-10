---
phase: 29-something-new-lightweight-first-generation-29s-3-5s
plan: 02
subsystem: api
tags: [gemini, recipe-hydration, caching, hono, recipe-parseText, performance]

# Dependency graph
requires:
  - phase: 29-something-new-lightweight-first-generation-29s-3-5s
    plan: 01
    provides: "light /search previews ({title, description, times, difficulty, nutrition, ingredient_names}) — the hydrate input shape"
  - phase: 11-hybrid-ai-client
    provides: "callAIParseRecipeText('recipe.parseText') routed to gemini flash; toolOutputToRecipe → ParsedRecipe"
  - phase: 27-performance-caching
    provides: "discoveryCache content-address + inflight-coalesce pattern mirrored by the hydration cache"
provides:
  - "hydrateRecipePreview(preview) — light preview → full ParsedRecipe (ingredients+steps+nutrition) via ONE recipe.parseText call (mirrors applyRemixVariation)"
  - "content-address sha256 hydration cache (title|total_time|sorted ingredient_names) + 30min TTL + inflight coalescing + __resetHydrationCache test hook"
  - "POST /api/v1/recipes/hydrate (authed) → { data: { ingredients, steps, calories_per_serving, protein_grams_per_serving, servings } }"
  - "callAIParseRecipeText + toolOutputToRecipe now exported from recipeParser.ts so other services can reuse the proven engine"
affects: [29-03-client-hydration-hook, 29-04-deploy-measure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse-the-proven-engine: hydration composes callAIParseRecipeText('recipe.parseText') + toolOutputToRecipe (exact applyRemixVariation primitives) rather than inventing a new AI prompt surface"
    - "Content-address cache + inflight coalescing copied verbatim from discoveryCache (LRU Map + sha256 key + inflight Map) for a single-value (ParsedRecipe) instead of array payload"

key-files:
  created:
    - packages/server/src/services/recipeHydration.ts
    - packages/server/src/services/__tests__/recipeHydration.test.ts
    - packages/server/src/routes/__tests__/recipes.hydrate.test.ts
  modified:
    - packages/server/src/routes/recipes.ts
    - packages/server/src/services/recipeParser.ts

key-decisions:
  - "Hydration TTL = 30 min (longer than discoveryCache's 12 min): a preview's full content doesn't change, and the client may re-hydrate the same on-screen card across persistence/relaunch (D7)"
  - "Cache key = sha256(title|total_time|sorted ingredient_names) — the fields that determine the hydration output; sorting ingredient_names makes the key order-insensitive so the same preview always collides"
  - "Exported callAIParseRecipeText + toolOutputToRecipe from recipeParser.ts (they were module-private) so recipeHydration reuses the EXACT proven engine instead of duplicating prompt/mapping logic"
  - "Route declared ABOVE GET /:id (same positioning rationale as /search and /discover) so '/hydrate' isn't captured as an :id param"

patterns-established:
  - "Single-value content-address cache: discoveryCache's array cache adapted to cache one ParsedRecipe per key (lookup/store/inflight identical, value type ParsedRecipe not ParsedRecipe[])"

requirements-completed: [D3]

# Metrics
duration: 5min
completed: 2026-06-09
---

# Phase 29 Plan 02: Server hydration endpoint Summary

**`POST /recipes/hydrate` turns a lightweight "Something New" preview into full `{ ingredients, steps, nutrition }` by reusing the proven single-call `recipe.parseText` engine (the exact `applyRemixVariation` primitives), content-address cached + inflight-coalesced so re-hydrating the same preview within 30 min is free — the background-fill engine the client (29-03) calls per-card after render.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-10T05:07:00Z
- **Completed:** 2026-06-10T05:12:00Z
- **Tasks:** 2 (both TDD)
- **Files created:** 3, **modified:** 2

## Accomplishments

- **`recipeHydration.ts` service** — `hydrateRecipePreview(preview)` where `preview = { title, description?, difficulty?, prep/cook/total_time_minutes?, cuisine?, ingredient_names? }` returns a full `ParsedRecipe` with non-empty `ingredients[]` + `steps[]` + nutrition. It builds a prompt mirroring `applyRemixVariation`'s wording (seeds the model with title + description + cuisine + difficulty + total time + the known `ingredient_names` as "expand to full quantities", and copies the SAME calories/protein nutrition-instruction block), then makes ONE `callAIParseRecipeText('recipe.parseText', prompt)` call and `toolOutputToRecipe(input, 'ai')`.
- **Content-address cache + coalescing** — module-level LRU `Map<string,{value,expiresAt}>` keyed by `sha256(title|total_time|sorted ingredient_names)`, `HYDRATION_CACHE_TTL_MS = 30 * 60 * 1000`, and an inflight `Map<string, Promise<ParsedRecipe>>` so two concurrent identical calls share one upstream call. `__resetHydrationCache()` exported for tests. Copied verbatim from `discoveryCache.ts` (single-value instead of array).
- **`POST /recipes/hydrate` route** — declared above `GET /:id`; runs the auth guard (`c.get('user')`); JSON-parse → 400, missing/empty `title` → 400; calls `hydrateRecipePreview` defensively pulling fields from the body; returns `{ data: { ingredients, steps, calories_per_serving, protein_grams_per_serving, servings } }` (the contract 29-03 consumes); service failure → 500 `{ error }` mirroring `/search`.
- **Engine reuse** — `callAIParseRecipeText` and `toolOutputToRecipe` exported from `recipeParser.ts` (were module-private) so the hydration service reuses the proven primitives rather than re-implementing the prompt + tool-output mapping.

## Task Commits

Each task was committed atomically (TDD: test → feat), normal `git commit` to `main`:

1. **Task 1 RED: failing test for recipeHydration** — `4f8e40c` (test)
2. **Task 1 GREEN: recipeHydration service + recipeParser exports (D3)** — `d27f291` (feat)
3. **Task 2 RED: failing tests for POST /recipes/hydrate** — `a631e14` (test)
4. **Task 2 GREEN: POST /recipes/hydrate route (D3)** — `5ca8cda` (feat)

_No REFACTOR commits — implementation was clean as written._

## Files Created/Modified

- `packages/server/src/services/recipeHydration.ts` (created) — `HydratePreviewInput` type, `hydrateRecipePreview()`, `buildHydrationPrompt()`, sha256 `hydrationCacheKey()`, LRU `lookup`/`store`, inflight coalescing, `HYDRATION_CACHE_TTL_MS`, `__resetHydrationCache`.
- `packages/server/src/services/__tests__/recipeHydration.test.ts` (created) — full recipe via one parseText call (asserts `getClientFor('recipe.parseText')` + prompt seeds title/ingredients), cache-hit (mock called once across two identical calls), inflight coalescing (concurrent → one call), distinct previews → two calls, TTL constant.
- `packages/server/src/routes/__tests__/recipes.hydrate.test.ts` (created) — valid preview → 200 with full content + nutrition + servings; missing/empty title → 400; bad JSON → 400; service failure → 500. Reuses the recipes.search auth/supabase mock harness.
- `packages/server/src/routes/recipes.ts` (modified) — `import { hydrateRecipePreview }`; `recipes.post('/hydrate', ...)` declared above `recipes.get('/:id')`. **Note:** 29-01's `/search` light mode + parallelized fetches preserved untouched.
- `packages/server/src/services/recipeParser.ts` (modified) — added `export` to the previously-private `callAIParseRecipeText` and `toolOutputToRecipe` so the hydration service reuses the proven engine.

## Decisions Made

- **30-min hydration TTL** (vs discoveryCache's 12 min) — a preview's full content is stable, and the client may re-hydrate the same on-screen card across store persistence/relaunch (D7), so a longer window maximizes free re-hydrations.
- **Cache key = `sha256(title|total_time|sorted ingredient_names)`** — exactly the fields that drive the hydration output. Sorting `ingredient_names` makes the key order-insensitive so the same preview always collides into the cache.
- **Export the proven primitives, don't duplicate** — `callAIParseRecipeText` + `toolOutputToRecipe` were module-private in recipeParser.ts. Exporting them lets recipeHydration reuse the exact `applyRemixVariation` engine (single Gemini call + CJK-sanitizing tool-output mapping) instead of re-implementing it, honoring D3's "reuse the proven engine, no new AI surface" mandate.
- **Route above `/:id`** — `/hydrate` must register before the `:id` param route or Hono captures "hydrate" as a recipe id. Same positioning as `/search` and `/discover`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported `callAIParseRecipeText` + `toolOutputToRecipe` from recipeParser.ts**
- **Found during:** Task 1
- **Issue:** The plan's interface block mandated reusing `callAIParseRecipeText('recipe.parseText', ...)` + `toolOutputToRecipe(input,'ai')` from a SEPARATE `recipeHydration.ts` module, but both functions were module-private (not exported) in `recipeParser.ts` — the import would fail.
- **Fix:** Added `export` to both declarations. Zero behavior change to recipeParser; `parseRecipeFromUrl/Text/Photo` and `applyRemixVariation` continue calling them in-module. This is the minimal change that lets the hydration service reuse the proven engine rather than duplicating the prompt + tool-output mapping (which would risk drift, e.g. the CJK sanitizer in `toolOutputToRecipe`).
- **Files modified:** packages/server/src/services/recipeParser.ts
- **Verification:** recipeParser.test.ts still passes (17/17).
- **Committed in:** d27f291 (Task 1 GREEN)

## Issues Encountered

- **External revert of the `/hydrate` route mid-task.** After the first apply of the route + import to `recipes.ts`, a linter/external modification fully reverted the file (the route and import vanished; `git status` showed no changes to recipes.ts). Re-applied both edits and committed immediately; the route is now persisted (commit `5ca8cda`, verified `recipes.post('/hydrate'` at line 490 < `recipes.get('/:id'` at 546).
- **Full server suite baseline unchanged.** `pnpm vitest run` → 759 passed / 76 failed / 16 skipped. All 76 failures are `ECONNREFUSED 127.0.0.1:3000` in the top-level `__tests__/` integration suites (ai, auth-stubs, cooking, meal-plans — they require a live server) plus the documented untyped-Hono `tsc` noise — the exact baseline recorded in 29-01's SUMMARY. The two new suites (recipeHydration: 5, recipes.hydrate: 5) are all green.

## Known Stubs

None. The hydration endpoint returns the full content the light preview lacks; there are no placeholder/empty-data paths.

## User Setup Required

None — no external service configuration. Uses the existing `recipe.parseText` (gemini flash) route already provisioned.

## Next Phase Readiness

- The server hydration contract is ready. Plan 29-03 (client) adds a `useHydratedRecipeContent(preview)` hook mirroring `useGeneratedRecipeImage` (MAX_CONCURRENT=2 FIFO limiter, AsyncStorage, inflight coalescing) that POSTs each light preview to `/recipes/hydrate` and patches `searchResults[i]` with the returned `ingredients`/`steps`/nutrition, and gates Save/Cook/Favorite until `status==='resolved'` (D5).
- The endpoint returns exactly `{ data: { ingredients, steps, calories_per_serving, protein_grams_per_serving, servings } }` — the fields the client patches onto the light card.
- Plan 29-04 deploys (Fly) + measures the end-to-end win.

## Self-Check: PASSED

All created/modified files present; all 4 task commits (4f8e40c, d27f291, a631e14, 5ca8cda) verified in git history.

---
*Phase: 29-something-new-lightweight-first-generation-29s-3-5s*
*Completed: 2026-06-09*
