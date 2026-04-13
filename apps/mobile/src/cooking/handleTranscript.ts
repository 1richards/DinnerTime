/**
 * handleTranscript — pure dispatcher factored out of cook.tsx so it can be
 * unit-tested under vitest's node environment without rendering React Native.
 *
 * Given a final STT transcript, classify via routeIntent and fan out to the
 * provided action callbacks. Async `ask` flow is awaited by the caller.
 *
 * All TTS/Speech calls are passed in as callbacks — this module has zero
 * direct dependencies on expo-speech, cookingStore, or askAssistant so tests
 * can swap them with plain mocks.
 */
import type { CookingIntent } from '../types/cooking';
import { routeIntent } from './intentRouter';

export interface TranscriptDeps {
  stopSpeech: () => void;
  next: () => void;
  back: () => void;
  repeat: () => void;
  addTimer: (ms: number) => void;
  speak: (text: string) => void;
  onAsk: (question: string) => Promise<void>;
}

export async function handleTranscript(
  transcript: string,
  deps: TranscriptDeps,
): Promise<CookingIntent> {
  const intent = routeIntent(transcript);

  switch (intent.type) {
    case 'next':
      deps.stopSpeech();
      deps.next();
      return intent;
    case 'back':
      deps.stopSpeech();
      deps.back();
      return intent;
    case 'repeat':
      deps.stopSpeech();
      deps.repeat();
      return intent;
    case 'timer': {
      deps.addTimer(intent.ms);
      const minutes = Math.round(intent.ms / 60000);
      deps.speak(
        `Timer set for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
      return intent;
    }
    case 'pause':
      deps.stopSpeech();
      return intent;
    case 'resume':
      return intent;
    case 'ask':
      await deps.onAsk(intent.question);
      return intent;
  }
}
