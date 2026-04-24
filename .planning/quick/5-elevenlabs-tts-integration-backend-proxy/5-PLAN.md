---
phase: quick-5-elevenlabs-tts
plan: 5
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/server/src/config/env.ts
  - packages/server/src/services/elevenlabs.ts
  - packages/server/src/routes/voice.ts
  - .env.example
  - apps/mobile/package.json
  - apps/mobile/src/cooking/useStepSpeaker.ts
  - apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts
  - apps/mobile/ios/**
  - apps/mobile/app.json
autonomous: true
requirements:
  - VOIC-TTS-ELEVENLABS-01
user_setup:
  - service: elevenlabs
    why: "Natural-voice TTS for cooking-mode step read-aloud (replaces robotic iOS system voice)."
    env_vars:
      - name: ELEVENLABS_API_KEY
        source: "ElevenLabs Dashboard → Profile → API Key (https://elevenlabs.io/app/settings/api-keys)"
      - name: ELEVENLABS_VOICE_ID
        source: "Optional. Defaults to 'nPczCjzI2devNBz1zQrb' (Brian, a pre-made warm male voice). Override via ElevenLabs Voice Library if desired."

must_haves:
  truths:
    - "Backend /api/v1/voice/tts endpoint returns audio/mpeg bytes for a short text payload when ELEVENLABS_API_KEY is set"
    - "curl POST to /api/v1/voice/tts with a valid JWT produces an MP3 that plays natural speech via afplay"
    - "On 400/5xx from ElevenLabs (or network error), the backend returns 502 with {error: 'TTS unavailable'}, and never crashes the server"
    - "Mobile useStepSpeaker fetches an MP3 from the backend, plays it via expo-audio, and caches the temp file via a 20-entry in-memory LRU keyed by trimmed text"
    - "On any backend/expo-audio failure, mobile falls back to Speech.speak(text) so cooking flow never breaks"
    - "Existing useStepSpeaker public API (StepSpeakerHandle {speak, stop}, runStepSpeakerEffect) is preserved byte-for-byte; consumers (cook.tsx, useVoiceListener, AskSheet, StopTTSButton) do not change"
    - "Vitest suite for useStepSpeaker passes, including two new tests (fetch success → player.play called; fetch failure → Speech.speak called as fallback)"
    - "Simulator cooking-mode step read-aloud sounds clearly different from — and more natural than — the prior iOS system voice"
  artifacts:
    - path: "packages/server/src/services/elevenlabs.ts"
      provides: "generateSpeech(text, voiceId?) → Buffer | null, mirroring recipeImageGen error-swallowing"
      exports: ["generateSpeech"]
      min_lines: 25
    - path: "packages/server/src/routes/voice.ts"
      provides: "authed POST /tts returning audio/mpeg or 4xx/502"
      contains: "/tts"
    - path: "packages/server/src/config/env.ts"
      provides: "ELEVENLABS_API_KEY (required) and ELEVENLABS_VOICE_ID (optional, default nPczCjzI2devNBz1zQrb)"
      contains: "ELEVENLABS_API_KEY"
    - path: ".env.example"
      provides: "Documented ELEVENLABS_API_KEY / ELEVENLABS_VOICE_ID entries"
      contains: "ELEVENLABS_API_KEY"
    - path: "apps/mobile/src/cooking/useStepSpeaker.ts"
      provides: "ElevenLabs-first speak() with LRU cache + expo-speech fallback; preserved public API"
      exports: ["useStepSpeaker", "runStepSpeakerEffect", "StepSpeakerHandle"]
    - path: "apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts"
      provides: "Updated vitest suite covering new fetch→play path and fallback path"
    - path: "apps/mobile/package.json"
      provides: "expo-audio dep added via `npx expo install expo-audio`"
      contains: "expo-audio"
  key_links:
    - from: "apps/mobile/src/cooking/useStepSpeaker.ts"
      to: "POST ${EXPO_PUBLIC_API_URL}/api/v1/voice/tts"
      via: "fetch with Authorization: Bearer <supabase access_token>"
      pattern: "voice/tts"
    - from: "packages/server/src/routes/voice.ts"
      to: "services/elevenlabs.ts generateSpeech"
      via: "direct function call inside POST /tts handler"
      pattern: "generateSpeech\\("
    - from: "packages/server/src/services/elevenlabs.ts"
      to: "https://api.elevenlabs.io/v1/text-to-speech/{voiceId}"
      via: "fetch with xi-api-key header"
      pattern: "api\\.elevenlabs\\.io"
---

<objective>
Replace cooking-mode's robotic iOS system voice with ElevenLabs' natural "Brian" voice by adding a thin authed backend proxy (packages/server) and refactoring the mobile `useStepSpeaker` hook (apps/mobile) to fetch + play MP3 via expo-audio, with a transparent fallback to `expo-speech` when anything on the ElevenLabs path fails.

Purpose: The iOS TTS voice is a known pain point in beta feedback — it sounds synthetic and undercuts the "friendly sous chef" feel the cooking experience is going for. ElevenLabs' buffered TTS gives us a natural voice without touching the streaming / voice-listener architecture.

Output:
- `POST /api/v1/voice/tts` endpoint returning `audio/mpeg` bytes on success.
- Mobile hook that uses ElevenLabs by default, falls back to `expo-speech` invisibly, caches audio per-session (LRU 20) to avoid re-paying for identical step text.
- Preserved public API — zero changes to `cook.tsx`, `useVoiceListener.ts`, `handleTranscript.ts`, or any other cooking-flow file.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<!-- Existing server files the executor modifies -->
@packages/server/src/config/env.ts
@packages/server/src/routes/voice.ts

<!-- Mirror this pattern for graceful failure + console.error logging -->
@packages/server/src/services/recipeImageGen.ts

<!-- Mobile file being refactored -->
@apps/mobile/src/cooking/useStepSpeaker.ts
@apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts

<!-- Mirror this pattern for auth token fetch + bearer header -->
@apps/mobile/src/hooks/useGeneratedRecipeImage.ts

<!-- Config surface -->
@apps/mobile/app.json
@apps/mobile/package.json

<interfaces>
<!-- Extracted from existing files so the executor has contracts without exploring. -->

From packages/server/src/config/env.ts — adapter pattern to follow:
```ts
function requireEnv(name: string): string { /* throws if unset */ }
function optionalEnv(name: string, defaultValue: string): string { /* returns default */ }

export const env = {
  get SUPABASE_URL() { return requireEnv('SUPABASE_URL'); },
  // ... existing getters
  // ADD:
  get ELEVENLABS_API_KEY() { return requireEnv('ELEVENLABS_API_KEY'); },
  get ELEVENLABS_VOICE_ID() { return optionalEnv('ELEVENLABS_VOICE_ID', 'nPczCjzI2devNBz1zQrb'); },
} as const;
```

From packages/server/src/routes/voice.ts — existing stub to extend (NOT replace):
```ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

const voice = new Hono();
voice.use('*', authMiddleware);

voice.post('/transcribe', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

// ADD voice.post('/tts', ...) below this line. Do NOT touch /transcribe.

export default voice;
```

From packages/server/src/services/recipeImageGen.ts — error-swallowing pattern to mirror:
```ts
async function generateBytes(...): Promise<Buffer | null> {
  try {
    // call external API
    return Buffer.from(...);
  } catch (err) {
    console.error('[recipeImageGen] ... error:', err);
    return null;
  }
}
```

From apps/mobile/src/cooking/useStepSpeaker.ts — public API that MUST be preserved:
```ts
export interface StepSpeakerHandle {
  speak: (text: string) => void;
  stop: () => void;
}
export function runStepSpeakerEffect(text: string | undefined, enabled: boolean): (() => void) | undefined;
export function useStepSpeaker(text: string | undefined, enabled: boolean): StepSpeakerHandle;
```
All three must remain exported with identical signatures. `baseSpeakOptions()`, `resolvePreferredVoice()`, and `scoreVoice()` stay in the file — they're used by the expo-speech fallback path.

From apps/mobile/src/hooks/useGeneratedRecipeImage.ts — auth-token + fetch pattern to mirror:
```ts
import { supabase } from '../lib/supabase';

function getApiBaseUrl(): string {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch { return null; }
}

// fetch with Authorization: `Bearer ${token}`
```

ElevenLabs REST contract (no SDK):
- URL: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- Method: POST
- Headers: `xi-api-key: <key>`, `Content-Type: application/json`, `Accept: audio/mpeg`
- Body JSON: `{ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 0.95 } }`
- Success response: raw MP3 bytes — read via `await res.arrayBuffer()` → `Buffer.from(...)`
- On `!res.ok` or any throw: return null.

expo-audio contract (SDK 55):
- `import { createAudioPlayer } from 'expo-audio';`
- `const player = createAudioPlayer({ uri: string });`
- `player.play()` — starts playback (fire-and-forget for our use case).
- `player.pause()` — stops current playback.
- `player.release()` — frees native resources. Call after pause when swapping players.

expo-file-system contract (already in deps):
- `import * as FileSystem from 'expo-file-system';`
- `FileSystem.cacheDirectory` — base dir for ephemeral files.
- `FileSystem.writeAsStringAsync(path, base64Str, { encoding: 'base64' })` — write MP3 bytes to disk as a file:// URI usable by createAudioPlayer.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — ElevenLabs proxy service + /tts route + env wiring</name>
  <files>
    packages/server/src/config/env.ts
    packages/server/src/services/elevenlabs.ts
    packages/server/src/routes/voice.ts
    .env.example
  </files>
  <action>
1. Edit `packages/server/src/config/env.ts`. Inside the `env` const, ADD two getters AFTER `GOOGLE_API_KEY`:
   ```ts
   get ELEVENLABS_API_KEY() {
     return requireEnv('ELEVENLABS_API_KEY');
   },
   get ELEVENLABS_VOICE_ID() {
     return optionalEnv('ELEVENLABS_VOICE_ID', 'nPczCjzI2devNBz1zQrb');
   },
   ```
   Do not reorder or rename existing getters. Do not introduce a new `ELEVENLABS_*` block before `PORT` — keep admin/legacy getters at their current positions.

2. CREATE `packages/server/src/services/elevenlabs.ts` with a single export `generateSpeech`. Mirror the `recipeImageGen.ts` error-swallowing pattern (try/catch around the entire call, `console.error('[elevenlabs] ...', err)` on failure, `return null` on any non-success):
   ```ts
   import { env } from '../config/env.js';

   const BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
   const MODEL = 'eleven_turbo_v2_5';

   /**
    * generateSpeech — POST to ElevenLabs text-to-speech, return MP3 bytes.
    * Graceful degradation: swallows all errors and returns null so callers
    * can surface a 502 without crashing. Mirrors recipeImageGen's pattern.
    */
   export async function generateSpeech(
     text: string,
     voiceId?: string,
   ): Promise<Buffer | null> {
     try {
       const resolvedVoice = voiceId && voiceId.trim().length > 0
         ? voiceId
         : env.ELEVENLABS_VOICE_ID;
       const res = await fetch(`${BASE}/${resolvedVoice}`, {
         method: 'POST',
         headers: {
           'xi-api-key': env.ELEVENLABS_API_KEY,
           'Content-Type': 'application/json',
           Accept: 'audio/mpeg',
         },
         body: JSON.stringify({
           text,
           model_id: MODEL,
           voice_settings: {
             stability: 0.5,
             similarity_boost: 0.75,
             speed: 0.95,
           },
         }),
       });
       if (!res.ok) {
         const bodyText = await res.text().catch(() => '');
         console.error('[elevenlabs] non-ok', res.status, bodyText.slice(0, 500));
         return null;
       }
       const arr = await res.arrayBuffer();
       return Buffer.from(arr);
     } catch (err) {
       console.error('[elevenlabs] fetch error:', err);
       return null;
     }
   }
   ```
   Keep the service file focused on the HTTP call only. Do NOT add retry/backoff — consistent with `recipeImageGen`.

3. Edit `packages/server/src/routes/voice.ts`. PRESERVE the `/transcribe` stub. ADD a `POST /tts` handler below it (still inside the existing `voice` Hono instance, still behind `authMiddleware` via the pre-registered `voice.use('*', authMiddleware)`):
   ```ts
   voice.post('/tts', async (c) => {
     let body: unknown;
     try {
       body = await c.req.json();
     } catch {
       return c.json({ error: 'Invalid JSON body' }, 400);
     }
     const { text, voiceId } = (body ?? {}) as { text?: unknown; voiceId?: unknown };
     if (typeof text !== 'string') {
       return c.json({ error: 'text is required and must be a string' }, 400);
     }
     const trimmed = text.trim();
     if (trimmed.length === 0) {
       return c.json({ error: 'text must be non-empty' }, 400);
     }
     if (trimmed.length > 5000) {
       return c.json({ error: 'text exceeds 5000 character limit' }, 400);
     }
     const resolvedVoiceId = typeof voiceId === 'string' && voiceId.trim().length > 0
       ? voiceId.trim()
       : undefined;
     const bytes = await generateSpeech(trimmed, resolvedVoiceId);
     if (!bytes) {
       return c.json({ error: 'TTS unavailable' }, 502);
     }
     return new Response(new Uint8Array(bytes), {
       status: 200,
       headers: {
         'Content-Type': 'audio/mpeg',
         'Content-Length': String(bytes.byteLength),
         'Cache-Control': 'no-store',
       },
     });
   });
   ```
   Add `import { generateSpeech } from '../services/elevenlabs.js';` at the top of the file. Do NOT remove the 501 `/transcribe` stub.

4. Append to `.env.example` (root of repo). Place AT THE BOTTOM after the last existing entry; do not reorder existing entries:
   ```
   # ElevenLabs TTS — backend proxy for cooking-mode step read-aloud
   ELEVENLABS_API_KEY=
   ELEVENLABS_VOICE_ID=
   ```

5. Run `cd packages/server && pnpm tsc --noEmit` to confirm the server typechecks cleanly. Fix any TS errors before proceeding.

Addresses requirement VOIC-TTS-ELEVENLABS-01 (backend side). Mirrors recipeImageGen.ts pattern for graceful degradation — ensures a missing/rotated ElevenLabs key never breaks the server, only the TTS feature.
  </action>
  <verify>
    <automated>cd packages/server && pnpm tsc --noEmit</automated>

    Manual verification (must be run as part of executor's work — see Task 3 for end-to-end curl test):
    - Boot server with `set -a && source .env && set +a && cd packages/server && pnpm dev` from repo root. Confirm no `Missing required environment variable: ELEVENLABS_API_KEY` throw (if user has added the key to .env). If the key is missing from `.env`, the server will fail on first `/tts` request — document in SUMMARY as "user must add ELEVENLABS_API_KEY to root .env" and proceed.
  </verify>
  <done>
    - `packages/server/src/config/env.ts` exposes `env.ELEVENLABS_API_KEY` (required) and `env.ELEVENLABS_VOICE_ID` (default `nPczCjzI2devNBz1zQrb`).
    - `packages/server/src/services/elevenlabs.ts` exists with a single `generateSpeech` export that returns `Buffer | null`.
    - `packages/server/src/routes/voice.ts` still has the `/transcribe` stub AND a new `POST /tts` route returning `audio/mpeg` on 200, JSON `{error}` on 400/502.
    - `.env.example` documents both new env vars at the bottom.
    - `pnpm tsc --noEmit` passes in `packages/server`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Mobile — install expo-audio and rebuild dev client</name>
  <files>
    apps/mobile/package.json
    apps/mobile/app.json
    apps/mobile/ios/**
  </files>
  <action>
This task is expected to be the longest single step (~15-20 min for xcodebuild). Treat as part of executor's work — NOT a human-verify checkpoint.

1. Install expo-audio with the Expo-managed version pin:
   ```bash
   cd apps/mobile && npx expo install expo-audio
   ```
   This writes `"expo-audio": "~X.X.X"` to `package.json`. Do NOT use `pnpm add` — `npx expo install` picks the SDK-55-compatible version.

2. Regenerate the iOS project to pick up expo-audio's native module. This is DESTRUCTIVE to `apps/mobile/ios/` but is the standard Expo config-plugin pipeline — existing plugins in `app.json` (expo-router, expo-secure-store, expo-apple-authentication, Google sign-in, @jamsch/expo-speech-recognition, @react-native-community/datetimepicker, @sentry/react-native, expo-sharing) will re-register automatically. expo-audio typically auto-links without requiring an entry in `plugins` — verify after prebuild.
   ```bash
   cd apps/mobile && npx expo prebuild --clean
   ```

3. Install CocoaPods (expo-audio brings a native pod):
   ```bash
   cd apps/mobile/ios && pod install
   ```

4. Build the debug app for the iPhone 17 Pro simulator:
   ```bash
   cd apps/mobile/ios && xcodebuild \
     -workspace DinnerTime.xcworkspace \
     -scheme DinnerTime \
     -configuration Debug \
     -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
     -derivedDataPath build \
     -quiet
   ```
   If xcodebuild fails, capture the tail of the build log (`find ios/build -name '*.log' | xargs tail -100`) and document the failure in SUMMARY. Do NOT fall back to `eas build --local` without user confirmation — eas builds are slow and can consume build minutes. Mark the plan feature-code-complete; UAT blocked.

5. Install the freshly built .app onto the already-booted simulator:
   ```bash
   xcrun simctl boot "iPhone 17 Pro" || true
   open -a Simulator
   xcrun simctl install booted apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
   ```
   If the path differs (xcodebuild sometimes uses a nested path under `ios/build/Build/Products/Debug-iphonesimulator/`), `find apps/mobile/ios/build -name 'DinnerTime.app' -type d | head -1` and install from whatever path is produced.

6. Confirm `apps/mobile/package.json` has the new `"expo-audio"` dep pinned. Confirm `apps/mobile/app.json` is still valid JSON (prebuild may normalize whitespace but should not strip existing plugin entries — check that `expo-router`, `@jamsch/expo-speech-recognition`, `@sentry/react-native` are still present).

7. If prebuild altered anything in `app.json` that looks like a loss of project config (e.g. bundleIdentifier, plugins, iOS infoPlist entries like `NSSpeechRecognitionUsageDescription`), restore the missing pieces from the pre-prebuild git diff. The snapshot prior to prebuild is the source of truth for project configuration.

Risk notes for the executor:
- prebuild --clean DELETES and recreates `apps/mobile/ios/`. Git will show a large diff. This is expected.
- Some native module plugins (Google sign-in in particular) register things that need the correct reversed client ID; if the simulator build crashes on launch with a Google-sign-in error, the `iosUrlScheme` placeholder in app.json was already a placeholder — not caused by this task.
- If `pod install` fails with CocoaPods version incompatibility, try `cd ios && bundle install && bundle exec pod install` (the Podfile may pin a version).
  </action>
  <verify>
    <automated>cd apps/mobile && cat package.json | grep -q '"expo-audio"'</automated>

    Also confirm (manually, during executor run):
    - `ls apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app` returns a directory.
    - `xcrun simctl install booted apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app` exits 0.
  </verify>
  <done>
    - `expo-audio` appears in `apps/mobile/package.json` dependencies with a `~X.X.X` pin.
    - `apps/mobile/ios/` is regenerated and builds cleanly via xcodebuild.
    - Dev client .app is installed onto booted iPhone 17 Pro simulator.
    - `app.json` retains all pre-existing plugin entries and iOS infoPlist keys.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Mobile — refactor useStepSpeaker to ElevenLabs-first with expo-speech fallback (+ tests + curl + UAT)</name>
  <files>
    apps/mobile/src/cooking/useStepSpeaker.ts
    apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts
  </files>
  <behavior>
- When `useStepSpeaker(text, enabled=true)` runs for the first time with a new text, it POSTs `{text}` to `${EXPO_PUBLIC_API_URL}/api/v1/voice/tts` with `Authorization: Bearer <supabase access_token>` and `Content-Type: application/json`.
- On a successful response (`res.ok === true`, `content-type: audio/mpeg`), it writes the MP3 bytes to `FileSystem.cacheDirectory + <key>.mp3`, caches `{text → uri}` in a 20-entry LRU, creates an expo-audio player via `createAudioPlayer({ uri })`, calls `player.play()`, and does NOT call `Speech.speak`.
- On any non-ok response or thrown error in the fetch/file-write/expo-audio path, it falls back to `Speech.speak(text, baseSpeakOptions())` — the existing British-voice code path.
- On a cache hit (same trimmed text seen within the session), it re-plays from the cached URI without a new fetch.
- `stop()` pauses + releases the current expo-audio player AND calls `Speech.stop()` (both paths may have been in-flight; fine to call both every time — `Speech.stop()` is already idempotent).
- When `enabled=false` or `text` is undefined, nothing happens. No fetch, no player, no Speech.speak.
- The public API is unchanged: `StepSpeakerHandle { speak, stop }`, `runStepSpeakerEffect(text, enabled)`, `useStepSpeaker(text, enabled)`.

Test plan (apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts):
- Keep all 5 existing tests, but update internals to assert via the new mock stack (fetch + expo-file-system + expo-audio) where applicable. Assertions about `Speech.stop()` on cleanup still apply (cleanup MUST call both `player.pause() + release()` AND `Speech.stop()` since either path may have started playback).
- Test 1 (existing): `runStepSpeakerEffect('Chop onions', true)` with fetch mocked to succeed → exactly one fetch call; after the microtask queue drains, `createAudioPlayer` called once, `player.play` called once, `Speech.speak` NOT called.
- Test 2 (existing, updated): text-change cleanup before next speak → cleanup pauses+releases the prior player; subsequent runStepSpeakerEffect fires a new fetch for the new text.
- Test 3 (existing): `enabled=false` → no fetch, no play, no speak.
- Test 4 (existing, updated): cleanup calls `player.pause()` + `player.release()` AND `Speech.stop()`.
- Test 5 (existing): `text=undefined` → no fetch, no play, no speak.
- Test 6 (NEW): fetch succeeds → `player.play` called, `Speech.speak` NOT called.
- Test 7 (NEW): fetch returns `{ ok: false, status: 502 }` → `Speech.speak` IS called with the text and baseSpeakOptions() shape.
- Do NOT delete any existing tests without an explanatory comment.
  </behavior>
  <action>
1. Refactor `apps/mobile/src/cooking/useStepSpeaker.ts`:

   a. Keep these existing exports AND their signatures unchanged: `StepSpeakerHandle`, `runStepSpeakerEffect`, `useStepSpeaker`.
   b. Keep `baseSpeakOptions()`, `resolvePreferredVoice()`, `scoreVoice()`, and the `preferredVoiceId` / `voiceLookupStarted` module-scope state. These are used ONLY on the expo-speech fallback path.
   c. Add new module-scope state:
      ```ts
      import { createAudioPlayer, AudioPlayer } from 'expo-audio';
      import * as FileSystem from 'expo-file-system';
      import { supabase } from '../lib/supabase';

      type LRUEntry = { uri: string };
      const LRU_MAX = 20;
      const lruCache = new Map<string, LRUEntry>(); // trimmed text → entry

      let currentPlayer: AudioPlayer | null = null;
      let fetchCounter = 0; // monotonic id for race guards

      function getApiBaseUrl(): string {
        return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
      }

      async function getAuthToken(): Promise<string | null> {
        try {
          const { data } = await supabase.auth.getSession();
          return data?.session?.access_token ?? null;
        } catch {
          return null;
        }
      }

      function lruGet(key: string): LRUEntry | undefined {
        const hit = lruCache.get(key);
        if (!hit) return undefined;
        // Promote to MRU
        lruCache.delete(key);
        lruCache.set(key, hit);
        return hit;
      }

      function lruSet(key: string, entry: LRUEntry): void {
        if (lruCache.has(key)) lruCache.delete(key);
        lruCache.set(key, entry);
        while (lruCache.size > LRU_MAX) {
          const firstKey = lruCache.keys().next().value;
          if (firstKey === undefined) break;
          lruCache.delete(firstKey);
        }
      }

      function releaseCurrentPlayer(): void {
        const p = currentPlayer;
        currentPlayer = null;
        if (!p) return;
        try { p.pause(); } catch { /* ignore */ }
        try { p.release(); } catch { /* ignore */ }
      }
      ```
   d. Replace the module-level "speak via Speech.speak" logic inside `runStepSpeakerEffect` and in the `useMemo` handle's `speak()`. Extract a shared async function:
      ```ts
      async function speakViaElevenLabs(text: string, myFetchId: number): Promise<boolean> {
        // Cache hit?
        const cached = lruGet(text);
        if (cached) {
          try {
            if (fetchCounter !== myFetchId) return true; // stale — caller already moved on
            releaseCurrentPlayer();
            const player = createAudioPlayer({ uri: cached.uri });
            currentPlayer = player;
            player.play();
            return true;
          } catch (err) {
            console.warn('[tts] cached player error', err);
            return false;
          }
        }

        const token = await getAuthToken();
        if (!token) return false;

        try {
          const res = await fetch(`${getApiBaseUrl()}/api/v1/voice/tts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text }),
          });
          if (!res.ok) return false;
          const arr = await res.arrayBuffer();
          if (fetchCounter !== myFetchId) return true; // stale, but don't fall back

          // Write to cache dir. expo-file-system writeAsStringAsync expects base64 here.
          const b64 = arrayBufferToBase64(arr);
          const filename = `tts-${simpleHash(text)}.mp3`;
          const uri = `${FileSystem.cacheDirectory}${filename}`;
          await FileSystem.writeAsStringAsync(uri, b64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          lruSet(text, { uri });

          if (fetchCounter !== myFetchId) return true;
          releaseCurrentPlayer();
          const player = createAudioPlayer({ uri });
          currentPlayer = player;
          player.play();
          return true;
        } catch (err) {
          console.warn('[tts] elevenlabs path error', err);
          return false;
        }
      }

      function arrayBufferToBase64(buf: ArrayBuffer): string {
        // Node/Hermes both expose a global `btoa`? Hermes does NOT reliably.
        // Use a small manual encoder — or use `Buffer` if available. React
        // Native ships `Buffer` via the polyfill in RN 0.83. Prefer Buffer
        // when available, fall back to manual.
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(buf).toString('base64');
        }
        let binary = '';
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).btoa(binary);
      }

      function simpleHash(s: string): string {
        // Cheap non-crypto hash for filenames — we don't need collision resistance
        // because the LRU key IS the text; the file just needs a stable name.
        let h = 5381;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) + h + s.charCodeAt(i)) | 0;
        }
        return (h >>> 0).toString(36);
      }

      function fallbackToSpeech(text: string): void {
        Speech.speak(text, baseSpeakOptions());
      }

      export function runStepSpeakerEffect(
        text: string | undefined,
        enabled: boolean,
      ): (() => void) | undefined {
        if (!enabled || !text) return undefined;
        const trimmed = text.trim();
        if (trimmed.length === 0) return undefined;

        const myFetchId = ++fetchCounter;
        void speakViaElevenLabs(trimmed, myFetchId).then((ok) => {
          if (!ok && fetchCounter === myFetchId) {
            fallbackToSpeech(trimmed);
          }
        });

        return () => {
          // Cleanup: stop whichever path was playing.
          fetchCounter++; // invalidate any still-inflight speakVia* for this effect
          releaseCurrentPlayer();
          Speech.stop();
        };
      }
      ```
   e. Update `useStepSpeaker`'s handle so `speak(t)` goes through the same pipeline:
      ```ts
      return useMemo<StepSpeakerHandle>(
        () => ({
          speak: (t: string) => {
            const trimmed = t.trim();
            if (trimmed.length === 0) return;
            const myFetchId = ++fetchCounter;
            void speakViaElevenLabs(trimmed, myFetchId).then((ok) => {
              if (!ok && fetchCounter === myFetchId) fallbackToSpeech(trimmed);
            });
          },
          stop: () => {
            fetchCounter++;
            releaseCurrentPlayer();
            Speech.stop();
          },
        }),
        [],
      );
      ```
   f. Keep `void resolvePreferredVoice()` at module load — still needed for the fallback path.
   g. Run `cd apps/mobile && npx tsc --noEmit` (or `pnpm tsc --noEmit` if workspace-aware). Must pass cleanly for useStepSpeaker.ts. If other unrelated files have pre-existing TS errors, note them in SUMMARY but do not fix.

2. Update `apps/mobile/src/cooking/__tests__/useStepSpeaker.test.ts`:

   a. Add mocks at the top (BEFORE the `describe` block, after imports):
      ```ts
      vi.mock('expo-audio', () => ({
        createAudioPlayer: vi.fn(() => ({
          play: vi.fn(),
          pause: vi.fn(),
          release: vi.fn(),
        })),
      }));
      vi.mock('expo-file-system', () => ({
        cacheDirectory: 'file:///tmp/',
        writeAsStringAsync: vi.fn(async () => {}),
        EncodingType: { Base64: 'base64' },
      }));
      vi.mock('../../lib/supabase', () => ({
        supabase: {
          auth: {
            getSession: vi.fn(async () => ({
              data: { session: { access_token: 'test-token' } },
            })),
          },
        },
      }));
      ```
   b. Mock `global.fetch` in `beforeEach`:
      ```ts
      global.fetch = vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(10),
      })) as unknown as typeof fetch;
      ```
   c. Update existing Test 1: after calling `runStepSpeakerEffect('Chop onions', true)`, `await` a microtask flush (`await Promise.resolve(); await Promise.resolve();` — two ticks: one for supabase.auth.getSession, one for fetch), then assert `createAudioPlayer` called, `player.play()` called, `Speech.speak` NOT called.
   d. Update Test 2 (text change): cleanup must have called `player.pause()` + `player.release()`. Inspect the last result from `createAudioPlayer.mock.results` to get the prior player.
   e. Keep Test 3 (`enabled=false`): still no fetch, no play, no speak.
   f. Update Test 4 (cleanup): cleanup calls `pause` + `release` on the player AND `Speech.stop()`.
   g. Keep Test 5 (`text=undefined`): no fetch, no play, no speak.
   h. ADD Test 6 (fetch success → Speech.speak NOT called): happy path, assert `player.play` called once, `Speech.speak.mock.calls.length === 0`.
   i. ADD Test 7 (fetch failure → Speech.speak IS called): set `global.fetch` to `async () => ({ ok: false, status: 502, arrayBuffer: async () => new ArrayBuffer(0) })`, run the effect, flush microtasks, assert `Speech.speak` called once with the text and an object containing `language: 'en-US', rate: 0.95`.
   j. Run `cd apps/mobile && pnpm test -- useStepSpeaker`. All tests must pass.

3. End-to-end curl verification (MUST run before marking plan done):
   Boot the server (`set -a && source .env && set +a && cd packages/server && pnpm dev`). In another terminal, obtain a test user JWT — the quickest path is to sign in via the simulator and copy the token from AsyncStorage, OR reuse a saved token from prior UAT runs. Then:
   ```bash
   curl -X POST http://localhost:3000/api/v1/voice/tts \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"text":"Heat the pan over medium heat for two minutes."}' \
     --output /tmp/elevenlabs-test.mp3 \
     -w '%{http_code}\n'
   ```
   Expect `200` and a >10KB MP3 at `/tmp/elevenlabs-test.mp3`. Then `afplay /tmp/elevenlabs-test.mp3` — confirm the voice is natural/human-sounding (clearly NOT the iOS system voice).

   If curl returns `502 TTS unavailable`, check server logs for `[elevenlabs] non-ok` — most likely a bad/missing API key, a wrong voiceId format, or ElevenLabs billing. Document the specific failure in SUMMARY.

   If curl returns `401`, the JWT is expired — refresh by signing in on the simulator.

4. Simulator UAT:
   Open the dev client on the booted iPhone 17 Pro simulator (Metro must be running via `npx expo start --dev-client --lan`). Navigate to a recipe → enter cooking mode. The first step's text should be read aloud in the new ElevenLabs "Brian" voice. It should sound noticeably more natural than the prior iOS voice. Exit cooking mode — speech should stop cleanly (no bleed-through).

   Negative test (if feasible): temporarily kill the server (Ctrl-C) while in cooking mode, advance to the next step. The app should NOT crash — it should fall back to `expo-speech` and read the step in the existing British voice.

   Take screenshots of cooking mode pre/post for the SUMMARY (`apps/mobile/.maestro/scripts/uat.sh shot` or `xcrun simctl io booted screenshot /tmp/cooking-tts.png`).

Addresses requirement VOIC-TTS-ELEVENLABS-01 (mobile side + end-to-end verification). Preserves the exact public API so cook.tsx, useVoiceListener.ts, AskSheet, and StopTTSButton do not need to change.
  </action>
  <verify>
    <automated>cd apps/mobile && pnpm test -- useStepSpeaker</automated>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -E '(useStepSpeaker\.ts|error TS)' | grep useStepSpeaker || echo "typecheck clean for useStepSpeaker"</automated>

    Curl verification (MUST be performed manually during execution):
    ```bash
    curl -X POST http://localhost:3000/api/v1/voice/tts \
      -H "Authorization: Bearer <jwt>" \
      -H "Content-Type: application/json" \
      -d '{"text":"Heat the pan over medium heat."}' \
      --output /tmp/elevenlabs-test.mp3 -w '%{http_code}\n'
    afplay /tmp/elevenlabs-test.mp3
    ```

    Simulator UAT (MUST be performed manually):
    - Enter cooking mode → confirm natural ElevenLabs voice on step read-aloud.
    - Exit cooking mode → speech stops cleanly.
    - Negative test (server down) → falls back to expo-speech without crashing.
  </verify>
  <done>
    - `apps/mobile/src/cooking/useStepSpeaker.ts` refactored with ElevenLabs-first `speakViaElevenLabs` + `Speech.speak` fallback. Public API (`StepSpeakerHandle`, `runStepSpeakerEffect`, `useStepSpeaker`) unchanged.
    - LRU cache implemented: 20 entries max, MRU promotion on get, oldest-eviction on overflow.
    - Vitest suite passes: all 5 original tests updated to the new mock stack, 2 new tests added (Test 6 + Test 7).
    - `pnpm tsc --noEmit` is clean for `useStepSpeaker.ts` (no new errors introduced).
    - `curl POST /api/v1/voice/tts` with a valid JWT returns a 200 audio/mpeg response; the resulting MP3 plays a natural voice via `afplay`.
    - Simulator UAT confirms cooking mode uses the new voice and falls back gracefully on server outage.
  </done>
</task>

</tasks>

<verification>
End-to-end checklist (run after all 3 tasks):

1. **Server typecheck:** `cd packages/server && pnpm tsc --noEmit` → clean.
2. **Mobile typecheck (target file):** `cd apps/mobile && npx tsc --noEmit` → no new errors on useStepSpeaker.ts.
3. **Mobile tests:** `cd apps/mobile && pnpm test -- useStepSpeaker` → all 7 tests pass.
4. **Backend curl (happy path):** MP3 plays natural voice via `afplay /tmp/elevenlabs-test.mp3`.
5. **Backend curl (degradation):** With ELEVENLABS_API_KEY unset OR temporarily set to an invalid value, /tts returns 502 `{error: 'TTS unavailable'}` and the server does NOT crash.
6. **Simulator UAT:** Cooking-mode step read-aloud uses ElevenLabs voice.
7. **Simulator UAT (negative):** Kill the server → next step falls back to expo-speech without crash.
8. **No unintended files modified:** `git status` shows only the files listed in `files_modified`. `apps/mobile/ios/**` diff is large but expected from prebuild.

Blocker contingencies — document in SUMMARY and proceed to commit if encountered:
- **Missing ELEVENLABS_API_KEY in root .env:** server fails on first /tts request. Feature-code-complete; curl + UAT blocked pending user adding key.
- **xcodebuild fails:** do NOT pivot to `eas build --local` without user confirmation. Mark plan feature-code-complete; UAT blocked.
- **Prebuild drops a plugin from app.json:** restore from pre-prebuild git diff; re-run pod install + xcodebuild.
</verification>

<success_criteria>
The plan is complete when:
- [ ] All 8 verification checks pass OR blockers are documented in SUMMARY with the feature-code-complete rationale.
- [ ] `POST /api/v1/voice/tts` returns audio/mpeg bytes for a valid authed request.
- [ ] Mobile cooking mode uses ElevenLabs voice on happy path, expo-speech on failure path.
- [ ] Public API of `useStepSpeaker` is byte-for-byte unchanged — no consumer file edits.
- [ ] `cook.tsx`, `useVoiceListener.ts`, `handleTranscript.ts`, and all other cooking-flow files have ZERO diffs.
- [ ] Tests pass: 7 tests in useStepSpeaker.test.ts, all green.
- [ ] Server typecheck clean.
- [ ] Mobile typecheck clean for useStepSpeaker.ts.
</success_criteria>

<output>
After completion, create `.planning/quick/5-elevenlabs-tts-integration-backend-proxy/5-SUMMARY.md` documenting:
- Files changed + file sizes (LOC delta).
- Commands run for prebuild + xcodebuild + curl.
- curl response sample (status code, content-length, first-bytes check).
- afplay audible voice observation ("natural warm male voice, clearly distinct from iOS system voice").
- Any blockers encountered (missing API key, xcodebuild failure, etc.) with remediation notes.
- Simulator UAT screenshots referenced from `/tmp/`.
- Explicit note: consumers (cook.tsx, etc.) untouched — public API preserved.
</output>
