/**
 * Phase 17 Wave 0 (plan 17-00): Persistence contract for suggestionsStore.
 *
 * Red-by-design. suggestionsStore today has no `persist` middleware wrapper;
 * Plan 17-02 wraps it with `zustand/middleware#persist` and partialize-gates
 * the fields below. These tests pin the contract.
 *
 * Why `vi.resetModules()` + dynamic import:
 *   Zustand persist attaches to AsyncStorage at module import time. We want a
 *   fresh store per test so a previous test's setState doesn't leak into the
 *   next. The canonical shape lives in `recipeStore.persist.test.ts` — we
 *   mirror it here.
 *
 * Pitfall 1 (17-RESEARCH): autoFetch MUST NOT be persisted. If it were, a
 * cold-boot after the user toggled autoFetch on during a post-scan flow would
 * re-trigger SuggestionList even when they're no longer in that flow. The
 * partialize function MUST whitelist only the Phase 17 fields.
 *
 * @see .planning/phases/17-.../17-VALIDATION.md § Per-Task Verification Map
 * @see .planning/phases/17-.../17-CONTEXT.md D-02, D-05, D-10
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
        data: { session: { access_token: 't' } },
        error: null,
      })),
    },
  },
}));

// Key that plan 17-02 will use in the persist config. Locked here so Plan 02
// sees a named contract instead of inventing the key.
const STORAGE_KEY = 'dinnertime-suggestions';

describe('suggestionsStore persist (Phase 17 Wave 0)', () => {
  beforeEach(() => {
    asyncStorageMock.store.clear();
    vi.resetModules();
  });

  it('P17-02: persists searchResults, recentQueries, lastQuery, pantryOnly', async () => {
    const { useSuggestionsStore } = await import('../suggestionsStore');
    useSuggestionsStore.setState({
      // @ts-expect-error Phase 17 Wave 0: fields added in Plan 02
      searchResults: [{ title: 'Carbonara' }],
      // @ts-expect-error Phase 17 Wave 0: fields added in Plan 02
      recentQueries: ['pasta', 'soup'],
      // @ts-expect-error Phase 17 Wave 0: fields added in Plan 02
      lastQuery: 'pasta',
      // @ts-expect-error Phase 17 Wave 0: fields added in Plan 02
      pantryOnly: true,
    });
    // Flush async persist write
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toBeDefined();
    expect(parsed.state.searchResults).toEqual([{ title: 'Carbonara' }]);
    expect(parsed.state.recentQueries).toEqual(['pasta', 'soup']);
    expect(parsed.state.lastQuery).toBe('pasta');
    expect(parsed.state.pantryOnly).toBe(true);
  });

  it('P17-02 Pitfall 1: excludes autoFetch from partialize', async () => {
    const { useSuggestionsStore } = await import('../suggestionsStore');
    useSuggestionsStore.setState({
      autoFetch: true,
      // @ts-expect-error Phase 17 Wave 0: field added in Plan 02
      lastQuery: 'pasta',
    });
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    // autoFetch is a session/flow flag — rehydrating it could cause
    // SuggestionList to re-mount post-cold-boot when the user is no longer in
    // a post-scan flow.
    expect(parsed.state.autoFetch).toBeUndefined();
  });

  it('P17-02 Pitfall 1: excludes isLoading and error from partialize', async () => {
    const { useSuggestionsStore } = await import('../suggestionsStore');
    useSuggestionsStore.setState({
      isLoading: true,
      error: 'transient network error',
    });
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.isLoading).toBeUndefined();
    expect(parsed.state.error).toBeUndefined();
  });

  it('P17-02: persists with version field === 1', async () => {
    const { useSuggestionsStore } = await import('../suggestionsStore');
    useSuggestionsStore.setState({
      // @ts-expect-error Phase 17 Wave 0: field added in Plan 02
      lastQuery: 'pasta',
    });
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
  });
});
