---
phase: 09-voice-cooking-mode
plan: 02
subsystem: voice
tags: [intent-router, regex, timer-parser, tdd, vitest, cooking-mode]

requires:
  - phase: 09-voice-cooking-mode
    provides: CookingIntent discriminated-union type from 09-01 types/cooking.ts
provides:
  - Pure regex intent classifier (routeIntent) covering next/back/repeat/pause/resume/timer/ask
  - Natural-language timer phrase parser (parseTimerPhrase) handling digits, word-numbers, "half", "and a half", and "an hour" bridging
  - Perf regression guard (1000-iteration sanity test) enforcing the VOIC-07 latency budget at the classifier layer
affects: [09-03-cooking-store, 09-04-cooking-screen, voice-pipeline]

tech-stack:
  added: []
  patterns:
    - "Pure-functional local intent classification before any Claude roundtrip"
    - "Timer-first routing order so nav verbs can't steal 'continue for N minutes' phrases"

key-files:
  created:
    - apps/mobile/src/cooking/intentRouter.ts
    - apps/mobile/src/cooking/timerParser.ts
    - apps/mobile/src/cooking/__tests__/intentRouter.test.ts
    - apps/mobile/src/cooking/__tests__/timerParser.test.ts
    - apps/mobile/src/cooking/__tests__/intentRouter.perf.test.ts
  modified: []

key-decisions:
  - "routeIntent checks parseTimerPhrase BEFORE nav regexes so phrases combining 'continue'/'go' with a duration cannot be miscategorized as { type: 'next' }"
  - "ask.question preserves the ORIGINAL transcript (not lowercased) so the downstream Claude prompt gets verbatim user intent"
  - "Timer gatekeeper regex bails out cheaply on non-timer phrases before the more expensive duration matcher runs"
  - "Word-number dictionary is deliberately small (1..60 + half) — 95% of cooking timers fit, full number-word parsing is out of scope"

patterns-established:
  - "Pattern: Local intent router runs on every final STT transcript; network path only reached for free-form 'ask' intents"
  - "Pattern: Vitest perf sanity test (1000 iterations <200ms) acts as a regression guard against accidental network calls creeping into hot paths"

requirements-completed: [VOIC-02, VOIC-03, VOIC-07]

duration: 3min
completed: 2026-04-10
---

# Phase 09 Plan 02: Local Intent Router + Timer Parser Summary

**Pure-regex cooking voice command classifier and timer phrase parser, with a 1000-iteration perf sanity test guarding the VOIC-07 <1s latency budget.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-10
- **Completed:** 2026-04-13T00:38:16Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files created:** 5
- **Tests:** 33 passing (32 behavior + 1 perf sanity)
- **Perf measurement:** 1000 mixed-phrase routings complete in <5ms of actual work on this machine (budget: 200ms; hard ceiling: 1000ms per VOIC-07)

## Accomplishments

- Local intent router classifies next / back / repeat / pause / resume / timer / ask without any network I/O
- Timer phrase parser handles the full matrix from plan:
  - "set a timer for 10 minutes" → 600 000 ms
  - "timer 5 min" → 300 000 ms
  - "timer for two minutes" → 120 000 ms
  - "set timer for half an hour" → 1 800 000 ms
  - "set a timer for 2 and a half minutes" → 150 000 ms
  - "remind me in 30 seconds" → 30 000 ms
  - "next step" / "hello world" → null
- Timer-first routing order verified: "set a timer for 5 minutes and continue" → `{ type: 'timer', ms: 300000 }` (not `next`)
- Perf regression guard blocks future regressions if a network call sneaks into the hot path

## Task Commits

1. **Task 1 (RED): failing tests for intent router + timer parser** — `ac107ae` (test)
2. **Task 1 (GREEN): implement intent router + timer parser** — `0f619ab` (feat)

Note: Commit `ebc0bf3` (`test(09-03)`) sits between these in git log but is unrelated to plan 09-02 — it was already on disk when this plan started.

## Files Created/Modified

- `apps/mobile/src/cooking/timerParser.ts` — Pure natural-language timer parser (UNIT_MS, WORDS map, gate regex, duration matcher)
- `apps/mobile/src/cooking/intentRouter.ts` — Pure regex intent classifier (timer-first, then NEXT → BACK → REPEAT → PAUSE → RESUME, fall through to ask)
- `apps/mobile/src/cooking/__tests__/timerParser.test.ts` — 10 unit tests covering positive + negative paths + case insensitivity
- `apps/mobile/src/cooking/__tests__/intentRouter.test.ts` — 22 unit tests covering navigation verbs, timer precedence, ask fallthrough, case insensitivity, empty/whitespace handling
- `apps/mobile/src/cooking/__tests__/intentRouter.perf.test.ts` — 1 perf sanity test (1000 iterations across 10-phrase mix, assert <200ms)

## Decisions Made

- **Timer gatekeeper regex** (`TIMER_GATE`) does a cheap pre-check so non-timer phrases bail out before the larger duration matcher runs. Keeps the hot path tight for nav verbs and ask fallthroughs.
- **"an hour" bridging:** the duration regex allows optional `an?\s+` between "half" and the unit, so "half an hour" resolves cleanly as n=0.5, unit=hour → 1 800 000 ms without a separate code path.
- **`and a half` handling:** only adds half-unit when the number token itself isn't already "half" (avoids double-counting for "half an hour" vs "2 and a half minutes").
- **Original transcript preserved in ask:** `routeIntent` only lowercases/trims for matching but passes the raw `transcript` into `ask.question`, so Claude sees the user's phrasing verbatim.

## Deviations from Plan

None — plan executed exactly as written. The regex shape from 09-RESEARCH Pattern 4 needed one small ergonomic tweak (the `an?\s+` bridge for "half an hour"), but this was anticipated by the plan's behavior matrix itself rather than a scope deviation.

## Issues Encountered

None. TDD RED → GREEN on first implementation pass; all 33 tests green without iteration.

## User Setup Required

None — this plan is purely local, pure-functional TypeScript. No env vars, no services, no permissions.

## Next Phase Readiness

- `routeIntent` and `parseTimerPhrase` are ready for import by 09-03 (cooking store wiring) and the cooking screen in later plans
- VOIC-02, VOIC-03, and the latency-critical half of VOIC-07 are now satisfied at the classifier layer — remaining VOIC-07 risk lives in the STT + TTS pipeline, not the intent path
- No blockers for plan 09-03

## Self-Check: PASSED

- FOUND: apps/mobile/src/cooking/intentRouter.ts
- FOUND: apps/mobile/src/cooking/timerParser.ts
- FOUND: apps/mobile/src/cooking/__tests__/intentRouter.test.ts
- FOUND: apps/mobile/src/cooking/__tests__/timerParser.test.ts
- FOUND: apps/mobile/src/cooking/__tests__/intentRouter.perf.test.ts
- FOUND commit: ac107ae (test RED)
- FOUND commit: 0f619ab (feat GREEN)
- Verification command `cd apps/mobile && npm test -- intentRouter timerParser` → 3 files, 33 tests passed

---
*Phase: 09-voice-cooking-mode*
*Completed: 2026-04-10*
