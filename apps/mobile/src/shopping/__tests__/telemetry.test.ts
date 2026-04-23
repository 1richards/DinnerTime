/**
 * Red test stub (Phase 20 Wave 0) — production module ships in 20-01.
 *
 * The import resolves to `apps/mobile/src/shopping/telemetry.ts` (a minimal
 * stub that throws / no-ops). Wave 0 contract: these tests fail with
 * ASSERTION errors (not import errors). Wave 1 (plan 20-01) clones the
 * Phase 16 cooking telemetry implementation here verbatim, with the
 * whitelist extended to 14 keys (9 original + 5 shopping-specific), and
 * flips every case green.
 *
 * Requirement: SHOP-DC-04 (shopping telemetry pipeline).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  logShoppingEvent,
  flushShoppingTelemetry,
  sanitizePayload,
  __resetForTests,
} from '../telemetry';

describe('telemetry — shopping event batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    if (typeof __resetForTests === 'function') {
      try {
        __resetForTests();
      } catch {
        // stub may throw — acceptable in Wave 0
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
      logShoppingEvent({
        name: 'shopping.draft_cart_started',
        session_id: 'sess-x',
        payload: { ms: 1200, item_count: 4 },
      });
    }
    // allow microtasks + any queued flush to resolve
    await vi.runAllTimersAsync();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toMatch(/\/api\/v1\/telemetry\/shopping$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toMatch(/^Bearer /);
    const parsed = JSON.parse(init.body);
    expect(parsed.events.length).toBe(10);
  });

  it('time-based flush: 1 event + 30s tick triggers flush', async () => {
    logShoppingEvent({
      name: 'shopping.draft_cart_started',
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

    logShoppingEvent({
      name: 'shopping.draft_cart_failed',
      session_id: 'sess-x',
      payload: { error_code: 'instacart_api' },
    });
    await vi.advanceTimersByTimeAsync(30_000);
    // First flush failed — retry flush should send the same batch again.
    await flushShoppingTelemetry();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('queue cap: 201 enqueues drops the oldest; queue.length === 200', () => {
    for (let i = 0; i < 201; i++) {
      logShoppingEvent({
        name: 'shopping.draft_cart_started',
        session_id: 'sess-x',
        payload: { ms: i },
      });
    }
    // __resetForTests exposes a getter for the internal queue length.
    // The sentinel contract: after 201 logs + no flush, queue holds ≤ 200 events.
    const queueLen = (
      __resetForTests as unknown as { getQueueLength?: () => number }
    ).getQueueLength?.();
    expect(typeof queueLen).toBe('number');
    expect(queueLen).toBe(200);
  });

  it('sanitizePayload exposes the documented key surface only (9 Phase-16 + 5 shopping)', () => {
    const dirty = {
      // 9 Phase-16 keys
      answer_length: 120,
      confidence: 0.9,
      error_code: 'network',
      first_chunk_ms: 400,
      intent_type: 'next',
      length: 42,
      ms: 1200,
      session_id: 'sess-x',
      total_ms: 1600,
      // 5 shopping-specific keys
      item_count: 4,
      list_id: 'list-fixture-20',
      order_id: 'order-abc',
      app_installed: true,
      variant: 'instacart_api',
      // PII — must be dropped
      item_names: ['chicken', 'rice'],
      user_name: 'Patrick',
      raw_query: 'anything that leaks',
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
        'item_count',
        'list_id',
        'order_id',
        'app_installed',
        'variant',
      ].sort(),
    );
    // And confirm the PII fields are absent.
    expect((clean as Record<string, unknown>).item_names).toBeUndefined();
    expect((clean as Record<string, unknown>).user_name).toBeUndefined();
    expect((clean as Record<string, unknown>).raw_query).toBeUndefined();
  });

  it('__resetForTests exposes setTokenGetter() seam', () => {
    const setTokenGetter = (
      __resetForTests as unknown as {
        setTokenGetter?: (fn: () => Promise<string | null>) => void;
      }
    ).setTokenGetter;
    expect(typeof setTokenGetter).toBe('function');
    // Calling should not throw in the real impl.
    expect(() => setTokenGetter?.(async () => 'tok-xyz')).not.toThrow();
  });
});
