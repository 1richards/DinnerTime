# Phase 19 — Deferred Items

Out-of-scope discoveries from Phase 19 execution. Not fixed here; logged for later triage.

## Pre-existing mobile test failures (discovered during Plan 19-01)

Confirmed pre-existing on `main` before Plan 19-01's changes (verified via `git stash` + full `pnpm test`). All are in stores Plan 19-01 never touched.

| Test file | Failing tests | Notes |
|---|---|---|
| `__tests__/auth-store.test.ts` | `initialize > should set isOnboarded based on profile.onboarding_complete` | 1 failure |
| `src/stores/__tests__/shoppingStore.test.ts` | `generateList > POSTs meal_plan_id and populates currentList + items`, `fetchCurrent > populates list + items on 200` | 2 failures — response-shape mismatch between test fixtures and store |
| `src/stores/__tests__/progressionStore.test.ts` | `fetchVariations returns string[] on 200` | 1 failure |

**Baseline (both with and without Plan 19-01 edits):** Test Files 3 failed / 26 passed / 1 skipped. Tests 4 failed / 262 passed / 2 skipped.

Plan 19-01 design tests are fully green (36 passed; `tokens-purity.test.ts` skipped by design until Plan 19-05).

Owner: not assigned. Consider rolling into Phase 23 (Settings, Auth & NFRs) where the auth/shopping/progression store stability lives.
