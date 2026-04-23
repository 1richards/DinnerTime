---
phase: 07-meal-planning
plan: 02
subsystem: services
tags: [meal-planning, anthropic, tool-use, tdd, vitest]

requires:
  - phase: 07-meal-planning
    provides: meal_plans / meal_plan_entries tables, shared MealPlan types
  - phase: 01-foundation
    provides: anthropic client singleton, Supabase SSR client
  - phase: 05-recipe-import
    provides: recipes table (id, title, profile_id) for RECIPE LIBRARY block
provides:
  - buildMealPlanPrompt (pure) exported for testing and reuse
  - generateMealPlan(supabase, profileId, weekStart) IO function that persists 1 meal_plan + 7 meal_plan_entries
  - generateMealPlanTool Anthropic tool definition with minItems:7/maxItems:7 days array
  - MealPlanContext / MealPlanPreferences / RecipeLibraryEntry context types
affects: [07-03 routes, 07-04 mobile store, 07-05 meal-plan UI, 08 shopping]

tech-stack:
  added: []
  patterns:
    - "Claude tool-use with forced tool_choice to guarantee structured output"
    - "Tool schema enforces fixed array length via minItems + maxItems"
    - "Delete-then-insert regeneration pattern for uniqueness-constrained weekly records"
    - "String enum day_of_week at API boundary, SMALLINT 0..6 at DB boundary via dayStringToIndex"
    - "HARD CONSTRAINTS / SOFT PREFERENCES block separation mirrors suggestions.ts"

key-files:
  created:
    - packages/server/src/services/mealPlanner.ts
    - packages/server/src/services/__tests__/mealPlanner.test.ts
  modified: []

key-decisions:
  - "[Phase 07-02]: Claude tool schema enforces minItems:7/maxItems:7 on days array (Pitfall 1 mitigation)"
  - "[Phase 07-02]: day_of_week at API boundary is string enum mon..sun, mapped to SMALLINT 0..6 only at persistence via dayStringToIndex helper"
  - "[Phase 07-02]: Regenerate flow uses delete-then-insert on meal_plans (cascades entries) instead of upsert to avoid partial-update races"
  - "[Phase 07-02]: kidFriendlyNeeded derived server-side from household_members.member_type='kid' (not a user-set flag)"
  - "[Phase 07-02]: Recipe library capped at 100 and recent meals at 21 to keep prompt within context budget"
  - "[Phase 07-02]: buildMealPlanPrompt is pure over a MealPlanContext DTO (not raw DB rows) so it is fully unit-testable without mocks"
  - "[Phase 07-02]: EMPTY_PANTRY guard at <3 items mirrors suggestions.ts contract exactly"

patterns-established:
  - "Service-layer prompt functions take a DTO context, not raw Supabase rows, to decouple pure logic from IO"
  - "Tool definitions exported as named constants for schema assertions in unit tests"
  - "Error codes attached via (err as Error & { code?: string }).code for consumer branching"

requirements-completed: [PLAN-01, PLAN-02, PLAN-03, PLAN-04]

duration: 5min
completed: 2026-04-10
---

# Phase 07 Plan 02: Meal Planner Service Summary

**TDD-built mealPlanner service with pure prompt assembly, Anthropic tool-use schema enforcing 7 days, and a regeneration-safe persist path for weekly meal plans.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-12T19:08:27Z
- **Completed:** 2026-04-12T19:13:16Z
- **Tasks:** 2 (both TDD)
- **Files created:** 2
- **Tests:** 17 (9 buildMealPlanPrompt + 2 generateMealPlanTool + 6 generateMealPlan) — all passing

## Accomplishments

- `buildMealPlanPrompt(context)` assembles a structured prompt with 7 distinct blocks: AVAILABLE PANTRY, HOUSEHOLD, HARD CONSTRAINTS, SOFT PREFERENCES, RECIPE LIBRARY (with ids), AVOID REPEATING, WEEK STRUCTURE, and an explicit OUTPUT CONTRACT demanding exactly 7 days 0..6 with 0=Monday.
- `generateMealPlanTool` Anthropic tool definition enforces `minItems:7` and `maxItems:7` at the schema level (Pattern 1 from 07-RESEARCH, Pitfall 1 mitigation) and requires `complexity_target` and `kid_friendly` on every day.
- `generateMealPlan(supabase, profileId, weekStart)` orchestrates: pantry fetch + EMPTY_PANTRY guard → members/profile/recipes(limit 100)/recent meals(limit 21) → buildMealPlanPrompt → Claude call with forced tool_choice → INVALID_PLAN_LENGTH validation → delete-then-insert regeneration → persist meal_plans + 7 meal_plan_entries mapping mon..sun to 0..6.
- Kid-friendly rule derived server-side: when any household member has `member_type='kid'`, prompt demands "at least 3 of 7 nights must be kid_friendly=true".
- Full TDD: RED → GREEN → (no refactor needed) for both tasks with per-phase commits.

## Task Commits

1. **Task 1 RED: failing tests for buildMealPlanPrompt** — `0f1d5b7` (test)
2. **Task 1 GREEN: implement buildMealPlanPrompt** — `ada2e4c` (feat)
3. **Task 2 RED: failing tests for generateMealPlan + tool** — `40f7d42` (test)
4. **Task 2 GREEN: implement generateMealPlan service** — `20eb422` (feat)

## Files Created/Modified

- `packages/server/src/services/mealPlanner.ts` — 440 lines: context types, pure prompt builder, tool schema, day mapper, async service
- `packages/server/src/services/__tests__/mealPlanner.test.ts` — 546 lines: 17 tests with hoisted Anthropic mock and stubbed Supabase builder chain

## Decisions Made

- Tool schema `minItems:7/maxItems:7` instead of runtime length validation alone (defense in depth with Pitfall 1)
- Day strings (`mon..sun`) at the API/tool boundary, integer SMALLINT at the DB boundary, translated via `dayStringToIndex`
- Delete-then-insert regeneration (cascades entries) to avoid uniqueness collisions and partial-state races
- Pure `buildMealPlanPrompt(MealPlanContext)` over raw DB rows so prompt tests require zero mocks
- `kidFriendlyNeeded` derived from `household_members.member_type`, not a user flag
- Recipe library capped at 100, recent meals at 21 (hard constant in code, verified by test)

## Deviations from Plan

None — both TDD tasks executed exactly as specified. Implementation passed on first GREEN run for both Task 1 (9/9) and Task 2 (8/8), so no REFACTOR commit was needed for either task.

## Issues Encountered

Pre-existing TS errors in `packages/server/src/services/__tests__/suggestions.test.ts` (already documented in `deferred-items.md` during 07-01) remain unchanged. `mealPlanner.ts` and `mealPlanner.test.ts` produce zero typecheck errors under `tsc --noEmit`. No `lint` or `typecheck` npm script exists in the server package, so lint step from plan verification is a no-op.

## User Setup Required

None — fully autonomous. Requires `ANTHROPIC_API_KEY` env var at runtime (already provisioned in Phase 01).

## Next Phase Readiness

- Wave 2 downstream (07-03 routes, 07-04 mobile store, 07-05 UI) can consume `generateMealPlan` and `generateMealPlanTool` against a stable exported contract.
- The pure `buildMealPlanPrompt` function is available for route-level dry-runs, debug endpoints, or prompt audits.
- No blockers.

## Self-Check

- FOUND: packages/server/src/services/mealPlanner.ts
- FOUND: packages/server/src/services/__tests__/mealPlanner.test.ts
- FOUND: commit 0f1d5b7
- FOUND: commit ada2e4c
- FOUND: commit 40f7d42
- FOUND: commit 20eb422
- Verified: `pnpm --filter @dinnertime/server test mealPlanner` → 17 passed

## Self-Check: PASSED

---
*Phase: 07-meal-planning*
*Completed: 2026-04-10*
