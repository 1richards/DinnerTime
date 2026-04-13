# Deferred Items - Phase 10

## Pre-existing TS errors (out of scope for 10-01)

`packages/server/src/services/__tests__/suggestions.test.ts` has multiple TS2345/TS2322 errors on `member_type: string` not assignable to `"adult" | "kid"` literal union (lines 131, 138, 145, 155, 173, ...).

- **Discovered during:** 10-01 Task 2 verification (`pnpm --filter server exec tsc --noEmit`)
- **Confirmed pre-existing** via `git stash` reproduction on clean main
- **Why deferred:** Unrelated to skill progression types; affects test fixtures from prior phase
- **Suggested fix:** Cast fixture rows `as HouseholdMemberRow` or set `member_type: 'adult' as const`
- **Note:** Server runtime tests (vitest) all pass (180/180); only `tsc --noEmit` reports these

## In-progress 10-02 RED test (out of scope for 10-03)

`packages/server/src/services/__tests__/progression.test.ts` fails with "Cannot find module '../progression.js'" — this is a deliberate RED test from the parallel 10-02 wave (commit `29670fe test(10-02): add failing tests for progression service`).

- **Discovered during:** 10-03 Task 2 full-suite verification
- **Why out of scope:** 10-03 is the cooking tips wave; 10-02 (progression service) is in-flight in parallel and will provide the missing module
- **Action:** None — will resolve when 10-02 GREEN lands
