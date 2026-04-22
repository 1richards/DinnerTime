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

export function runStepSpeakerEffect(
  text: string | undefined,
  enabled: boolean,
): (() => void) | undefined {
  if (!enabled || !text) return undefined;
  Speech.speak(text, {
    language: 'en-US',
    rate: 0.95,
    pitch: 1.0,
    onError: (e) => console.warn('[tts]', e),
  });
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
        Speech.speak(t, {
          language: 'en-US',
          rate: 0.95,
          pitch: 1.0,
          onError: (e) => console.warn('[tts]', e),
        });
      },
      stop: () => {
        Speech.stop();
      },
    }),
    [],
  );
}
