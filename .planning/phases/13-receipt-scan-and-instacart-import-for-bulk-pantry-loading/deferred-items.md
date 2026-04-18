# Deferred Items (Out-of-scope Discoveries)

## Pre-existing test failures discovered during Plan 13-01 execution

- `src/ai/__tests__/taskRouting.test.ts > env.GOOGLE_API_KEY throws when unset and returns value when set` — fails on `main` before Plan 13-01 changes. Appears to be a test-isolation issue where `env` getter caches an earlier value. Not caused by Plan 13-01; scope boundary keeps us out of `src/ai/__tests__/`. Revisit in a dedicated fix plan.

## Pre-existing mobile test failures discovered during Plan 13-02 execution

Ran `cd apps/mobile && npx vitest run` against a clean `main` (stashed all 13-02 changes): **4 failures exist pre-change**, unrelated to pantry/scan work:

- `__tests__/auth-store.test.ts > Auth Store > initialize > should set isOnboarded based on profile.onboarding_complete`
- `src/stores/__tests__/progressionStore.test.ts > progressionStore > fetchVariations returns string[] on 200`
- `src/stores/__tests__/shoppingStore.test.ts > shoppingStore > generateList > POSTs meal_plan_id and populates currentList + items`
- `src/stores/__tests__/shoppingStore.test.ts > shoppingStore > fetchCurrent > populates list + items on 200`

Not caused by Plan 13-02; scope boundary keeps us out of authStore/progressionStore/shoppingStore tests. Logged here so future plans/refactors can pick these up.
