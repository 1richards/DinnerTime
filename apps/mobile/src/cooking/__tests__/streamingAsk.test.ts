/**
 * Contract tests for the SSE streaming client (Phase 16 Wave 1, plan 16-02).
 *
 * Requirement: COOK-UX-01 (responsive voice latency via SSE streaming).
 *
 * The module was introduced as a Wave 0 red stub in 16-00 and filled in by
 * this plan. If these ever regress, cooking-mode TTS first-word latency
 * will regress too — keep them green.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSSEStream, buildSSEError } from '../__fixtures__/sse-response';
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
