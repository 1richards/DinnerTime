import type { Recipe } from './recipe';

export type CookingIntent =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'repeat' }
  | { type: 'timer'; ms: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'ask'; question: string };

export interface Timer {
  id: string;
  label: string;
  endsAt: number; // epoch ms
  remainingMs: number;
}

export interface CookingState {
  recipe: Recipe | null;
  stepIndex: number;
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  listening: boolean;
  timers: Timer[];
  lastAssistantAnswer: string | null;
}
