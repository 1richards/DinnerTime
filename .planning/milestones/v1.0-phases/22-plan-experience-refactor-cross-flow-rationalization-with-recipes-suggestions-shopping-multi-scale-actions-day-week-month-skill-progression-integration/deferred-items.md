# Phase 22 — Deferred Items

Out-of-scope issues discovered during execution. NOT fixed here.

## Pre-existing test failures (logged in Plan 22-05)

**1. `__tests__/meal-plans.test.ts > POST /meal-plans/generate (AI) > generates a 7-day meal plan`**

- **Symptom:** Returns 400 `EMPTY_PANTRY` instead of 201/500 when the test
  pantry fixture can't be inserted.
- **Root cause:** Live-Supabase test setup fails `pantry_items` insert with
  `Could not find the 'unit' column of 'pantry_items' in the schema cache`.
  Schema cache mismatch — likely needs a Supabase schema reload on the test
  DB or a regeneration of the integration fixture.
- **Verified pre-existing:** Stash-then-rerun on parent commit `dcd65a9`
  reproduces the same 1 failure with the same error message.
- **Out of scope for 22-05** (not touched by this plan's changes; plan 22-05
  only extends `mealPlanner.ts` pure prompt-builder logic + adds a PATCH
  route handler, neither of which depends on live Supabase).
- **Owner:** Future integration-test cleanup plan or operations pass.

**2. `src/ai/__tests__/taskRouting.test.ts > env.GOOGLE_API_KEY throws when unset and returns value when set`**

- **Symptom:** The test expects `env.GOOGLE_API_KEY` to throw when unset.
  Receives `undefined` instead of a throw.
- **Verified pre-existing:** Already documented in `22-00-SUMMARY.md`
  (Wave 0 — "Pre-existing test failures (unrelated)").
- **Out of scope for 22-05.**
