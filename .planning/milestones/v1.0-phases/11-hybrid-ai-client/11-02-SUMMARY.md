---
phase: 11-hybrid-ai-client
plan: 02
subsystem: ai
tags: [ai-client, anthropic, gemini, vision, recipe-parser, refactor]

requires:
  - phase: 11-hybrid-ai-client
    provides: AIClient interface, AnthropicAdapter, GeminiAdapter, getClientFor factory, TASK_ROUTES (Plan 11-01)
provides:
  - vision.ts migrated to AIClient via vision.pantryScan task slot (Anthropic Sonnet 4.6)
  - recipeParser.ts photo path migrated to recipe.parsePhoto (Anthropic Sonnet 4.6)
  - recipeParser.ts URL path (JSON-LD + fallback) migrated to recipe.parseUrl (Gemini Flash)
  - recipeParser.ts text path migrated to recipe.parseText (Gemini Flash)
  - Canonical factory-level mock pattern for AIClient-backed services, to be copied verbatim by 11-03 and 11-04
affects: [11-03, 11-04, 11-05]

tech-stack:
  added: []
  patterns:
    - "Service-layer migration pattern: replace direct SDK imports with getClientFor(task) + analyzeImageStructured/generateStructured"
    - "Test mock pattern: vi.hoisted() factory stub of ../../ai/clientFactory.js exposing generateText/generateStructured/analyzeImageStructured"
    - "Schema simplification: strict JsonSchema (no union types like ['string','null']) with nullable fields omitted from required array"

key-files:
  created: []
  modified:
    - packages/server/src/services/vision.ts
    - packages/server/src/services/recipeParser.ts
    - packages/server/src/services/__tests__/vision.test.ts
    - packages/server/src/services/__tests__/recipeParser.test.ts

key-decisions:
  - "Simplified parse_recipe schema to drop ['type','null'] unions — Gemini parametersJsonSchema rejects them; toolOutputToRecipe still defaults missing fields to null at the JS boundary"
  - "Nullable fields (description, prep_time_minutes, etc.) omitted from JsonSchema.required so providers can skip them, matching the pre-migration nullable semantics without union types"
  - "Split callClaudeParseRecipe into callAIParseRecipeText(task, prompt) + callAIParseRecipePhoto(base64, prompt) so URL/text share a Gemini path while photo stays on Anthropic"
  - "Tests mock ../../ai/clientFactory.js (not @anthropic-ai/sdk) — establishes the canonical pattern for 11-03/11-04"

patterns-established:
  - "Factory-level mocking: hoist mockGenerateText/Structured/AnalyzeImageStructured, stub getClientFor to return a client shaped object — downstream plans copy this verbatim"
  - "Task slot assertion: every test that exercises an AI call asserts expect(mockGetClientFor).toHaveBeenCalledWith('<exact task>') to lock in routing"

requirements-completed: [ARCH-01, ARCH-03]

duration: 8min
completed: 2026-04-10
---

# Phase 11 Plan 02: Vision + Recipe Parser Migration Summary

**vision.ts and recipeParser.ts fully migrated off @anthropic-ai/sdk onto the AIClient abstraction; photo paths stay on Anthropic Sonnet 4.6, URL/text paths route to Gemini Flash, both test suites green with factory-level mocks.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-10T09:36:00Z
- **Completed:** 2026-04-10T09:44:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `identifyFoodItems` now routes via `getClientFor('vision.pantryScan').analyzeImageStructured` — zero direct Anthropic SDK use in vision.ts
- `parseRecipeFromPhoto` routes via `getClientFor('recipe.parsePhoto').analyzeImageStructured` (Anthropic Sonnet 4.6 via adapter)
- `parseRecipeFromUrl` routes via `getClientFor('recipe.parseUrl').generateStructured` for both the JSON-LD ingredient-parse path and the non-JSON-LD full-extraction fallback (Gemini Flash)
- `parseRecipeFromText` routes via `getClientFor('recipe.parseText').generateStructured` (Gemini Flash)
- Tests rewritten to mock the factory, not the SDK — 6 vision tests + 17 recipeParser tests all green
- Public APIs unchanged: `routes/scan.ts` and `routes/recipes.ts` require no modifications

## Task Commits

1. **Task 1: Migrate vision.ts to AIClient + rewrite vision.test.ts** — `48a844a` (refactor)
2. **Task 2: Migrate recipeParser.ts (photo→Anthropic, url+text→Gemini) + rewrite recipeParser.test.ts** — `be63a0a` (refactor)

## Files Created/Modified

- `packages/server/src/services/vision.ts` — AIClient-based identifyFoodItems, StructuredTool definition, zero SDK imports
- `packages/server/src/services/recipeParser.ts` — simplified parseRecipeTool schema, split callAIParseRecipeText/Photo helpers, three public functions routed to distinct task slots
- `packages/server/src/services/__tests__/vision.test.ts` — factory-level mock, asserts task slot + tool name + image forwarding
- `packages/server/src/services/__tests__/recipeParser.test.ts` — factory-level mock, asserts recipe.parseUrl/parsePhoto/parseText routing per path, preserves all pre-migration behavioral coverage
- `.planning/phases/11-hybrid-ai-client/deferred-items.md` — pre-existing issues discovered but explicitly out of scope

## AITask slots consumed by this plan

- `vision.pantryScan` → Anthropic Sonnet 4.6
- `recipe.parsePhoto` → Anthropic Sonnet 4.6
- `recipe.parseUrl` → Gemini Flash (two call sites: JSON-LD ingredient parse + non-JSON-LD fallback)
- `recipe.parseText` → Gemini Flash

## Schema simplifications

The legacy `parseRecipeTool.input_schema` used Anthropic-tolerated union types of the form `type: ['string', 'null']` on every nullable field (description, quantity, unit, notes, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, source_url, image_url). These are:

- Not valid in our stricter `JsonSchema` type (the `type` field is a single literal union, not an array)
- Rejected by Gemini's `parametersJsonSchema` — it would fail at validation time

**Fix applied:** Each nullable field was converted to a single-type declaration (e.g., `{ type: 'number' }`) and simply omitted from the parent's `required` array. This lets providers skip the field entirely. The `toolOutputToRecipe` mapper already coerces missing properties to `null` on the JS side via `(input.description as string) || null`, so the `ParsedRecipe` output shape is byte-identical to the pre-migration contract.

**Impact:** Zero behavioral change. Every existing test assertion about null handling still passes.

## Canonical mock pattern for 11-03 / 11-04

Copy verbatim into any test file that exercises an AIClient-backed service:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAnalyzeImageStructured, mockGenerateStructured, mockGenerateText, mockGetClientFor } =
  vi.hoisted(() => {
    const mockAnalyzeImageStructured = vi.fn();
    const mockGenerateStructured = vi.fn();
    const mockGenerateText = vi.fn();
    const mockGetClientFor = vi.fn(() => ({
      generateText: mockGenerateText,
      generateStructured: mockGenerateStructured,
      analyzeImageStructured: mockAnalyzeImageStructured,
    }));
    return {
      mockAnalyzeImageStructured,
      mockGenerateStructured,
      mockGenerateText,
      mockGetClientFor,
    };
  });

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

// Import the service AFTER the vi.mock block:
import { myService } from '../myService.js';
```

Per-test:
- Stub a return: `mockGenerateStructured.mockResolvedValue({ /* plain object, not tool_use wrapped */ })`
- Assert routing: `expect(mockGetClientFor).toHaveBeenCalledWith('my.task')`
- Assert shape: `expect(mockGenerateStructured).toHaveBeenCalledWith(expect.objectContaining({ tool: expect.objectContaining({ name: 'my_tool' }) }))`

Reset in `beforeEach` by calling `.mockReset()` on each mock plus `mockGetClientFor.mockClear()`.

## Decisions Made

- Schema simplification (see above): accept minor JsonSchema restriction as the cost of provider portability; the JS-layer defaulting keeps output semantics unchanged.
- Two-helper split (`callAIParseRecipeText` + `callAIParseRecipePhoto`) instead of a single polymorphic helper: keeps per-task routing explicit at each call site and makes the URL-vs-text-vs-photo branching obvious.
- URL fallback branch routes to `recipe.parseUrl` (not `recipe.parseText`): the plan explicitly wanted both URL code paths on the same Gemini task slot so cost tracking is consistent per feature.

## Deviations from Plan

None - plan executed exactly as written. Schema simplification was pre-specified in the plan's task 2 action block (the `['X','null']` → single-type conversion), not an unplanned deviation.

## Issues Encountered

- `npx tsc --noEmit` reports errors in two files unrelated to this plan:
  - `src/services/ingredientCategories.ts` — still imports `anthropic`, out of scope for 11-02 (future wave)
  - `src/services/__tests__/suggestions.test.ts` — pre-existing `member_type: string` vs `"adult"|"kid"` literal union error, predates Phase 11 entirely
  Both logged to `.planning/phases/11-hybrid-ai-client/deferred-items.md`. **Zero type errors in vision.ts, recipeParser.ts, or their test files.**

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Vision + recipe parser off direct SDKs; the factory-level mock pattern is now proven and documented for 11-03 / 11-04 to copy verbatim.
- Schema simplification pattern (drop `['X','null']` unions, omit from required) is precedent for any other services that carried the same legacy shape.
- `ingredientCategories.ts` migration deferred to a later wave — flagged in deferred-items.md.

---
*Phase: 11-hybrid-ai-client*
*Plan: 02*
*Completed: 2026-04-10*

## Self-Check: PASSED

- FOUND: packages/server/src/services/vision.ts
- FOUND: packages/server/src/services/recipeParser.ts
- FOUND: packages/server/src/services/__tests__/vision.test.ts
- FOUND: packages/server/src/services/__tests__/recipeParser.test.ts
- FOUND commit 48a844a (Task 1)
- FOUND commit be63a0a (Task 2)
- 0 `anthropic` refs in vision.ts
- 0 `anthropic` refs in recipeParser.ts
- 6/6 vision tests green
- 17/17 recipeParser tests green
