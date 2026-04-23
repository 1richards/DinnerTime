import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Recipe } from '../types/recipe';
import type { CookingState, Timer, CommandToast } from '../types/cooking';

interface CookingActions {
  enter: (recipe: Recipe) => void;
  exit: () => void;
  next: () => void;
  back: () => void;
  jumpToStep: (index: number) => void;
  repeat: () => void;
  addTimer: (ms: number) => void;
  removeTimer: (id: string) => void;
  setListening: (listening: boolean) => void;
  setAssistantAnswer: (answer: string | null) => void;
  // Phase 16 additions
  toggleIngredient: (id: string) => void;
  clearIngredientChecks: () => void;
  setDarkMode: (on: boolean) => void;
  showCommandToast: (message: string) => void;
  clearCommandToast: () => void;
  startSession: () => void;
}

const initialState: CookingState = {
  recipe: null,
  stepIndex: 0,
  voiceEnabled: true,
  ttsEnabled: true,
  listening: false,
  timers: [],
  lastAssistantAnswer: null,
  ingredientChecks: {},
  darkMode: false,
  lastCommandToast: null,
  currentSessionId: null,
};

// RN-safe id generator: crypto.randomUUID is unreliable in RN runtime
const genTimerId = (): string =>
  `tmr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const genSessionId = (): string =>
  `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const genToastId = (): string => `t-${Date.now()}`;

export const useCookingStore = create<CookingState & CookingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      enter: (recipe) => {
        // Reset per-session ephemeral state and mint a fresh telemetry session id.
        set({
          recipe,
          stepIndex: 0,
          ingredientChecks: {},
          currentSessionId: genSessionId(),
        });
      },

      exit: () => {
        set({
          recipe: null,
          stepIndex: 0,
          timers: [],
          listening: false,
          // Phase 16: clear session + toast on exit so next enter() is clean.
          currentSessionId: null,
          lastCommandToast: null,
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

      jumpToStep: (index) => {
        const { recipe } = get();
        if (!recipe) return;
        const maxIndex = Math.max(0, recipe.steps.length - 1);
        const clamped = Math.min(Math.max(0, index), maxIndex);
        set({ stepIndex: clamped });
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

      // --- Phase 16 additions ---------------------------------------------

      toggleIngredient: (id) => {
        const current = get().ingredientChecks;
        set({
          ingredientChecks: {
            ...current,
            [id]: !current[id],
          },
        });
      },

      clearIngredientChecks: () => {
        set({ ingredientChecks: {} });
      },

      setDarkMode: (on) => {
        set({ darkMode: on });
      },

      showCommandToast: (message) => {
        const toast: CommandToast = { message, id: genToastId() };
        set({ lastCommandToast: toast });
      },

      clearCommandToast: () => {
        set({ lastCommandToast: null });
      },

      startSession: () => {
        set({ currentSessionId: genSessionId() });
      },
    }),
    {
      name: 'dinnertime-cooking',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the cooking-mode preferences (dark mode). Everything else
      // is ephemeral per cooking session.
      partialize: (state) => ({ darkMode: state.darkMode }),
      version: 1,
    }
  )
);
