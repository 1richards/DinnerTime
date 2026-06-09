---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
plan: 04
subsystem: performance
tags: [ai, gemini, discovery, caching, latency, expo, hono]

# Dependency graph
requires:
  - phase: 11-hybrid-ai-client
    provides: GeminiAdapter with MALFORMED_FUNCTION_CALL retry-once behavior
  - phase: 06-recipe-library
    provides: recipeDiscovery service defaultCount + POST /discover + discover.tsx screen
provides:
  - Initial discovery batch shrunk 6 to 3 for ~2x faster first results (lazy-append remainder)
  - Observable Gemini MALFORMED_FUNCTION_CALL retry (warn log, no longer silent)
  - Module-scoped TTL cache on Discover screen to skip redundant mount-time AI calls
affects: [performance, ai-suggestions, recipe-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-scope (file-level) cache with TTL to survive React component remounts where useState resets"

key-files:
  created: []
  modified:
    - packages/server/src/services/recipeDiscovery.ts
    - packages/server/src/ai/adapters/geminiAdapter.ts
    - apps/mobile/src/app/recipes/discover.tsx

key-decisions:
  - "Discover mount-fetch guard lives at module scope (not component state) because `recipes` useState resets on unmount, making a recipes.length guard a no-op"
  - "Gemini retry observability is a console.warn (no logger imported in adapter); model + tool name only, no prompt/PII"
  - "Initial discovery floor reduced 6 to 3; explicit-count load-more path left authoritative and untouched"

patterns-established:
  - "Module-scoped TTL cache (`let discoverCache` + DISCOVER_CACHE_TTL_MS) for AI results that must survive screen remounts"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-06-08
---

# Phase 27 Plan 04: Performance & Caching Fixes (discovery batch, Gemini retry observability, Discover mount guard) Summary

**Initial discovery batch cut 6 to 3 for ~2x faster first results, Gemini MALFORMED_FUNCTION_CALL retry made observable via warn, and the legacy Discover screen now reuses a module-scoped 10-min TTL cache instead of re-firing a full AI call on every mount.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-08T21:32:00Z
- **Completed:** 2026-06-08T21:34:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- `recipeDiscovery.ts` defaultCount floor reduced from 6 to 3 (Decision 5 / Fix 4a) — first results land roughly twice as fast; remaining recipes lazy-append via the existing load-more path.
- `geminiAdapter.ts` first-attempt MALFORMED_FUNCTION_CALL retry now emits an observable `console.warn` with model + tool name (Decision 5 / Fix 4) — the "sometimes 2x slow" retry tail is measurable; second-attempt throw unchanged.
- `discover.tsx` mount fetch guarded by a module-scoped `discoverCache` with a 10-min TTL (Decision 5 / Fix 5) — reopening Discover within the TTL reuses the cached result instead of paying a fresh multi-second AI call; explicit refresh/regenerate still forces a fresh fetch and refreshes the cache.

## Task Commits

Each task was committed atomically to `main`:

1. **Task 1: Shrink initial discovery batch 6 to 3** - `31ffe60` (fix)
2. **Task 2: Make Gemini MALFORMED_FUNCTION_CALL retry observable** - `fad5e5d` (fix)
3. **Task 3: Guard Discover screen mount fetch with module-scoped TTL cache** - `20d31c7` (fix)

## Files Created/Modified
- `packages/server/src/services/recipeDiscovery.ts` - defaultCount floor 6 → 3 (`Math.max(3, cuisineCount + 2)`); explicit-count path unchanged.
- `packages/server/src/ai/adapters/geminiAdapter.ts` - `console.warn` on first-attempt retry inside the `attempt === 0` branch; recursion `callStructured<T>(opts, 1)` and second-attempt throw preserved.
- `apps/mobile/src/app/recipes/discover.tsx` - module-scope `discoverCache` + `DISCOVER_CACHE_TTL_MS`; cache populated on fetch success; mount `useEffect` reuses fresh cache before calling `fetchDiscover`.

## Decisions Made
- **Module-scope cache over component-state guard:** `recipes` is local `useState` that resets on unmount, so an `if (recipes.length > 0) return` guard is a no-op. The cache lives at module scope so it survives remounts (per plan Task 3 revision).
- **Warn over telemetry for retry observability:** no logger is imported in geminiAdapter; `wrapWithTelemetry` lives at the clientFactory layer (out of scope). A `console.warn` with model + tool name is the minimum observable signal Decision 5 requires, with no prompt/PII.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Full `pnpm vitest run` shows 76 failures across `__tests__/*.test.ts` (auth-stubs, pantry, recipes, meal-plans, ai, cooking) — all `connect ECONNREFUSED 127.0.0.1:3000`. These are integration/route tests that require a live server on port 3000, which is not running this session. They are pre-existing, environment-bound, and unrelated to this plan's changes. The unit suites this plan touches are green: `recipeDiscovery.test.ts` (16 passed) and the `src/ai` adapter suites (29 passed). No discovery/adapter regression.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 27-04 changes are independent of 27-03 (which owns discoveryCache.ts + routes/recipes.ts) — no file overlap.
- Remaining incomplete plans: 27-03, 27-05.

## Self-Check: PASSED

---
*Phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions*
*Completed: 2026-06-08*
