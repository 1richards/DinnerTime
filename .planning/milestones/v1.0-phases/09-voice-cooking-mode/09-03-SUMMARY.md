---
phase: 09-voice-cooking-mode
plan: 03
subsystem: api
tags: [hono, anthropic, claude-sonnet, voice, cooking, qa]

# Dependency graph
requires:
  - phase: 09-voice-cooking-mode
    provides: voice cooking foundation (deps, types, cookingStore) from 09-01
  - phase: 05-recipe-import
    provides: recipes table with title/ingredients/steps JSONB shape
provides:
  - POST /api/v1/cooking/ask endpoint — Claude Sonnet 4 Q&A with recipe context
  - Short-answer system prompt pattern (<=300 char spoken-style) for voice TTS
  - Mock pattern for @anthropic-ai/sdk default export in Hono route tests
affects: [09-voice-cooking-mode, mobile cooking UI, future voice pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock @anthropic-ai/sdk default export (NOT config wrapper) per Phase 08-02 decision"
    - "Belt-and-suspenders server-side truncation for LLM output length limits (Pitfall 6)"
    - "current_step_index clamping with Math.min/max to avoid out-of-range recipe step access"

key-files:
  created:
    - packages/server/src/routes/cooking.ts
    - packages/server/src/routes/__tests__/cooking.test.ts
  modified:
    - packages/server/src/index.ts

key-decisions:
  - "[Phase 09-03]: /cooking namespace is distinct from /voice — voice is future Whisper fallback; cooking is the Claude Q&A endpoint"
  - "[Phase 09-03]: System prompt embeds short-answer rule verbatim (load-bearing for TTS duration and cost)"
  - "[Phase 09-03]: Request validation treats invalid JSON and missing fields identically as 400 INVALID_REQUEST (single error shape for mobile)"
  - "[Phase 09-03]: current_step_index clamped server-side to [0, steps.length-1] so mobile can send stale indices without 400s"

patterns-established:
  - "System prompt assembly: title header + CURRENT STEP section + INGREDIENTS list + short-answer rule as trailing constraint"
  - "Claude error mapping: any anthropic.messages.create throw → 502 CLAUDE_ERROR (upstream failure, not server bug)"

requirements-completed: [VOIC-04]

# Metrics
duration: 2min
completed: 2026-04-10
---

# Phase 9 Plan 3: Cooking Q&A Endpoint Summary

**POST /api/v1/cooking/ask — Claude Sonnet 4 conversational Q&A with recipe+step context injection, short-answer rule, and 300-char truncation for voice TTS**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T00:37:02Z
- **Completed:** 2026-04-13T00:39:01Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- POST /api/v1/cooking/ask endpoint live on Hono app (mounted alongside /voice)
- 8 test cases green: happy path, 401 auth, 404 wrong-user, 400 invalid body, 400 invalid JSON, 502 Claude throw, 300-char truncation, step-index clamping
- System prompt includes recipe title, current step text, ingredients list, and short-answer rule verbatim
- Zero regressions: full server suite still passes (180/180)

## Task Commits

Task 1 executed as a TDD cycle (RED + GREEN, no refactor needed):

1. **Task 1 RED: failing cooking Q&A tests** — `ebc0bf3` (test)
2. **Task 1 GREEN: implement POST /cooking/ask** — `b9e8f51` (feat)

## Files Created/Modified
- `packages/server/src/routes/cooking.ts` — new Hono subrouter with /ask handler, system prompt builder, ingredient formatter, 300-char truncation
- `packages/server/src/routes/__tests__/cooking.test.ts` — 8 integration tests with mocked @anthropic-ai/sdk default export and fluent Supabase builder
- `packages/server/src/index.ts` — imports cooking route and mounts at /cooking

## Route Contract

```
POST /api/v1/cooking/ask
Authorization: Bearer <token>
Content-Type: application/json

Request:
{
  "recipe_id": string,
  "current_step_index": number,
  "question": string
}

Responses:
200 { "answer": string }                // <=300 chars, spoken-style
400 { "error": "INVALID_REQUEST" }      // missing/invalid body or non-JSON
404 { "error": "RECIPE_NOT_FOUND" }     // recipe not owned by authed user
502 { "error": "CLAUDE_ERROR" }         // anthropic.messages.create threw
```

## System Prompt Shape

```
You are a hands-free cooking assistant helping a user prepare "{recipe.title}".

CURRENT STEP:
{steps[clamped_index]}

RECIPE INGREDIENTS:
- {qty} {unit} {name}
- ...

Answers MUST be 1-3 sentences, spoken conversationally, no markdown, no bullet lists, no preamble.
```

Model: `claude-sonnet-4-latest`, `max_tokens: 200`.

## Test Matrix

| # | Scenario                                | Assertion                                                 |
|---|-----------------------------------------|-----------------------------------------------------------|
| 1 | No Authorization header                 | 401                                                       |
| 2 | Happy path (buttermilk substitute)      | 200 + Claude call shape + prompt contains title/step/rule |
| 3 | Recipe not owned by user                | 404 RECIPE_NOT_FOUND + Claude not called                  |
| 4 | Missing body fields                     | 400 INVALID_REQUEST                                       |
| 5 | Non-JSON body                           | 400                                                       |
| 6 | anthropic.messages.create throws        | 502 CLAUDE_ERROR                                          |
| 7 | Claude returns >300 char answer         | Answer length === 300, ends with "..."                    |
| 8 | current_step_index out of range (999)   | 200 + last step appears in system prompt (clamp to last)  |

## Decisions Made
- /cooking is a new sibling namespace to /voice. voice.ts transcribe stub remains in place for future Whisper fallback — no routes collide.
- Used the existing `anthropic` export from `config/anthropic.ts` directly (the plan's note about a "lazy singleton" matches how recipeDiscovery.ts consumes it). Test mocks the SDK default export so the constructed instance in config/anthropic.ts becomes a MockAnthropic.
- INVALID_REQUEST is returned for both malformed JSON and missing required fields to give mobile a single shape to handle.
- Step index is clamped instead of 400'd so mobile's optimistic UI can send stale indices during step transitions without user-facing failures.

## Deviations from Plan

None — plan executed exactly as written. System prompt rule string matches the plan's "no preamble" sentence verbatim.

## Issues Encountered

- **Pre-existing tsc errors unrelated to this task:** `src/services/__tests__/suggestions.test.ts` (Phase 04 file) has `member_type: string` vs `"adult" | "kid"` type errors. Not caused by this plan's changes. Out of scope per execution rules — NOT fixed, NOT deferred here (already pre-existing before 09-03).
- **Cosmetic tsc errors in route files:** `c.get('supabase')`/`c.get('user')` are typed `unknown` across all existing routes (recipes.ts, shopping.ts share the same pattern). My new `cooking.ts` inherits the same pattern and same cosmetic errors. Not fixed to stay consistent with existing routes.

## User Setup Required

None — no external service configuration. ANTHROPIC_API_KEY is already configured from earlier phases.

## Next Phase Readiness

- Backend Q&A endpoint is ready for mobile integration in subsequent 09 plans (UI + voice pipeline wiring).
- Mobile cookingStore (09-01) and intent router (09-02) can now call `/api/v1/cooking/ask` for the `ask` intent branch.
- Consider adding analytics/logging for prompt length + truncation rate in a later observability pass.

## Self-Check

Verifying claims:

- packages/server/src/routes/cooking.ts — FOUND
- packages/server/src/routes/__tests__/cooking.test.ts — FOUND
- packages/server/src/index.ts — FOUND (modified, mounts /cooking)
- Commit ebc0bf3 (test RED) — FOUND in git log
- Commit b9e8f51 (feat GREEN) — FOUND in git log
- cd packages/server && npm test -- cooking → 8/8 passed
- cd packages/server && npm test → 180/180 passed (zero regressions)

## Self-Check: PASSED

---
*Phase: 09-voice-cooking-mode*
*Completed: 2026-04-10*
