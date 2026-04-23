/**
 * useStepSpeaker — thin wrapper over expo-speech for cooking-mode step
 * read-aloud (VOIC-05). Isolated in one file so a pre-1.0 expo-speech API
 * break is a single-file fix (Pitfall 7 mitigation).
 *
 * Behavior:
 *   - On mount / text change: speak the step at a slightly slowed rate.
 *   - On cleanup: Speech.stop() to prevent overlap with the next step or
 *     TTS bleed-through when the user exits cooking mode.
 *   - enabled=false or text=undefined: no-op.
 *
 * Voice selection:
 *   - Prefers a British male voice ("Daniel", "Oliver", "Arthur") at the
 *     highest quality tier (Premium > Enhanced > Default).
 *   - Falls back to any en-GB voice, then to the system default.
 *   - The chosen identifier is cached module-scope so we pick exactly once
 *     per app lifetime. Picking is async (getAvailableVoicesAsync is a
 *     Promise) but speak() degrades gracefully when the cache is empty —
 *     the first call uses system default, later calls use the preferred
 *     voice once the lookup settles.
 *
 * Phase 16 (16-06) extensions:
 *   - Module-level `speak(text)` + `stop()` functions allow cook.tsx to
 *     imperatively drive TTS (for question answers + timer-done
 *     announcements) without re-mounting the hook. `stop()` is also wired
 *     to the StopTTSButton in the sticky header.
 *   - NOTE: the telemetry event `tts_echo_swallowed` is emitted by
 *     useVoiceListener (the owner of the soft isSpeakingAsync gate), not
 *     here. This file intentionally does NOT add telemetry — it is a
 *     passive TTS surface.
 *
 * The effect body is extracted as `runStepSpeakerEffect` so it can be
 * exercised by unit tests in a node (non-DOM) environment without a React
 * hook renderer. The hook itself is a one-line useEffect wrapper.
 */
import * as Speech from 'expo-speech';
import { useEffect, useMemo } from 'react';

/**
 * Imperative TTS control returned by `useStepSpeaker`. Consumers (cook.tsx)
 * invoke `speak` / `stop` directly — e.g., StopTTSButton onPress calls
 * `stepSpeaker.stop()`, AskSheet fallback path calls `stepSpeaker.speak(answer)`.
 */
export interface StepSpeakerHandle {
  speak: (text: string) => void;
  stop: () => void;
}

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

// Kick off the voice lookup on module load so the identifier is usually
// resolved before the first speak() call.
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

export function runStepSpeakerEffect(
  text: string | undefined,
  enabled: boolean,
): (() => void) | undefined {
  if (!enabled || !text) return undefined;
  Speech.speak(text, baseSpeakOptions());
  return () => {
    Speech.stop();
  };
}

export function useStepSpeaker(
  text: string | undefined,
  enabled: boolean,
): StepSpeakerHandle {
  useEffect(() => runStepSpeakerEffect(text, enabled), [text, enabled]);

  // The handle is stable across renders — speak/stop call into the
  // module-level expo-speech API so consumers don't need to re-register
  // callbacks when stepIndex changes.
  return useMemo<StepSpeakerHandle>(
    () => ({
      speak: (t: string) => {
        Speech.speak(t, baseSpeakOptions());
      },
      stop: () => {
        Speech.stop();
      },
    }),
    [],
  );
}
