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
 * Phase 16 (16-06) telemetry hooks:
 *   - Fire `stt_final` on every final transcript (payload: { length,
 *     confidence? }; NEVER the raw transcript text — PII guard in
 *     16-RESEARCH.md Pattern 1).
 *   - Fire `stt_error` on every error event (payload: { error_code }).
 *   - Fire `tts_echo_swallowed` when the soft isSpeakingAsync gate drops a
 *     transcript — this is the soft-gate owner per UI-SPEC §Echo-loop.
 *   - session_id is read lazily from useCookingStore.getState() so the hook
 *     doesn't re-subscribe on session changes. Null session → skip logging.
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
import { logCookingEvent, sanitizePayload } from './telemetry';
import { useCookingStore } from '../stores/cookingStore';

interface SpeechResultEvent {
  results: Array<
    { transcript: string; isFinal?: boolean; confidence?: number } | undefined
  >;
  isFinal?: boolean;
}

interface SpeechErrorEvent {
  error?: string;
  message?: string;
  code?: string | number;
  name?: string;
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

    // Phase 16 telemetry: fire stt_final on EVERY final transcript — before
    // the TTS-echo soft-gate — so we capture the ground truth rate the model
    // actually surfaces finals at. payload carries only length + confidence
    // (NEVER the raw transcript — PII guard).
    const sessionId = useCookingStore.getState().currentSessionId;
    const recipeId = useCookingStore.getState().recipe?.id ?? null;
    const stepIndex = useCookingStore.getState().stepIndex;
    if (sessionId) {
      logCookingEvent({
        name: 'stt_final',
        session_id: sessionId,
        recipe_id: recipeId,
        step_index: stepIndex,
        payload: sanitizePayload({
          length: result.transcript.length,
          confidence: result.confidence ?? null,
        }),
      });
    }

    // Pitfall 4 — drop transcripts that arrive while TTS is speaking.
    // isSpeakingAsync is a Promise; we check then forward.
    Speech.isSpeakingAsync().then((speaking) => {
      if (speaking) {
        // TTS-echo soft-gate swallowed a transcript. Emit telemetry so the
        // post-beta analysis can quantify false-trigger rate.
        const sid = useCookingStore.getState().currentSessionId;
        if (sid) {
          logCookingEvent({
            name: 'tts_echo_swallowed',
            session_id: sid,
            recipe_id: useCookingStore.getState().recipe?.id ?? null,
            step_index: useCookingStore.getState().stepIndex,
            payload: {},
          });
        }
        return;
      }
      callbackRef.current(result.transcript);
    });
  });

  useSpeechRecognitionEvent('error', (e: SpeechErrorEvent) => {
    console.warn('[stt]', e.error, e.message);
    const sessionId = useCookingStore.getState().currentSessionId;
    if (sessionId) {
      logCookingEvent({
        name: 'stt_error',
        session_id: sessionId,
        recipe_id: useCookingStore.getState().recipe?.id ?? null,
        step_index: useCookingStore.getState().stepIndex,
        payload: sanitizePayload({
          error_code: String(e.code ?? e.name ?? e.error ?? 'unknown'),
        }),
      });
    }
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
