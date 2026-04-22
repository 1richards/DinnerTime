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

## Pre-existing Maestro flow failures (discovered during Plan 19-06)

During Plan 19-06's full Maestro suite run (2026-04-18 16:00 UTC), 9 of 24 flows failed. Five failures share a single pre-existing root cause: the Kitchen tab's segment label changed from "Library" to "Recipe Box" in an out-of-band commit (likely during the 2026-04-14 "Recipe Box rename" landed on `main` after Phase 19 planning). Maestro flow selectors `.*Library.*` + `.*in your library.*` were not rebased. Plan 19-06 fixed the THREE flows it owned (18, 20, 23); the remaining FIVE flows are scope-boundary-excluded per the execute-plan protocol.

| Flow | Selector that broke | Fix (when scheduled) |
|---|---|---|
| `03-import-url.yaml` | `.*Library.*` (post-save nav) | Replace with `.*Recipe Box.*`; update `.*in your library.*` → `.*in your recipe box.*` |
| `04-import-manual.yaml` | `.*Library.*` (post-save nav) | Same as above |
| `05-recipe-detail-edit.yaml` | `.*Library.*` (navigating to recipes list before opening one) | Same as above |
| `06-recipe-discover.yaml` | `.*Library.*` | Same as above |
| `22-dirty-form-guard.yaml` | `.*Library.*` | Same as above |

Additional pre-existing failure (not selector-related):
| Flow | Root cause | Fix |
|---|---|---|
| `21-modal-dismiss.yaml` | `.*Ready to scan your kitchen.*` selector not present in current scan/index.tsx copy. The EmptyState copy must have drifted between Phase 15 and today. | Rebase selector against current `apps/mobile/src/app/scan/index.tsx` empty-state text. |

All 5 `.*Library.*`-regression flows pre-date Plan 19-06's sweep (the Recipe Box rename was not a Phase 19 change — it happened in 14/15 per commit history). Scope boundary per execute-plan protocol: Plan 19-06 owns only the 7 Maestro files listed in its `files_modified` frontmatter. A follow-up one-liner gap-closure plan can rebase the remaining 6 flows in ~5 minutes.

Owner: not assigned. Recommend a `/gsd:quick` pass after Phase 19 Gate A approval to mass-rebase the 6 flows.
