import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { generateSpeech } from '../services/elevenlabs.js';

const voice = new Hono();

voice.use('*', authMiddleware);

voice.post('/transcribe', (c) => {
  return c.json({ data: [], message: 'Not implemented' }, 501);
});

/**
 * POST /tts — Proxy ElevenLabs text-to-speech for cooking-mode step
 * read-aloud. Accepts { text, voiceId? }, returns audio/mpeg bytes on
 * success. On any ElevenLabs failure (non-ok status, network error),
 * returns 502 { error: 'TTS unavailable' } — the mobile hook reads this
 * and falls back transparently to expo-speech, so cooking flow never
 * breaks even if ElevenLabs is down or the key is invalid/rotated.
 */
voice.post('/tts', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }
  const { text, voiceId } = (body ?? {}) as {
    text?: unknown;
    voiceId?: unknown;
  };
  if (typeof text !== 'string') {
    return c.json({ error: 'text is required and must be a string' }, 400);
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return c.json({ error: 'text must be non-empty' }, 400);
  }
  if (trimmed.length > 5000) {
    return c.json({ error: 'text exceeds 5000 character limit' }, 400);
  }
  const resolvedVoiceId =
    typeof voiceId === 'string' && voiceId.trim().length > 0
      ? voiceId.trim()
      : undefined;
  const bytes = await generateSpeech(trimmed, resolvedVoiceId);
  if (!bytes) {
    return c.json({ error: 'TTS unavailable' }, 502);
  }
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
});

export default voice;
