/**
 * Phase 23 Wave 2 (plan 23-06): mobile-side AI telemetry batcher tests.
 *
 * Cloned from apps/mobile/src/shopping/__tests__/telemetry.test.ts, with:
 *   - endpoint swapped to /api/v1/telemetry/ai
 *   - 14-key whitelist tuned to AI-call scope (task_name + model + tokens + latency)
 *   - session_id is still included so we can correlate cross-channel traces
 *
 * Requirement: NFR-17 (AI telemetry — cost + latency + model per call).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  logAiEvent,
  flushAiTelemetry,
  sanitizePayload,
  __resetForTests,
} from '../telemetry';

describe('telemetry — ai event batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof __resetForTests === 'function') {
      try {
        __resetForTests();
      } catch {
        // acceptable in wave 0
      }
    }
    // @ts-expect-error — global fetch seam
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-flushes after 10 events with POST + Authorization + events.length === 10', async () => {
    for (let i = 0; i < 10; i++) {
      logAiEvent({
        name: 'ai.request_succeeded',
        session_id: 'sess-x',
        task_name: 'pantry.scan',
        model: 'claude-sonnet-4-20250514',
        payload: { latency_ms: 1200, tokens_in: 400, tokens_out: 180 },
      });
    }
    await vi.runAllTimersAsync();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toMatch(/\/api\/v1\/telemetry\/ai$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toMatch(/^Bearer /);
    const parsed = JSON.parse(init.body);
    expect(parsed.events.length).toBe(10);
  });

  it('time-based flush: 1 event + 30s tick triggers flush', async () => {
    logAiEvent({
      name: 'ai.request_succeeded',
      session_id: 'sess-x',
      task_name: 'pantry.scan',
      model: 'claude-sonnet-4-20250514',
      payload: { latency_ms: 800 },
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

    logAiEvent({
      name: 'ai.request_failed',
      session_id: 'sess-x',
      task_name: 'planner.generate_week',
      model: 'claude-sonnet-4-20250514',
      payload: { error_code: 'anthropic_5xx' },
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await flushAiTelemetry();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('queue cap: 201 enqueues drops the oldest; queue.length === 200', () => {
    for (let i = 0; i < 201; i++) {
      logAiEvent({
        name: 'ai.request_succeeded',
        session_id: 'sess-x',
        task_name: 'pantry.scan',
        model: 'claude-sonnet-4-20250514',
        payload: { latency_ms: i },
      });
    }
    const queueLen = (
      __resetForTests as unknown as { getQueueLength?: () => number }
    ).getQueueLength?.();
    expect(typeof queueLen).toBe('number');
    expect(queueLen).toBe(200);
  });

  it('sanitizePayload exposes the documented 14-key surface only (AI-specific whitelist)', () => {
    const dirty = {
      // AI-specific whitelist (14 keys per plan)
      session_id: 'sess-x',
      task_name: 'pantry.scan',
      model: 'claude-sonnet-4-20250514',
      tokens_in: 400,
      tokens_out: 180,
      latency_ms: 1200,
      first_chunk_ms: 400,
      total_ms: 1600,
      success: true,
      error_code: 'anthropic_5xx',
      intent_type: 'query',
      length: 42,
      ms: 1200,
      confidence: 0.9,
      // PII — must be dropped
      raw_query: 'anything that leaks',
      prompt: 'system prompt text',
      email: 'patrick@example.com',
      user_name: 'Patrick',
    };
    const clean = sanitizePayload(dirty);
    expect(Object.keys(clean).sort()).toEqual(
      [
        'session_id',
        'task_name',
        'model',
        'tokens_in',
        'tokens_out',
        'latency_ms',
        'first_chunk_ms',
        'total_ms',
        'success',
        'error_code',
        'intent_type',
        'length',
        'ms',
        'confidence',
      ].sort(),
    );
    expect((clean as Record<string, unknown>).raw_query).toBeUndefined();
    expect((clean as Record<string, unknown>).prompt).toBeUndefined();
    expect((clean as Record<string, unknown>).email).toBeUndefined();
    expect((clean as Record<string, unknown>).user_name).toBeUndefined();
  });

  it('__resetForTests exposes setTokenGetter() seam', () => {
    const setTokenGetter = (
      __resetForTests as unknown as {
        setTokenGetter?: (fn: () => Promise<string | null>) => void;
      }
    ).setTokenGetter;
    expect(typeof setTokenGetter).toBe('function');
    expect(() => setTokenGetter?.(async () => 'tok-xyz')).not.toThrow();
  });
});
