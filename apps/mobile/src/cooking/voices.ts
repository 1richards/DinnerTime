/**
 * Curated ElevenLabs voice catalog for cooking-mode read-aloud.
 *
 * IDs are well-known ElevenLabs default voices (publicly listed in the
 * voice library). They're stable handles — each maps to a fixed voice
 * regardless of the user's ElevenLabs account state. Selection persists
 * via `settingsStore.cookingVoiceId`; `null` means "use the server-side
 * default" (Daniel — pinned in `packages/server/src/services/elevenlabs.ts`).
 *
 * Adding a voice: append an entry below. The Settings picker auto-renders
 * from this list. If a chosen ID isn't reachable on the user's account
 * the server returns 502 and `useStepSpeaker` falls back to expo-speech
 * silently — no UX break.
 */

export interface CookingVoice {
  id: string;
  name: string;
  accent: string;
  description: string;
}

export const COOKING_VOICES: readonly CookingVoice[] = [
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    accent: 'British male',
    description: 'Warm, deep narration. The default — pinned to keep the cooking-mode tone consistent.',
  },
  {
    id: 'XB0fDUnXU5powFXDhCwa',
    name: 'Charlotte',
    accent: 'English female',
    description: 'Calm and soft — friendly without being chatty.',
  },
  {
    id: 'pNInz6obpgDQGcFmaJgB',
    name: 'Adam',
    accent: 'American male',
    description: 'Deep and steady. American counterpart to Daniel.',
  },
  {
    id: '21m00Tcm4TlvDq8ikWAM',
    name: 'Rachel',
    accent: 'American female',
    description: 'Calm narration — clear pacing for step-by-step instructions.',
  },
  {
    id: 'ErXwobaYiN019PkySvjV',
    name: 'Antoni',
    accent: 'American male',
    description: 'Conversational and warm — a touch lighter than Adam.',
  },
] as const;

export const DEFAULT_COOKING_VOICE_ID = COOKING_VOICES[0].id;
