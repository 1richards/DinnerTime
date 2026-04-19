# Deferred Items — Phase 18

## Pre-existing TypeScript errors (out-of-scope for 18-01)

`npx tsc --noEmit -p .` in `packages/server/` reports hundreds of errors in files
Phase 18-01 did not touch:

- `src/routes/{pantry,recipes,meal-plans,shopping,cooking,progression,ai}.ts` — implicit-any on Hono handler args
- `src/services/__tests__/suggestions.test.ts` — `HouseholdMemberRow.member_type` literal union mismatch
- `src/services/recipeParser.ts` — `source_type: 'ai'` not in the `'url' | 'photo' | 'manual'` union (Phase 6-04 decision noted this divergence; types never caught up)
- `src/routes/__tests__/shopping.test.ts` — one test type mismatch

Files Phase 18-01 added or modified (`itemLocation.ts`, `itemLocation.test.ts`,
`migrations.test.ts`, the added `SOURCE_LOCATIONS`/`SourceLocation` block in
`vision.ts`) are **all clean** under `npx tsc --noEmit -p .`.

Vitest runs green: all 45 tests across itemLocation + migrations +
ingredientCategories pass. The project's test runner does not gate on tsc
cleanliness today.

Recommendation: address in a dedicated typing cleanup pass or during Phase 23
(Non-Functional Requirements).
