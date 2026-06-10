---
phase: 29-something-new-lightweight-first-generation-29s-3-5s
plan: 03
subsystem: mobile-client
tags: [hydration, background-fill, throttle-limiter, zustand-persist, async-storage, telemetry, perf-budget]

# Dependency graph
requires:
  - phase: 29-something-new-lightweight-first-generation-29s-3-5s
    plan: 01
    provides: "light /search previews ({title, description, times, difficulty, nutrition, ingredient_names}) — the hydrate input shape"
  - phase: 29-something-new-lightweight-first-generation-29s-3-5s
    plan: 02
    provides: "POST /api/v1/recipes/hydrate → { data: { ingredients, steps, calories_per_serving, protein_grams_per_serving, servings } }"
  - phase: 27-performance-caching
    provides: "useGeneratedRecipeImage limiter+cache pattern mirrored by the hydration hook"
provides:
  - "useHydratedRecipeContent(preview) — background content hydration hook mirroring useGeneratedRecipeImage (Map cache + MAX_CONCURRENT=2 FIFO limiter + AsyncStorage + inflight coalescing); returns { ingredients, steps, status }"
  - "prefetchHydration(preview) — fire-and-forget that RETURNS the inflight promise so the store can await+patch per index"
  - "hydrationStatusFor(preview) — sync status read ('loading'|'resolved'|'failed'|'idle') for Plan 29-04 Save/Cook gating"
  - "suggestionsStore: light:true on search+append, withBudget('suggestions.search') wrap, background-hydrate-all patching searchResults[i], rehydrateUnhydrated + onRehydrateStorage (D7)"
  - "SUGGESTIONS_SEARCH_MS=5000 perf budget"
affects: [29-04-deploy-measure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mirror-the-proven-hook: useHydratedRecipeContent is a near-verbatim copy of useGeneratedRecipeImage (Map<key,{content,inflight,attempted}> cache, MAX_CONCURRENT=2 acquireSlot/releaseSlot FIFO limiter, hydrateFromStorage/persistToStorage, hydrationListeners) — only the payload (content vs image url) differs"
    - "prefetchHydration returns the inflight promise (the image prefetch is void) so the store awaits per-card and patches searchResults[i] by title — the one intentional divergence from the image template, mandated by the plan"
    - "onRehydrateStorage → setTimeout(0) → rehydrateUnhydrated: defer D7 self-heal to next tick so the store + hook module are initialized before get() is read"

key-files:
  created:
    - apps/mobile/src/hooks/useHydratedRecipeContent.ts
    - apps/mobile/src/hooks/__tests__/useHydratedRecipeContent.test.ts
  modified:
    - apps/mobile/src/stores/suggestionsStore.ts
    - apps/mobile/src/stores/__tests__/suggestionsStore.test.ts
    - apps/mobile/src/lib/perfBudgets.ts

key-decisions:
  - "prefetchHydration RETURNS the inflight promise (vs void in prefetchGeneratedRecipeImage) so the store can await per-index and patch searchResults[i] without polling — the plan's 'SIMPLEST robust approach'"
  - "hydrateAll matches previews to grid rows by title (Something New titles are unique) — no index coupling, survives reordering/appends"
  - "D7 implemented as option (a): re-trigger hydration on rehydrate for any persisted preview with empty ingredients OR steps (isUnhydrated), via onRehydrateStorage → rehydrateUnhydrated"
  - "Store test mocks the hydration hook module (prefetchHydration/hydrationStatusFor) + spies withBudget (pass-through) — deterministic, no real /hydrate fetch or limiter timing in the store suite"

patterns-established:
  - "A returns-the-inflight-promise prefetch variant of the image-prefetch pattern, letting a store await+patch the resolved payload per item"

requirements-completed: [D4, D7, D8-client]

# Metrics
duration: 6min
completed: 2026-06-09
---

# Phase 29 Plan 03: Client background hydration Summary

**`useHydratedRecipeContent` mirrors `useGeneratedRecipeImage` exactly (module Map cache + MAX_CONCURRENT=2 FIFO limiter + AsyncStorage + inflight coalescing) and POSTs each light "Something New" preview to `/recipes/hydrate`; `suggestionsStore` now sends `light:true`, measures the `/search` round-trip with `withBudget('suggestions.search', 5000)`, background-hydrates every preview (throttled 2-at-a-time) patching `searchResults[i]` ingredients+steps as each lands, and self-heals persisted empty previews on rehydrate (D7) — the user-visible win: instant cards in 3-5s that fill in.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2 (both TDD: RED → GREEN, no REFACTOR needed)
- **Files created:** 2, **modified:** 3
- **Tests:** 24/24 green across the 3 plan suites (5 hook + 15 store + 4 persist)

## Accomplishments

- **`useHydratedRecipeContent.ts` (D4)** — verbatim mirror of `useGeneratedRecipeImage`: module-level `cache = new Map<string, { content, inflight, attempted }>`, the `MAX_CONCURRENT = 2` / `acquireSlot` / `releaseSlot` / `_waitQueue` FIFO limiter, `fetchHydratedThrottled` wrapping the POST to `/api/v1/recipes/hydrate`, `STORAGE_KEY = 'dinnertime-hydration-cache'` with `hydrateFromStorage`/`persistToStorage` (persists ONLY resolved entries; failures retry next session), `hydrationListeners` + `hydrated` flag, and the `useHydratedRecipeContent(preview)` hook with the same evaluate() state machine returning `{ ingredients, steps, status }`. Cache key = `norm(title)#sorted(ingredient_names)` (mirrors the server's content-address key so client/server collide on the same preview).
- **`prefetchHydration` + `hydrationStatusFor` exports** — `prefetchHydration` is the image-prefetch analog but RETURNS the inflight `Promise<HydratedContent | null>` (the store awaits it to patch per index); no-op-cached (resolved/inflight/failed reuse the existing entry → coalescing). `hydrationStatusFor` reads the module cache synchronously for Plan 29-04 Save/Cook gating.
- **`emitHydrationEvent` (D8-client)** — `logAiEvent({ name: 'recipe.hydrate.visible', session_id: 'something-new', task_name: 'recipe.hydrate', model: 'gemini-flash', payload: sanitizePayload({ ms, success }) })` — ms + success only (PII guard), modeled on `emitImageEvent`.
- **`suggestionsStore` wiring (D4 + D7 + D8)** — `searchRecipes` and `appendSearchResults` add `light: true` to the body; the `/search` fetch is wrapped in `withBudget('suggestions.search', SUGGESTIONS_SEARCH_MS, () => fetch(...))`. After results are set, `hydrateAll(previews, set)` background-hydrates each via `prefetchHydration(previewFrom(r))` and patches the matching `searchResults` row (by title) with `ingredients`/`steps`/nutrition. `rehydrateUnhydrated` + the persist `onRehydrateStorage` callback re-trigger hydration (next tick) for any persisted preview with empty ingredients OR steps (D7).
- **`SUGGESTIONS_SEARCH_MS = 5000`** added to `perfBudgets.ts` with a doc comment mirroring `RECIPE_LOAD_MS`'s style (5s = upper bound of the 3-5s target band).

## Task Commits

Each task committed atomically (TDD: test → feat), normal `git commit` to `main`:

1. **Task 1 RED: failing test for useHydratedRecipeContent** — `3ae9ac8` (test)
2. **Task 1 GREEN: useHydratedRecipeContent hydration hook (D4)** — `cc0d365` (feat)
3. **Task 2 RED: failing tests for light-mode + hydration store wiring** — `9c2452f` (test, includes SUGGESTIONS_SEARCH_MS as a test fixture dependency)
4. **Task 2 GREEN: suggestionsStore light-mode + background hydration (D4+D7+D8)** — `d12c513` (feat)

_No REFACTOR commits — implementation was clean as written._

## Files Created/Modified

- `apps/mobile/src/hooks/useHydratedRecipeContent.ts` (created) — `HydratePreview`/`HydratedContent` types, the hook, `prefetchHydration`, `hydrationStatusFor`, `MAX_CONCURRENT`, `__resetHydrationCacheForTests`, `emitHydrationEvent`.
- `apps/mobile/src/hooks/__tests__/useHydratedRecipeContent.test.ts` (created) — module-surface coverage: MAX_CONCURRENT===2; resolve→'resolved' with ingredients/steps; duplicate prefetch → fetch once (coalescing); limiter caps concurrent fetches at 2; failed→'failed' and NOT persisted.
- `apps/mobile/src/stores/suggestionsStore.ts` (modified) — `previewFrom`/`isUnhydrated`/`hydrateAll` helpers, `light:true` + `withBudget` wrap on search/append, `void hydrateAll(...)` after results land, `rehydrateUnhydrated` action, `onRehydrateStorage` persist callback.
- `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts` (modified) — mocks hydration hook + spies withBudget; new block asserts light:true (search+append), withBudget wrap, per-index patch, D7 rehydrate.
- `apps/mobile/src/lib/perfBudgets.ts` (modified) — `export const SUGGESTIONS_SEARCH_MS = 5000`.

## Decisions Made

- **prefetchHydration returns the inflight promise** — the image prefetch is `void`; here the store needs the resolved `{ ingredients, steps }` to patch `searchResults[i]`. The plan flagged this as the "SIMPLEST robust approach" (await per-index, patch) over polling the cache.
- **Patch by title, not index** — Something New titles are unique; matching `x.title === r.title` decouples the patch from grid order so it survives appends/reorders.
- **D7 = re-trigger on rehydrate (option a)** — `isUnhydrated` = empty ingredients OR empty steps; `onRehydrateStorage` defers `rehydrateUnhydrated` to `setTimeout(0)` so the store + hook module are initialized before `get()` runs.
- **Store test mocks the hook module** — deterministic store-level assertions without the real `/hydrate` fetch or limiter timing; the limiter/coalescing itself is covered in the hook suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test timing] Hydration-hook limiter/coalescing tests needed a macrotask tick**
- **Found during:** Task 1 GREEN
- **Issue:** `fetchHydrated` awaits `getAuthToken()` (a real microtask) before incrementing the limiter's in-flight count / firing `fetch`. The first draft of the coalescing + limiter tests asserted after only `await Promise.resolve()` ticks, so the captured fetch hadn't fired yet (coalescing test timed out; limiter saw `active===0`).
- **Fix:** Awaited `setTimeout(0)` (a macrotask) before resolving/asserting in those two tests. No implementation change — the limiter and coalescing logic were correct; only the test's tick accounting was off.
- **Files modified:** apps/mobile/src/hooks/__tests__/useHydratedRecipeContent.test.ts
- **Committed in:** cc0d365 (Task 1 GREEN)

## Issues Encountered

None beyond the test-timing fix above. `tsc --noEmit` reports no errors in any touched file.

## Known Stubs

None. The hook fills the exact `{ ingredients, steps, nutrition }` the light preview lacks; the store patches them onto the grid and self-heals persisted empties (D7). No placeholder/empty-data paths are introduced — the temporary empty state IS the design (light preview pre-hydration), and Plan 29-04 gates Save/Cook on `hydrationStatusFor` until resolved.

## User Setup Required

None — no external service configuration. Uses the existing `/api/v1/recipes/hydrate` endpoint provisioned in 29-02.

## Next Phase Readiness

- The client background-fill is wired: cards render from light previews, ingredients+steps fill in 2-at-a-time, and persisted empties self-heal on relaunch.
- Plan 29-04 wires Save/Cook/Favorite gating on `hydrationStatusFor(preview) === 'resolved'` (D5) in `SomethingNewResults.tsx`, deploys (Fly + EAS), and measures the 29s → 3-5s win via the `suggestions.search` budget + `recipe.hydrate.visible` events.

## Self-Check: PASSED

All created/modified files present; all 4 task commits (3ae9ac8, cc0d365, 9c2452f, d12c513) verified in git history. 24/24 plan tests green; no tsc errors in touched files.

---
*Phase: 29-something-new-lightweight-first-generation-29s-3-5s*
*Completed: 2026-06-09*
