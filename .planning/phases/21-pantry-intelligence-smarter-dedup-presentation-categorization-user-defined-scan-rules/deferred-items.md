# Phase 21 Deferred Items

Pre-existing issues discovered during plan execution but unrelated to the plan's scope. Tracked here for a future cleanup plan.

## Pre-existing TypeScript errors on main (discovered during 21-01)

**Scope:** Discovered 2026-04-19 while running `npx tsc --noEmit -p packages/server` as part of 21-01 verification. Confirmed present on `main` before 21-01's migration additions — unrelated to this plan.

### 1. `packages/server/src/services/__tests__/suggestions.test.ts`

- Multiple `HouseholdMemberRow` type mismatches on `member_type: string` vs the union `"adult" | "kid"` (lines 116, 123, 131, 139, 146, 153, 163, 179).
- Root cause: test fixtures use plain `string` member_type; should use `satisfies` cast or literal typing.
- Fix scope: one-line `as const` or `satisfies HouseholdMemberRow` per fixture.

### 2. `packages/server/src/services/recipeParser.ts` line 415

- `Argument of type '"ai"' is not assignable to parameter of type '"url" | "photo" | "manual"'`.
- Root cause: Phase 06-04 added `'ai'` to the `ParsedRecipe.source_type` union but the consumer at `recipeParser.ts:415` still uses the narrower triple.
- Fix scope: widen the target signature's type to include `'ai'`, or guard with an assertion.

### 3. Passing files — migrations.test.ts

The file added by 21-01 passes both vitest (68/68 green) and tsc within its own scope. The tsc failures above are unrelated.

**Recommended home:** A Phase 23 observability/hygiene micro-plan, or a GSD `/quick` fix.

## Pre-existing mobile test failures on main (discovered during 21-04)

**Scope:** Discovered 2026-04-19 while running `apps/mobile && pnpm test --run` during 21-04. Confirmed pre-existing via `git stash && pnpm test` — none caused by Phase 21 work.

### 4. `apps/mobile/__tests__/auth-store.test.ts`

- Single failing test: "should set isOnboarded based on profile.onboarding_complete". Pre-dates Phase 21.

### 5. `apps/mobile/src/stores/__tests__/progressionStore.test.ts`

- Single failing test: "fetchVariations returns string[] on 200". Probably schema drift after Phase 10 landed structured variations.

### 6. `apps/mobile/src/stores/__tests__/shoppingStore.test.ts`

- Two failing tests (`generateList` and `fetchCurrent`) — test fixtures expect the pre-Phase 8 response shape `list` directly rather than `{list, items}`. Expected object wraps currentList by one layer.

**Recommended home:** Phase 23 observability/hygiene micro-plan. These are isolated fixture-level test drift and do not indicate production regressions.
