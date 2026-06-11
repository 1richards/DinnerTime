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
  it('starts requests in strict priority order, serially (top image first)', async () => {
    // Fire 5 prefetches in the SAME tick, OUT of priority order. MAX_CONCURRENT
    // is 1 and every request is enqueued (no synchronous free-slot grant), so
    // the microtask scheduler collects all 5 first and then starts the LOWEST
    // priority. This proves call order does NOT win — the top card (priority 0)
    // generates first, and each next-lowest only starts once the prior resolves.
    prefetchGeneratedRecipeImage('A', { priority: 0 });
    prefetchGeneratedRecipeImage('B', { priority: 9 });
    prefetchGeneratedRecipeImage('C', { priority: 5 });
    prefetchGeneratedRecipeImage('D', { priority: 1 });
    prefetchGeneratedRecipeImage('E', { priority: 3 });

    await flush();
    // Only the highest-priority (A=0) has started — serial, so nothing else yet.
    expect(fetchOrder).toEqual(['A']);

    // A resolves → next-lowest priority among the rest is D=1.
    resolvers['A']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D']);

    // D resolves → E=3 next.
    resolvers['D']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D', 'E']);

    // E resolves → C=5 next (B=9 still last despite enqueuing 2nd).
    resolvers['E']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D', 'E', 'C']);

    // C resolves → B=9 last.
    resolvers['C']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'D', 'E', 'C', 'B']);
  });
});
