import { create } from 'zustand';
import type { Recipe } from '../types/recipe';
import type { CookingState, Timer } from '../types/cooking';

interface CookingActions {
  enter: (recipe: Recipe) => void;
  exit: () => void;
  next: () => void;
  back: () => void;
  repeat: () => void;
  addTimer: (ms: number) => void;
  removeTimer: (id: string) => void;
  setListening: (listening: boolean) => void;
  setAssistantAnswer: (answer: string | null) => void;
}

const initialState: CookingState = {
  recipe: null,
  stepIndex: 0,
  voiceEnabled: true,
  ttsEnabled: true,
  listening: false,
  timers: [],
  lastAssistantAnswer: null,
};

// RN-safe id generator: crypto.randomUUID is unreliable in RN runtime
const genTimerId = (): string =>
  `tmr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const useCookingStore = create<CookingState & CookingActions>()(
  (set, get) => ({
    ...initialState,

    enter: (recipe) => {
      set({ recipe, stepIndex: 0 });
    },

    exit: () => {
      set({
        recipe: null,
        stepIndex: 0,
        timers: [],
        listening: false,
      });
    },

    next: () => {
      const { recipe, stepIndex } = get();
      if (!recipe) return;
      const maxIndex = Math.max(0, recipe.steps.length - 1);
      set({ stepIndex: Math.min(stepIndex + 1, maxIndex) });
    },

    back: () => {
      const { stepIndex } = get();
      set({ stepIndex: Math.max(0, stepIndex - 1) });
    },

    repeat: () => {
      // Intentional no-op on state — downstream effects observe the call
      // via imperative dispatch (TTS re-reads current step).
      set({});
    },

    addTimer: (ms) => {
      const now = Date.now();
      const minutes = Math.round(ms / 60000);
      const timer: Timer = {
        id: genTimerId(),
        label: `${minutes} min`,
        endsAt: now + ms,
        remainingMs: ms,
      };
      set({ timers: [...get().timers, timer] });
    },

    removeTimer: (id) => {
      set({ timers: get().timers.filter((t) => t.id !== id) });
    },

    setListening: (listening) => {
      set({ listening });
    },

    setAssistantAnswer: (answer) => {
      set({ lastAssistantAnswer: answer });
    },
  })
);
