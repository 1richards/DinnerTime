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
