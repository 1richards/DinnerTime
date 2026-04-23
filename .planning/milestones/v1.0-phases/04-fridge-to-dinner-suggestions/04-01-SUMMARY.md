---
phase: 04-fridge-to-dinner-suggestions
plan: 01
subsystem: api
tags: [claude-api, tool-use, suggestions, hono, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-pantry-scanning
    provides: pantry_items table, PantryItem type, confidence decay logic
  - phase: 02-household-preferences
    provides: household_members table with dietary_restrictions, dietary_allergies, disliked_ingredients
provides:
  - buildSuggestionPrompt function for assembling Claude prompt from user context
  - getSuggestions service for fetching context and calling Claude API
  - DinnerSuggestion and SuggestionsResponse types
  - POST /api/v1/ai/suggest endpoint returning structured suggestions
affects: [04-02, 04-03, mobile-suggestions-store, suggestions-ui]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side-confidence-decay, dietary-allergy-vs-restriction-separation, prompt-assembly-pure-function]

key-files:
  created:
    - packages/server/src/services/suggestions.ts
    - packages/server/src/services/__tests__/suggestions.test.ts
  modified:
    - packages/server/src/routes/ai.ts

key-decisions:
  - "Replicated confidence decay logic server-side rather than importing from mobile"
  - "Prompt separates HARD CONSTRAINTS (allergies with NEVER) from SOFT PREFERENCES (dietary restrictions)"
  - "Empty pantry guard at <3 items returns 400 without calling Claude API"

patterns-established:
  - "Prompt assembly as pure exported function for testability"
  - "Server-side context assembly pattern: mobile sends minimal request, server fetches all DB context"
  - "Supabase mock pattern with chained method returns for service unit tests"

requirements-completed: [MEAL-01, MEAL-02, MEAL-03]

# Metrics
duration: 3min
completed: 2026-04-12
---

# Phase 4 Plan 1: AI Dinner Suggestion Service Summary

**Claude tool_use suggestion service with prompt assembly separating hard allergies from soft dietary preferences, kid-friendly logic, and confidence decay**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-12T07:53:28Z
- **Completed:** 2026-04-12T07:57:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Suggestion service assembles pantry items, household members, and profile into structured Claude prompt
- Prompt clearly separates hard allergies (NEVER) from soft dietary restrictions (prefer to avoid)
- Kid-friendly instruction included when household has children, with age-range context
- Confidence decay replicated server-side: 7-day grace, 0.05/day linear, floor at 0.1
- POST /api/v1/ai/suggest endpoint wired with auth, returning structured DinnerSuggestion[]
- 14 unit tests covering prompt assembly, dietary separation, kid-friendly logic, response parsing, empty pantry guard

## Task Commits

Each task was committed atomically:

1. **TDD RED: Failing tests for suggestion service** - `8363990` (test)
2. **TDD GREEN: Implement suggestion service + API endpoint** - `3a00df2` (feat)

## Files Created/Modified
- `packages/server/src/services/suggestions.ts` - Prompt assembly, confidence decay, Claude API call, response parsing
- `packages/server/src/services/__tests__/suggestions.test.ts` - 14 unit tests with mocked Anthropic SDK and Supabase
- `packages/server/src/routes/ai.ts` - POST /suggest endpoint wired to getSuggestions service

## Decisions Made
- Replicated confidence decay logic server-side rather than importing from mobile (different runtime, keeps server self-contained)
- buildSuggestionPrompt is a pure exported function for easy unit testing without mocking DB/API
- Empty pantry guard (<3 items) returns 400 with user-friendly message to save Claude API costs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Suggestion service ready for mobile consumption via POST /api/v1/ai/suggest
- DinnerSuggestion type defined server-side; mobile types (04-02) will mirror this
- Zustand store (04-02) can call this endpoint with authenticated fetch pattern

---
*Phase: 04-fridge-to-dinner-suggestions*
*Completed: 2026-04-12*
