# Deferred Items - Phase 07

## Pre-existing type errors (out of scope)

**Discovered during:** 07-01 Task 2 typecheck
**File:** `packages/server/src/services/__tests__/suggestions.test.ts`
**Issue:** `HouseholdMemberRow` requires `member_type: 'adult' | 'kid'` but test fixtures use plain `string`. Multiple instances (lines 131, 138, 145, 155, 173).
**Scope:** Pre-existing, unrelated to meal planning types. Belongs to Phase 04 suggestions service tests.
**Action:** Not fixed. Should be addressed in a dedicated cleanup pass or when touching suggestions tests.
