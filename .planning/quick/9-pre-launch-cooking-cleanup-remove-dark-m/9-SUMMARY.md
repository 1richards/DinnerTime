# Quick Task 9 — Pre-launch cooking cleanup

**Status:** Complete
**Started:** 2026-05-03
**Completed:** 2026-05-03

## Goal
Two surgical removals + two UX additions in cooking mode pre-launch:

1. Drop the cooking dark-mode rendering path entirely.
2. Unwire the on-device voice STT input from cook.tsx (keep TTS playback).
3. Add a Start affordance on the next-button so the first tap lands on step 1.
4. Drop the exit-confirmation ActionSheet — tap-to-exit goes straight back.

## Commits

| # | Commit | Scope |
|---|--------|-------|
| 1 | `833e126` | refactor: drop darkMode + voiceEnabled from cookingStore + types + tests (persist v1→v2 migrate) |
| 2 | `40c6716` | refactor: strip darkMode + STT wiring from cook.tsx, header, nav buttons, settings |
| 3 | `c3ea81d` | feat: Start affordance + frictionless exit |
| 4 | `245cfd2` | fix: remove duplicate speak on Start to clear TTS race |

## Files modified
- `apps/mobile/src/stores/cookingStore.ts` — drop darkMode/voiceEnabled flags, add `start` action, persist v1→v2 migrate
- `apps/mobile/src/types/cooking.ts` — drop dropped flags
- `apps/mobile/src/stores/__tests__/cookingStore.test.ts` — prune dropped-flag cases, cover `start`
- `apps/mobile/src/app/recipes/[id]/cook.tsx` — drop DARK_PALETTE + dark style overrides + useVoiceListener wiring; tap-to-exit no confirmation; Start handler flips userNavigated; unhighlight pre-Start step; primaryNext styling
- `apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts` — remove voiceEnabled seed
- `apps/mobile/src/components/cooking/StickyCookingHeader.tsx` — drop voice + dark props, drop VoiceWaveform render
- `apps/mobile/src/components/cooking/__tests__/StickyCookingHeader.test.tsx` — trim baseProps, remove dropped @ts-expect-error
- `apps/mobile/src/components/cooking/StepNavButtons.tsx` — drop voice toggle + 'active' variant; add `nextLabel`/`nextIcon`/`primaryNext` overrides for Start
- `apps/mobile/src/app/(tabs)/settings.tsx` — drop dark-mode Switch + cooking-store import; CookingVoiceSection (TTS picker) preserved

## Voice scaffolding preserved (backlog 999.1)
- `apps/mobile/src/cooking/useVoiceListener.ts`
- `apps/mobile/src/cooking/useVoiceAmplitude.ts`
- `apps/mobile/src/components/cooking/VoiceWaveform.tsx`
- `apps/mobile/src/cooking/__tests__/useVoiceAmplitude.test.ts`
- `apps/mobile/src/components/cooking/__tests__/VoiceWaveform.test.tsx`

These files stay on disk; only the call-sites inside `cook.tsx` are unwired. Backlog item 999.1 (`.planning/phases/999.1-hands-free-voice-control-in-cooking-mode-stt/`) tracks future revival via server-side STT (Whisper / ElevenLabs).

## Persisted-state safety
- cookingStore persist version bumped 1 → 2 with `migrate: () => ({})`
- Old AsyncStorage blobs containing `darkMode: true` / `voiceEnabled: true` rehydrate cleanly without crashing

## Test results
- 883/883 mobile tests green at task-2 commit point
- 64/64 cooking-area tests green after Start + exit cleanup
- TTS race-fix: 13/13 cook tests green

## UX changes shipped
- Cooking screen: light palette only (no theme toggle, no dark override)
- Bottom-right cook nav: "Start" with brand-orange primary styling + play.fill glyph until first tap
- First tap: lands on step 1 (no skip), highlights it, auto-speaks via useStepSpeaker effect
- Exit (xmark, top-left): one tap → exit, no ActionSheet confirmation
- Settings: no dark-mode toggle, no voice-control toggle; CookingVoiceSection (Daniel/Oliver/etc.) preserved

## Deviations
None — straight-line execution of the plan.

## Out of scope (deferred)
- Hands-free STT revival (backlog 999.1)
- Maestro flow updates beyond reusing existing cooking smoke
- TTS provider tuning (ElevenLabs vs. expo-speech path selection)
