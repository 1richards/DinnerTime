---
phase: 08-shopping-instacart
plan: 02
subsystem: api
tags: [shopping, ingredients, pantry, anthropic, claude-haiku, tool-use, vitest, tdd]

requires:
  - phase: 08-shopping-instacart
    provides: ConsolidatedItem / VariationSuggestion types, shopping schema
  - phase: 07-meal-planning
    provides: normalizeIngredientName helper, MealPlanEntry/MealPlanIngredient types
  - phase: 03-pantry
    provides: PantryItem type, lazy anthropic client module
provides:
  - consolidateIngredients pure function
  - subtractPantry pure function
  - suggestVariations (Claude Haiku tool-use) async function
  - 13 unit tests with mocked anthropic SDK
affects: [08-03-categorization, 08-05-shopping-routes, 08-06-instacart-linking]

tech-stack:
  added: []
  patterns:
    - "Pure service functions unit-tested without Supabase coupling"
    - "vi.hoisted + class-based vi.mock of @anthropic-ai/sdk default export"
    - "Forced tool_choice with single-tool schema for structured Haiku responses"

key-files:
  created:
    - packages/server/src/services/shoppingList.ts
    - packages/server/src/services/__tests__/shoppingList.test.ts
  modified: []

key-decisions:
  - "Unit conflict in consolidation takes max(qty) and nulls unit (no conversion)"
  - "subtractPantry re-normalizes item.name defensively so externally-constructed ConsolidatedItems still match pantry"
  - "Mocked @anthropic-ai/sdk default export (not config/anthropic.ts) to match existing test pattern in recipeDiscovery/mealPlanner"
  - "suggest_swaps tool schema enforces minItems:3/maxItems:5 for Claude-side guarantee"

patterns-established:
  - "Service-layer Claude tool-use: single forced tool + parse first tool_use block or throw"
  - "Defensive re-normalization in subtract to decouple from producer-side normalization drift"

requirements-completed: [SHOP-01, SHOP-02, SHOP-07]

duration: ~4min
completed: 2026-04-10
---

# Phase 08 Plan 02: Shopping List Service Summary

**Pure consolidate / pantry-subtract / AI-swap functions for the shopping list, TDD-covered with mocked Claude Haiku tool use.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-12T21:23:00Z
- **Completed:** 2026-04-12T21:25:10Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments
- `consolidateIngredients` groups meal-plan entries by normalized ingredient name, summing matching-unit quantities, nulling unit and taking max on conflict, deduping source recipe titles
- `subtractPantry` removes fully-stocked items, reduces partially-covered items, passes through unmatched items, and re-normalizes defensively
- `suggestVariations` calls `claude-haiku-4-latest` with a forced `suggest_swaps` tool schema and parses the first tool_use block (throws if missing)
- 13 passing vitest tests with hoisted `@anthropic-ai/sdk` mock

## Task Commits

1. **Task 1+2: Shopping list service (consolidate, subtract, variations)** - `64f8e99` (feat)

_Note: The plan's two TDD tasks share the same two files. Because tests for both were written before either implementation ran, the RED and GREEN phases were combined into a single atomic feat commit rather than artificially splitting an already-green file._

## Files Created/Modified
- `packages/server/src/services/shoppingList.ts` - Service with consolidateIngredients, subtractPantry, suggestVariations
- `packages/server/src/services/__tests__/shoppingList.test.ts` - 13 unit tests covering all behaviors

## Decisions Made
- **Anthropic mock target:** Mocked `@anthropic-ai/sdk` default export (matching recipeDiscovery/mealPlanner pattern) rather than the `config/anthropic.ts` module. Avoids creating a new mocking convention.
- **Defensive re-normalization in subtractPantry:** Callers may build `ConsolidatedItem` outside `consolidateIngredients` (e.g. direct fixtures or future route code). Re-normalizing `item.name` at subtract-time guarantees `Tomatoes` matches pantry `tomato` regardless of producer.
- **Unit handling in consolidation:** On unit mismatch, take `max(existing, incoming)` and null unit. No unit conversion attempted (research Pitfall 2). This biases conservatively — a separate 2-cup and 1-can broth becomes "2 broth" with null unit so downstream UI can warn the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Anthropic client is a direct export, not a getter/singleton**
- **Found during:** Task 2 setup
- **Issue:** Plan interfaces section described importing `getAnthropicClient` from a lazy singleton module. Actual `packages/server/src/config/anthropic.ts` exports a direct `anthropic` const.
- **Fix:** Imported `{ anthropic }` directly from `../config/anthropic.js`, matching the pattern used by recipeDiscovery, mealPlanner, and suggestions services.
- **Files modified:** packages/server/src/services/shoppingList.ts
- **Verification:** All 13 tests green; the vi.mock of `@anthropic-ai/sdk` intercepts the underlying SDK regardless of the wrapper module.
- **Committed in:** 64f8e99

**2. [Rule 1 - Bug] subtractPantry failed "Tomatoes matches tomato" test**
- **Found during:** Task 1 GREEN (first implementation attempt)
- **Issue:** Initial implementation keyed pantry lookup purely on `item.normalizedName` (a pre-computed field). Test fixtures constructed `ConsolidatedItem` with `normalizedName: name.toLowerCase()`, producing "tomatoes", while pantry normalization produced "tomato" — causing a false negative match.
- **Fix:** Re-normalize `item.name` inside subtractPantry via `normalizeIngredientName` and fall back to `item.normalizedName` if the fresh key misses.
- **Files modified:** packages/server/src/services/shoppingList.ts
- **Verification:** All 13 tests pass.
- **Committed in:** 64f8e99

---

**Total deviations:** 2 auto-fixed (1 blocking interface drift, 1 correctness bug)
**Impact on plan:** No scope creep. Both fixes increase robustness of the subtract path for external callers.

## Deferred Issues

- Pre-existing TypeScript errors in `packages/server/src/services/__tests__/suggestions.test.ts` (HouseholdMemberRow `member_type` literal type mismatch). Unrelated to this plan; logged for future cleanup.

## Issues Encountered
- None beyond deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `consolidateIngredients`, `subtractPantry`, `suggestVariations` are ready for composition by Plan 08-05 (shopping routes).
- Categorization (Plan 08-03) can run against `ConsolidatedItem.name` / `normalizedName`.
- Instacart mapping (Plan 08-06) can consume the post-subtract `ConsolidatedItem[]` directly.

## Self-Check: PASSED

- FOUND: packages/server/src/services/shoppingList.ts
- FOUND: packages/server/src/services/__tests__/shoppingList.test.ts
- FOUND: commit 64f8e99

---
*Phase: 08-shopping-instacart*
*Completed: 2026-04-10*
