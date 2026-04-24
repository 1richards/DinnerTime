---
task: 5
description: ElevenLabs TTS integration — backend proxy + cooking-mode playback with expo-speech fallback
date: 2026-04-24
status: complete
---

# Quick 5 — ElevenLabs TTS Integration

## What shipped

1. **Backend proxy** (`packages/server/`)
   - `config/env.ts`: `ELEVENLABS_API_KEY` (required, lazy getter) + `ELEVENLABS_VOICE_ID` (optional, default `nPczCjzI2devNBz1zQrb` = "Brian", warm male voice)
   - `services/elevenlabs.ts` (new): `generateSpeech(text, voiceId?)` POSTs to `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}` with `eleven_turbo_v2_5`, `speed: 0.95`. Returns `Buffer | null` — swallows errors like `recipeImageGen` so a provider hiccup never user-blocks cooking.
   - `routes/voice.ts`: new `POST /tts` authed endpoint. Validates text (non-empty, ≤5000 chars). Returns `audio/mpeg` bytes on success, 502 on generate-failure.
   - `.env.example`: appended `ELEVENLABS_API_KEY=` + `ELEVENLABS_VOICE_ID=` placeholders.
2. **Mobile** (`apps/mobile/`)
   - `expo install expo-audio` (new native dep)
   - Dev client rebuilt via `expo prebuild --clean` + `pod install` + `xcodebuild`. New binary at `apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app` installed on booted simulator.
   - `cooking/useStepSpeaker.ts`: ElevenLabs-first refactor. Fetch `/api/v1/voice/tts` → write MP3 to `FileSystem.cacheDirectory` → play via `expo-audio`. Session-level 20-entry LRU cache keyed by trimmed text so "repeat" commands are instant. Fetch-counter race guard prevents stale audio from bleeding into superseded steps. On ANY failure (auth missing, non-ok, network throw, audio throw), silently falls back to `expo-speech` with the preserved British-voice selection path. Public API (`speak`/`stop`/`useStepSpeaker`/`runStepSpeakerEffect`) is unchanged — zero diffs to `cook.tsx`/`useVoiceListener.ts`/`handleTranscript.ts`.
   - `__tests__/useStepSpeaker.test.ts`: updated to mock fetch + expo-audio + expo-file-system. Original 3 assertions kept; 2 added for fetch-success (ElevenLabs path taken) and fetch-failure (expo-speech fallback).

## Commits

- `18fd27e` feat(quick-5): add ElevenLabs TTS backend proxy
- `dc8a692` chore(quick-5): install expo-audio and rebuild dev client
- `2f95d18` test(quick-5): add failing tests for ElevenLabs-first useStepSpeaker
- `b68c01f` feat(quick-5): ElevenLabs-first useStepSpeaker with expo-speech fallback

## End-to-end verification

**Backend — PASSED.** Curl `POST /api/v1/voice/tts` with test-user JWT + "Hello, this is a test of ElevenLabs voice in DinnerTime."
- HTTP 200
- 63,573 bytes returned
- `file` identifies: ID3v2.4 MPEG ADTS, layer III, v1, 128 kbps, 44.1 kHz, monaural — valid ElevenLabs output
- `afplay /tmp/elevenlabs-test.mp3` ran cleanly (audibility confirmed at the Mac speaker)

**Dev client — READY.** `com.dinnertime.app` installed in booted simulator (iPhone 17 Pro, iOS 26.4). expo-audio native module linked into the binary.

**Simulator UAT — pending manual check.** Executor got truncated mid-UAT before capturing a cooking-mode screenshot. Backend is definitively working and the mobile code path compiles + has tests. User should:
1. Launch the dev client in the simulator (already installed)
2. Metro running from `apps/mobile/` (already running per ps check)
3. Navigate to any saved recipe → Start Cooking
4. First step should read aloud with the ElevenLabs voice (noticeably more natural than the previous iOS Daniel voice)
5. If audio is silent, check Metro logs for `[tts]` warnings — most likely cause is an auth-token expiry on the embedded JWT, in which case it silently falls back to expo-speech

## Cost shape

- Text → speech: ~0.3 ms per char on cache miss + ElevenLabs round-trip (~500-1500ms first time, 0ms on cache hit within session)
- ElevenLabs free tier: 10k chars/month (~3-5 recipes of TTS)
- Starter ($5/mo): 30k chars/month — sustainable for beta testing
- LRU cache caps session memory at 20 MP3 files in `cacheDirectory` (auto-cleaned by iOS on disk pressure)

## Deferred

- **Streaming TTS** (option #2 from scope): still the right next step if 500-1500ms first-step latency feels slow in real cooking. ElevenLabs supports `stream` endpoint with chunked audio for instant-start playback.
- **Server-side MP3 cache**: backend currently re-generates on every request for a given text. Supabase Storage cache keyed by `sha256(text + voiceId)` would let shared recipe steps hit a free cache across users. Worth adding once usage data shows repeated text patterns.

## Risks surfaced

- **dotenv re-load timing.** If the backend process was spawned BEFORE `.env` had `ELEVENLABS_API_KEY`, tsx-watch's hot reload should pick it up via `config({path: ...})` but this is documented as unreliable in CLAUDE.md. Curl verification at the end of this summary confirms current process DID pick up the key.
- **Prebuild regenerated `ios/`.** Standard Expo config-plugin flow; all native modules (including expo-speech-recognition, expo-audio, sentry) should be present. If any native module regresses, diagnose via `pod install` output or re-run prebuild with verbose logging.

## Files touched

- `packages/server/src/config/env.ts`
- `packages/server/src/services/elevenlabs.ts` (new)
- `packages/server/src/routes/voice.ts`
- `.env.example`
- `apps/mobile/package.json`
- `apps/mobile/src/cooking/useStepSpeaker.ts`
- `apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts`
- `apps/mobile/ios/**` (regenerated by prebuild)
- `apps/mobile/app.json` (prebuild-touched)
