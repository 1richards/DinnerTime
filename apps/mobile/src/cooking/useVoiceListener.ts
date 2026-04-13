/**
 * useVoiceListener — thin wrapper over @jamsch/expo-speech-recognition
 * (VOIC-02). This is the ONLY file in the app that touches the pre-1.0
 * speech-recognition API surface, so a breaking library change is a
 * single-file fix (Pitfall 7 mitigation).
 *
 * Critical semantics:
 *   - Only FINAL results are forwarded to onFinalTranscript (Pitfall 2 —
 *     interim "next time" would mis-fire a "next" intent mid-word).
 *   - If TTS is currently speaking (Speech.isSpeakingAsync), swallow the
 *     transcript (Pitfall 4 — TTS-into-STT feedback loops).
 *   - On 'end' (iOS SFSpeechRecognizer caps ~1 min), auto-restart after a
 *     small delay as long as enabled is still true.
 *   - Lifecycle: request permissions + start on enabled→true, stop on
 *     enabled→false or unmount.
 *
 * No dedicated unit test in this plan — deeply RN/native coupled. The
 * cooking screen test in 09-05 exercises it end-to-end via the global
 * vitest.setup.ts mocks. TODO: manual device-build smoke test for
 * continuous listening across the ~1 min iOS cap.
 */
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from '@jamsch/expo-speech-recognition';
import * as Speech from 'expo-speech';
import { useEffect, useRef } from 'react';

interface SpeechResultEvent {
  results: Array<{ transcript: string; isFinal?: boolean } | undefined>;
  isFinal?: boolean;
}

interface SpeechErrorEvent {
  error?: string;
  message?: string;
}

async function startListening(hints: string[]): Promise<void> {
  const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
  if (!granted) return;
  ExpoSpeechRecognitionModule.start({
    lang: 'en-US',
    continuous: true,
    interimResults: false,
    iosTaskHint: 'confirmation',
    contextualStrings: hints,
  });
}

export function useVoiceListener(
  onFinalTranscript: (transcript: string) => void,
  enabled: boolean,
  hints: string[],
): void {
  // Keep latest callback/flags in refs so the event handlers (which close
  // over the first-render values) always see current values without
  // re-subscribing on every render.
  const callbackRef = useRef(onFinalTranscript);
  const enabledRef = useRef(enabled);
  const hintsRef = useRef(hints);
  callbackRef.current = onFinalTranscript;
  enabledRef.current = enabled;
  hintsRef.current = hints;

  useSpeechRecognitionEvent('result', (e: SpeechResultEvent) => {
    const result = e.results[0];
    if (!result) return;
    const isFinal = result.isFinal ?? e.isFinal ?? false;
    if (!isFinal) return; // Pitfall 2 — final results only.

    // Pitfall 4 — drop transcripts that arrive while TTS is speaking.
    // isSpeakingAsync is a Promise; we check then forward.
    Speech.isSpeakingAsync().then((speaking) => {
      if (speaking) return;
      callbackRef.current(result.transcript);
    });
  });

  useSpeechRecognitionEvent('error', (e: SpeechErrorEvent) => {
    console.warn('[stt]', e.error, e.message);
  });

  useSpeechRecognitionEvent('end', () => {
    // iOS SFSpeechRecognizer stops after ~1 min silence — auto-restart while
    // cooking mode is still active. The small setTimeout lets the native
    // module fully tear down before we start again.
    if (!enabledRef.current) return;
    setTimeout(() => {
      if (enabledRef.current) {
        void startListening(hintsRef.current);
      }
    }, 250);
  });

  useEffect(() => {
    if (enabled) {
      void startListening(hints);
      return () => {
        ExpoSpeechRecognitionModule.stop();
      };
    }
    ExpoSpeechRecognitionModule.stop();
    return undefined;
    // We intentionally re-run only on enabled flips; hints changes are
    // read via the ref so a dynamic hint list doesn't tear down the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
