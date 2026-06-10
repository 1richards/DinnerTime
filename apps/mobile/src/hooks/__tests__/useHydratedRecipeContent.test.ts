/**
 * Phase 29-03 (D4): useHydratedRecipeContent — background content hydration.
 *
 * Mirrors useGeneratedRecipeImage's module-level cache + MAX_CONCURRENT=2 FIFO
 * limiter + AsyncStorage persistence + inflight coalescing. These tests
 * exercise the MODULE surface (prefetchHydration / hydrationStatusFor /
 * MAX_CONCURRENT) directly — the vitest env is node with react-native mocked,
 * so we don't mount the React hook; the module-level limiter + cache are the
 * load-bearing logic and are fully testable without a renderer.
 *
 * Assertions:
 *  (a) a resolved hydration is queryable as 'resolved' with ingredients/steps;
 *  (b) two prefetchHydration calls for the SAME preview → fetch called ONCE
 *      (inflight coalescing);
 *  (c) the limiter caps concurrent in-flight fetches at MAX_CONCURRENT (=2);
 *  (d) a failed fetch → status 'failed' and is NOT persisted to AsyncStorage.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// In-memory AsyncStorage so we can assert what gets persisted (resolved only).
const asyncStorageMock = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    default: {
      getItem: vi.fn(async (k: string) => store.get(k) ?? null),
      setItem: vi.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: vi.fn(async (k: string) => {
        store.delete(k);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorageMock.default,
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: 'test-token' } },
        error: null,
      })),
    },
  },
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  prefetchHydration,
  hydrationStatusFor,
  MAX_CONCURRENT,
  __resetHydrationCacheForTests,
  type HydratePreview,
} from '../useHydratedRecipeContent';

function preview(title: string, names: string[] = ['onion']): HydratePreview {
  return {
    title,
    description: 'desc',
    difficulty: 'easy',
    prep_time_minutes: 5,
    cook_time_minutes: 10,
    total_time_minutes: 15,
    cuisine: 'Italian',
    ingredient_names: names,
  };
}

function okHydrate(ingredients: { name: string }[], steps: string[]) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          ingredients,
          steps,
          calories_per_serving: 400,
          protein_grams_per_serving: 20,
          servings: 2,
        },
      }),
  };
}

describe('useHydratedRecipeContent module', () => {
  beforeEach(() => {
    asyncStorageMock.store.clear();
    vi.clearAllMocks();
    mockFetch.mockReset();
    __resetHydrationCacheForTests();
  });

  it('exports MAX_CONCURRENT === 2', () => {
    expect(MAX_CONCURRENT).toBe(2);
  });

  it('(a) prefetchHydration resolves to provided ingredients/steps, status resolved', async () => {
    mockFetch.mockResolvedValueOnce(
      okHydrate([{ name: 'onion' }, { name: 'garlic' }], ['Chop', 'Cook']),
    );

    const result = await prefetchHydration(preview('Soup'));

    expect(result).not.toBeNull();
    expect(result!.ingredients.map((i) => i.name)).toEqual(['onion', 'garlic']);
    expect(result!.steps).toEqual(['Chop', 'Cook']);
    expect(hydrationStatusFor(preview('Soup'))).toBe('resolved');
    // POSTs to the 29-02 endpoint.
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/recipes/hydrate'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('(b) two prefetchHydration calls for same preview → fetch called once (coalescing)', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    mockFetch.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );

    const p1 = prefetchHydration(preview('Stew'));
    const p2 = prefetchHydration(preview('Stew'));

    resolveFetch(okHydrate([{ name: 'beef' }], ['Sear']));
    await Promise.all([p1, p2]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('(c) limiter caps concurrent in-flight fetches at MAX_CONCURRENT', async () => {
    let active = 0;
    let peak = 0;
    const releasers: Array<() => void> = [];

    mockFetch.mockImplementation(
      () =>
        new Promise((res) => {
          active++;
          peak = Math.max(peak, active);
          releasers.push(() => {
            active--;
            res(okHydrate([{ name: 'x' }], ['step']));
          });
        }),
    );

    // Fire 4 distinct previews — only MAX_CONCURRENT should be in-flight.
    const promises = [
      prefetchHydration(preview('A', ['a'])),
      prefetchHydration(preview('B', ['b'])),
      prefetchHydration(preview('C', ['c'])),
      prefetchHydration(preview('D', ['d'])),
    ];

    // Let the limiter admit the first batch.
    await Promise.resolve();
    await Promise.resolve();

    expect(active).toBe(MAX_CONCURRENT);

    // Drain.
    while (releasers.length) {
      releasers.shift()!();
      await Promise.resolve();
      await Promise.resolve();
    }
    await Promise.all(promises);

    expect(peak).toBe(MAX_CONCURRENT);
  });

  it('(d) failed fetch → status failed, NOT persisted', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });

    const result = await prefetchHydration(preview('Bad'));

    expect(result).toBeNull();
    expect(hydrationStatusFor(preview('Bad'))).toBe('failed');

    // Give persistence a tick — failures must not be written.
    await new Promise((r) => setTimeout(r, 10));
    for (const v of asyncStorageMock.store.values()) {
      const parsed = JSON.parse(v) as Record<string, unknown>;
      expect(Object.keys(parsed)).toHaveLength(0);
    }
  });
});
