/**
 * streamingAsk — SSE client for the Phase 16 /api/v1/cooking/ask-stream
 * endpoint (COOK-UX-01).
 *
 * Consumes the server's SSE stream and emits per-chunk callbacks so the
 * cook screen (Wave 3, plan 16-06) can start TTS on the first sentence
 * boundary instead of waiting for the full response. Cuts p95 TTS-first-word
 * latency from ~2-3s to <1.5s.
 *
 * Kept intentionally separate from askAssistant.ts — the non-streaming
 * function remains the fallback path when:
 *   - RN 0.83 fetch does not expose res.body as a ReadableStream
 *     (Pitfall 1, 16-RESEARCH.md lines 758-769), in which case this module
 *     calls onError('NO_STREAM_BODY') and the caller falls back.
 *   - The server emits event: error (CLAUDE_ERROR).
 *   - The stream throws mid-read.
 *
 * Wire format (from server/src/routes/cooking.ts):
 *   event: delta\ndata: <chunk>\n\n     (one per text delta from Claude)
 *   event: done\ndata: <full-answer>\n\n
 *   event: error\ndata: <code>\n\n
 */

export interface StreamAskOptions {
  /**
   * API base URL (e.g. http://localhost:3000 or the Cloudflare tunnel URL).
   * Injected by the caller so the module stays independent of the Expo
   * process.env lookup seam — makes tests trivial.
   */
  baseUrl: string;
  /** Supabase access token. Caller resolves via `supabase.auth.getSession()`. */
  accessToken: string;
  recipeId: string;
  currentStepIndex: number;
  question: string;
}

export interface StreamAskHandlers {
  /** Called once per `event: delta` SSE message. */
  onChunk: (chunk: string) => void;
  /** Called once when `event: done` arrives. Stream is then finalized. */
  onDone: (full: string) => void;
  /**
   * Called on any failure. Codes emitted by this module:
   *   - 'NO_AUTH'          — accessToken was empty/missing
   *   - 'HTTP_<status>'    — non-OK HTTP response
   *   - 'NO_STREAM_BODY'   — res.body was null (RN fallback signal)
   *   - 'STREAM_ERROR'     — reader threw mid-stream (rare)
   *   - '<event:error data>' — server-emitted SSE error (e.g. CLAUDE_ERROR)
   * The caller (cook.tsx in 16-06) treats NO_STREAM_BODY and NO_AUTH as
   * "fall through to askAssistant()" while CLAUDE_ERROR bubbles up as a
   * user-visible error.
   */
  onError: (code: string) => void;
}

/**
 * Parse an SSE message block (already separated by `\n\n`) into
 * { event, data }. Handles multi-line `data:` lines per the SSE spec
 * (though the server never emits them). Defaults to 'message' event when
 * `event:` is absent, matching EventSource behavior.
 */
function parseSSEMessage(raw: string): { event: string; data: string } {
  const lines = raw.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // Don't trim() aggressively — preserve intra-chunk whitespace that the
      // server intentionally emits (e.g. "Hello " with trailing space).
      // The SSE spec strips exactly one leading space after `data:`.
      const rest = line.slice(5);
      data += rest.startsWith(' ') ? rest.slice(1) : rest;
    }
  }
  return { event, data };
}

export async function streamAsk(
  options: StreamAskOptions,
  handlers: StreamAskHandlers
): Promise<void> {
  const { baseUrl, accessToken, recipeId, currentStepIndex, question } = options;
  const { onChunk, onDone, onError } = handlers;

  if (!accessToken) {
    onError('NO_AUTH');
    return;
  }

  let res: Response;
  try {
    res = (await fetch(`${baseUrl}/api/v1/cooking/ask-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipe_id: recipeId,
        current_step_index: currentStepIndex,
        question,
      }),
    })) as Response;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message || 'STREAM_ERROR')
        : 'STREAM_ERROR';
    onError(code);
    return;
  }

  if (!res.ok) {
    onError(`HTTP_${res.status}`);
    return;
  }

  // Pitfall 1 guard: RN 0.83 fetch may not expose a ReadableStream body on
  // some paths. Surface the fallback signal so cook.tsx can degrade to the
  // non-streaming askAssistant() path.
  if (!res.body) {
    onError('NO_STREAM_BODY');
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Each SSE message is terminated by a blank line (`\n\n`). Drain all
      // complete messages from the buffer before looping back to read.
      let sepIdx = buffer.indexOf('\n\n');
      while (sepIdx !== -1) {
        const rawMsg = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);
        sepIdx = buffer.indexOf('\n\n');

        if (rawMsg.length === 0) continue;
        const { event, data } = parseSSEMessage(rawMsg);

        if (event === 'delta') {
          onChunk(data);
        } else if (event === 'done') {
          onDone(data);
          // Swallow any remaining bytes — the stream is logically finished.
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return;
        } else if (event === 'error') {
          onError(data || 'STREAM_ERROR');
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
          return;
        }
        // Unknown events (future-proofing) are ignored.
      }
    }
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message || 'STREAM_ERROR')
        : 'STREAM_ERROR';
    onError(code);
    return;
  }

  // Stream closed without a terminal event. Treat as a soft error so the
  // caller can fall back to askAssistant() rather than hang.
  onError('STREAM_ERROR');
}
