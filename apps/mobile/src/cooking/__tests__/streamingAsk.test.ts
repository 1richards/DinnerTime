/**
 * Red test stub (Phase 16 Wave 0) — production module ships in 16-01.
 *
 * Imports `../streamingAsk` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../streamingAsk'" — that is the red signal.
 *
 * Wave 1 (plan 16-01) creates `streamingAsk.ts` to make these tests green.
 *
 * Requirement: COOK-UX-01 (responsive voice latency via SSE streaming).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSSEStream, buildSSEError } from '../__fixtures__/sse-response';

// @ts-expect-error — module does not exist yet (Wave 0 red stub; shipped 16-01)
import { streamAsk } from '../streamingAsk';

describe('streamingAsk — SSE parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes onChunk for each delta and onDone with the full concatenation', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: buildSSEStream(['Hello ', 'world. ', 'Done.']),
    }));
    // @ts-expect-error — assign into the global fetch seam used by streamAsk.
    globalThis.fetch = fetchMock;

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamAsk(
      {
        baseUrl: 'http://localhost:3000',
        accessToken: 't',
        recipeId: 'r1',
        currentStepIndex: 0,
        question: 'what now?',
      },
      { onChunk, onDone, onError }
    );

    expect(onChunk).toHaveBeenCalledTimes(3);
    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hello ');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'world. ');
    expect(onChunk).toHaveBeenNthCalledWith(3, 'Done.');
    expect(onDone).toHaveBeenCalledWith('Hello world. Done.');
    expect(onError).not.toHaveBeenCalled();
  });

  it('fires onError with HTTP_<status> when fetch returns !ok', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      body: null,
    }));
    // @ts-expect-error — global fetch seam
    globalThis.fetch = fetchMock;

    const onError = vi.fn();
    await streamAsk(
      {
        baseUrl: 'http://localhost:3000',
        accessToken: 't',
        recipeId: 'r1',
        currentStepIndex: 0,
        question: 'hi',
      },
      { onChunk: vi.fn(), onDone: vi.fn(), onError }
    );
    expect(onError).toHaveBeenCalledWith('HTTP_503');
  });

  it('fires onError with the error code when the stream emits event: error', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: buildSSEError('CLAUDE_ERROR'),
    }));
    // @ts-expect-error — global fetch seam
    globalThis.fetch = fetchMock;

    const onError = vi.fn();
    await streamAsk(
      {
        baseUrl: 'http://localhost:3000',
        accessToken: 't',
        recipeId: 'r1',
        currentStepIndex: 0,
        question: 'hi',
      },
      { onChunk: vi.fn(), onDone: vi.fn(), onError }
    );
    expect(onError).toHaveBeenCalledWith('CLAUDE_ERROR');
  });
});
