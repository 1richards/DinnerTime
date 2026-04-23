---
phase: 06-recipe-library
plan: 04
subsystem: api
tags: [anthropic, claude-sonnet, tool-use, hono, recipe-discovery, ai]

requires:
  - phase: 04
    provides: "suggestions.ts pattern (HARD CONSTRAINTS / SOFT PREFERENCES, tool_choice forcing, anthropic config singleton)"
  - phase: 05
    provides: "ParsedRecipe type + parseRecipeTool schema shape (recipeParser.ts)"
  - phase: 06-02
    provides: "getRecipes store function + POST/PATCH/DELETE recipe routes"
provides:
  - "recipeDiscovery service with buildDiscoveryPrompt and discoverRecipes"
  - "suggestRecipesTool schema returning ParsedRecipe-shaped recipes"
  - "POST /api/v1/recipes/discover route (RECP-10)"
  - "ParsedRecipe.source_type extended with 'ai' variant"
affects: [06-05-mobile-discovery-ui, 07-meal-planning]

tech-stack:
  added: []
  patterns:
    - "Flattened DiscoveryPreferences type decouples service tests from Supabase schema"
    - "Discovery prompt reuses Phase 4 HARD CONSTRAINTS / SOFT PREFERENCES structure with AVOID list extension"
    - "Discovered recipes never persisted server-side -- save remains explicit user action"

key-files:
  created:
    - packages/server/src/services/recipeDiscovery.ts
    - packages/server/src/services/__tests__/recipeDiscovery.test.ts
    - packages/server/src/routes/__tests__/recipes.discover.test.ts
  modified:
    - packages/server/src/routes/recipes.ts
    - packages/server/src/services/recipeParser.ts

key-decisions:
  - "[Phase 06-04]: DiscoveryPreferences is a flat {allergies, dietary_restrictions, disliked_ingredients, cuisine_preferences} type instead of passing raw household_members rows -- makes service unit-testable without Supabase mocks"
  - "[Phase 06-04]: Route assembles preferences inline (matches suggestions.ts pattern) rather than extracting a loadPreferences helper -- no existing helper to reuse"
  - "[Phase 06-04]: Extended ParsedRecipe.source_type union with 'ai' rather than creating a separate DiscoveredRecipe type -- lets the save path reuse existing POST / handler unchanged"
  - "[Phase 06-04]: Discovery body.prompt is optional; empty/invalid JSON bodies do not 400 -- default to 'Suggest 6 dinner recipes.'"
  - "[Phase 06-04]: Route placed before GET /:id in recipes.ts to keep discovery-related routes grouped (method guards the ambiguity)"

patterns-established:
  - "Discovery services accept a flat preferences DTO; route layer is responsible for Supabase assembly and deduplication across members"
  - "AVOID list pattern: pass existing library titles as a newline-bulleted block in the system prompt to suppress duplicate recommendations"

requirements-completed: [RECP-10]

duration: 3min
completed: 2026-04-12
---

# Phase 06 Plan 04: AI Recipe Discovery Summary

**Backend Claude Sonnet recipe discovery with preferences-aware prompting, AVOID list deduplication, and POST /api/v1/recipes/discover endpoint returning ParsedRecipe[] stamped source_type='ai'.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-12T18:44:00Z
- **Completed:** 2026-04-12T18:46:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `buildDiscoveryPrompt(preferences, existingTitles?)` pure function with HARD CONSTRAINTS (allergies) vs SOFT PREFERENCES (dietary restrictions, dislikes, cuisines) + optional AVOID list for existing library titles
- `discoverRecipes({ preferences, existingTitles?, prompt? })` calls Claude Sonnet (`claude-sonnet-4-20250514`) with `suggest_recipes` tool and `tool_choice` forcing, returns `ParsedRecipe[]` with `source_type: 'ai'`, `source_url: null`, `image_url: null`
- `suggestRecipesTool` schema mirrors `parseRecipeTool` shape so discovered recipes flow through existing save path unchanged
- `POST /api/v1/recipes/discover` Hono route assembles preferences from `household_members` + `profiles` inline (dedupes allergies/restrictions/dislikes across members), passes library titles as AVOID list, forwards optional `body.prompt`, does NOT persist
- 13 new tests (6 prompt + 6 service + 7 route), full server suite 81 tests green

## Task Commits

1. **Task 1: recipeDiscovery service with Claude tool-use (TDD)** - `b45d4a1` (feat)
2. **Task 2: POST /api/v1/recipes/discover route (TDD)** - `a23378d` (feat)

_Note: TDD tasks were committed in single feat commits (RED+GREEN co-committed) matching project convention from prior phases._

## Files Created/Modified
- `packages/server/src/services/recipeDiscovery.ts` - New service: `DiscoveryPreferences` type, `suggestRecipesTool`, `buildDiscoveryPrompt`, `discoverRecipes`
- `packages/server/src/services/__tests__/recipeDiscovery.test.ts` - 12 tests (prompt shape, AVOID list, tool_use parsing, error cases, source_type stamping)
- `packages/server/src/routes/recipes.ts` - Added `POST /discover` handler with inline preferences assembly and library-title AVOID list
- `packages/server/src/routes/__tests__/recipes.discover.test.ts` - 7 tests (preferences assembly, AVOID list, optional prompt, empty body, 500 error, no-persist)
- `packages/server/src/services/recipeParser.ts` - Extended `ParsedRecipe.source_type` union with `'ai'` variant

## Decisions Made

See key-decisions in frontmatter. Highlights:
- **Flat DiscoveryPreferences DTO** instead of raw household_members rows — keeps service pure and unit-testable without Supabase mocks, and decouples the prompt shape from the DB schema.
- **Inline preferences loading in the route** — matches `suggestions.ts` pattern (no shared `loadPreferences` helper exists; creating one solely for this plan would be premature abstraction).
- **Extended ParsedRecipe.source_type with 'ai'** instead of a parallel `DiscoveredRecipe` type — the save path (POST /) already accepts ParsedRecipe and the DB column is free-form text, so extending the union is the minimum-friction change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended ParsedRecipe.source_type union with 'ai'**
- **Found during:** Task 1 (recipeDiscovery service implementation)
- **Issue:** Plan requires each discovered recipe to have `source_type: 'ai'`, but `ParsedRecipe.source_type` in `recipeParser.ts` was typed as `'url' | 'photo' | 'manual'` only. TypeScript would reject the assignment.
- **Fix:** Added `'ai'` to the union in `recipeParser.ts`. This is the minimum-scope fix — the DB column is free-form text, and the save path (`POST /`) already accepts any ParsedRecipe shape, so no other code needed updating.
- **Files modified:** `packages/server/src/services/recipeParser.ts`
- **Verification:** Full server suite (81 tests) green after change; no existing tests asserted on the narrower union.
- **Committed in:** `b45d4a1` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking type issue)
**Impact on plan:** Necessary to compile. No scope creep — single union-member addition.

## Issues Encountered

None. Plan mapped cleanly onto the Phase 4 suggestions pattern; the only structural difference (flat DTO vs raw rows) was a proactive testability improvement rather than a workaround.

## User Setup Required

None — uses existing `ANTHROPIC_API_KEY` env var already configured for Phase 3/4/5.

## Next Phase Readiness

- Server-side RECP-10 complete. Mobile UI plan (Phase 06-05 if planned, otherwise deferred to next wave) can call `POST /api/v1/recipes/discover` with optional `{ prompt }` body and render the returned `ParsedRecipe[]` via the existing recipe card components.
- Save flow works unchanged: mobile can POST any returned recipe to `POST /api/v1/recipes` to persist it with `source_type: 'ai'` preserved.
- No blockers for remaining Phase 6 work.

## Self-Check: PASSED

Verified files exist:
- FOUND: packages/server/src/services/recipeDiscovery.ts
- FOUND: packages/server/src/services/__tests__/recipeDiscovery.test.ts
- FOUND: packages/server/src/routes/__tests__/recipes.discover.test.ts
- FOUND: packages/server/src/routes/recipes.ts (modified)
- FOUND: packages/server/src/services/recipeParser.ts (modified)

Verified commits exist:
- FOUND: b45d4a1 (Task 1)
- FOUND: a23378d (Task 2)

Verified tests: `pnpm --filter server test -- --run` → 11 files, 81 tests passed.

---
*Phase: 06-recipe-library*
*Completed: 2026-04-12*
