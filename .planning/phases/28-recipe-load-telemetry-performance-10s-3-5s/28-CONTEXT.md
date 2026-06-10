# Phase 28: Recipe-load telemetry + performance — Context

**Gathered:** 2026-06-09
**Status:** Ready for planning
**Source:** User report (~10s recipe load, target 3-5s) + a thorough read-only Explore trace of the load path & telemetry infra + user decisions.

<domain>
## Phase Boundary

Cut Recipe Box cold-load perceived time from ~10s to 3-5s. Two threads, ONE phase (user chose "telemetry + known wins together"):
1. **Instrument** the recipe-load critical path by lighting up the EXISTING dormant telemetry plumbing (no new deps) so we get real p50/p95 numbers.
2. **Ship the high-confidence wins** the trace already identified: stop the list from generating images on the critical path, trim the getRecipes payload, paginate.

Then deploy + measure with the new telemetry to confirm we land at 3-5s.

**Out of scope:** Sentry Performance tracing (user chose the dormant-plumbing sink, not Sentry spans — do NOT wire Sentry transactions this phase), new screens, redesign, the v1.1 household work.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Telemetry sink: light up the existing dormant plumbing (NOT Sentry tracing)
All the timing plumbing already exists with zero call sites — wire it to the recipe path:
- `apps/mobile/src/lib/perfBudgets.ts` — `withBudget(name, budgetMs, fn)` exists, unused. Define a new `RECIPE_LOAD_MS` budget and wrap the fetch.
- `apps/mobile/src/ai/telemetry.ts` — `logAiEvent` batched client (POSTs to `/api/v1/telemetry/ai`), zero call sites. Use it for per-image time-to-visible events.
- `supabase/migrations/00027_ai_events.sql` — `ai_events` table already exists; `packages/server/src/ai/aiTelemetry.ts recordAiCall` is the ready sink.
- `packages/server/src/middleware/requestLogging.ts` — emits one JSON line with total `latency_ms`; add sub-stage fields.

### T1 — Server: sub-stage timing on GET /recipes
Add to the request log (or a structured log line) for the list fetch: DB query ms, row count, and payload bytes. Seam: `packages/server/src/routes/recipes.ts` GET '/' handler + `packages/server/src/services/recipeStore.ts getRecipes` (lines ~133-156). Confirms whether SELECT * / no-limit is a real cost.

### T2 — Server: time POST /generate-image
Record cache-hit vs miss and Gemini generation ms. Seam: `packages/server/src/services/recipeImageGen.ts` (~348-354: time `cachedUrlIfExists`, `generateBytes`, `uploadAndPublicUrl`). Image gen bypasses `getClientFor`, so call `recordAiCall` directly (it accepts latency_ms in payload). This quantifies the suspected dominant cost.

### T3 — Client: recipe.fetch budget + per-image time-to-visible
- Wrap `fetchRecipes` round-trip in `withBudget('recipe.fetch', RECIPE_LOAD_MS, ...)` at `apps/mobile/src/stores/recipeStore.ts:254-260` (include the `getAuthToken`/`getSession` pre-flight — the trace flagged it as an unmeasured pre-flight that may trigger token refresh).
- Per-image: record hook-mount → resolved in `apps/mobile/src/hooks/useGeneratedRecipeImage.ts` (~290-303) and/or RecipeCard expo-image `onLoad`, emit via `logAiEvent`. Capture cache-hit vs cold-gen and queue wait (the MAX_CONCURRENT=2 limiter at ~57-91 is a natural place for queue-depth/wait).

### O1 — getRecipes: explicit lightweight column list + pagination (known win)
- `getRecipes` (`recipeStore.ts:138-149`) currently `.select()` = SELECT *, shipping full `steps`, `step_image_urls`, `ingredients` JSONB for the whole library. The list UI (RecipeCard) needs only: id, title, description, prep/cook/total time, servings, nutrition columns, labels, image_url, is_favorite, source_type, created_at.
- Decision: select an EXPLICIT lightweight column set for the LIST query — drop `steps` and `step_image_urls`. **Careful with `ingredients`:** `useGeneratedRecipeImage` uses `ingredients` for cold image-gen context, but that path is `skip:true` once `image_url` is set (which O3 makes the norm). Planner must resolve: either keep a trimmed `ingredients` or accept that cold-gen (rare after O3) fetches full data. Recipe DETAIL screen must still load full data (steps/ingredients) on open — verify the detail fetch path uses getRecipeById (full select), not the list payload.
- Add pagination/LIMIT to the list query (e.g. page size ~20-30) with the existing list supporting incremental load. Do not break offline AsyncStorage cache behavior.

### O2 — generate-on-save (stop the list generating images)
The real win: recipes should NEVER trigger generation on the Recipe Box critical path. When a recipe is SAVED (AI discovery save, seed-baseline, manual), populate `image_url` server-side at save time (generate + persist, or enqueue) so the row is never null by the time the list loads. Seam: the save path in `packages/server/src/routes/recipes.ts` (saveRecipe) + seed-baseline. Reuse the content-addressed `recipeImageGen` cache so this is cheap/idempotent.

### O3 — backfill legacy null-image_url rows
Provide a backfill path (admin endpoint or script) that generates + persists `image_url` for existing recipes where it's null, so current users' libraries stop cold-generating on the list. This is the one-time complement to O2. Idempotent (content-addressed cache means re-runs are cheap). Patrick triggers it; do not auto-run on every boot.

### Claude's Discretion
- Exact column list for the list query (verify against RecipeCard's actual field usage).
- Pagination mechanism (offset/limit vs keyset) and page size; how the mobile list requests more.
- Whether generate-on-save is synchronous (blocks save briefly) or fire-and-forget after save returns — prefer not blocking the save UX; fire-and-forget + write-back is acceptable since the write-back path (27-01) already persists.
- Backfill as a protected admin route vs a one-off script run against prod.
- ai_events payload shape for the new event types (reuse existing columns).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Diagnosis / trace (source of truth for the load path)
- The Explore trace in this phase's planning (critical path + telemetry inventory) — summarized in the decisions above with file:line.
- `.planning/debug/perf-recipe-load-image-caching.md` — prior image diagnosis.
- `.planning/phases/27-.../27-01-SUMMARY.md` — the image_url write-back already shipped (generate-image persists when recipeId passed); O2/O3 build on it.

### Code touch points (verify current state before editing)
- `apps/mobile/src/app/(tabs)/kitchen.tsx` — Recipe Box FlatList, fetchRecipes effect (~385-389), windowing props already added in 27-02.
- `apps/mobile/src/stores/recipeStore.ts` — fetchRecipes (~244-283), getAuthToken (~44-50), persist/partialize (~432-437).
- `apps/mobile/src/hooks/useGeneratedRecipeImage.ts` — image hook, MAX_CONCURRENT limiter (~57-91), resolution (~290-303).
- `apps/mobile/src/components/recipes/RecipeCard.tsx` — field usage (which recipe fields the card actually renders → defines the list column set).
- `apps/mobile/src/lib/perfBudgets.ts` — withBudget (unused).
- `apps/mobile/src/ai/telemetry.ts` — logAiEvent client (unused).
- `packages/server/src/routes/recipes.ts` — GET '/' (list), POST /generate-image (~574-653), saveRecipe path, /telemetry router.
- `packages/server/src/services/recipeStore.ts` — getRecipes (~133-156, the SELECT *), getRecipeById (full select for detail).
- `packages/server/src/services/recipeImageGen.ts` — generateRecipeImage (~332-355), content-addressed cache.
- `packages/server/src/ai/aiTelemetry.ts` — recordAiCall sink; `supabase/migrations/00027_ai_events.sql` — ai_events table.
- `packages/server/src/middleware/requestLogging.ts` — request logger (total latency_ms).
</canonical_refs>

<specifics>
## Specific Ideas

- Likely dominant cost = cold Gemini image generation 2-at-a-time; the highest-leverage fix is O2+O3 (image_url always populated before the list loads). Telemetry (T2) confirms this with real numbers.
- This phase ENDS with deploy + measure: after code lands, deploy to Fly + (if needed) EAS build, then read the new telemetry on a cold load to confirm 3-5s. Verification is partly data-driven and human-gated (needs the running app).
- IMPORTANT build-version caveat: Phase 27 mobile fixes only reach the device in EAS build #24+ (in TestFlight processing). Measurements must be taken on a build that includes Phase 27 + Phase 28, or the numbers won't reflect the fixes.
</specifics>

<deferred>
## Deferred / Optional

- Sentry Performance tracing / spans (user explicitly chose the dormant-plumbing sink instead).
- Image CDN/transform/resizing, prefetch-next-screen, keyset pagination tuning — revisit only if telemetry shows residual cost after O1-O3.
- Collapsing the always-mounted dual-segment lists in kitchen.tsx (both Recipe Box + Something New mount via display:none) — note as a possible follow-up if the trace shows the hidden list costs anything.
</deferred>

---

*Phase: 28-recipe-load-telemetry-performance-10s-3-5s*
*Context gathered: 2026-06-09 from Explore trace + user decisions*
