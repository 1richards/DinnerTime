---
phase: 10-skill-progression-offline
plan: 03
subsystem: server
tags: [hono, anthropic, haiku, supabase, cache, vitest, tdd]

requires:
  - phase: 10-skill-progression-offline
    plan: 01
    provides: recipe_step_tips table with composite PK and RLS
  - phase: 09-voice-cooking-mode
    plan: 03
    provides: existing /api/v1/cooking router with POST /ask handler
provides:
  - getOrGenerateTip service (Haiku-backed, Supabase cached)
  - GET /api/v1/cooking/tips endpoint with ownership check
affects: [10-05 mobile cook screen tip rendering]

tech-stack:
  added: []
  patterns:
    - "Haiku cache pattern: SELECT then INSERT on miss; uncertain (empty) responses are NOT cached so the model can fill them in on a future call"
    - "Hedging guard prompt forbids 'traditionally', 'some say', 'might' (Pitfall 5)"
    - "Route ownership check via recipes.profile_id = user.id, then delegate to service"

key-files:
  created:
    - packages/server/src/services/cookingTips.ts
    - packages/server/src/services/__tests__/cookingTips.test.ts
  modified:
    - packages/server/src/routes/cooking.ts
    - packages/server/src/routes/__tests__/cooking.test.ts
    - .planning/phases/10-skill-progression-offline/deferred-items.md

key-decisions:
  - "[Phase 10-03]: Don't cache uncertainty — empty Haiku responses bypass INSERT entirely so future model improvements can backfill"
  - "[Phase 10-03]: Service throws on Anthropic failure; route layer maps to 502 CLAUDE_ERROR (mirrors POST /ask)"
  - "[Phase 10-03]: getOrGenerateTip does NOT do the recipe ownership check — that lives in the route layer (single responsibility)"
  - "[Phase 10-03]: Cache INSERT errors are swallowed in the service (best-effort); the tip is still returned even if the row write races"
  - "[Phase 10-03]: max_tokens=120, temperature=0.3, model='claude-haiku-4-20250514' — bounded cost, low variability, latest haiku"

patterns-established:
  - "Per-step generative cache pattern (composite PK lookup + lazy generation + selective insert)"

requirements-completed: [SKIL-03]

duration: 2 min
completed: 2026-04-10
---

# Phase 10 Plan 03: Per-Step Cooking Tips (Haiku Cache) Summary

**Lazy per-step cooking tips backed by Claude Haiku and a Supabase cache, exposed via GET /api/v1/cooking/tips on the existing 09-03 cooking router.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-13T04:33:19Z
- **Completed:** 2026-04-13T04:35:22Z
- **Tasks:** 2 (both TDD)
- **Files created:** 2
- **Files modified:** 3

## Accomplishments

- `getOrGenerateTip(supabase, recipeId, stepIndex, stepText)` service: cache hit short-circuits Anthropic; cache miss calls Haiku with a hedging-guard system prompt and inserts the result; empty/whitespace responses return '' without caching; Anthropic errors propagate
- GET `/api/v1/cooking/tips?recipe_id=...&step_index=...&step_text=...` Hono route with 401 / 400 / 404 / 502 mappings, ownership check via `recipes.profile_id = auth.uid()`, mirrors the POST /ask validation style
- 6 new cookingTips service tests + 6 new route tests (12 net additions), all green; existing POST /ask tests untouched and still passing

## Task Commits

1. **Task 1 RED — failing cookingTips tests** — `768eea7` (test)
2. **Task 1 GREEN — cookingTips service** — `c3a5daa` (feat)
3. **Task 2 RED — extended cooking route tests** — `d8786ad` (test)
4. **Task 2 GREEN — GET /cooking/tips route** — `e2e2ffb` (feat)

## Files Created/Modified

- `packages/server/src/services/cookingTips.ts` — 99-line service with Haiku call, cache logic, hedging guard prompt
- `packages/server/src/services/__tests__/cookingTips.test.ts` — 6 tests covering hit/miss/empty/whitespace/guard/throws
- `packages/server/src/routes/cooking.ts` — added GET /tips handler (60 new lines)
- `packages/server/src/routes/__tests__/cooking.test.ts` — added GET /tips describe block (6 tests)
- `.planning/phases/10-skill-progression-offline/deferred-items.md` — logged in-progress 10-02 RED test as out-of-scope

## Decisions Made

See `key-decisions` in frontmatter — five decisions covering the don't-cache-uncertainty pattern, error mapping responsibility, ownership-check placement, best-effort INSERT, and Haiku model parameters.

## Deviations from Plan

None — plan executed exactly as written. RED → GREEN cycles passed first try on both tasks.

## Issues Encountered

**Out of scope: parallel 10-02 RED test failure.** `packages/server/src/services/__tests__/progression.test.ts` (commit `29670fe`) fails because the `progression.ts` service it imports does not exist yet. This is a deliberate RED test from the in-flight 10-02 wave running in parallel and will resolve when 10-02 GREEN lands. Logged in `deferred-items.md`. Does not affect 10-03 truths.

**193 of 194 server tests pass** (the one failure is the unrelated 10-02 RED file above; everything 10-03 touches is green).

## Verification

- `pnpm --filter server test -- --run cookingTips` → 6/6 passing
- `pnpm --filter server test -- --run cooking` → 13/13 passing (7 existing /ask + 6 new /tips)
- Full server suite: 193 passing, 1 unrelated 10-02 failure (out of scope, documented)
- Haiku uncertainty guard verifiable in prompt: test asserts `system` contains "uncertain", "empty string", and "traditionally"
- POST /ask tests untouched and still green (regression-free)

## Truths Verified (must_haves)

- ✅ Cache hit returns the stored tip without calling Claude (test: `cache hit: returns stored tip without calling Anthropic`)
- ✅ Cache miss calls Claude Haiku, stores the tip, and returns it (test: `cache miss: calls Haiku, inserts new row, returns generated tip`)
- ✅ Haiku returning empty string is honored (no tip) and NOT cached as empty (tests: `Haiku empty response`, `Haiku whitespace-only response`)
- ✅ GET /api/v1/cooking/tips returns tip for (recipe_id, step_index) or 404 (tests in `GET /tips` describe block)

## User Setup Required

None.

## Next Phase Readiness

- 10-05 (mobile cook screen) can call `GET /api/v1/cooking/tips?recipe_id=…&step_index=…&step_text=…` and render `body.tip` (treating empty string as "no tip available")
- Cache table is now populated organically as users cook; no warmup needed
- No blockers

## Self-Check: PASSED

- packages/server/src/services/cookingTips.ts: FOUND
- packages/server/src/services/__tests__/cookingTips.test.ts: FOUND
- Commit 768eea7: FOUND
- Commit c3a5daa: FOUND
- Commit d8786ad: FOUND
- Commit e2e2ffb: FOUND

---
*Phase: 10-skill-progression-offline*
*Completed: 2026-04-10*
