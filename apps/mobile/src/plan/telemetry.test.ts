/**
 * Phase 22 Wave 0: plan telemetry batcher tests. Clones the Phase 20
 * shopping telemetry test pattern 1:1 — only diffs: 14-key whitelist
 * (9 parity + meal_plan_id + meal_plan_entry_id + variant + date +
 * week_start), meal_plan_id/meal_plan_entry_id fields, and the POST URL.
 *
 * Requirement: PLAN-X-10 foundation (plan_events telemetry pipeline).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  logPlanEvent,
  flushPlanTelemetry,
  sanitizePayload,
  __resetForTests,
} from './telemetry';

describe('telemetry — plan event batcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetForTests();
    // @ts-expect-error — global fetch seam
    globalThis.fetch = vi.fn(async () => ({ ok: true, status: 200 }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-flushes after 10 events with POST + Authorization + events.length === 10 + URL /telemetry/plan', async () => {
    for (let i = 0; i < 10; i++) {
      logPlanEvent({
        name: 'plan.recipe_pin_started',
        session_id: 'sess-x',
        payload: { ms: 1200, variant: 'recipe' },
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
    expect(url).toMatch(/\/api\/v1\/telemetry\/plan$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toMatch(/^Bearer /);
    const parsed = JSON.parse(init.body);
    expect(parsed.events.length).toBe(10);
  });

  it('time-based flush: 1 event + 30s tick triggers flush', async () => {
    logPlanEvent({
      name: 'plan.stretch_displayed',
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

    logPlanEvent({
      name: 'plan.recipe_pin_failed',
      session_id: 'sess-x',
      payload: { error_code: 'validation' },
    });
    await vi.advanceTimersByTimeAsync(30_000);
    // First flush failed — retry flush should send the same batch again.
    await flushPlanTelemetry();

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('queue cap: 201 enqueues drops the oldest; queue.length === 200', () => {
    for (let i = 0; i < 201; i++) {
      logPlanEvent({
        name: 'plan.recipe_pin_started',
        session_id: 'sess-x',
        payload: { ms: i },
      });
    }
    const queueLen = (
      __resetForTests as unknown as { getQueueLength?: () => number }
    ).getQueueLength?.();
    expect(typeof queueLen).toBe('number');
    expect(queueLen).toBe(200);
  });

  it('sanitizePayload exposes the documented key surface only (9 parity + 5 plan)', () => {
    const dirty = {
      // 9 parity keys
      answer_length: 120,
      confidence: 0.9,
      error_code: 'network',
      first_chunk_ms: 400,
      intent_type: 'next',
      length: 42,
      ms: 1200,
      session_id: 'sess-x',
      total_ms: 1600,
      // 5 plan-specific keys
      meal_plan_id: 'plan-abc',
      meal_plan_entry_id: 'entry-xyz',
      variant: 'swap',
      date: '2026-05-14',
      week_start: '2026-05-11',
      // PII-adjacent — must be dropped
      title: 'Coq au Vin',
      ingredient_names: ['chicken', 'wine'],
      user_note: 'anything that leaks',
      // Shopping-only keys that should NOT carry over — must be dropped
      item_count: 4,
      list_id: 'list-abc',
      order_id: 'order-abc',
      app_installed: true,
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
        'meal_plan_id',
        'meal_plan_entry_id',
        'variant',
        'date',
        'week_start',
      ].sort(),
    );
    // PII-adjacent absent
    expect((clean as Record<string, unknown>).title).toBeUndefined();
    expect((clean as Record<string, unknown>).ingredient_names).toBeUndefined();
    expect((clean as Record<string, unknown>).user_note).toBeUndefined();
    // Shopping-only keys absent (parity with shopping whitelist is intentional, but
    // we do NOT forward shopping-scoped IDs through the plan channel).
    expect((clean as Record<string, unknown>).item_count).toBeUndefined();
    expect((clean as Record<string, unknown>).list_id).toBeUndefined();
    expect((clean as Record<string, unknown>).order_id).toBeUndefined();
    expect((clean as Record<string, unknown>).app_installed).toBeUndefined();
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

  it('setTokenGetter overrides the default and is honored by flush', async () => {
    const customGetter = vi.fn(async () => 'custom-token');
    const setTokenGetter = (
      __resetForTests as unknown as {
        setTokenGetter: (fn: () => Promise<string | null>) => void;
      }
    ).setTokenGetter;
    setTokenGetter(customGetter);

    logPlanEvent({
      name: 'plan.week_regenerated',
      session_id: 'sess-x',
      payload: { ms: 500 },
    });
    await vi.advanceTimersByTimeAsync(30_000);

    expect(customGetter).toHaveBeenCalled();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init.headers.Authorization).toBe('Bearer custom-token');
  });
});
