# Deferred Items - Phase 11 Hybrid AI Client

Items discovered during execution that are out of scope for the current plan.

## From 11-02 (vision + recipeParser migration)

- **src/services/ingredientCategories.ts:287** — still imports `anthropic` directly. Out of scope for 11-02 (plan scope: vision + recipeParser only). Will be migrated in a later wave (11-03 or 11-04) as that service moves onto the AIClient abstraction.
- **src/services/__tests__/suggestions.test.ts** — pre-existing TS2345/TS2322 errors about `member_type` being `string` instead of `"adult" | "kid"` literal union. Predates this phase entirely; not related to AI client migration.
