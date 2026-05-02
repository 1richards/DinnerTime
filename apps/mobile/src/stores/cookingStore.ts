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
  setMicPermission: (state: 'unknown' | 'granted' | 'denied') => void;
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
  voiceEnabled: false,
  ttsEnabled: true,
  listening: false,
  timers: [],
  lastAssistantAnswer: null,
  ingredientChecks: {},
  darkMode: false,
  lastCommandToast: null,
  currentSessionId: null,
  micPermission: 'unknown',
  userNavigated: false,
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
        // voiceEnabled resets to false every session so users opt in explicitly
        // each time — a persisted "on" state would silently re-enable the mic
        // on a subsequent recipe even after the user had turned it off.
        // userNavigated also resets so the initial scroll position holds at
        // the top (ingredients visible) until the user taps Back/Next.
        set({
          recipe,
          stepIndex: 0,
          ingredientChecks: {},
          currentSessionId: genSessionId(),
          voiceEnabled: false,
          userNavigated: false,
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
        set({
          stepIndex: Math.min(stepIndex + 1, maxIndex),
          userNavigated: true,
        });
      },

      back: () => {
        const { stepIndex } = get();
        set({ stepIndex: Math.max(0, stepIndex - 1), userNavigated: true });
      },

      jumpToStep: (index) => {
        const { recipe } = get();
        if (!recipe) return;
        const maxIndex = Math.max(0, recipe.steps.length - 1);
        const clamped = Math.min(Math.max(0, index), maxIndex);
        set({ stepIndex: clamped, userNavigated: true });
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

      setMicPermission: (state) => {
        set({ micPermission: state });
        // Permission denial implies the listener can't be active. Clear the
        // listening flag eagerly so the UI doesn't show a stale "live" dot.
        if (state === 'denied') set({ listening: false });
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
