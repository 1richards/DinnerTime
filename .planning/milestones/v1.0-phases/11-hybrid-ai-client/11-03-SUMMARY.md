---
phase: 11-hybrid-ai-client
plan: 03
subsystem: ai-client-migration
tags: [refactor, ai, abstraction, gemini, anthropic]
requires:
  - 11-01  # AIClient interface + adapters + factory
  - 11-02  # vision + recipeParser mock pattern
provides:
  - suggestions.getSuggestions via AIClient (suggestions.dinner → Gemini Flash)
  - mealPlanner.generateMealPlan + regenerateDay via AIClient (mealPlanner.week → Gemini 3.1 Pro)
  - recipeDiscovery.discoverRecipes via AIClient (recipe.discovery → Gemini Flash)
  - progression.rankAmbition + getRecipeVariations via AIClient (Gemini Flash)
  - shoppingList.suggestVariations via AIClient (shoppingList.variations → Gemini Flash)
  - progression AnthropicLike DI pattern removed
affects:
  - packages/server/src/routes/progression.ts  # dropped anthropic import + arg
tech-stack:
  added: []
  patterns:
    - "AIClient factory mock for service tests (11-02 pattern extended)"
    - "JsonSchema type coercion: drop ['X','null'] unions; mark field not-required"
key-files:
  created:
    - .planning/phases/11-hybrid-ai-client/11-03-SUMMARY.md
  modified:
    - packages/server/src/services/suggestions.ts
    - packages/server/src/services/mealPlanner.ts
    - packages/server/src/services/recipeDiscovery.ts
    - packages/server/src/services/progression.ts
    - packages/server/src/services/shoppingList.ts
    - packages/server/src/services/__tests__/suggestions.test.ts
    - packages/server/src/services/__tests__/mealPlanner.test.ts
    - packages/server/src/services/__tests__/recipeDiscovery.test.ts
    - packages/server/src/services/__tests__/progression.test.ts
    - packages/server/src/services/__tests__/shoppingList.test.ts
    - packages/server/src/routes/progression.ts
decisions:
  - "progression.ts drops AnthropicLike DI and imports getClientFor directly — the abstraction replaces that testability hatch"
  - "Tool schemas with type:['X','null'] unions replaced by plain type:'X' with the field removed from required (provider returns undefined → downstream ?? null handles it)"
  - "generateMealPlanTool dropped minItems/maxItems:7 constraint; runtime days.length!==7 check remains the single source of truth"
  - "discoverRecipes now passes system via AIClient.generateStructured({system, user, ...}) instead of concatenating — the abstraction supports system prompts directly"
  - "shoppingList.suggestVariations throws 'no tool_use in response' on missing swaps array to preserve prior error message surface"
metrics:
  duration: 5min
  tasks: 3
  files: 11
  tests: 83
  completed: 2026-04-10
---

# Phase 11 Plan 03: Migrate Gemini-Routed Text Services Summary

Migrated the five Gemini-routed text services (suggestions, mealPlanner, recipeDiscovery, progression, shoppingList) off direct `anthropic.messages.create` calls and onto the AIClient abstraction from 11-01, using the factory-mock test pattern established in 11-02.

## What Changed

### Service migrations
- **suggestions.ts** → `getClientFor('suggestions.dinner')` → Gemini 3 Flash
- **mealPlanner.ts** → `getClientFor('mealPlanner.week')` → Gemini 3.1 Pro (both generate + regenerateDay)
- **recipeDiscovery.ts** → `getClientFor('recipe.discovery')` → Gemini 3 Flash (now uses structured `system` param)
- **progression.ts** → `getClientFor('progression.ambition')` + `getClientFor('progression.variations')` → Gemini 3 Flash
- **shoppingList.ts** → `getClientFor('shoppingList.variations')` → Gemini 3 Flash (pure functions `consolidateIngredients` / `subtractPantry` untouched)

### progression.ts DI cleanup
The pre-11-03 progression service took a structural `AnthropicLike` client as a parameter on both `rankAmbition` and `getRecipeVariations`. With the AIClient abstraction in place that DI hatch is redundant — `getClientFor` is just as mockable. Removed:
- `AnthropicLike` interface
- `anthropic` parameter on `rankAmbition` and `getRecipeVariations`
- Hand-rolled `{ messages: { create: vi.fn() } }` fake client in progression.test.ts

### Route caller update
`routes/progression.ts` no longer imports the `anthropic` singleton and no longer passes it into the two service functions. This was the only route file that directly consumed the removed parameter.

## Schema Simplifications

Several Anthropic-era tool schemas used `type: ['string', 'null']` / `type: ['number', 'null']` unions. These work for Anthropic but are **not valid** in the stricter `JsonSchema` type or for Gemini `parametersJsonSchema`. Ported as follows:

| Service | Field | Before | After |
|---|---|---|---|
| mealPlanner | `recipe_id` | `type: ['string','null']` | `type: 'string'`, not in `required` |
| recipeDiscovery | `description`, `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`, `servings` | `type: ['X','null']` | `type: 'X'`, not in `required` |
| recipeDiscovery ingredient | `quantity`, `unit`, `notes` | `type: ['X','null']` | `type: 'X'`, only `name` required |

Downstream conversion code already handles missing-vs-null via `?? null` so the behavioral surface is unchanged. The `generateMealPlanTool` also dropped `minItems:7/maxItems:7` since the runtime `days.length !== 7` guard already enforces the contract (and these constraint keywords aren't in the restricted `JsonSchema` subset either).

## Test Pattern Divergences from 11-02

The 11-02 template (`mockGetClientFor` factory mock + `mockGenerateStructured.mockResolvedValue({...})`) ports verbatim for every test file. Two minor additions:

1. **`mockGetClientFor.mockClear()` in every `beforeEach`** — needed because several tests assert `getClientFor` was called with the correct task string; without clearing between cases the spy leaks across tests.
2. **`shoppingList.test.ts` missing-array test** — the `throws on empty response` case used to mock `content: [{ type: 'text' }]`. Now it returns `{}` (no `swaps`) and we assert the service throws the original `no tool_use in response` message unchanged.

The progression test lost its `markCooked → logRecipeCook` integration test's `vi.resetModules()` + `vi.doMock('@anthropic-ai/sdk', ...)` dance — mealPlanner no longer imports the SDK, so the test now just dynamically imports `mealPlanner.js` without any SDK remock. Cleaner.

## Files Touched

**Services (5):** suggestions.ts, mealPlanner.ts, recipeDiscovery.ts, progression.ts, shoppingList.ts
**Tests (5):** matching `__tests__/*.test.ts`
**Routes (1):** progression.ts

## Verification

```
cd packages/server && npm test -- suggestions mealPlanner recipeDiscovery progression shoppingList
→ Test Files  6 passed (6)    (progression.test.ts matches both service + route)
→ Tests      83 passed (83)
```

`npx tsc --noEmit` shows zero NEW errors from this plan. The pre-existing errors (routes/ai.ts, routes/cooking.ts, routes/meal-plans.ts, routes/pantry.ts, suggestions.test.ts member_type literal widening) were present on the 11-02 commit and are untouched by 11-03.

`grep "@anthropic-ai/sdk\|config/anthropic" suggestions.ts mealPlanner.ts recipeDiscovery.ts progression.ts shoppingList.ts` → zero matches.

## Deviations from Plan

None. The plan executed as written. Task 1 through 3 each committed atomically; no checkpoints hit; no Rule-1/2/3 auto-fixes needed beyond the expected tool-schema simplifications the plan explicitly called out.

## Remaining AITask Slots (post-11-03)

Routed & in use: `vision.pantryScan`, `recipe.parsePhoto`, `recipe.parseUrl`, `recipe.parseText`, `suggestions.dinner`, `mealPlanner.week`, `recipe.discovery`, `progression.ambition`, `progression.variations`, `shoppingList.variations`.

Not yet consumed (for 11-04): `cooking.voiceAsk`, `cooking.tips`, `ingredient.categorize`.

## Commits

- `16c94a5` refactor(11-03): migrate suggestions + mealPlanner to AIClient
- `81dc9d5` refactor(11-03): migrate recipeDiscovery + shoppingList to AIClient
- `240492a` refactor(11-03): migrate progression to AIClient and drop AnthropicLike DI

## Self-Check: PASSED

- [x] packages/server/src/services/suggestions.ts — FOUND
- [x] packages/server/src/services/mealPlanner.ts — FOUND
- [x] packages/server/src/services/recipeDiscovery.ts — FOUND
- [x] packages/server/src/services/progression.ts — FOUND
- [x] packages/server/src/services/shoppingList.ts — FOUND
- [x] packages/server/src/routes/progression.ts — FOUND
- [x] 5 test files modified and green — FOUND
- [x] commit 16c94a5 — FOUND
- [x] commit 81dc9d5 — FOUND
- [x] commit 240492a — FOUND
- [x] no anthropic/SDK imports in migrated services — VERIFIED (grep clean)
