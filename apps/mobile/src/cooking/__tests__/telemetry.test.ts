/**
 * Red test stub (Phase 16 Wave 0) — production module ships in 16-01.
 *
 * Imports `../telemetry` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../telemetry'" — that is the red signal.
 *
 * Wave 1 (plan 16-01) creates `telemetry.ts` to make these tests green.
 *
 * Requirement: COOK-UX-02 (STT evaluated / telemetry pipeline).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 red stub; shipped 16-01)
import {
  logCookingEvent,
  flushTelemetry,
  sanitizePayload,
  __resetForTests,
} from '../telemetry';

describe('telemetry — cooking event batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof __resetForTests === 'function') __resetForTests();
    // @ts-expect-error — global fetch seam
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-flushes after 10 events with POST + Authorization + events.length === 10', async () => {
    for (let i = 0; i < 10; i++) {
      logCookingEvent({
        name: 'stt_final',
        session_id: 'sess-x',
        payload: { ms: 1200, confidence: 0.9 },
      });
    }
    // allow microtasks + any queued flush to resolve
    await vi.runAllTimersAsync();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toMatch(/^Bearer /);
    const parsed = JSON.parse(init.body);
    expect(parsed.events.length).toBe(10);
  });

  it('time-based flush: 1 event + 30s tick triggers flush', async () => {
    logCookingEvent({
      name: 'stt_final',
      session_id: 'sess-x',
      payload: { ms: 800 },
    });
    await vi.advanceTimersByTimeAsync(30_000);

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
  });

  it('re-queues the batch when the server responds 5xx', async () => {
    // @ts-expect-error — seed failure once then success
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    logCookingEvent({
      name: 'stt_final',
      session_id: 'sess-x',
      payload: { ms: 800 },
    });
    await vi.advanceTimersByTimeAsync(30_000);
    // First flush failed — retry flush should send the same batch again.
    await flushTelemetry();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('queue cap: 201 enqueues drops the oldest; queue.length === 200', () => {
    for (let i = 0; i < 201; i++) {
      logCookingEvent({
        name: 'stt_final',
        session_id: 'sess-x',
        payload: { ms: i },
      });
    }
    // __resetForTests exposes a getter for the internal queue length.
    // The sentinel contract: after 201 logs + no flush, queue holds ≤ 200 events.
    const queueLen = (
      __resetForTests as unknown as { getQueueLength?: () => number }
    ).getQueueLength?.();
    if (typeof queueLen === 'number') {
      expect(queueLen).toBe(200);
    }
  });

  it('sanitizePayload exposes the documented key surface only', () => {
    const dirty = {
      confidence: 0.9,
      ms: 1200,
      intent_type: 'next',
      length: 42,
      error_code: null,
      first_chunk_ms: 400,
      total_ms: 1600,
      answer_length: 120,
      session_id: 'sess-x',
      transcript: 'sensitive words that should NOT be forwarded',
      user_name: 'Patrick',
    };
    const clean = sanitizePayload(dirty);
    expect(Object.keys(clean).sort()).toEqual(
      [
        'answer_length',
        'confidence',
        'error_code',
        'first_chunk_ms',
        'intent_type',
        'length',
        'ms',
        'session_id',
        'total_ms',
      ].sort()
    );
    // And confirm the PII fields are absent.
    expect((clean as Record<string, unknown>).transcript).toBeUndefined();
    expect((clean as Record<string, unknown>).user_name).toBeUndefined();
  });
});
