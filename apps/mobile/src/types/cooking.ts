import type { Recipe } from './recipe';

export type CookingIntent =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'repeat' }
  | { type: 'timer'; ms: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'show_ingredients' }
  | { type: 'ask'; question: string };

export interface Timer {
  id: string;
  label: string;
  endsAt: number; // epoch ms
  remainingMs: number;
}

export interface CommandToast {
  message: string;
  id: string;
}

export interface CookingState {
  recipe: Recipe | null;
  stepIndex: number;
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  listening: boolean;
  timers: Timer[];
  lastAssistantAnswer: string | null;
  // Phase 16 additions
  /** Map of ingredient id -> checked flag (ephemeral; cleared on enter/exit). */
  ingredientChecks: Record<string, boolean>;
  /** User-selected dark cooking mode preference. Persisted across sessions. */
  darkMode: boolean;
  /** Most-recent voice-command toast message (auto-cleared by the UI after 1.5s). */
  lastCommandToast: CommandToast | null;
  /** Session id for telemetry grouping; regenerated on every enter(), cleared on exit(). */
  currentSessionId: string | null;
  /**
   * Mic permission state (mirrored from the OS so the UI can surface a
   * "denied — open Settings" banner instead of failing silently when
   * voice mode is enabled but the mic is unavailable).
   */
  micPermission: 'unknown' | 'granted' | 'denied';
}
