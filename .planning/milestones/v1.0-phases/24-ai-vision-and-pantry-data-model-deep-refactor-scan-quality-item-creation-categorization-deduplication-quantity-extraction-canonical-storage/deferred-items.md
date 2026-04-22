# Phase 24 — Deferred Items (Out-of-Scope Discoveries)

Logged by executor agents during plan execution. Not fixed — out of scope per deviation-rules SCOPE BOUNDARY.

## From 24-02 execution (2026-04-19)

### Pre-existing test failure — taskRouting GOOGLE_API_KEY
- **File:** `packages/server/src/ai/__tests__/taskRouting.test.ts:93`
- **Error:** `expect(() => env.GOOGLE_API_KEY).toThrow(/GOOGLE_API_KEY/)` — received undefined instead of throw.
- **Likely cause:** env module lazy-getter caching across test runs; GOOGLE_API_KEY already read by another test suite into the frozen env proxy.
- **Out of scope:** not caused by units.ts. Should be picked up in a test-isolation refactor or Phase 24-04 when env shape touches.

### Parallel-plan RED state — canonicalResolver.test.ts — RESOLVED 2026-04-19 (24-03)
- **File:** `packages/server/src/services/__tests__/canonicalResolver.test.ts`
- **Previous state:** `Cannot find module '../canonicalResolver.js'`
- **Resolution:** Plan 24-03 landed canonicalResolver.ts + full test suite (14/14 GREEN).

### Pre-existing TS errors (unrelated files)
- `packages/server/src/services/__tests__/suggestions.test.ts` — multiple `member_type: string` vs `"adult" | "kid"` mismatches (test fixtures typed too loosely against the HouseholdMemberRow row type).
- `packages/server/src/services/recipeParser.ts:415` — `source_type: 'ai'` not in `"url" | "photo" | "manual"` union (Phase 06-04 added 'ai' at schema layer but type not updated here).
- **Verified:** zero TS errors touch `services/units.ts` or `services/__tests__/units.test.ts`.
- **Out of scope:** not introduced by units.ts; surface during future passes on those subsystems.
