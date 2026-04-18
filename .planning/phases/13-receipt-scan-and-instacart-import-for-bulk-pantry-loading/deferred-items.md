# Deferred Items (Out-of-scope Discoveries)

## Pre-existing test failures discovered during Plan 13-01 execution

- `src/ai/__tests__/taskRouting.test.ts > env.GOOGLE_API_KEY throws when unset and returns value when set` — fails on `main` before Plan 13-01 changes. Appears to be a test-isolation issue where `env` getter caches an earlier value. Not caused by Plan 13-01; scope boundary keeps us out of `src/ai/__tests__/`. Revisit in a dedicated fix plan.
