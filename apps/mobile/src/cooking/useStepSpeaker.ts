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
 * The effect body is extracted as `runStepSpeakerEffect` so it can be
 * exercised by unit tests in a node (non-DOM) environment without a React
 * hook renderer. The hook itself is a one-line useEffect wrapper.
 */
import * as Speech from 'expo-speech';
import { useEffect } from 'react';

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
): void {
  useEffect(() => runStepSpeakerEffect(text, enabled), [text, enabled]);
}
