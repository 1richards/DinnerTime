---
phase: 06-recipe-library
plan: 02
subsystem: server-api
tags: [hono, supabase, rest, tdd, vitest]

requires:
  - phase: 06-recipe-library
    plan: 01
    provides: is_favorite column, Recipe types with is_favorite
provides:
  - PATCH /api/v1/recipes/:id (whitelisted field updates)
  - DELETE /api/v1/recipes/:id (scoped delete, returns 204)
  - GET /api/v1/recipes supports ?q= keyword search and ?favorites=true
  - Service helpers: updateRecipe, deleteRecipe, getRecipes options
affects: [06-recipe-library]

tech-stack:
  added: []
  patterns:
    - "Whitelist-then-filter patch building for safe partial updates"
    - "Escape-then-wrap ILIKE pattern to neutralize user-supplied % and _"
    - "Hono route testing via app.request() with vi.mock() on service + middleware"

key-files:
  created:
    - packages/server/src/services/__tests__/recipeStore.test.ts
    - packages/server/src/routes/__tests__/recipes.patch.test.ts
    - packages/server/src/routes/__tests__/recipes.delete.test.ts
    - packages/server/src/routes/__tests__/recipes.get.test.ts
  modified:
    - packages/server/src/services/recipeStore.ts
    - packages/server/src/routes/recipes.ts

key-decisions:
  - "ILIKE wildcards escaped with /[%_\\\\]/g -> \\$& before wrapping in %...%"
  - "updateRecipe returns null on PGRST116 instead of throwing; route maps to 404"
  - "PATCH body filtering uses Object.fromEntries+Array.includes against PATCHABLE_FIELDS constant"
  - "Created new __tests__ dir for route tests (first route-level tests in server package)"

patterns-established:
  - "Route tests mock ../../middleware/auth.js to set fake user/supabase on context, mock ../../services/recipeStore.js for unit isolation, then import recipes route and mount on a throwaway Hono app"
  - "Service tests use a chainable thenable mock that records method+args then resolves to {data,error} on await"

requirements-completed: [RECP-06, RECP-07, RECP-08]

duration: 3min
completed: 2026-04-10
---

# Phase 06 Plan 02: Recipe CRUD + Search + Favorites API Summary

**Server-side completion of recipe CRUD (PATCH, DELETE), keyword search, and favorites filtering with full TDD coverage (19 new tests).**

## Performance

- Duration: ~3 min
- Started: 2026-04-10
- Completed: 2026-04-10
- Tasks: 2
- Files modified: 6 (2 source, 4 test)

## Accomplishments

- Extended `getRecipes(supabase, profileId, opts?: { q?: string; favoritesOnly?: boolean })` with keyword search and favorites filter
- ILIKE wildcards escaped so `q='50%_off\'` queries `'%50\%\_off\\%'` (literal match, no wildcard injection)
- New `updateRecipe(supabase, profileId, recipeId, patch)` -> RecipeRow | null (null = PGRST116)
- New `deleteRecipe(supabase, profileId, recipeId)` -> void (throws on error)
- New route `PATCH /api/v1/recipes/:id` with 10-field whitelist (title, description, ingredients, steps, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, is_favorite, image_url)
- New route `DELETE /api/v1/recipes/:id` returns 204 with empty body
- Extended `GET /api/v1/recipes` to parse `?q=` and `?favorites=true` query params

## Task Commits

1. Task 1 RED: `110cfab` test(06-02): failing recipeStore tests
2. Task 1 GREEN: `99c3faf` feat(06-02): getRecipes options + updateRecipe + deleteRecipe
3. Task 2 RED: `98a2c4a` test(06-02): failing route tests
4. Task 2 GREEN: `5844de0` feat(06-02): PATCH/DELETE + extended GET

## Service Signatures

```typescript
export interface GetRecipesOptions { q?: string; favoritesOnly?: boolean }
export async function getRecipes(supabase, profileId, opts?: GetRecipesOptions): Promise<RecipeRow[]>
export async function updateRecipe(supabase, profileId, recipeId, patch: Record<string, unknown>): Promise<RecipeRow | null>
export async function deleteRecipe(supabase, profileId, recipeId): Promise<void>
```

## Whitelisted PATCH Fields

`title`, `description`, `ingredients`, `steps`, `prep_time_minutes`, `cook_time_minutes`, `total_time_minutes`, `servings`, `is_favorite`, `image_url`

Any other keys in the body (including `id`, `profile_id`) are silently dropped before `updateRecipe` is called.

## Wildcard Escape Approach

```typescript
function escapeIlikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}
// then: query.ilike('title', `%${escapeIlikePattern(opts.q)}%`)
```

This neutralizes all three Postgres LIKE metacharacters so user input can only match as a literal substring.

## Test Files

- `packages/server/src/services/__tests__/recipeStore.test.ts` (9 tests)
- `packages/server/src/routes/__tests__/recipes.patch.test.ts` (4 tests)
- `packages/server/src/routes/__tests__/recipes.delete.test.ts` (2 tests)
- `packages/server/src/routes/__tests__/recipes.get.test.ts` (4 tests)

Total: 19 new tests, all passing. Full server suite: 62 tests passing.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 3 - Blocking] Plan referenced non-existent test file.** The plan directed "extend existing recipeStore.test.ts" in packages/server, but that file did not exist (only a mobile-side recipeStore.test.ts exists). Created the file from scratch using the chainable-mock pattern established by pantry.test.ts. No user impact.
2. **[Rule 3 - Blocking] No existing route test harness in server package.** The plan said "check one existing file like recipes.test.ts" in `packages/server/src/routes/__tests__/` but that directory did not exist. Built a new harness pattern using `vi.hoisted` + `vi.mock` on `../../middleware/auth.js` and `../../services/recipeStore.js`, then `app.request()` via a mounted Hono instance. Also mocked `../../services/recipeParser.js` since `recipes.ts` imports it at module top-level.
3. **[Out of scope - deviation from plan wording]** Created a separate `recipes.get.test.ts` for the GET query-param tests instead of "extending the existing GET test file" (none existed). Three test files instead of two (patch, delete, get) keeps each focused.

No architectural changes. No user permission needed.

## Auth Gates

None encountered. All work is unit-level; no live Supabase calls.

## Issues Encountered

- Noticed pre-existing commits `32514fa` and `bb72e1a` on the branch tagged `06-03` containing an overlapping earlier implementation of updateRecipe/deleteRecipe on a different path. They did not conflict with this plan's work on `packages/server/src/services/recipeStore.ts`. Out of scope to reconcile; logged for 06-03 planner.

## Next Phase Readiness

Plan 06-03 (mobile recipe store) can now consume:
- `PATCH /api/v1/recipes/:id { is_favorite: true }` for favoriting
- `DELETE /api/v1/recipes/:id` for recipe deletion
- `GET /api/v1/recipes?q=pasta&favorites=true` for searched/filtered listing

No blockers.

## Self-Check: PASSED

- FOUND: packages/server/src/services/__tests__/recipeStore.test.ts
- FOUND: packages/server/src/routes/__tests__/recipes.patch.test.ts
- FOUND: packages/server/src/routes/__tests__/recipes.delete.test.ts
- FOUND: packages/server/src/routes/__tests__/recipes.get.test.ts
- FOUND: packages/server/src/services/recipeStore.ts (modified: updateRecipe/deleteRecipe/getRecipes options exported)
- FOUND: packages/server/src/routes/recipes.ts (modified: PATCH/DELETE handlers, GET query params)
- FOUND commit: 110cfab
- FOUND commit: 99c3faf
- FOUND commit: 98a2c4a
- FOUND commit: 5844de0

---
*Phase: 06-recipe-library*
*Completed: 2026-04-10*
