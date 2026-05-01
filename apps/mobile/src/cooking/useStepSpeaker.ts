/**
 * useStepSpeaker — ElevenLabs-first cooking-mode step read-aloud.
 *
 * Behavior (quick-5):
 *   - On mount / text change: POST to /api/v1/voice/tts, write MP3 bytes to
 *     the cache dir, play via expo-audio.
 *   - On any failure (auth missing, non-ok response, network error,
 *     expo-audio throw, file write throw): invisibly fall back to
 *     expo-speech with the preserved British-voice selection logic.
 *   - On cleanup: pause + release the current expo-audio player AND call
 *     Speech.stop() so either playback path terminates cleanly.
 *   - enabled=false or text=undefined: no-op (no fetch, no player, no
 *     speak).
 *
 * Cache:
 *   - Session-level 20-entry LRU keyed by trimmed text. MRU-promote on get;
 *     evict the oldest when overflowing.
 *   - Cached URIs point at files previously written to
 *     FileSystem.cacheDirectory — expo-audio plays the cached file without
 *     a round-trip to the server.
 *   - LRU cap keeps the cache bounded; recipe steps average ~30 entries
 *     per session so eviction pressure is low.
 *
 * Voice-selection (fallback path only):
 *   - Prefers a British male voice ("Daniel", "Oliver", "Arthur") at the
 *     highest quality tier (Premium > Enhanced > Default).
 *   - Falls back to any en-GB voice, then to the system default.
 *   - Resolved once per app lifetime (module-scope cache).
 *
 * Race-guard:
 *   - fetchCounter is bumped on every new speak / cleanup so stale inflight
 *     fetches don't play into a superseded step. Stale resolutions short-
 *     circuit without playing AND without firing the fallback (the caller
 *     already moved on).
 *
 * Public API (UNCHANGED from quick-4):
 *   export interface StepSpeakerHandle { speak, stop }
 *   export function runStepSpeakerEffect(text, enabled)
 *   export function useStepSpeaker(text, enabled): StepSpeakerHandle
 *
 * Consumers (cook.tsx, useVoiceListener.ts, AskSheet, StopTTSButton) are
 * NOT modified. This file is the single pivot-point for the TTS provider.
 */
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
// Legacy file-system API (cacheDirectory / writeAsStringAsync / EncodingType)
// is the simplest path for fire-and-forget base64 writes. The new class-based
// API (File/Paths) in expo-file-system's default export is more ergonomic for
// streams but adds verbosity for our one-shot cache write. Revisit if legacy
// is removed in a future SDK.
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Imperative TTS control returned by `useStepSpeaker`. Consumers (cook.tsx)
 * invoke `speak` / `stop` directly — e.g., StopTTSButton onPress calls
 * `stepSpeaker.stop()`, AskSheet fallback path calls `stepSpeaker.speak(answer)`.
 */
export interface StepSpeakerHandle {
  speak: (text: string) => void;
  stop: () => void;
}

// ---------- Voice-selection state (fallback path) ----------

// Voice-selection cache. Resolved once per app lifetime by the first consumer
// to import this module; subsequent speak() calls read the already-resolved
// identifier synchronously.
let preferredVoiceId: string | undefined;
let voiceLookupStarted = false;

interface AnyVoice {
  identifier: string;
  name?: string;
  language?: string;
  quality?: string;
}

// Rank British male voices. Higher quality wins; Daniel/Oliver/Arthur are the
// canonical iOS "British gentleman" voices. If none match, we settle for any
// en-GB voice so the user at least gets the right accent.
function scoreVoice(v: AnyVoice): number {
  if (!v.language) return -1;
  const isGB = v.language === 'en-GB' || v.language.toLowerCase().startsWith('en-gb');
  if (!isGB) return -1;
  const q = (v.quality ?? '').toLowerCase();
  const qualityScore = q.includes('premium') ? 30 : q.includes('enhanced') ? 20 : 10;
  const name = (v.name ?? '').toLowerCase();
  const nameScore = /daniel|oliver|arthur|jamie/.test(name)
    ? 40
    : /\b(male|guy)\b/.test(name)
      ? 20
      : 0;
  return qualityScore + nameScore;
}

async function resolvePreferredVoice(): Promise<void> {
  if (voiceLookupStarted) return;
  voiceLookupStarted = true;
  try {
    const voices = (await Speech.getAvailableVoicesAsync()) as AnyVoice[];
    let best: AnyVoice | undefined;
    let bestScore = -1;
    for (const v of voices) {
      const s = scoreVoice(v);
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    if (best && bestScore >= 0) {
      preferredVoiceId = best.identifier;
    }
  } catch {
    // getAvailableVoicesAsync throws on platforms without TTS — fall through
    // and keep preferredVoiceId undefined so speak() uses the system default.
  }
}

// Kick off the voice lookup on module load — still needed for the fallback
// path when ElevenLabs is unreachable.
void resolvePreferredVoice();

function baseSpeakOptions(): Speech.SpeechOptions {
  // Keep `language: 'en-US'` — that's what STT listens in (useVoiceListener
  // passes lang 'en-US'), and mismatched TTS/STT locales can lengthen the
  // TTS-speaking window in ways that cause the STT echo-gate to swallow
  // "next" / "repeat" commands (Pitfall 4 in useVoiceListener). When a
  // British voice identifier resolves, iOS still speaks with that voice —
  // `voice` overrides `language` for actual playback — so we get the
  // accent without the STT-blocking side effect.
  return {
    language: 'en-US',
    voice: preferredVoiceId,
    rate: 0.95,
    pitch: 1.0,
    onError: (e) => console.warn('[tts]', e),
  };
}

// ---------- ElevenLabs path ----------

type LRUEntry = { uri: string };
const LRU_MAX = 20;
// Key is `${voiceId ?? 'default'}::${trimmedText}` so swapping voices
// in Settings doesn't replay cached audio in the previous voice.
const lruCache = new Map<string, LRUEntry>();

function cacheKey(text: string, voiceId: string | null): string {
  return `${voiceId ?? 'default'}::${text}`;
}

function getSelectedVoiceId(): string | null {
  // Read on every speak() — Zustand's getState is synchronous and cheap.
  // Picking up a Settings change without a remount is the whole point of
  // this hook reaching into the store directly instead of taking a prop.
  try {
    return useSettingsStore.getState().cookingVoiceId;
  } catch {
    return null;
  }
}

let currentPlayer: AudioPlayer | null = null;
// Monotonic id bumped on every new speak() or cleanup so stale inflight
// fetches drop their result silently.
let fetchCounter = 0;

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
  try {
    p.pause();
  } catch {
    /* ignore */
  }
  try {
    p.release();
  } catch {
    /* ignore */
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // React Native 0.83 polyfills Buffer via buffer — prefer it because it's
  // the fastest path. If for some reason Buffer isn't present we fall
  // through to the string-chunk manual encoder + global btoa (also
  // polyfilled in RN). Either path produces a base64 string expo-file-
  // system can write with encoding: 'base64'.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buf).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).btoa(binary);
}

function simpleHash(s: string): string {
  // Cheap non-crypto hash for filenames — collision-resistance is NOT
  // required because the LRU key IS the text; the file just needs a
  // stable name that's consistent within a session. djb2.
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function fallbackToSpeech(text: string): void {
  Speech.speak(text, baseSpeakOptions());
}

/**
 * Try the ElevenLabs path. Returns true when the expo-audio player was
 * started (or a stale result was dropped — the caller should NOT fall
 * back in that case either). Returns false only when the caller should
 * fall back to Speech.speak.
 */
async function speakViaElevenLabs(
  text: string,
  myFetchId: number,
): Promise<boolean> {
  const voiceId = getSelectedVoiceId();
  const key = cacheKey(text, voiceId);

  // Cache hit — replay the already-downloaded file.
  const cached = lruGet(key);
  if (cached) {
    try {
      if (fetchCounter !== myFetchId) return true; // stale — caller moved on
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
      body: JSON.stringify(voiceId ? { text, voiceId } : { text }),
    });
    if (!res.ok) return false;
    const arr = await res.arrayBuffer();
    if (fetchCounter !== myFetchId) return true; // stale, don't fall back

    const b64 = arrayBufferToBase64(arr);
    // Filename includes voice slug so different voices for the same text
    // don't overwrite each other on disk.
    const filename = `tts-${simpleHash(key)}.mp3`;
    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    lruSet(key, { uri });

    if (fetchCounter !== myFetchId) return true; // stale post-write
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

// ---------- Public API ----------

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
    // Cleanup: invalidate any still-inflight speakVia* for this effect and
    // stop whichever path was playing.
    fetchCounter++;
    releaseCurrentPlayer();
    Speech.stop();
  };
}

export function useStepSpeaker(
  text: string | undefined,
  enabled: boolean,
): StepSpeakerHandle {
  useEffect(() => runStepSpeakerEffect(text, enabled), [text, enabled]);

  // The handle is stable across renders — speak/stop call into the
  // module-level ElevenLabs-first pipeline so consumers don't need to
  // re-register callbacks when stepIndex changes.
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
}
