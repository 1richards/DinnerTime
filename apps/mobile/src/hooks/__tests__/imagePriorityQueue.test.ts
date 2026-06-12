/**
 * Verifies the concurrency limiter in useGeneratedRecipeImage serves waiters
 * top-first: when slots are saturated, the queued request with the LOWEST
 * `priority` number is dequeued next (stable for ties). This is the core of
 * Task A — the TOP Something New card's hero must generate before lower cards
 * even when several fire at once.
 *
 * Strategy: drive the queue exclusively through prefetchGeneratedRecipeImage
 * (which goes through the same fetchGeneratedUrlThrottled limiter as the hook).
 * We mock the network fetch with a controllable promise per request and assert
 * the ORDER in which requests actually leave the queue (reach fetch). With
 * MAX_CONCURRENT=1 and microtask-coalesced scheduling, that order is strict
 * priority (lowest number first), independent of call/insertion order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Auth token always present so the fetch branch runs.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../ai/telemetry', () => ({
  logAiEvent: vi.fn(),
  sanitizePayload: (p: unknown) => p,
}));

import { prefetchGeneratedRecipeImage } from '../useGeneratedRecipeImage';

// Order in which the mocked fetch is actually entered (i.e. a slot was granted).
const fetchOrder: string[] = [];
// Resolver handles so the test controls when each in-flight request finishes.
const resolvers: Record<string, (v: Response) => void> = {};

function makeResponse(): Response {
  return {
    ok: true,
    json: async () => ({ url: 'https://img/x.png' }),
  } as unknown as Response;
}

beforeEach(() => {
  fetchOrder.length = 0;
  for (const k of Object.keys(resolvers)) delete resolvers[k];
});

global.fetch = vi.fn(async (_url: unknown, init?: { body?: string }) => {
  const body = JSON.parse(init?.body ?? '{}') as { title: string };
  const title = body.title;
  fetchOrder.push(title);
  return new Promise<Response>((resolve) => {
    resolvers[title] = resolve;
  });
}) as unknown as typeof fetch;

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useGeneratedRecipeImage priority queue', () => {
  it('leads with the top image alone, then fills the rest 2-wide in priority order', async () => {
    // Fire 5 prefetches in the SAME tick, OUT of priority order. Every request
    // enqueues (no synchronous free-slot grant), so the microtask scheduler
    // collects all 5, then starts the LOWEST priority. LEAD=1 means only the
    // top card (priority 0) runs until it resolves; then STEADY=2 opens up. This
    // proves (a) call order never wins and (b) the hero is guaranteed first.
    prefetchGeneratedRecipeImage('A', { priority: 0 });
    prefetchGeneratedRecipeImage('B', { priority: 9 });
    prefetchGeneratedRecipeImage('C', { priority: 5 });
    prefetchGeneratedRecipeImage('D', { priority: 1 });
    prefetchGeneratedRecipeImage('E', { priority: 3 });

    await flush();
    // LEAD phase: only the highest-priority (A=0) has started — hero alone.
    expect(fetchOrder).toEqual(['A']);

    // A resolves → burst opens to STEADY=2: the two lowest remaining start
    // together (D=1 then E=3), still strictly by priority.
    resolvers['A']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D', 'E']);

    // D resolves → next-lowest (C=5) fills the freed slot.
    resolvers['D']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D', 'E', 'C']);

    // E resolves → last waiter (B=9), despite it enqueuing 2nd.
    resolvers['E']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D', 'E', 'C', 'B']);
  });
});
