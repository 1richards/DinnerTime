# Phase 20 — Deferred Items

Discoveries made during Phase 20 execution that are OUT OF SCOPE for the current
wave. These are NOT caused by Phase 20 changes. Do not fix them here.

## Pre-existing test failures (confirmed on HEAD before Phase 20 Wave 0)

### shoppingStore.test.ts — 2 cases red

Discovered: 2026-04-22 during Plan 20-00 execution (Task 2 run).

Confirmed pre-existing by stashing all Phase-20 new files and re-running the
suite: both cases still fail on HEAD without any Phase-20 content.

Failing cases:

1. `shoppingStore > generateList > POSTs meal_plan_id and populates currentList + items`
2. `shoppingStore > fetchCurrent > populates list + items on 200`

Both fail with the same shape:

```
AssertionError: expected { list: { id: 'list-1', …(6) } } to deeply equal { id: 'list-1', …(6) }
  + "list": { ... },  // server response wraps the list under data.list
```

Root cause (not investigated — out of scope for Phase 20 Wave 0): the server
response shape diverged from what `generateList` / `fetchCurrent` unpack. The
fix likely belongs in Phase 20-02 (shoppingStore refactor for draft-cart flow)
or a drive-by fix when those methods are touched.

**Action for Phase 20 Wave 0:** DO NOT FIX. These tests stay red on main; the
Plan 20-00 "zero regression in unrelated existing suites" success criterion
is interpreted as "do not *add* regressions" — not "fix pre-existing ones."

Verify in a later wave that touches `shoppingStore.generateList` /
`fetchCurrent` (probably 20-01 or 20-02).

### packages/server — 2 pre-existing unrelated failures

Discovered: 2026-04-22 during Plan 20-00 execution (full server suite run at
Task 3 wrap-up). Confirmed pre-existing by running the same two files with
Plan 20-00 telemetry changes absent.

Failing cases:

1. `__tests__/meal-plans.test.ts > POST /meal-plans/generate (AI) > generates a 7-day meal plan`
2. `src/ai/__tests__/taskRouting.test.ts > taskRouting > env.GOOGLE_API_KEY throws when unset and returns value when set`

Neither file was touched by Plan 20-00. `taskRouting` is an env-var contract
test that appears to have a missing env teardown; `meal-plans.test.ts`
references the AI meal plan generator which is unrelated to shopping. Both
are out of scope for Phase 20.

**Action for Phase 20 Wave 0:** DO NOT FIX. Expected to be picked up by
whichever phase next touches the AI task router / meal-plan generator (or
as a dedicated maintenance plan).
