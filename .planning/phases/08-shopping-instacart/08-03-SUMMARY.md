---
phase: 08-shopping-instacart
plan: 03
subsystem: api
tags: [claude, haiku, classification, tool-use, shopping, grocery-categories]

requires:
  - phase: 08-shopping-instacart
    provides: "GroceryCategory type (08-01)"
provides:
  - "STATIC_MAP of ~170 common ingredients across 9 categories"
  - "classifyStatic: O(1) + token-fallback classifier"
  - "classifyBatchWithHaiku: Claude Haiku batch classifier with enum-constrained tool schema"
  - "classifyItems: hybrid entry point (static first, Haiku fallback, default to 'other')"
affects: [08-04, 08-05, 08-shopping-list-generation]

tech-stack:
  added: []
  patterns:
    - "Hybrid static-map + LLM fallback for classification (research Pattern 3)"
    - "Enum-constrained tool schema as Pitfall 5 mitigation against freeform model output"
    - "Zero-unknown fast path: hybrid classifier does not invoke Claude when all items are statically known"

key-files:
  created:
    - packages/server/src/services/ingredientCategories.ts
    - packages/server/src/services/__tests__/ingredientCategories.test.ts
  modified: []

key-decisions:
  - "STATIC_MAP uses normalized (lowercase, depluralized) keys so callers pass normalizeIngredientName output directly without re-normalizing"
  - "classifyBatchWithHaiku throws on missing tool_use response (caller responsibility to handle); callers default absent names to 'other' at the classifyItems layer, not inside the batch call"
  - "Used claude-haiku-4-latest model id and max_tokens=1024 (batch classification is cheap; Haiku is ~10x cheaper than Sonnet)"
  - "Token fallback only triggers on multi-word names (tokens.length > 1), avoiding redundant second lookup for single-word misses"

patterns-established:
  - "Hybrid classification: static first, LLM fallback only for unknowns, merge results keyed by normalized name"
  - "Enum-constrained tool schemas for bounded categorical outputs from Claude"

requirements-completed: [SHOP-03]

duration: 3min
completed: 2026-04-12
---

# Phase 08 Plan 03: Ingredient Categorization Summary

**Hybrid ingredient categorizer: ~170-entry STATIC_MAP with token fallback, plus Claude Haiku batch classifier with enum-constrained tool schema for unknowns, composed into a single classifyItems entry point.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-12T21:23:00Z
- **Completed:** 2026-04-12T21:26:00Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- STATIC_MAP with ~170 ingredients across all 9 non-"other" categories (produce, dairy, protein, pantry, bakery, frozen, beverages, condiments, spices)
- classifyStatic with full-string lookup + whitespace token fallback
- classifyBatchWithHaiku using claude-haiku-4-latest with forced tool_use and strict GroceryCategory enum
- classifyItems hybrid entry point — never calls Claude when all inputs are statically known
- 13 tests all green, covering happy path, token fallback, null miss, empty batch, hybrid merge, zero-unknown fast path, and "other" defaulting

## Task Commits

1. **Task 1: STATIC_MAP + classifyStatic** - `d8cd0de` (feat, TDD)
2. **Task 2: classifyBatchWithHaiku + classifyItems hybrid** - `dcca8a1` (feat, TDD)

## Files Created/Modified

- `packages/server/src/services/ingredientCategories.ts` - STATIC_MAP + classifyStatic + classifyBatchWithHaiku + classifyItems
- `packages/server/src/services/__tests__/ingredientCategories.test.ts` - 13 tests across 4 describe blocks

## Decisions Made

- Map keys stored pre-normalized so callers pass normalizeIngredientName output directly (no double-normalization)
- classifyItems defaults AI-omitted unknowns to 'other' at the hybrid layer, keeping classifyBatchWithHaiku a pure "whatever Claude said" translator
- Tool schema enforces the 10-value GroceryCategory enum on `category` — this is the Pitfall 5 mitigation against freeform model output
- Deduplication inside classifyItems so repeated normalized names across items don't trigger duplicate Haiku entries

## Deviations from Plan

None — plan executed exactly as written. Tests were written RED first for each task, implementation brought them to GREEN, no refactor needed.

## Issues Encountered

None. Pre-existing unrelated typecheck errors in `suggestions.test.ts` (member_type string vs literal union) are out of scope and not touched by this plan.

## User Setup Required

None — no external service configuration required. Uses the existing anthropic client singleton from `packages/server/src/config/anthropic.ts`.

## Next Phase Readiness

- SHOP-03 classification logic is ready for the shopping-list route layer to call during list generation
- classifyItems should be called ONCE per shopping list (results persist on `shopping_list_items.category`, per research Pitfall 5 and Plan 01 schema)
- Future optimization: persistent category cache table for Haiku-resolved items (deferred intentionally per plan)

## Self-Check: PASSED

- Verified `packages/server/src/services/ingredientCategories.ts` exists
- Verified `packages/server/src/services/__tests__/ingredientCategories.test.ts` exists
- Verified commits `d8cd0de` and `dcca8a1` exist in git log
- All 13 tests pass (`pnpm -C packages/server test ingredientCategories.test.ts -- --run`)

---
*Phase: 08-shopping-instacart*
*Completed: 2026-04-12*
