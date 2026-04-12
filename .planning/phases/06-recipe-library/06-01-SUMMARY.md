---
phase: 06-recipe-library
plan: 01
subsystem: database
tags: [supabase, postgres, typescript, fraction.js, migrations]

requires:
  - phase: 05-recipe-import
    provides: recipes table schema, Recipe/ParsedRecipe TypeScript types
provides:
  - is_favorite column on recipes with partial index for efficient filtering
  - source_type CHECK constraint extended to include 'ai'
  - Recipe and ParsedRecipe TypeScript types updated with is_favorite and 'ai' source
  - fraction.js installed in mobile workspace for ingredient scaling
affects: [06-recipe-library]

tech-stack:
  added: [fraction.js ^5.3.4]
  patterns:
    - Partial index for boolean flag filtering (WHERE is_favorite = TRUE)
    - DROP + ADD CONSTRAINT pattern for extending CHECK enumerations

key-files:
  created:
    - supabase/migrations/00005_recipe_favorites.sql
  modified:
    - apps/mobile/src/types/recipe.ts
    - apps/mobile/package.json

key-decisions:
  - "Used partial index on is_favorite=TRUE to keep index small since most recipes won't be favorited"
  - "Extended existing RLS UPDATE policy covers is_favorite column without new policies"
  - "fraction.js 5.3.4 selected for ingredient quantity scaling (handles rational arithmetic)"

patterns-established:
  - "Migration pattern: DROP CONSTRAINT then ADD CONSTRAINT for extending CHECK enums"
  - "Type union extension: update both ParsedRecipe literal union and ImportSource alias in lockstep"

requirements-completed: [RECP-08, RECP-10]

duration: 4min
completed: 2026-04-10
---

# Phase 06 Plan 01: Recipe Library Foundation Summary

**Recipe library groundwork: is_favorite column with partial index, 'ai' source_type support, mobile types updated, and fraction.js installed for scaling**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-10
- **Completed:** 2026-04-10
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Migration 00005_recipe_favorites.sql adds `is_favorite BOOLEAN NOT NULL DEFAULT FALSE` to recipes
- Partial index `idx_recipes_profile_favorite` for efficient favorites-only filtering
- source_type CHECK constraint extended from `('url','photo','manual')` to include `'ai'`
- Recipe and ParsedRecipe TypeScript types updated (is_favorite field, 'ai' union variant)
- fraction.js ^5.3.4 installed in apps/mobile for downstream ingredient scaling work

## Task Commits

1. **Task 1: Create migration 00005_recipe_favorites.sql** - `95f19d8` (feat)
2. **Task 2: Extend Recipe/ParsedRecipe types and install fraction.js** - `f761f55` (feat)

## Files Created/Modified
- `supabase/migrations/00005_recipe_favorites.sql` - New migration: is_favorite column, partial index, extended source_type CHECK
- `apps/mobile/src/types/recipe.ts` - Added 'ai' to source_type unions and ImportSource; added is_favorite to Recipe
- `apps/mobile/package.json` - fraction.js ^5.3.4 dependency

## Decisions Made
- **Partial index choice:** Used `WHERE is_favorite = TRUE` partial index rather than full composite index; most recipes won't be favorited so the partial index stays small while still accelerating the primary favorites-listing query.
- **No new RLS policies:** Existing UPDATE policy (`auth.uid() = profile_id`) already governs all recipe columns including is_favorite, per Phase 6 research Pitfall 1.
- **Migration not applied locally:** No `db:push` script exists in packages/server/package.json; migration file will be picked up on next Supabase deployment. No local DB state to update.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `tsc --noEmit` reports 3 pre-existing consumer errors (RecipeCard.tsx, recipeStore.test.ts) due to the type union and Recipe interface changes. Plan explicitly instructed NOT to fix these in scope — they will be addressed in downstream store/UI plans (06-02, 06-03). No action taken.
- pnpm install printed a pre-existing peer warning for `react-native-worklets` (unrelated to this plan).

## Next Phase Readiness

Downstream Phase 6 plans (02 server CRUD, 03 mobile store, 04 UI) can now:
- Reference `is_favorite` on Recipe
- Use `'ai'` as a valid source_type literal
- Import `Fraction` from fraction.js for ingredient scaling

No blockers. Migration must be applied via Supabase deployment before server CRUD testing against a live database.

## Self-Check: PASSED

- FOUND: supabase/migrations/00005_recipe_favorites.sql
- FOUND: apps/mobile/src/types/recipe.ts (modified)
- FOUND: apps/mobile/package.json (fraction.js present)
- FOUND commit: 95f19d8
- FOUND commit: f761f55

---
*Phase: 06-recipe-library*
*Completed: 2026-04-10*
