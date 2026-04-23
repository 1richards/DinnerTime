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
 *
 * v2 (Phase 16 COOK-UX-05):
 *   - Fires `onCommandToast` + `onCommandHaptic` on every recognized intent
 *     EXCEPT `ask` (AskSheet opens instead — no toast) and `pause`/`resume`
 *     (silent per UI-SPEC §Voice feedback principle).
 *   - `timer` case no longer calls `speak(...)` — silent confirmation rule.
 *     Callers must wire their UI feedback via `onCommandToast` (toast copy
 *     per UI-SPEC: `Timer set · {N} min`).
 *   - NEW `show_ingredients` intent: fires stopSpeech → haptic → toast
 *     ('Ingredients') → `onShowIngredients()`. No network, no /ask routing.
 *     The scroll target (ScrollableRecipe's ingredient section) is wired by
 *     the cook.tsx integration in 16-06.
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
  /** Fired on recognized intent (next/back/repeat/timer/show_ingredients). Not fired on ask/pause/resume. */
  onCommandToast: (message: string) => void;
  /** Medium impact haptic. Paired with onCommandToast — same dispatch rules. */
  onCommandHaptic: () => void;
  /** Scrolls the ScrollableRecipe to its ingredients section. Wired in 16-06. */
  onShowIngredients: () => void;
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
      deps.onCommandHaptic();
      deps.onCommandToast('Next step');
      return intent;
    case 'back':
      deps.stopSpeech();
      deps.back();
      deps.onCommandHaptic();
      deps.onCommandToast('Previous step');
      return intent;
    case 'repeat':
      deps.stopSpeech();
      deps.repeat();
      deps.onCommandHaptic();
      deps.onCommandToast('Repeating');
      return intent;
    case 'timer': {
      deps.addTimer(intent.ms);
      const minutes = Math.round(intent.ms / 60000);
      deps.onCommandHaptic();
      deps.onCommandToast(`Timer set · ${minutes} min`);
      // Intentionally NO deps.speak(...) — UI-SPEC §Voice feedback principle:
      // silent confirmation, no TTS echo.
      return intent;
    }
    case 'pause':
      deps.stopSpeech();
      return intent;
    case 'resume':
      return intent;
    case 'show_ingredients':
      deps.stopSpeech();
      deps.onCommandHaptic();
      deps.onCommandToast('Ingredients');
      deps.onShowIngredients();
      return intent;
    case 'ask':
      await deps.onAsk(intent.question);
      return intent;
  }
}
