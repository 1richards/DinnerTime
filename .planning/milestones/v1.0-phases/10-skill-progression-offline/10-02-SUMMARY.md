---
phase: 10-skill-progression-offline
plan: 02
subsystem: api
tags: [hono, anthropic, sonnet, haiku, supabase, vitest, tdd, progression]

requires:
  - phase: 10-skill-progression-offline
    provides: recipe_cooks table, RecipeCookStats/AmbitionSuggestion/AmbitionRankRequest types
  - phase: 07-meal-planning
    provides: markCooked service, meal_plan_entries.recipe_id linkage
  - phase: 06-recipe-library
    provides: recipes table with steps/ingredients/total_time_minutes columns
provides:
  - logRecipeCook best-effort cook history append
  - getCookStats per-recipe aggregation (count + last_cooked_at)
  - computeComplexity heuristic (steps + ingredients + floor(time/15))
  - rankAmbition Sonnet ambition ranker with hallucination guard + lowest-complexity fallback
  - getRecipeVariations Haiku variations gated at cook_count >= 3
  - GET /api/v1/progression/cook-stats
  - GET /api/v1/progression/suggestions
  - GET /api/v1/progression/variations/:recipeId
  - markCooked side-effect: appends to recipe_cooks (non-fatal)
affects: [10-04 offline cache, 10-05 mobile progression UI]

tech-stack:
  added: []
  patterns:
    - AnthropicLike structural type so unit tests pass plain `{ messages: { create } }` mocks instead of patching the SDK module
    - rankAmbition pre-filters cook_count>=2 (overcooked excluded), drops sonnet recipe_ids not in candidate pool, falls back to lowest-complexity when sonnet returns nothing usable
    - BelowThresholdError class with literal `code = 'BELOW_THRESHOLD'` for typed route mapping
    - Service throws `{ code: 'NOT_FOUND' }` (not HTTP), route layer maps to 404 — mirrors mealPlanner code-based errors

key-files:
  created:
    - packages/server/src/services/progression.ts
    - packages/server/src/services/__tests__/progression.test.ts
    - packages/server/src/routes/progression.ts
    - packages/server/src/routes/__tests__/progression.test.ts
  modified:
    - packages/server/src/services/mealPlanner.ts
    - packages/server/src/index.ts

key-decisions:
  - "[Phase 10-02]: rankAmbition takes anthropic client as a parameter (AnthropicLike) instead of importing the singleton — tests use plain mock objects, no module patching"
  - "[Phase 10-02]: logRecipeCook is best-effort; insert errors swallowed via console.warn so a logging failure can never roll back a cook"
  - "[Phase 10-02]: markCooked only logs to recipe_cooks when entry.recipe_id is set — Claude-generated free-form meal entries have no recipe to track"
  - "[Phase 10-02]: rankAmbition fallback orders by ascending complexity (gentle starter picks) when Sonnet returns 0 valid recommendations"
  - "[Phase 10-02]: getRecipeVariations throws BelowThresholdError mapped to HTTP 400 (not 403) so mobile UI can show 'unlock at 3 cooks' affordance"
  - "[Phase 10-02]: NOT_FOUND error code surface for recipe ownership check (404), distinct from BELOW_THRESHOLD (400)"

patterns-established:
  - "AnthropicLike structural typing for service-layer Claude callers — avoids vi.mock SDK ceremony for any new service"
  - "Service-layer code-based errors mapped to HTTP at route boundary (mirrors EMPTY_PANTRY/ALREADY_COOKED pattern from 07-03)"

requirements-completed: [SKIL-01, SKIL-02, SKIL-04]

duration: 5min
completed: 2026-04-10
---

# Phase 10 Plan 02: Progression Service & Routes Summary

**Server-side progression backbone: cook history logging into recipe_cooks via markCooked, aggregated cook stats, Claude Sonnet ambition ranker, and Claude Haiku variations gated at 3 cooks — all TDD-covered.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-13T04:32:08Z
- **Completed:** 2026-04-13T04:37:37Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments
- 5 progression service functions with 13 unit tests (logRecipeCook, getCookStats, computeComplexity, rankAmbition, getRecipeVariations) plus markCooked integration test
- 3 auth-gated Hono routes mounted at /api/v1/progression with 6 route tests
- markCooked now appends to recipe_cooks transparently — existing 25 mealPlanner tests still green
- Full server suite: 212/212 passing

## Task Commits

1. **Task 1 RED: progression service tests** — `29670fe` (test)
2. **Task 1 GREEN: progression service + markCooked hook** — `eb651b0` (feat)
3. **Task 2 RED: progression route tests** — `79edc68` (test)
4. **Task 2 GREEN: progression routes + mount** — `3012c6f` (feat)

_Note: TDD pattern — RED commit per task with failing tests, GREEN commit with implementation. No refactor commits needed._

## Files Created/Modified
- `packages/server/src/services/progression.ts` — 5 exported functions + AnthropicLike type + BelowThresholdError + RANK_RECIPES_TOOL/VARIATIONS_TOOL schemas (~370 lines)
- `packages/server/src/services/__tests__/progression.test.ts` — 13 unit tests across all functions including markCooked side-effect verification
- `packages/server/src/routes/progression.ts` — 3 endpoints (/cook-stats, /suggestions, /variations/:recipeId), assembles history+candidates from library inline like meal-plans /generate
- `packages/server/src/routes/__tests__/progression.test.ts` — 6 route tests using meal-plans hoisted-mock pattern
- `packages/server/src/services/mealPlanner.ts` — markCooked imports logRecipeCook and calls it in a try/catch after the cooked-status update; only when entry.recipe_id is set
- `packages/server/src/index.ts` — mount `/progression` route alongside /cooking

## Decisions Made
See `key-decisions` in frontmatter. Highlights:
- AnthropicLike structural type lets tests pass `{ messages: { create: vi.fn() } }` directly — no `vi.mock('@anthropic-ai/sdk')` needed for progression. mealPlanner integration test still uses the SDK mock because mealPlanner imports the singleton.
- markCooked guards the cook log behind `if (entry.recipe_id)` — Claude-generated entries that aren't tied to a saved recipe correctly skip logging.
- rankAmbition fallback returns gentle starter picks (ascending complexity) instead of erroring when Sonnet fails or returns hallucinated ids.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] markCooked lives in mealPlanner.ts, not ingredientMatching.ts**
- **Found during:** Task 1 (GREEN — wiring the hook)
- **Issue:** Plan frontmatter and Task 1 action both said to edit `packages/server/src/services/ingredientMatching.ts::markCooked`, but markCooked actually lives in `mealPlanner.ts` (only `matchIngredientsToPantry` and `normalizeIngredientName` are in ingredientMatching.ts). Editing the wrong file would have left markCooked unmodified.
- **Fix:** Imported `logRecipeCook` into `mealPlanner.ts` and called it inside markCooked after the cooked-status update, in the location the plan described. Behavior is identical to what the plan intended.
- **Files modified:** packages/server/src/services/mealPlanner.ts
- **Verification:** Existing 25 mealPlanner tests still pass; new markCooked side-effect test in progression.test.ts asserts recipe_cooks insert is invoked.
- **Committed in:** eb651b0

**2. [Rule 2 - Missing Critical] markCooked guards logRecipeCook behind entry.recipe_id**
- **Found during:** Task 1 (GREEN)
- **Issue:** meal_plan_entries.recipe_id is nullable — Claude-generated free-form meals have no associated recipe. Calling logRecipeCook with a null recipe_id would insert garbage rows that fail FK constraints (and recipe_cooks.recipe_id is NOT NULL per 10-01 migration).
- **Fix:** Wrapped logRecipeCook call in `if (entry.recipe_id)` guard inside markCooked.
- **Files modified:** packages/server/src/services/mealPlanner.ts
- **Verification:** Test passes with explicit recipe_id='recipe-99' in fakeEntry; FK violation impossible.
- **Committed in:** eb651b0

**3. [Rule 1 - Bug] Test mock used wrong tool name for variations**
- **Found during:** Task 1 verification
- **Issue:** `makeAnthropicMock` defaulted `name: 'rank_recipes'` for all anthropic mocks, but getRecipeVariations looks for `name === 'suggest_variations'` in the response content array. The "returns string[] variations" test failed with "Claude did not return a tool_use response for variations".
- **Fix:** Added optional `toolName` parameter to `makeAnthropicMock`, passed `'suggest_variations'` for the variations test.
- **Files modified:** packages/server/src/services/__tests__/progression.test.ts
- **Verification:** All 13 progression service tests pass.
- **Committed in:** eb651b0 (rolled into Task 1 GREEN since it was test infrastructure, not production code)

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing critical, 1 test bug)
**Impact on plan:** All deviations were necessary — the plan's file path was wrong (Rule 3), the recipe_id guard was a critical correctness fix preventing FK violations on real free-form meal cooks (Rule 2), and the test mock bug was caught during the same verification cycle (Rule 1). No scope creep.

## Issues Encountered

- Initial `pnpm --filter server test -- --run progression` ran the entire suite (the `--run` flag was already implied by `vitest run` and the trailing pattern was treated as a separate arg). Switched to `pnpm --filter server exec vitest run <path>` for surgical file targeting.
- That same run surfaced 6 pre-existing cooking.test.ts failures (10-03 work) but a clean re-run after Task 2 showed 212/212 passing — the failures were transient/cached. No 10-02 changes touched cooking routes.

## User Setup Required

None — all changes are server-internal. No env vars, no migrations (10-01 already created recipe_cooks).

## Next Phase Readiness

- 10-04 (offline cache) can hit the new endpoints to seed cache.
- 10-05 (mobile UI) has all three endpoints stable: /cook-stats for the history view, /suggestions for the ambition feed, /variations/:id for the unlock-at-3 affordance.
- The BELOW_THRESHOLD/NOT_FOUND error codes are documented in the route handler — mobile store layer should map BELOW_THRESHOLD to a friendly "cook 3 times to unlock" message.

## Self-Check: PASSED

- packages/server/src/services/progression.ts — FOUND (~370 lines, exceeds 120 minimum)
- packages/server/src/services/__tests__/progression.test.ts — FOUND
- packages/server/src/routes/progression.ts — FOUND
- packages/server/src/routes/__tests__/progression.test.ts — FOUND
- packages/server/src/services/mealPlanner.ts logRecipeCook hook — FOUND
- packages/server/src/index.ts /progression mount — FOUND
- Commits 29670fe, eb651b0, 79edc68, 3012c6f — all FOUND in git log
- Full server suite: 212/212 passing

---
*Phase: 10-skill-progression-offline*
*Completed: 2026-04-10*
