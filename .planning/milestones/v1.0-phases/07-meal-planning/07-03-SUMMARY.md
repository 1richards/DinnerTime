---
phase: 07-meal-planning
plan: 03
subsystem: api
tags: [meal-planning, hono, routes, ingredient-matching, tdd, vitest, idempotency]

requires:
  - phase: 07-meal-planning
    provides: generateMealPlan service, buildMealPlanPrompt, generate_meal_plan tool, meal_plans/meal_plan_entries schema
  - phase: 03-pantry
    provides: pantry_items table and PantryItem type with normalized_name
  - phase: 01-foundation
    provides: authMiddleware, Hono app, Supabase user client
provides:
  - "matchIngredientsToPantry pure utility with deduct + willDeplete semantics"
  - "normalizeIngredientName (trim + lowercase + trailing es/s strip)"
  - "regenerateDay(supabase, profileId, planId, dayOfWeek) service that re-fetches fresh context and updates one entry"
  - "markCooked(supabase, profileId, planId, dayOfWeek) service with idempotent 409 ALREADY_COOKED and pantry deductions"
  - "GET /meal-plans/current returning active plan for the current Monday week_start"
  - "POST /meal-plans/generate returning 201 / 400 EMPTY_PANTRY / 502 INVALID_PLAN_LENGTH"
  - "POST /meal-plans/:id/entries/:day/regenerate with 0..6 day validation"
  - "POST /meal-plans/:id/entries/:day/cook returning { entry, pantryDelta } and 409 on repeat"
  - "mondayOf(date) helper computing ISO week start in UTC"
affects: [07-04 mobile store, 07-05 meal-plan UI, 08 shopping list]

tech-stack:
  added: []
  patterns:
    - "Pure matching utility (zero I/O) factored out for shared reuse by cook-deduct now and shopping list later"
    - "Service-level idempotency via status check + typed error.code=ALREADY_COOKED with status=409"
    - "Re-fetch fresh context on regenerate (Pitfall 2) instead of passing a snapshot"
    - "Scoped regenerate prompt appends exclusion clause onto buildMealPlanPrompt rather than forking prompt logic"
    - "Route layer branches on error.code (EMPTY_PANTRY, INVALID_PLAN_LENGTH, ALREADY_COOKED) to map to HTTP status"
    - "Normalization strategy (trim + lowercase + es/s strip) documented as superset of pantry.normalizeName with backfill migration path"

key-files:
  created:
    - packages/server/src/services/ingredientMatching.ts
    - packages/server/src/services/__tests__/ingredientMatching.test.ts
    - packages/server/src/routes/__tests__/meal-plans.test.ts
  modified:
    - packages/server/src/services/mealPlanner.ts
    - packages/server/src/services/__tests__/mealPlanner.test.ts
    - packages/server/src/routes/meal-plans.ts

key-decisions:
  - "[Phase 07-03]: normalizeIngredientName strips trailing 'es' then 's' so 'Tomatoes' collapses to 'tomato' matching pantry 'tomato'"
  - "[Phase 07-03]: Pantry-item match preserves insertion order and resolves duplicates by first occurrence (simpler + deterministic)"
  - "[Phase 07-03]: regenerateDay re-fetches pantry/members/profile/recipes on every call (Pitfall 2) — never trusts caller snapshot"
  - "[Phase 07-03]: Scoped regenerate prompt appends 'REGENERATION CONTEXT' block with the excluded title rather than forking buildMealPlanPrompt"
  - "[Phase 07-03]: markCooked idempotency via status==='cooked' guard throwing Error with code=ALREADY_COOKED and status=409"
  - "[Phase 07-03]: willDeplete (pantry.qty <= needed) sets pantry row status='used' — consistent with Phase 3 expand-to-act lifecycle"
  - "[Phase 07-03]: Route layer matches service error codes (EMPTY_PANTRY→400, INVALID_PLAN_LENGTH→502, ALREADY_COOKED→409) instead of string sniffing"
  - "[Phase 07-03]: mondayOf uses UTC exclusively; JS getUTCDay Sun=0 shifted so Monday becomes week start"
  - "[Phase 07-03]: Day-of-week validated as integer in 0..6 at route boundary before touching services"

patterns-established:
  - "Pure match/normalize utilities live beside their service consumers and export helper names for test reuse"
  - "Idempotency is enforced at service layer (not route layer) so every caller gets the 409 guarantee"
  - "Service errors use code-on-error pattern ({code, status}) so routes map 1:1 to HTTP without try/catch branching on message text"

requirements-completed: [PLAN-01, PLAN-05, PLAN-06, PLAN-07]

duration: 5min
completed: 2026-04-10
---

# Phase 07 Plan 03: Meal Plan Routes + Services Summary

**Shared ingredientMatching utility, regenerateDay + markCooked service functions, and four Hono endpoints (current / generate / regenerate / cook) completing the server side of Phase 7 with full TDD coverage.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-12T19:15:45Z
- **Completed:** 2026-04-12T19:20:22Z
- **Tasks:** 3 (all TDD)
- **Files created:** 3
- **Files modified:** 3
- **Tests added:** 27 (11 ingredientMatching + 8 regenerateDay/markCooked + 8 routes)
- **Full server suite:** 125 passing / 14 test files

## Accomplishments

- `matchIngredientsToPantry` pure utility with case/whitespace/plural-insensitive matching, quantity deduction, and `willDeplete` flag. Normalization strip 'es' or 's' so "Tomatoes" matches pantry "tomato".
- `regenerateDay` service re-fetches fresh pantry + preferences + recipes on every call (Pitfall 2), appends a scoped REGENERATION CONTEXT block with the excluded title onto the base prompt, calls Claude via existing `generate_meal_plan` tool, picks the matching day, and updates the single entry row in place.
- `markCooked` service loads the entry, short-circuits with `{ code: 'ALREADY_COOKED', status: 409 }` if already cooked, otherwise matches ingredients to pantry, applies per-item quantity deductions (status='used' when depleted), marks the entry cooked with cooked_at timestamp, and returns `{ entry, pantryDelta }`.
- Four Hono endpoints replacing the prior 501 stub, all under authMiddleware:
  - `GET /current` computes Monday week_start server-side via `mondayOf()`, loads plan + entries, 404 if absent.
  - `POST /generate` calls the service, maps `EMPTY_PANTRY→400`, `INVALID_PLAN_LENGTH→502`, otherwise 201.
  - `POST /:id/entries/:day/regenerate` validates day∈0..6 then delegates.
  - `POST /:id/entries/:day/cook` delegates and maps `ALREADY_COOKED→409`.
- Pure `mondayOf(date)` helper in UTC; exported for potential reuse and ease of unit testing.

## Task Commits

1. **Task 1 RED: failing tests for ingredientMatching** — `c410cf6` (test)
2. **Task 1 GREEN: implement ingredientMatching utility** — `31fc016` (feat)
3. **Task 2 RED: failing tests for regenerateDay + markCooked** — `80093b0` (test)
4. **Task 2 GREEN: regenerateDay + markCooked service** — `32c3459` (feat)
5. **Task 3 RED: failing route tests for meal-plans** — `5fceb4d` (test)
6. **Task 3 GREEN: implement meal-plans routes** — `8acf806` (feat)

_(Note: commits d1cf3f4 / d2e644b / 48b8482 / 4f9d489 in log range belong to a separate 07-04 track and are unrelated to this plan.)_

## Files Created/Modified

- `packages/server/src/services/ingredientMatching.ts` — 84 lines: MatchResult, normalizeIngredientName (trim+lowercase+es/s strip), matchIngredientsToPantry using Map<norm, PantryItem> for first-match deterministic lookup
- `packages/server/src/services/__tests__/ingredientMatching.test.ts` — 11 tests covering exact match, normalization, quantity deduction, willDeplete, unmatched list, undefined-quantity default, duplicate-pantry, and normalizeIngredientName behavior
- `packages/server/src/services/mealPlanner.ts` — +~260 lines: regenerateDay (context re-fetch + scoped prompt + in-place update) and markCooked (idempotency guard + matchIngredientsToPantry + pantry updates + cooked_at stamp)
- `packages/server/src/services/__tests__/mealPlanner.test.ts` — +354 lines: 3 regenerateDay tests + 5 markCooked tests with stubbed Supabase builder chains
- `packages/server/src/routes/meal-plans.ts` — 146 lines: replaces the 501 stub with 4 handlers + mondayOf helper
- `packages/server/src/routes/__tests__/meal-plans.test.ts` — 230 lines: 8 tests using hoisted auth + service mocks, Hono test client

## Decisions Made

- Normalization uses trailing `es` OR `s` strip to collapse "Tomatoes"/"tomato" (richer than pantry.normalizeName which is trim+lowercase only). Documented in module header as a backfill migration path rather than mutating pantry.normalizeName now.
- regenerateDay picks the Claude-returned day matching `day_of_week`, fallback to first. Defends against Claude returning a 7-day array.
- Route layer maps service error `code` → HTTP status via exact string match, not message sniffing. EMPTY_PANTRY→400, INVALID_PLAN_LENGTH→502, ALREADY_COOKED→409.
- `mondayOf` operates strictly in UTC so server timezone drift cannot shift the active week.

## Deviations from Plan

Two deviations, both self-contained and resolved during the task:

### Auto-fixed Issues

**1. [Rule 1 — Bug] Normalization strategy required `es` strip, not just `s`**
- **Found during:** Task 1 GREEN
- **Issue:** Plan specified naive trailing-'s' removal. Initial implementation stripped only one 's', so "tomatoes"→"tomatoe" and pantry "tomato"→"tomato" didn't match, breaking Test 2 ("Normalized name match").
- **Fix:** `normalizeIngredientName` now strips trailing `es` (if len>2) first, then `s` (if len>1). Both "tomatoes" and "tomato" collapse to "tomato".
- **Files modified:** packages/server/src/services/ingredientMatching.ts
- **Verification:** Tests 1,2,5,8 pass with identical normalization on both sides.
- **Committed in:** `31fc016`

**2. [Rule 3 — Blocking] Test 8c stale assertion after normalization change**
- **Found during:** Task 1 GREEN (after fix 1)
- **Issue:** Test 8c had a placeholder assertion expecting `'tomatoe'` from the original naive strategy, blocking the green run.
- **Fix:** Updated Test 8c to assert `'tomato'` and `'carrot'` for "Tomatoes" and "carrots" respectively.
- **Files modified:** packages/server/src/services/__tests__/ingredientMatching.test.ts
- **Verification:** 11/11 pass.
- **Committed in:** `31fc016` (same green commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Corrected the normalization rule to what the test semantics demanded. No scope creep, no architecture change.

## Issues Encountered

- Stubbed Supabase builder chain in `mealPlanner.test.ts` needed both `single()` and `maybeSingle()` on the `.eq().eq()` path because `regenerateDay` uses `single()` while `generateMealPlan` uses `maybeSingle()`. Added both to the shared mock (no production change).
- Pre-existing `deferred-items.md` entries from earlier phases remain untouched. No new lint/typecheck failures introduced.

## User Setup Required

None — fully autonomous. `ANTHROPIC_API_KEY` remains the only runtime requirement (already provisioned).

## Next Phase Readiness

- Mobile meal-plan store (07-04) now has four stable endpoints to call: `GET /current`, `POST /generate`, `POST /:id/entries/:day/regenerate`, `POST /:id/entries/:day/cook`.
- The pure `matchIngredientsToPantry` utility is ready for Phase 8 shopping list to compute "what must be bought" per plan.
- `regenerateDay` + `markCooked` match the must_haves truths: 409 on double-cook, fresh pantry on swap, single-entry replacement.
- No blockers.

## Self-Check

- FOUND: packages/server/src/services/ingredientMatching.ts
- FOUND: packages/server/src/services/__tests__/ingredientMatching.test.ts
- FOUND: packages/server/src/routes/__tests__/meal-plans.test.ts
- FOUND: packages/server/src/routes/meal-plans.ts (501 stub removed, verified via Grep)
- FOUND: commit c410cf6 (test 07-03 ingredientMatching RED)
- FOUND: commit 31fc016 (feat 07-03 ingredientMatching GREEN)
- FOUND: commit 80093b0 (test 07-03 mealPlanner RED)
- FOUND: commit 32c3459 (feat 07-03 mealPlanner services GREEN)
- FOUND: commit 5fceb4d (test 07-03 meal-plans routes RED)
- FOUND: commit 8acf806 (feat 07-03 meal-plans routes GREEN)
- Verified: `pnpm --filter @dinnertime/server test` → 125 passed / 14 test files / 0 failures

## Self-Check: PASSED

---
*Phase: 07-meal-planning*
*Completed: 2026-04-10*
