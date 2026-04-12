---
phase: 07-meal-planning
plan: 04
subsystem: state
tags: [zustand, meal-planning, optimistic-updates, vitest, tdd]

requires:
  - phase: 07-meal-planning
    provides: MealPlan types from 07-01, endpoint contract from 07-03 (mocked at test boundary)
provides:
  - Tested Zustand mealPlanStore with fetchCurrent, generate, swapDay, markCooked
  - Optimistic-update + snapshot-rollback pattern applied to markCooked
  - 409 ALREADY_COOKED handled as confirmation (no rollback)
affects: [07-meal-planning P05, future cooking mode phases]

tech-stack:
  added: []
  patterns:
    - Optimistic update with snapshot rollback (matches Phase 06-03)
    - Local getApiBaseUrl + getAuthToken helpers (matches suggestionsStore/recipeStore)
    - authedFetch wrapper with /api/v1 base path

key-files:
  created:
    - apps/mobile/src/stores/mealPlanStore.ts
    - apps/mobile/src/stores/__tests__/mealPlanStore.test.ts
  modified: []

key-decisions:
  - "[Phase 07-04]: EMPTY_PANTRY server error mapped to friendly 'Add at least 3 pantry items first' at store boundary"
  - "[Phase 07-04]: 409 ALREADY_COOKED retains optimistic state (server confirms cooked) and emits error='already_cooked' signal for caller"
  - "[Phase 07-04]: authedFetch helper centralizes /api/v1 prefix + auth header composition inside store file"

patterns-established:
  - "Error-code mapping: server string codes translated to user-facing copy inside store actions"
  - "Concurrency state flags (swappingDay/cookingDay) scoped to individual day indices rather than global loading"

requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07]

duration: 2min
completed: 2026-04-10
---

# Phase 07 Plan 04: Mobile Meal Plan Store Summary

**Zustand mealPlanStore with TDD-covered fetchCurrent/generate/swapDay/markCooked, optimistic cook with snapshot rollback, and 409 ALREADY_COOKED handling.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-12T19:15:47Z
- **Completed:** 2026-04-12T19:17:30Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- 12 passing unit tests covering success, error, optimistic, rollback, and conflict paths
- Store wired to /api/v1/meal-plans endpoints (mocked at test boundary — runs parallel with 07-03)
- Per-day concurrency flags (swappingDay, cookingDay) enable day-scoped spinners in UI
- authedFetch helper consolidates auth + JSON headers for all 4 actions

## Task Commits

1. **Task 1 RED:** `d1cf3f4` test(07-04): failing tests for fetchCurrent + generate
2. **Task 1 GREEN:** `d2e644b` feat(07-04): mealPlanStore fetchCurrent + generate (includes forward-implemented swap/cook used by Task 2)
3. **Task 2 Tests:** `48b8482` test(07-04): swapDay + markCooked optimistic rollback tests

## Files Created/Modified
- `apps/mobile/src/stores/mealPlanStore.ts` — Zustand store with 4 actions, authedFetch helper, EMPTY_PANTRY + ALREADY_COOKED error mapping
- `apps/mobile/src/stores/__tests__/mealPlanStore.test.ts` — 12 tests, global fetch mocked, supabase auth hoisted mock

## Decisions Made
- EMPTY_PANTRY translated to friendly copy at store boundary (consistent with Phase 04 pattern of user-facing messaging in stores)
- 409 ALREADY_COOKED does NOT rollback because server state already matches optimistic state; caller can read `error === 'already_cooked'` to show a toast without losing the cooked marker
- markCooked rollback on network error restores the full entries snapshot rather than patching the single entry — safer against partial-state bugs

## Deviations from Plan

Minor: Task 2's implementation was written alongside Task 1's feat commit (all 4 actions shipped in one store file) rather than as a separate feat commit. Task 2 landed as a test-only commit since no new production code was required. Functionality, coverage, and final state match the plan exactly.

## Issues Encountered
None.

## Self-Check: PASSED

- FOUND: apps/mobile/src/stores/mealPlanStore.ts
- FOUND: apps/mobile/src/stores/__tests__/mealPlanStore.test.ts
- FOUND commit: d1cf3f4
- FOUND commit: d2e644b
- FOUND commit: 48b8482
- Verification: `pnpm --filter @dinnertime/mobile test mealPlanStore` → 12/12 passed
- Verification: `pnpm --filter @dinnertime/mobile exec tsc --noEmit` → clean

## Next Phase Readiness
- Store is ready for 07-05 UI shell consumption
- Runtime integration with server meal-plans endpoints deferred until 07-03 completes (Wave 3 parallel); store shape aligned with endpoint contract in plan

---
*Phase: 07-meal-planning*
*Completed: 2026-04-10*
