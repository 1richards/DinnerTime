---
phase: 28-recipe-load-telemetry-performance-10s-3-5s
plan: 01
subsystem: api
tags: [hono, supabase, telemetry, performance, postgrest, recipes]

# Dependency graph
requires:
  - phase: 27-*
    provides: image_url write-back (generate-image persists when recipeId passed)
provides:
  - GET /recipes sub-stage timing log (db_query_ms, row_count, payload_bytes) with request_id correlation
  - getRecipes returns { rows, queryMs, rowCount } instead of a bare array
  - RECIPE_LIST_COLUMNS — explicit lightweight list column set (drops steps + step_image_urls JSONB, keeps ingredients)
  - RECIPE_LIST_LIMIT=200 hard cap on the list query (load-all capped)
affects: [28-02, 28-03, recipe-detail-rehydration, mobile-recipeStore, telemetry-measurement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service returns timing metadata ({ rows, queryMs, rowCount }) so the route can emit sub-stage logs without re-timing"
    - "Route serializes the JSON body once, reports Buffer.byteLength as payload_bytes, and returns it via c.body to avoid double-stringify"
    - "Structured stage-scoped console.log line (stage='recipes.list') mirrors requestLogging.ts one-JSON-line convention + request_id correlation"

key-files:
  created: []
  modified:
    - packages/server/src/services/recipeStore.ts
    - packages/server/src/routes/recipes.ts
    - packages/server/src/services/__tests__/recipeStore.test.ts
    - packages/server/src/routes/__tests__/recipes.get.test.ts
    - packages/server/src/routes/__tests__/recipes.search.test.ts
    - packages/server/src/routes/__tests__/recipes.discover.test.ts

key-decisions:
  - "List query uses an explicit lightweight column set (RECIPE_LIST_COLUMNS) excluding steps + step_image_urls; ingredients retained for the image-gen fingerprint + detail fallback"
  - "LIMIT 200 (load-all capped, NOT incremental paging) so client-side search + offline cache over the full in-memory array stay intact"
  - "getRecipeById (detail) keeps its full untyped .select() so detail re-hydration returns full steps — untouched per correctness guard"

patterns-established:
  - "Sub-stage timing: service times only the DB round-trip; route logs db_query_ms + row_count + payload_bytes"
  - "Serialize-once-return-via-c.body to measure exact wire payload without a second stringify"

requirements-completed: [T1, O1]

# Metrics
duration: 3min
completed: 2026-06-09
---

# Phase 28 Plan 01: Recipe-load telemetry + payload trim Summary

**GET /recipes now emits a structured `recipes.list` log (db_query_ms, row_count, payload_bytes) and the list query selects an explicit lightweight column set (no steps/step_image_urls JSONB, ingredients kept) bounded by LIMIT 200.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-10T03:30:08Z
- **Completed:** 2026-06-10T03:33:06Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- T1: GET /recipes emits a structured sub-stage timing line (`stage: recipes.list`) with `db_query_ms`, `row_count`, `payload_bytes`, and `request_id` for correlation with the middleware's total-latency line.
- O1 (server half): `getRecipes` selects `RECIPE_LIST_COLUMNS` — drops the large `steps` + `step_image_urls` JSONB from the list path while keeping `ingredients` (image-gen fingerprint + detail fallback both depend on it).
- O1: `RECIPE_LIST_LIMIT = 200` hard cap bounds worst-case payload without breaking client-side search / offline cache (load-all capped, not paging).
- `getRecipes` return shape changed to `{ rows, queryMs, rowCount }`; the two internal callers (`/search`, `/discover`) updated to read `library.rows`.
- `getRecipeById` (detail) untouched — keeps its full `.select()` so the 28-03 detail re-hydration returns full steps.

## Task Commits

Each task was committed atomically:

1. **Task 1: getRecipes — explicit lightweight column set + LIMIT + timing** - `9d72d6b` (feat, TDD: RED assertions → GREEN impl in one commit)
2. **Task 2: GET /recipes sub-stage timing log + route wiring** - `6241ddb` (feat)

_TDD note: Task 1 RED was verified failing (3 assertions on undefined symbols) before implementing; committed as a single feat after GREEN since test + impl are tightly coupled in one file pair._

## Files Created/Modified
- `packages/server/src/services/recipeStore.ts` - Added `RECIPE_LIST_COLUMNS` + `RECIPE_LIST_LIMIT`; `getRecipes` selects the explicit column set, applies LIMIT, times the DB query, returns `{ rows, queryMs, rowCount }`.
- `packages/server/src/routes/recipes.ts` - GET / destructures the new shape, serializes once, logs `recipes.list`, returns byte-identical `{ data }` via `c.body`; `/search` + `/discover` read `library.rows`.
- `packages/server/src/services/__tests__/recipeStore.test.ts` - Assertions for `.select(RECIPE_LIST_COLUMNS)`, `.limit(200)`, column-set contents (excludes steps/step_image_urls, includes ingredients), and the `{ rows, queryMs, rowCount }` return.
- `packages/server/src/routes/__tests__/recipes.get.test.ts` - Mock returns the new shape; new test asserts `{ data }` body + a `recipes.list` log line with db_query_ms/row_count/payload_bytes.
- `packages/server/src/routes/__tests__/recipes.search.test.ts` - getRecipes mock updated to `{ rows, queryMs, rowCount }` shape.
- `packages/server/src/routes/__tests__/recipes.discover.test.ts` - getRecipes mock updated to `{ rows, queryMs, rowCount }` shape.

## Decisions Made
- None beyond the plan — column list, LIMIT value (200), and return shape were all specified in the plan and followed exactly.

## Deviations from Plan

None - plan executed exactly as written.

The only adjustment beyond the two named test files was updating the `getRecipes` mocks in `recipes.search.test.ts` and `recipes.discover.test.ts` to the new `{ rows, queryMs, rowCount }` shape — this was explicitly anticipated by Task 1's action note ("/search and /discover ... MUST be updated to read .rows") and Task 2's verify step (which runs both suites). Not a deviation; the plan already scoped these callers.

## Issues Encountered
None.

## Test Results
- Targeted suites: `recipeStore.test.ts`, `recipes.get.test.ts`, `recipes.search.test.ts`, `recipes.discover.test.ts` — **31 passed**.
- Full server suite: 724 passed / 16 skipped / 76 failed. All 76 failures are the **pre-existing `ECONNREFUSED 127.0.0.1:3000` baseline** — the root `__tests__/*.test.ts` integration tests require a live server on :3000 (not running in this execution). Confirmed `__tests__/recipes.test.ts` failures are exclusively `fetch failed / ECONNREFUSED`, NOT regressions from this plan's changes.
- Pre-existing untyped-Hono-context `tsc` errors remain out of scope (documented baseline).

## Known Stubs
None — no stub/placeholder values introduced. The list payload trim is intentional and complete on the server; client-side detail re-hydration to backfill the dropped `steps` is the explicitly-scoped follow-up in Plan 28-03 (documented in this plan's correctness guard).

## Next Phase Readiness
- Server-side telemetry is live: a cold load will now log per-request `recipes.list` lines for p50/p95 analysis once deployed.
- The list payload no longer ships `steps`/`step_image_urls` — Plan 28-03 must add the client detail re-hydration fetch (detail GET /:id → mergeRecipeLocal) so the detail screen shows full steps after the trim.
- `getRecipeById` confirmed untouched (full select) — detail re-fetch path ready for 28-03.

---
*Phase: 28-recipe-load-telemetry-performance-10s-3-5s*
*Completed: 2026-06-09*

## Self-Check: PASSED
- FOUND: packages/server/src/services/recipeStore.ts
- FOUND: packages/server/src/routes/recipes.ts
- FOUND: .planning/phases/28-recipe-load-telemetry-performance-10s-3-5s/28-01-SUMMARY.md
- FOUND commit: 9d72d6b
- FOUND commit: 6241ddb
