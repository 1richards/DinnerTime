/**
 * elevenlabs — thin POST wrapper around the ElevenLabs text-to-speech API.
 *
 * Mirrors recipeImageGen's error-swallowing pattern: any non-ok response or
 * thrown fetch error is logged and returns null. The /tts route reads the
 * null and surfaces a 502 to the client; nothing bubbles up that could
 * crash the server or destabilize cooking-mode callers.
 *
 * Single responsibility: HTTP call only. No retries, no backoff, no cache —
 * consistent with recipeImageGen's Gemini wrapper. The mobile hook owns
 * session-level MP3 caching via an LRU; the server stays stateless.
 */
import { env } from '../config/env.js';

const BASE = 'https://api.elevenlabs.io/v1/text-to-speech';
const MODEL = 'eleven_turbo_v2_5';

/**
 * Default voice — Daniel, a warm British male. UAT pivot 2026-05-01:
 * an env override had drifted to a female voice the user disliked
 * ("girl's voice isn't good"). Pinning the code-level default to a
 * specific British male voice ID keeps the cooking-mode read-aloud
 * tone consistent regardless of env state. Voice IDs are stable
 * ElevenLabs handles.
 */
const DEFAULT_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9';

/**
 * generateSpeech — POST to ElevenLabs text-to-speech, return MP3 bytes.
 * Graceful degradation: swallows all errors and returns null so callers
 * can surface a 502 without crashing. Mirrors recipeImageGen's pattern.
 *
 * @param text   non-empty, caller-trimmed, bounded to 5000 chars upstream.
 * @param voiceId optional override; falls back to env.ELEVENLABS_VOICE_ID,
 *                then to DEFAULT_VOICE_ID (Daniel, British male).
 */
export async function generateSpeech(
  text: string,
  voiceId?: string,
): Promise<Buffer | null> {
  try {
    const envVoice = env.ELEVENLABS_VOICE_ID;
    const resolvedVoice =
      voiceId && voiceId.trim().length > 0
        ? voiceId
        : envVoice && envVoice.trim().length > 0
          ? envVoice
          : DEFAULT_VOICE_ID;
    const res = await fetch(`${BASE}/${resolvedVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed: 0.95,
        },
      }),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      console.error('[elevenlabs] non-ok', res.status, bodyText.slice(0, 500));
      return null;
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  } catch (err) {
    console.error('[elevenlabs] fetch error:', err);
    return null;
  }
}
