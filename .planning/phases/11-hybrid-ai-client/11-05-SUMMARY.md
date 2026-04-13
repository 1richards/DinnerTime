---
phase: 11-hybrid-ai-client
plan: 05
subsystem: ai
tags: [ai, anthropic, gemini, smoke-test, cleanup]

requires:
  - phase: 11-hybrid-ai-client
    provides: "All services migrated to AIClient abstraction; zero vendor SDK coupling outside ai/adapters/"
provides:
  - "config/anthropic.ts singleton deleted — zero dead code"
  - "Env-gated AI smoke test script (scripts/ai-smoke-test.ts)"
  - "npm run ai:smoke — manual safety net for spot-checking live provider calls"
  - "Phase 11 hybrid AI client refactor closed out"
affects: [future-phases-needing-new-ai-task]

tech-stack:
  added: []
  patterns:
    - "Env-gated smoke scripts (AI_SMOKE=1) for live-provider verification outside CI"
    - "ALL_TASKS iteration pattern proves routing table stays exhaustive at runtime"

key-files:
  created:
    - packages/server/scripts/ai-smoke-test.ts
  modified:
    - packages/server/package.json
  deleted:
    - packages/server/src/config/anthropic.ts

key-decisions:
  - "[Phase 11-05]: Smoke script iterates ALL_TASKS and dispatches by task family (image vs text-only vs structured) — single script covers every route with correct call shape"
  - "[Phase 11-05]: Smoke script exits 0 when AI_SMOKE unset so accidental invocation never counts as failure, and is not wired into `npm test`"
  - "[Phase 11-05]: Pre-existing server TS error count (151) predates phase 11 entirely (documented in deferred-items.md); file deletion introduced zero new errors — out of scope per scope boundary rule"

patterns-established:
  - "Live-provider smoke tests live in packages/server/scripts/ and are env-gated"
  - "Delete the singleton only after verifying zero grep matches outside adapters"

requirements-completed: [ARCH-02, ARCH-03]

duration: 3min
completed: 2026-04-13
---

# Phase 11 Plan 05: Phase Closeout Summary

**Deleted config/anthropic.ts singleton, added env-gated AI smoke script covering every AITask, and closed out the hybrid AI client refactor with a green 233-test suite.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-13T16:48:00Z
- **Completed:** 2026-04-13T16:50:52Z
- **Tasks:** 3 (2 automated + 1 auto-approved checkpoint)
- **Files modified:** 3 (1 created, 1 modified, 1 deleted)

## Accomplishments

- Verified zero provider-SDK leakage outside `ai/adapters/` via grep sweep
- Deleted `packages/server/src/config/anthropic.ts` (no remaining importers)
- Added `packages/server/scripts/ai-smoke-test.ts` exercising every entry in `ALL_TASKS` against live providers
- Wired `npm run ai:smoke` (env-gated via `AI_SMOKE=1`, not in CI)
- Full server test suite green: 25 test files, 233 tests
- Phase 11 hybrid AI client refactor complete

## Task Commits

1. **Task 1: Delete config/anthropic.ts, verify zero leakage, run tests** — `c00c0ee` (chore)
2. **Task 2: Add env-gated smoke test script covering every AITask** — `9840155` (feat)
3. **Task 3: User verification checkpoint** — auto-approved per execution objective (pre-approved checkpoints)

## Files Created/Modified

- `packages/server/scripts/ai-smoke-test.ts` (created) — iterates `ALL_TASKS`, dispatches image/text/structured call shapes, reports pass/fail summary
- `packages/server/package.json` (modified) — added `ai:smoke` script
- `packages/server/src/config/anthropic.ts` (deleted) — obsolete singleton from pre-hybrid era

## Decisions Made

- **Smoke script call shape dispatch:** `IMAGE_TASKS` set for vision tasks → `analyzeImageStructured`; `TEXT_ONLY_TASKS` set for voice/tips → `generateText`; everything else → `generateStructured`. Keeps the script one file yet exercises every AIClient method.
- **Out-of-scope TS errors:** 151 pre-existing TS errors in test mocks and Hono typings were already documented in `deferred-items.md` from 11-02/11-04. File deletion introduced zero new errors. Not addressed here per scope boundary rule.

## Deviations from Plan

**1. [Rule 3 — Blocking → downgraded to out-of-scope] `npx tsc --noEmit` not clean**
- **Found during:** Task 1 (typecheck after deletion)
- **Issue:** Plan required `npx tsc --noEmit` to be clean, but the server has 151 pre-existing TS errors in test-mock files (`suggestions.test.ts` member_type narrowing) and `routes/cooking.ts` Hono typings
- **Resolution:** Verified error count is identical before and after deletion (151 → 151). Pre-existing state, already documented in `.planning/phases/11-hybrid-ai-client/deferred-items.md` during 11-02 and 11-04. Scope boundary: not caused by this task's changes, so not fixed here.
- **Verification:** `git stash` → `tsc --noEmit | grep -c "error TS"` = 151; `git stash pop` → same count
- **Commit:** N/A (no fix made)

---

**Total deviations:** 1 (Rule 3 evaluated → downgraded to out-of-scope per boundary rule)
**Impact on plan:** None. Full test suite green; plan's intent (no SDK leakage, smoke script wired, tests green) satisfied.

## Issues Encountered

None beyond the pre-existing TS errors noted above.

## Authentication Gates

None encountered.

## User Setup Required

None. The smoke script requires `ANTHROPIC_API_KEY` and `GOOGLE_API_KEY` at run time but they are already configured in the developer's environment from prior phases.

## Next Phase Readiness

- **Phase 11 complete.** All 5 plans executed:
  - 11-01: AIClient interface + Anthropic/Gemini adapters + factory
  - 11-02: Vision + recipe parser migrated (Wave 1)
  - 11-03: Text-heavy services migrated to Gemini (Wave 2a)
  - 11-04: Classification + short-text migrated (Wave 2b)
  - 11-05: Singleton deleted, smoke script, phase closeout
- **Final AITask → provider/model mapping in production:**
  - `vision.pantryScan` → Anthropic Sonnet 4.6
  - `recipe.parsePhoto` → Anthropic Sonnet 4.6
  - `recipe.parseUrl` / `recipe.parseText` → Gemini 3 Flash
  - `suggestions.dinner` → Gemini 3 Flash
  - `mealPlanner.week` → Gemini 3.1 Pro
  - `recipe.discovery` → Gemini 3 Flash
  - `progression.ambition` / `progression.variations` → Gemini 3 Flash
  - `shoppingList.variations` → Gemini 3 Flash
  - `cooking.voiceAsk` / `cooking.tips` → Gemini 3.1 Flash Lite
  - `ingredient.categorize` → Gemini 3.1 Flash Lite
- **Open follow-ups:**
  - Streaming support deferred (not needed for any current UX)
  - Swap Gemini preview model IDs to `-latest` aliases when Google promotes 3.x out of preview
  - Pre-existing TS errors (151) tracked in `deferred-items.md` for a future typing cleanup plan
- **Live smoke test:** Not run during execution (user's prerogative per plan). Smoke script verified to no-op correctly without `AI_SMOKE`.
- **Milestone:** This is the final plan of the final phase. Ready for milestone closeout.

## Self-Check: PASSED

- `packages/server/scripts/ai-smoke-test.ts` exists on disk
- `packages/server/src/config/anthropic.ts` confirmed deleted
- Commits `c00c0ee` and `9840155` present in git log

---
*Phase: 11-hybrid-ai-client*
*Completed: 2026-04-13*
