---
phase: 06-recipe-library
plan: 03
subsystem: mobile-recipes
tags: [mobile, zustand, tdd, scaling, fraction.js]
requires:
  - "06-01: recipe types with is_favorite + 'ai' source"
provides:
  - "scaleIngredient(ing, multiplier): ParsedIngredient"
  - "formatQuantity(n): string"
  - "recipeStore.fetchRecipes(opts?: { q?, favoritesOnly? })"
  - "recipeStore.updateRecipe(id, patch)"
  - "recipeStore.deleteRecipe(id)"
  - "recipeStore.toggleFavorite(id)"
  - "recipeStore.{searchQuery, showFavoritesOnly, setSearchQuery, setShowFavoritesOnly}"
affects:
  - "apps/mobile/src/components/recipes/RecipeCard.tsx (badge map extended for 'ai')"
tech_stack:
  added: []
  patterns:
    - "Optimistic update + rollback via snapshot capture"
    - "URLSearchParams for typed query building"
    - "fraction.js for exact fractional arithmetic and mixed-fraction formatting"
key_files:
  created:
    - apps/mobile/src/lib/scaleIngredient.ts
    - apps/mobile/src/lib/__tests__/scaleIngredient.test.ts
  modified:
    - apps/mobile/src/stores/recipeStore.ts
    - apps/mobile/src/stores/__tests__/recipeStore.test.ts
    - apps/mobile/src/components/recipes/RecipeCard.tsx
decisions:
  - "formatQuantity short-circuits integers and zero before Fraction to avoid fraction.js mixed-form quirks"
  - "toggleFavorite implemented inline (not via updateRecipe) to keep rollback snapshot scope tight"
  - "fetchRecipes builds URL with URLSearchParams and only appends params that are set"
metrics:
  duration: ~3min
  completed: 2026-04-10
  tasks: 2
  files_touched: 5
---

# Phase 06 Plan 03: Mobile Scale Helper and Recipe Store Extensions Summary

Added fraction-aware ingredient scaling helper and extended the Zustand recipe store with update/delete/favorite/search actions, all built TDD against the existing store test harness.

## What Was Built

### scaleIngredient helper (`apps/mobile/src/lib/scaleIngredient.ts`)

```typescript
export function scaleIngredient(ing: ParsedIngredient, multiplier: number): ParsedIngredient
export function formatQuantity(n: number): string
```

- `scaleIngredient` uses `new Fraction(ing.quantity).mul(multiplier)` to avoid floating-point drift, then coerces back to `number`.
- Returns the ingredient unchanged when `quantity == null` (non-numeric ingredients like "salt to taste").
- `formatQuantity` short-circuits the integer and zero cases before calling `Fraction.toFraction(true)` so integers render as `"2"` (not `"2 0/1"`) and zero renders as `"0"`.
- Produces mixed fractions for improper values: `1.5 -> "1 1/2"`, and simple fractions for proper values: `0.75 -> "3/4"`.

### recipeStore extensions (`apps/mobile/src/stores/recipeStore.ts`)

Final action signatures:

```typescript
fetchRecipes: (opts?: { q?: string; favoritesOnly?: boolean }) => Promise<void>
updateRecipe: (id: string, patch: Partial<Recipe>) => Promise<void>
deleteRecipe: (id: string) => Promise<void>
toggleFavorite: (id: string) => Promise<void>
setSearchQuery: (q: string) => void
setShowFavoritesOnly: (v: boolean) => void
```

New state fields: `searchQuery: string` (default `''`), `showFavoritesOnly: boolean` (default `false`).

- **fetchRecipes** builds the URL with `URLSearchParams`: appends `q` when provided, `favorites=true` when `favoritesOnly` is truthy, otherwise hits bare `/api/v1/recipes`.
- **updateRecipe** snapshots the current `recipes` array, applies the optimistic patch, then PATCHes `/api/v1/recipes/:id`. On server error the snapshot is restored and `error` is set. On success the optimistic row is replaced with the server payload.
- **deleteRecipe** snapshots, optimistically filters out the target id, calls DELETE, restores snapshot on failure.
- **toggleFavorite** finds the current recipe, flips `is_favorite`, optimistically updates, then PATCHes with `{ is_favorite: nextValue }`. Inline implementation (not via `updateRecipe`) keeps the rollback snapshot scope tight to just this action. On success the server-returned row replaces the optimistic entry.
- All new methods reuse the existing `getApiBaseUrl()` and `getAuthToken()` helpers.
- All existing store methods (importFromUrl, importFromPhoto, importFromText, saveRecipe, clearImport) are preserved untouched.

## Edge Cases Handled

- `scaleIngredient` with `quantity: null` returns the input ingredient reference unchanged.
- `formatQuantity(0)` returns `"0"` directly.
- `formatQuantity` on any integer returns `String(n)` directly (avoids `"2 0/1"` style output).
- `fetchRecipes({})` with no options produces a bare URL with no query string.
- `toggleFavorite` on an unknown id is a no-op (silently returns).

## Verification

- `pnpm --filter @dinnertime/mobile test -- --run stores/recipeStore lib/scaleIngredient`: 72 tests passing (11 new store tests + 10 scaleIngredient tests + existing).
- `pnpm exec tsc --noEmit` (mobile): clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RecipeCard missing 'ai' source badge mappings**
- **Found during:** Task 2 typecheck after extending tests
- **Issue:** `SOURCE_LABELS` and `SOURCE_COLORS` in `RecipeCard.tsx` were declared as `Record<Recipe['source_type'], string>` but only defined `url | photo | manual`. The `'ai'` source added in 06-01 made this fail typecheck.
- **Fix:** Added `ai: 'AI'` label and `ai: 'bg-amber-100 text-amber-700'` color mapping.
- **Files modified:** `apps/mobile/src/components/recipes/RecipeCard.tsx`
- **Commit:** bb72e1a

**2. [Rule 3 - Blocking] recipeStore test mockRecipe missing `is_favorite`**
- **Found during:** Task 2 typecheck
- **Issue:** Pre-existing `mockRecipe` fixture omitted `is_favorite`, which became required after 06-01 added it to `Recipe`.
- **Fix:** Added `is_favorite: false` to the fixture.
- **Files modified:** `apps/mobile/src/stores/__tests__/recipeStore.test.ts`
- **Commit:** bb72e1a

## Commits

- `0a0cf1e` test(06-03): add failing tests for scaleIngredient helper
- `a03de9d` feat(06-03): implement scaleIngredient and formatQuantity helpers
- `32514fa` test(06-03): add failing tests for recipeStore update/delete/favorite/search
- `bb72e1a` feat(06-03): extend recipeStore with update/delete/favorite/search

## Success Criteria

UI plan 06-05 can now consume `recipeStore.toggleFavorite`, `fetchRecipes({ q })`, `scaleIngredient`, and `formatQuantity` without additional store or helper work.

## Self-Check: PASSED

- FOUND: apps/mobile/src/lib/scaleIngredient.ts
- FOUND: apps/mobile/src/lib/__tests__/scaleIngredient.test.ts
- FOUND: apps/mobile/src/stores/recipeStore.ts (modified)
- FOUND: apps/mobile/src/stores/__tests__/recipeStore.test.ts (modified)
- FOUND: commit 0a0cf1e
- FOUND: commit a03de9d
- FOUND: commit 32514fa
- FOUND: commit bb72e1a
