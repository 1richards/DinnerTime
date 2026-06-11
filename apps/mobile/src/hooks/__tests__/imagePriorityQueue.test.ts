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
 * the ORDER in which requests actually leave the queue (reach fetch) after the
 * first two saturate the 2 concurrent slots.
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
  it('dequeues the lowest-priority waiter first when a slot frees', async () => {
    // Fire 5 prefetches. MAX_CONCURRENT=2, so two enter fetch immediately and
    // three wait. We deliberately enqueue them OUT of priority order to prove
    // the queue reorders by priority, not insertion order.
    prefetchGeneratedRecipeImage('A', { priority: 0 }); // slot 1 (immediate)
    prefetchGeneratedRecipeImage('B', { priority: 9 }); // slot 2 (immediate)
    prefetchGeneratedRecipeImage('C', { priority: 5 }); // queued
    prefetchGeneratedRecipeImage('D', { priority: 1 }); // queued (highest pri)
    prefetchGeneratedRecipeImage('E', { priority: 3 }); // queued

    await flush();
    // First two saturate the slots in insertion order.
    expect(fetchOrder).toEqual(['A', 'B']);

    // Free one slot — the queued waiter with the LOWEST priority (D=1) goes.
    resolvers['A']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'B', 'D']);

    // Free another — next lowest among remaining (E=3) before C=5.
    resolvers['B']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'B', 'D', 'E']);

    // Last remaining waiter (C=5).
    resolvers['D']!(makeResponse());
    await flush();
    expect(fetchOrder).toEqual(['A', 'B', 'D', 'E', 'C']);
  });
});
