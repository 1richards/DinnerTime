/**
 * SSE smoke script — Phase 16 Wave 0 gate.
 *
 * Verifies that React Native 0.83 + Hermes exposes a working `fetch` +
 * `ReadableStream.getReader()` pipeline against our `/cooking/ask-stream`
 * endpoint. This is NOT a vitest test — it's a one-shot manual spike run
 * from the dev client.
 *
 * Why this exists:
 *   - `apps/mobile/src/cooking/streamingAsk.ts` (shipped in Wave 1) depends
 *     on `res.body?.getReader()` returning a ReadableStreamDefaultReader.
 *   - Some RN fetch polyfills historically return `null` for `res.body`,
 *     forcing a full-text fallback. We MUST validate on real hardware before
 *     Wave 1 commits to the streaming architecture.
 *
 * How to run:
 *   1. Start the dev server:  pnpm -C packages/server dev
 *   2. Start Metro:           cd apps/mobile && npx expo start --dev-client --lan
 *   3. In the running dev client, temporarily `import('./src/cooking/sse-smoke').then(m => m.runSseSmoke())`
 *      from somewhere that mounts at app entry (e.g. paste into `_layout.tsx`
 *      inside a `useEffect` for the spike, remove before commit).
 *   4. Observe the React Native console. Expected output (see EXPECTED_LOG
 *      constant below).
 *
 * Fallback: if `res.body` is `null` on RN 0.83, log a FALLBACK line and
 * document in DEVICE-TEST-16.md §Latency → Wave 1 will then ship the
 * text-based fallback parser instead of streaming.
 */

export const EXPECTED_LOG = [
  '[sse-smoke] starting fetch to /cooking/ask-stream',
  '[sse-smoke] status=200',
  '[sse-smoke] body=<ReadableStream>',
  '[sse-smoke] delta: ...',
  '[sse-smoke] done',
];

export interface SseSmokeOptions {
  baseUrl?: string;
  accessToken: string;
  recipeId: string;
  currentStepIndex?: number;
  question?: string;
}

export async function runSseSmoke(opts: SseSmokeOptions): Promise<void> {
  const baseUrl = opts.baseUrl ?? 'http://localhost:3000';
  const url = `${baseUrl}/api/v1/cooking/ask-stream`;
  const body = JSON.stringify({
    recipe_id: opts.recipeId,
    current_step_index: opts.currentStepIndex ?? 0,
    question: opts.question ?? 'how do I know the chicken is done?',
  });

  console.log('[sse-smoke] starting fetch to /cooking/ask-stream');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.accessToken}`,
    },
    body,
  });
  console.log(`[sse-smoke] status=${res.status}`);

  // RN 0.83 compatibility gate — if body is null, log FALLBACK and exit.
  if (!res.body) {
    console.log(
      '[sse-smoke] FALLBACK: res.body is null — RN fetch ReadableStream unsupported. Document in DEVICE-TEST-16.md.'
    );
    return;
  }
  console.log('[sse-smoke] body=<ReadableStream>');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  // Minimal SSE framing scan — production parser lives in streamingAsk.ts.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        console.log(`[sse-smoke] delta: ${line.slice(6)}`);
      }
    }
  }
  console.log('[sse-smoke] done');
}
