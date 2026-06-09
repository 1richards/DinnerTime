---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
plan: 03
subsystem: performance
tags: [ai, gemini, discovery, caching, coalescing, latency, hono, sha256]

# Dependency graph
requires:
  - phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
    plan: 01
    provides: POST /generate-image image_url write-back in routes/recipes.ts (preserved, not modified)
  - phase: 06-recipe-library
    provides: recipeDiscovery service + POST /discover + POST /recipes/search call sites
provides:
  - Server-side TTL'd LRU discovery response cache (12-min) keyed on sha256(user + normalized query + pantryOnly + sorted pantry manifest + count)
  - In-flight request coalescing (Map<key, Promise>) collapsing concurrent identical discovery calls to one upstream AI call
  - /search and /discover wired through getOrComputeDiscovery; load-more bypasses the base cache
affects: [performance, ai-suggestions, recipe-discovery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-addressed sha256 cache key mirroring recipeImageGen.ts (one hashing convention server-wide)"
    - "Single-flight coalescing via Map<key, Promise> with finally-cleanup of the in-flight entry"
    - "Injectable nowMs clock so TTL-expiry is tested without real timers"

key-files:
  created:
    - packages/server/src/services/discoveryCache.ts
    - packages/server/src/services/__tests__/discoveryCache.test.ts
  modified:
    - packages/server/src/routes/recipes.ts
    - packages/server/src/routes/__tests__/recipes.search.test.ts
    - packages/server/src/routes/__tests__/recipes.discover.test.ts

key-decisions:
  - "excludeTitles deliberately excluded from the cache key so the canonical initial (excludeTitles-free) load is cacheable; load-more passes cacheable:false to stay novel"
  - "Hand-rolled insertion-ordered Map (LRU touch via delete+set) + 12-min TTL + 200-entry soft cap — no new dependency, matches existing server patterns (CONTEXT Claude's Discretion)"
  - "Route tests reset the module-scoped cache in beforeEach via exported __resetDiscoveryCache so identical-key requests still exercise the discoverRecipes mock"

patterns-established:
  - "discoveryCacheKey + getOrComputeDiscovery as the single choke point for cacheable AI discovery calls"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-06-09
---

# Phase 27 Plan 03: Discovery response cache + in-flight coalescing Summary

**Added a server-side 12-min TTL'd LRU discovery response cache plus single-flight coalescing (sha256-keyed on user + normalized query + pantryOnly + sorted pantry manifest + count, excludeTitles excluded), and wired both /search and /discover through it so a repeat identical request returns in DB-time and concurrent identical requests collapse to one Gemini call.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-06-09T04:36:56Z
- **Completed:** 2026-06-09T04:40:30Z
- **Tasks:** 2
- **Files created:** 2 / **modified:** 3

## Accomplishments
- `discoveryCache.ts` — `discoveryCacheKey()` builds a sha256 content signature over `userId + trim/lowercase(prompt) + pantryOnly + sorted(pantryManifest) + count`, deliberately excluding `excludeTitles` so the initial load is cacheable. `getOrComputeDiscovery()` provides a 12-min TTL'd, insertion-ordered LRU (200-entry soft cap, LRU touch via delete+set) plus `Map<key, Promise>` coalescing; `cacheable:false` (load-more) bypasses read/write/coalesce; `nowMs` is injectable for deterministic TTL tests; `__resetDiscoveryCache()` clears both maps for tests.
- `routes/recipes.ts` — `/search` builds the key and wraps `discoverRecipes()` via `getOrComputeDiscovery`, passing `cacheable: !isLoadMore` (load-more = forced `count` AND non-empty `excludeTitles`). `/discover` caches the canonical zero-input library discovery. 27-01's `/generate-image` `update({ image_url: url })` write-back was left untouched.
- Tests — 6 cache unit tests (key stability/order-insensitivity, excludeTitles exclusion, cache hit, TTL expiry via fake clock, coalescing computes once, load-more bypass) and the existing `/search` + `/discover` route suites all green (35 tests across the 4 plan suites).

## Task Commits

Each task was committed atomically to `main`:

1. **Task 1 (RED): failing cache tests** - `cce5cc4` (test)
2. **Task 1 (GREEN): discoveryCache.ts service** - `871bad8` (feat)
3. **Task 2: wire /search + /discover through getOrComputeDiscovery** - `c75d276` (feat)

## Files Created/Modified
- `packages/server/src/services/discoveryCache.ts` (created) - `discoveryCacheKey`, `getOrComputeDiscovery`, `DISCOVERY_CACHE_TTL_MS`, `__resetDiscoveryCache`.
- `packages/server/src/services/__tests__/discoveryCache.test.ts` (created) - 6 tests covering key/cache/TTL/coalescing/load-more.
- `packages/server/src/routes/recipes.ts` (modified) - import + cache-wrapped `/search` and `/discover`; 27-01 write-back preserved.
- `packages/server/src/routes/__tests__/recipes.search.test.ts` (modified) - import `__resetDiscoveryCache`, reset in `beforeEach`.
- `packages/server/src/routes/__tests__/recipes.discover.test.ts` (modified) - import `__resetDiscoveryCache`, reset in `beforeEach`.

## Decisions Made
- **excludeTitles excluded from the key:** the initial load and a re-trigger differ only in not-yet-saved on-screen titles; folding them into the key would make the canonical first load uncacheable. Load-more requests pass `cacheable:false`.
- **Hand-rolled Map over a library:** TTL + insertion-order LRU + soft cap is a few lines and adds no dependency, matching the `recipeImageGen.ts` content-addressed convention (CONTEXT Claude's Discretion).
- **Reset cache in route tests:** the cache is module-scoped and shared across a file's tests; without a `beforeEach` reset, an identical-key request from a prior test would return a cached value and skip the `discoverRecipes` mock, breaking `toHaveBeenCalledOnce()`. The plan-exported `__resetDiscoveryCache()` is called per test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `__resetDiscoveryCache()` to both route test `beforeEach` hooks**
- **Found during:** Task 2 (wiring the module-scoped cache into the routes)
- **Issue:** The two existing route suites fire multiple identical-key requests (e.g. `/discover` with empty body → same key) and assert `toHaveBeenCalledOnce()`. With a shared module-scoped cache, the 2nd+ request would hit the cache and never call the `discoverRecipes` mock, failing those assertions.
- **Fix:** Imported the plan-provided `__resetDiscoveryCache` in both `recipes.search.test.ts` and `recipes.discover.test.ts` and called it in `beforeEach`. No production behavior change; test-only hygiene the plan anticipated by exporting the helper.
- **Files modified:** `packages/server/src/routes/__tests__/recipes.search.test.ts`, `packages/server/src/routes/__tests__/recipes.discover.test.ts`
- **Commit:** `c75d276`

## Issues Encountered
- `tsc --noEmit` reports 62 errors in `routes/recipes.ts` vs 60 at baseline. The +2 are `user.id` accesses where `c.get('user')` is typed `unknown` — the file's pre-existing untyped-Hono-context convention (every existing `user.id`/`supabase` use errors identically). Not introduced by the cache logic; `discoveryCache.ts` itself typechecks clean. The project's actual gate (vitest) is green.
- Pre-existing baseline: a full `pnpm vitest run` shows route/integration suites failing with `ECONNREFUSED 127.0.0.1:3000` (no live server this session). Environment-bound, unrelated to this plan — distinguished from the real unit suites, which all pass.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 27-03 owns `discoveryCache.ts` + the discovery call-site wrapping in `routes/recipes.ts`; 27-01's `/generate-image` write-back in the same file is preserved.
- Remaining incomplete plan: 27-05.

## Self-Check: PASSED

---
*Phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions*
*Completed: 2026-06-09*
