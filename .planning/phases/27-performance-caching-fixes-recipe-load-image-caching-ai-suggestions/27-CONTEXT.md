# Phase 27: Performance & caching fixes — Context

**Gathered:** 2026-06-08
**Status:** Ready for planning
**Source:** Two diagnose-only debug sessions + user decisions (no separate RESEARCH needed — root causes are code-evidenced)

<domain>
## Phase Boundary

Post-launch performance/caching fix phase (v1.0.2). APPLIES the recommended fixes from two completed diagnose-only debug sessions. This is a fix phase, not greenfield — every item below has a diagnosed root cause with file:line evidence in the debug docs.

**In scope:** image-generation persistence, discovery response caching/coalescing, recipe-list rendering efficiency, discovery batch sizing, prompt caching, and removing the source-type corner badge.

**Out of scope:** new features, the v1.1 household-sharing work, recipe enrichment (999.2), and any redesign. No new screens.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### 1. Image P0 — persist generated hero URL back to DB (HIGHEST IMPACT)
- The `/generate-image` route currently returns a URL but never writes it to the `recipes` row. Generated URLs live only in client AsyncStorage + content-addressed Supabase Storage, so every cold start / new device / cache clear re-fires `POST /generate-image` for every imageless recipe.
- **Decision:** Extend `POST /generate-image` to accept an optional `recipeId`. On a resolved URL, `UPDATE recipes SET image_url = $url WHERE id = $recipeId AND profile_id = $uid`. Keep AsyncStorage for unsaved "Something New" previews (no recipeId yet).
- Result: after first generation, `recipe.image_url` is set → `RecipeCard` passes `skip=true` → zero generate-image requests on later cold starts.
- Evidence: `.planning/debug/perf-recipe-load-image-caching.md` (P0).

### 2. Discovery RC1 — server response cache + in-flight coalescing
- The discovery path (`routes/recipes.ts` `/search` + `/discover` → `recipeDiscovery.ts discoverRecipes()`) always makes a fresh blocking AI call. No cache, no coalescing.
- **Decision:** Add an in-memory LRU response cache, TTL ~10–15 min, keyed on `sha256(userId/prefs + normalized query + pantryOnly + sorted pantry manifest + count)`. Exclude exclude-titles from the base key so the initial load is cacheable. Add in-flight coalescing via `Map<key, Promise>` so concurrent identical requests await one upstream call. Mirror the content-addressed pattern already in `recipeImageGen.ts`.
- Evidence: `.planning/debug/perf-ai-suggestions-latency.md` (RC1, Fix 1 + Fix 2).

### 3. Image P1 — FlatList windowing + viewport-gated fan-out
- The Recipe Box FlatList has no windowing props (default windowSize=21 mounts far more than visible), and the `MAX_CONCURRENT=2` limiter serializes but doesn't bound total fan-out; off-screen cards still request images.
- **Decision:** Add `initialNumToRender={6}`, `maxToRenderPerBatch={6}`, `windowSize={5}`, `removeClippedSubviews` to the Recipe Box FlatList in `kitchen.tsx`. Optionally thread a viewport-gated `enabled` flag into `useGeneratedRecipeImage` so off-screen cards don't request.
- Evidence: `perf-recipe-load-image-caching.md` (P1).

### 4. Image P2 — memoize RecipeCard
- `RecipeCard` is a plain function with an inline `renderItem` closure → any parent re-render re-renders all mounted cards.
- **Decision:** `React.memo(RecipeCard)` + `useCallback` the `renderItem` in `kitchen.tsx`.
- Evidence: `perf-recipe-load-image-caching.md` (P2).

### 5. Discovery RC2/RC3/RC4 — batch sizing, observable retry, mount guard
- One large blocking non-streaming call (~6 recipes, `maxTokens: 8192`) + a silent full-call retry on `MALFORMED_FUNCTION_CALL`; `discover.tsx` re-fires a full AI discover on every mount.
- **Decision:** Shrink the initial discovery batch 6→3 (`recipeDiscovery.ts`) and lazy-append the rest via the existing load-more path. Make the silent Gemini `MALFORMED_FUNCTION_CALL` retry observable (log/telemetry). Guard the `discover.tsx` mount fetch (~line 116-118) so it reuses persisted results instead of re-firing on every mount.
- Evidence: `perf-ai-suggestions-latency.md` (RC2, RC3, Fix 4, Fix 5).

### 6. Prompt caching on the static discovery prompt/tools
- **Decision:** Apply Anthropic `cache_control: ephemeral` on the static system prompt + tool schema in `anthropicAdapter.ts`, and Gemini `cachedContent` in `geminiAdapter.ts`, where the static prefix clears each provider's min-token threshold. (Note: the Kitchen "Something New" hot path is Gemini Flash, not Claude — apply where it pays off.)
- Evidence: `perf-ai-suggestions-latency.md` (Fix 3).

### 7. UI — remove the source-type corner badge entirely
- `RecipeCard.tsx` renders a top-left source-type badge (`SOURCE_LABELS = {url:'URL', ai:'AI', …}`), which falls back to "AI" when no `cuisineLabel` is passed (the Something New path passes none).
- **Decision (user, explicit):** Remove the source-type badge for ALL recipes — drop the top-left corner label and its `SOURCE_LABELS` usage entirely. No AI/URL/cuisine corner label at all. There is no legal/App-Store requirement to label AI images.

### Claude's Discretion
- Exact LRU implementation/library vs hand-rolled Map+timestamp (match existing server patterns).
- Cache key hashing helper location.
- Whether to add the optional viewport `enabled` flag now or rely on FlatList windowing alone.
- Telemetry mechanism for the retry counter (reuse existing `wrapWithTelemetry` if a `userId` is in context).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diagnosis (source of truth for root causes + recommended fixes)
- `.planning/debug/perf-recipe-load-image-caching.md` — image load/caching root causes (P0–P3) with file:line.
- `.planning/debug/perf-ai-suggestions-latency.md` — discovery latency root causes (RC1–RC4) with file:line.
- `.planning/debug/recipe-slow-load-missing-steps.md` — prior partial fixes already applied (concurrency limiter, refetch-dep, auto-seed); do not redo.

### Code touch points (verify current state before editing)
- `packages/server/src/routes/recipes.ts` — `/generate-image`, `/search`, `/discover` handlers.
- `packages/server/src/ai/recipeDiscovery.ts` — `discoverRecipes()`, batch size, retry.
- `packages/server/src/ai/recipeImageGen.ts` — content-addressed cache pattern to mirror; `cachedUrlIfExists` Storage probe.
- `packages/server/src/ai/anthropicAdapter.ts`, `geminiAdapter.ts` — prompt caching.
- `apps/mobile/src/hooks/useGeneratedRecipeImage.ts` — client image hook + inflight pattern.
- `apps/mobile/src/app/(tabs)/kitchen.tsx` — Recipe Box FlatList + renderItem.
- `apps/mobile/src/components/recipes/RecipeCard.tsx` — source-type badge to remove.
- `apps/mobile/src/app/recipes/discover.tsx` — mount-fetch guard.
</canonical_refs>

<specifics>
## Specific Ideas

- Mirror `recipeImageGen.ts` content-addressed caching for the discovery cache to keep one pattern.
- The two highest-leverage items (decision 1 and decision 2) should land first / be independently verifiable.
- Image P0 likely needs a DB write path that respects RLS (`profile_id = auth.uid()`); confirm the `recipes` UPDATE policy exists.
</specifics>

<deferred>
## Deferred / Optional (do only if cheap; otherwise next patch)

- P3: avoid the Supabase Storage `list()` probe on cache hit in `recipeImageGen.ts`.
- `getRecipes` column trim (exclude `steps`/`step_image_urls` JSONB from the list query; keep `ingredients`).
- `recyclingKey={recipe.id}` on the expo-image cell (UX polish).
- Collapse `/search` + `/discover` into one handler to give caching a single choke point.
</deferred>

---

*Phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions*
*Context gathered: 2026-06-08 from debug sessions + user decisions*
