---
phase: 09-voice-cooking-mode
plan: 04
subsystem: mobile
tags: [expo-speech, expo-speech-recognition, tts, stt, hooks, vitest, authedFetch]

requires:
  - phase: 09-voice-cooking-mode
    provides: "CookingIntent/Timer/CookingState types (09-01), routeIntent + parseTimerPhrase (09-02), /cooking/ask endpoint (09-03)"
provides:
  - "useStepSpeaker hook — expo-speech wrapper with cooking-mode defaults and overlap-safe cleanup (VOIC-05)"
  - "useVoiceListener hook — @jamsch/expo-speech-recognition wrapper with final-only forwarding and TTS feedback guard (VOIC-02)"
  - "askAssistant client — authedFetch to POST /api/v1/cooking/ask with Bearer auth (VOIC-04)"
  - "Global vitest mocks for expo-speech, expo-keep-awake, and @jamsch/expo-speech-recognition"
affects: [09-05-cook-screen, future-voice-phases]

tech-stack:
  added: []
  patterns:
    - "Pure effect body extracted from hooks (runStepSpeakerEffect) for node-env unit testing without a React renderer"
    - "Global vitest setupFile mocks for native/Expo modules so downstream screen tests inherit stubs"
    - "Refs-in-event-handlers pattern in useVoiceListener so hint/enabled updates don't tear down STT sessions"

key-files:
  created:
    - apps/mobile/vitest.setup.ts
    - apps/mobile/src/cooking/useStepSpeaker.ts
    - apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts
    - apps/mobile/src/cooking/useVoiceListener.ts
    - apps/mobile/src/cooking/askAssistant.ts
    - apps/mobile/src/cooking/__tests__/askAssistant.test.ts
  modified:
    - apps/mobile/vitest.config.ts

key-decisions:
  - "[Phase 09-04] Extracted runStepSpeakerEffect as a pure helper so useStepSpeaker is testable under environment:node without @testing-library/react-native or react-test-renderer"
  - "[Phase 09-04] Global vitest setupFile (vitest.setup.ts) hosts expo-speech / expo-speech-recognition / expo-keep-awake mocks — downstream screen tests inherit the same stub surface"
  - "[Phase 09-04] useVoiceListener uses refs for enabled/hints/callback so hint list or callback identity changes don't force a native STT session restart"
  - "[Phase 09-04] askAssistant inlines getApiBaseUrl/getAuthToken/authedFetch (mealPlanStore pattern) rather than introducing a shared src/lib/api.ts — no shared helper existed to reuse"
  - "[Phase 09-04] useVoiceListener has no dedicated unit test — it is deeply native-coupled; coverage moves to the 09-05 cook.tsx screen test via global mocks (manual device smoke test TODO for iOS ~1min auto-restart)"
  - "[Phase 09-04] askAssistant error path maps non-JSON error bodies to HTTP_<status> so upstream store layers always receive a usable error code"

patterns-established:
  - "Hook-effect extraction: export runXxxEffect pure helper for node-env tests; useXxx is a one-line useEffect wrapper"
  - "Native module mocks live in vitest.setup.ts (global), never per-test"
  - "Refs in useSpeechRecognitionEvent handlers to avoid re-subscribing on every render"

requirements-completed: [VOIC-02, VOIC-04, VOIC-05]

duration: 4min
completed: 2026-04-10
---

# Phase 09 Plan 04: Voice-mode hook & client scaffolding Summary

**Thin single-file wrappers around expo-speech (useStepSpeaker), @jamsch/expo-speech-recognition (useVoiceListener), and the /cooking/ask endpoint (askAssistant) so the 09-05 cook screen can compose them and any native-module breakage stays a one-file fix.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-10T17:41:48Z
- **Completed:** 2026-04-10T17:44:30Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments
- `useStepSpeaker` with 5-case unit coverage (enable-speak, overlap stop-then-speak, disabled no-op, unmount cleanup, undefined guard) — exported `runStepSpeakerEffect` lets node-env vitest exercise the hook without a React renderer
- `useVoiceListener` isolates the entire `@jamsch/expo-speech-recognition` surface behind one file: final-only result forwarding (Pitfall 2), TTS-speaking guard (Pitfall 4), iOS auto-restart on `end` while enabled (Pitfall 7 — pre-1.0 library churn blast radius = 1 file)
- `askAssistant` client mirrors mealPlanStore's authedFetch pattern verbatim and is covered by 4 unit tests (success, server error code, non-JSON fallback `HTTP_<status>`, missing session)
- Global `vitest.setup.ts` with mocks for expo-speech, expo-keep-awake, @jamsch/expo-speech-recognition — downstream 09-05 cook screen test inherits the stub surface automatically
- All 161 mobile tests pass (up from 152, +9 new); `tsc --noEmit` clean

## Task Commits

1. **Task 1: Add module mocks to vitest.setup.ts** — `b202d4d` (chore)
2. **Task 2: useStepSpeaker hook + test (TDD)** — `904952f` (test RED) → `0dd464f` (feat GREEN)
3. **Task 3: useVoiceListener + askAssistant with tests** — `ff0b6fc` (feat)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `apps/mobile/vitest.setup.ts` - Global vi.mock() registrations for expo-speech, expo-keep-awake, @jamsch/expo-speech-recognition
- `apps/mobile/vitest.config.ts` - Register setupFiles
- `apps/mobile/src/cooking/useStepSpeaker.ts` - TTS hook + pure runStepSpeakerEffect helper
- `apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts` - 5 tests covering all 5 plan behaviors
- `apps/mobile/src/cooking/useVoiceListener.ts` - STT hook; refs-based event handlers; final-only + TTS guard
- `apps/mobile/src/cooking/askAssistant.ts` - authedFetch POST to /api/v1/cooking/ask
- `apps/mobile/src/cooking/__tests__/askAssistant.test.ts` - 4 tests: happy path, server error code, non-JSON fallback, no-session

## Decisions Made
- Extracted `runStepSpeakerEffect` as a pure helper because `environment: 'node'` + no `@testing-library/react-native` means we can't `renderHook`; the plan explicitly allows a "minimal test harness" fallback
- `useVoiceListener` intentionally has no unit test in this plan (native-coupled, tested via 09-05 screen test + manual device smoke test TODO)
- `askAssistant` inlines authedFetch (no shared `src/lib/api.ts` exists) — consistent with mealPlanStore/shoppingStore
- Non-JSON error bodies map to `HTTP_<status>` so the store layer always has a usable code string

## Deviations from Plan

None — plan executed exactly as written. The `runStepSpeakerEffect` extraction was explicitly anticipated by the plan's "minimal test harness component if renderHook isn't available" guidance.

## Issues Encountered
- Initial askAssistant test file had a TypeScript error (`null` not assignable to session type) when overriding the hoisted mock for the no-session case. Fixed by giving `vi.fn` an explicit generic signature that permits `session: null`. Caught by `tsc --noEmit`; no runtime impact.

## User Setup Required
None — no external service configuration changed.

## Next Phase Readiness
- 09-05 (cook.tsx screen) can now import `useStepSpeaker`, `useVoiceListener`, and `askAssistant` with zero knowledge of expo-speech / expo-speech-recognition internals
- Global vitest mocks are in place so the screen test will not need per-file native-module stubs
- Manual iOS device smoke test needed for `useVoiceListener` auto-restart on the ~1 min SFSpeechRecognizer cap (deferred to device build phase)

## Self-Check: PASSED

All 7 expected files present on disk. All 4 task commits present in git history (b202d4d, 904952f, 0dd464f, ff0b6fc).

---
*Phase: 09-voice-cooking-mode*
*Completed: 2026-04-10*
