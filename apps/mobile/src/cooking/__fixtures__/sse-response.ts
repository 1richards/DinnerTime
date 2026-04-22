/**
 * SSE mock helpers for Phase 16 streaming tests.
 *
 * Build real `ReadableStream<Uint8Array>` instances that mimic what the server
 * will emit on `POST /cooking/ask-stream`. Consumed by
 * `src/cooking/__tests__/streamingAsk.test.ts`.
 *
 * Event shape:
 *   event: delta
 *   data: <chunk>
 *
 *   ...
 *
 *   event: done
 *   data: <full-concatenated-answer>
 *
 * Error variant:
 *   event: error
 *   data: <error-code>
 */

const encoder = new TextEncoder();

function encode(event: string, data: string): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${data}\n\n`);
}

/**
 * Build a ReadableStream that emits each chunk as `event: delta`, then a final
 * `event: done` carrying the concatenated full answer.
 */
export function buildSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const full = chunks.join('');
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encode('delta', chunk));
      }
      controller.enqueue(encode('done', full));
      controller.close();
    },
  });
}

/**
 * Build a ReadableStream that emits a single `event: error` message and closes.
 */
export function buildSSEError(code: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encode('error', code));
      controller.close();
    },
  });
}
