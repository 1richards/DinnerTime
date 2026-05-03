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
  ttsEnabled: boolean;
  listening: boolean;
  timers: Timer[];
  lastAssistantAnswer: string | null;
  // Phase 16 additions
  /** Map of ingredient id -> checked flag (ephemeral; cleared on enter/exit). */
  ingredientChecks: Record<string, boolean>;
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
  /**
   * True after the user has tapped Back/Next or jumpToStep at least once
   * during the current session. Cooking mode opens at the top (ingredients
   * visible) and only auto-centers the active step card after the user
   * navigates — without this gate the auto-scroll would jump past the
   * ingredients on first layout, hiding what the user actually wants to
   * read first.
   */
  userNavigated: boolean;
}
