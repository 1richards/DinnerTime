---
phase: 05-recipe-import
plan: 02
subsystem: api, ai
tags: [cheerio, json-ld, claude-vision, recipe-parsing, hono, supabase]

# Dependency graph
requires:
  - phase: 05-recipe-import
    provides: ParsedRecipe/ParsedIngredient types, parse_recipe tool, parseDuration helper, cheerio, recipes table
  - phase: 03-pantry-scan
    provides: vision.ts Claude Vision pattern, anthropic singleton
provides:
  - parseRecipeFromUrl with JSON-LD extraction and Claude fallback
  - parseRecipeFromPhoto via Claude Vision with parse_recipe tool
  - parseRecipeFromText via Claude with parse_recipe tool
  - recipeStore CRUD operations (save, list, getById, duplicate check)
  - Recipe API routes (3 import endpoints, save, list, getById)
affects: [05-recipe-import, 06-meal-planning]

# Tech tracking
tech-stack:
  added: []
  patterns: [JSON-LD extraction with cheerio for structured recipe data, Claude tool_use fallback for unstructured content]

key-files:
  created:
    - packages/server/src/services/recipeStore.ts
    - packages/server/src/services/__tests__/recipeParser.test.ts
  modified:
    - packages/server/src/services/recipeParser.ts
    - packages/server/src/routes/recipes.ts

key-decisions:
  - "JSON-LD ingredients still sent through Claude parse_recipe tool for structured parsing (raw strings to ParsedIngredient)"
  - "parseDuration accepts null/undefined gracefully (guard clause) for safe JSON-LD mapping"
  - "Duplicate URL detection via findRecipeBySourceUrl returns existing recipe with duplicate flag"

patterns-established:
  - "JSON-LD extraction: cheerio load -> find script[type=application/ld+json] -> recursive @graph search"
  - "Claude tool_use pattern: callClaudeParseRecipe helper centralizes tool invocation and response parsing"
  - "Recipe store: simple Supabase CRUD with profile_id scoping following pantry pattern"

requirements-completed: [RECP-01, RECP-02, RECP-03, RECP-04, RECP-05]

# Metrics
duration: 4min
completed: 2026-04-12
---

# Phase 5 Plan 2: Recipe Parser Service Summary

**TDD recipe parser with JSON-LD extraction, Claude Vision photo import, freeform text parsing, recipe DB store, and 6 API endpoints**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-12T08:22:10Z
- **Completed:** 2026-04-12T08:26:06Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- 17 unit tests covering all three import paths (URL/photo/text), JSON-LD extraction, mapping, and duration parsing
- Full recipe parser with JSON-LD-first strategy and Claude fallback for unstructured pages
- Recipe store with save, list, getById, and duplicate URL detection
- Six API routes: 3 import endpoints + save + list + getById with auth middleware

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for recipe parser** - `88fea65` (test)
2. **Task 2 (GREEN): Implement recipe parser service** - `6a873e0` (feat)
3. **Task 3: Recipe store and API routes** - `41d9583` (feat)

## Files Created/Modified
- `packages/server/src/services/__tests__/recipeParser.test.ts` - 17 tests for parser functions
- `packages/server/src/services/recipeParser.ts` - extractRecipeJsonLd, mapJsonLdToRecipe, parseRecipeFromUrl/Photo/Text
- `packages/server/src/services/recipeStore.ts` - saveRecipe, getRecipes, getRecipeById, findRecipeBySourceUrl
- `packages/server/src/routes/recipes.ts` - POST /import/url, /import/photo, /import/text, POST /, GET /, GET /:id

## Decisions Made
- JSON-LD ingredients (string arrays) still sent through Claude parse_recipe tool for structured ParsedIngredient parsing
- parseDuration updated to accept null/undefined input for safe JSON-LD mapping
- Duplicate URL detection returns existing recipe with `duplicate: true` flag rather than erroring

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three import paths ready for mobile UI integration in Plan 03
- Recipe save/list endpoints ready for recipe collection feature
- Full test suite green (41 tests across 5 files)

---
*Phase: 05-recipe-import*
*Completed: 2026-04-12*
