---
phase: 11-hybrid-ai-client
plan: 04
subsystem: server/ai
tags: [ai-migration, gemini, classification, voice-qa, cooking-tips]
requires:
  - 11-01 (AIClient interface + adapters + getClientFor factory + TASK_ROUTES)
provides:
  - cooking.tips routed through AIClient (Gemini 3.1 flash-lite preview)
  - ingredient.categorize routed through AIClient (Gemini 3.1 flash-lite preview)
  - cooking.voiceAsk routed through AIClient (Gemini 3.1 flash-lite preview)
affects:
  - packages/server/src/services/cookingTips.ts
  - packages/server/src/services/ingredientCategories.ts
  - packages/server/src/routes/cooking.ts
tech-stack:
  added: []
  patterns:
    - "Factory mock pattern for AI services: vi.mock('../../ai/clientFactory.js') with hoisted mockGenerateText/mockGenerateStructured"
    - "StructuredTool<T> with JsonSchema enum constraint preserves Pitfall 5 classification guarantee across providers"
key-files:
  created:
    - path: .planning/phases/11-hybrid-ai-client/11-04-SUMMARY.md
      purpose: Plan summary
  modified:
    - path: packages/server/src/services/cookingTips.ts
      purpose: Route getOrGenerateTip through getClientFor('cooking.tips').generateText
    - path: packages/server/src/services/ingredientCategories.ts
      purpose: Route classifyBatchWithHaiku through getClientFor('ingredient.categorize').generateStructured; convert classifyIngredientsTool to StructuredTool<ClassificationsOutput>
    - path: packages/server/src/routes/cooking.ts
      purpose: Route /ask handler through getClientFor('cooking.voiceAsk').generateText; remove anthropic import
    - path: packages/server/src/services/__tests__/cookingTips.test.ts
      purpose: Swap SDK mock for clientFactory mock
    - path: packages/server/src/services/__tests__/ingredientCategories.test.ts
      purpose: Swap SDK mock for clientFactory mock; keep static-map + token-fallback coverage; assert enum constraint on StructuredTool schema
    - path: packages/server/src/routes/__tests__/cooking.test.ts
      purpose: Swap SDK mock for clientFactory mock; mock services/cookingTips separately to isolate route-layer concerns
decisions:
  - "[11-04] classifyIngredientsTool is now a top-level `StructuredTool<ClassificationsOutput>` exported for test schema assertions — preserves enum on category (Pitfall 5 mitigation) unchanged across provider swap"
  - "[11-04] cooking.test.ts mocks services/cookingTips.js directly; tips route tests no longer re-verify cache semantics (that's cookingTips.test.ts territory) — cleaner layering"
  - "[11-04] /ask maxTokens bumped 200 -> 300 per plan interface spec to match the generateText contract; the belt-and-suspenders 300-char truncation at the route layer still applies"
  - "[11-04] No new routes/cooking.test.ts was created — one already existed from a prior phase; it was rewritten to use the factory mock"
metrics:
  duration: "5m"
  completed: "2026-04-13"
  tasks: 3
  files: 6
---

# Phase 11 Plan 04: Classification & Short-Text Migration Summary

**One-liner:** Migrated cookingTips, ingredientCategories, and /cooking/ask onto the AIClient abstraction — all three now route to Gemini 3.1 flash-lite via `getClientFor`, with zero remaining `anthropic` imports in production services/routes.

## Objective Recap

Complete Wave 2 of the hybrid AI client migration by moving the three short-text / classification consumers off direct `@anthropic-ai/sdk` calls and onto the provider-agnostic `AIClient` interface shipped in Plan 11-01. Cache semantics, enum-constrained classification, and the short-answer voice contract all preserved.

## Tasks Completed

| Task | Name                                | Commit  | Tests         |
| ---- | ----------------------------------- | ------- | ------------- |
| 1    | Migrate cookingTips.ts + test       | 0aadba2 | 6/6 green     |
| 2    | Migrate ingredientCategories + test | f9f65c1 | 14/14 green   |
| 3    | Migrate /cooking/ask route + test   | fbebbbe | 15/15 green   |

Full suite for this plan: **35/35 passing.**

## Behavioral Subtleties Discovered

- **cookingTips cache path is completely unchanged.** The cache hit short-circuit runs before `getClientFor` is ever called, and the test mock is set up in `beforeEach` so `mockGetClientFor` not being called on the hit path is an observable, asserted invariant — not an accidental implicit behavior.
- **Uncertainty empty-string path still bypasses INSERT.** Preserved verbatim: `raw.trim()` length check happens between the AIClient call and the Supabase INSERT, so an empty/whitespace response from Gemini produces the same `''` return + no cache write that Haiku used to produce.
- **classifyBatchWithHaiku empty-input zero-cost path is still zero-cost.** The `unknownItems.length === 0` guard short-circuits before `getClientFor` is invoked, so a shopping list that's 100% statically classified still produces zero AI calls. Verified by the "does NOT invoke AI client when all items statically known" test.
- **Input-coverage guard for AI omissions still fills with `'other'`.** The loop `result[name] = aiResolved[name] ?? 'other'` in `classifyItems` is untouched — Gemini omitting a name from its tool response produces the same `'other'` default Claude did.

## Test Strategy Change

Previous tests mocked `@anthropic-ai/sdk` or `../../config/anthropic.js` directly. All three test files now mock `../../ai/clientFactory.js` and provide a fake `AIClient` via `mockGetClientFor.mockReturnValue(...)`. This decouples tests from any vendor SDK entirely, so future provider changes in `TASK_ROUTES` won't break these suites.

`routes/__tests__/cooking.test.ts` additionally mocks `../../services/cookingTips.js` so the route-layer tests for GET /tips stop re-verifying cache semantics — that territory now belongs exclusively to `services/__tests__/cookingTips.test.ts`.

## Anthropic SDK Footprint (post-11-04)

Zero `anthropic` imports in `src/services/*.ts` or `src/routes/*.ts` production code. Remaining references:

1. `packages/server/src/ai/adapters/anthropicAdapter.ts` — the internal adapter (expected; this is the only module allowed to import the SDK).
2. `packages/server/src/config/anthropic.ts` — the legacy singleton. Slated for deletion in Plan 11-05 once its final callers (pantry vision etc. already on AIClient) are all verified clean.
3. `packages/server/src/services/__tests__/{progression,shoppingList,mealPlanner,recipeDiscovery}.test.ts` — pre-existing legacy test mocks from prior phases' plans. Not runtime references; will be cleaned as those services' tests are refreshed in a future sweep.

**Confirmation:** the only remaining anthropic **SDK** reference that actually executes at runtime is inside `anthropicAdapter.ts`.

## Deviations from Plan

**None for Rules 1-3.** Plan executed exactly as written.

Minor adjustments (within plan spec):

- Exported `classifyIngredientsTool` from `ingredientCategories.ts` so the test can assert the `enum` constraint on `category` without duplicating the schema. The plan's must_haves required verifying enum-constrained output handling; this is the least-coupled way to do it.
- `routes/__tests__/cooking.test.ts` already existed (from Phase 9-03 originally, inferred). The plan's Task 3 noted "If there is no direct test for /ask, add a minimal smoke test in a NEW file" — I rewrote the existing file instead of creating a new one, which strictly supersedes the "new smoke test" option per the plan's intent.

## Deferred Issues

Logged to `.planning/phases/11-hybrid-ai-client/deferred-items.md`:

- `src/routes/cooking.ts`: 9 pre-existing Hono context typing errors (`c.get('supabase')` / `c.get('user')` returning `unknown`). Verified present **before** 11-04 changes (same count after). Not introduced by this migration.

## Verification

- `cd packages/server && npm test -- cookingTips ingredientCategories routes/__tests__/cooking` — **35/35 green**
- `grep -c "anthropic" src/services/cookingTips.ts` — **0**
- `grep -c "anthropic" src/services/ingredientCategories.ts` — **0**
- `grep -c "anthropic" src/routes/cooking.ts` — **0**
- No new TS errors in migrated files (pre-change baseline: 9 in cooking.ts, 0 in cookingTips.ts, 0 in ingredientCategories.ts; post-change baseline: identical).

## Success Criteria

- [x] cookingTips, ingredientCategories, routes/cooking.ts all route via AIClient abstraction
- [x] Cache semantics preserved (cache hit, uncertainty empty-string no-cache path)
- [x] Enum-constrained classification preserved (StructuredTool schema + input coverage guard)
- [x] No anthropic singleton imports outside of the adapter in production services/routes
- [x] All tests in this plan green (35/35)
- [x] No new TS errors introduced by migration

## Self-Check: PASSED

- FOUND: packages/server/src/services/cookingTips.ts (migrated)
- FOUND: packages/server/src/services/ingredientCategories.ts (migrated)
- FOUND: packages/server/src/routes/cooking.ts (migrated)
- FOUND: packages/server/src/services/__tests__/cookingTips.test.ts (migrated)
- FOUND: packages/server/src/services/__tests__/ingredientCategories.test.ts (migrated)
- FOUND: packages/server/src/routes/__tests__/cooking.test.ts (migrated)
- FOUND commit 0aadba2 (Task 1)
- FOUND commit f9f65c1 (Task 2)
- FOUND commit fbebbbe (Task 3)
