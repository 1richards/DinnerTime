import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token' } },
        error: null as Error | null,
      })
    ),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useProgressionStore } from '../progressionStore';
import type {
  RecipeCookStats,
  AmbitionSuggestion,
} from '../../types/progression';

const resetState = () => {
  useProgressionStore.setState({
    cookStats: [],
    ambitionSuggestions: [],
    loading: false,
    error: null,
  });
};

const makeStats = (): RecipeCookStats[] => [
  {
    recipe_id: 'r1',
    title: 'Pasta',
    cook_count: 4,
    last_cooked_at: '2026-04-09T00:00:00Z',
  },
];

const makeSuggestions = (): AmbitionSuggestion[] => [
  { recipe_id: 'a1', title: 'Risotto', rationale: 'next step up' },
  { recipe_id: 'a2', title: 'Coq au vin', rationale: 'classic to try' },
  { recipe_id: 'a3', title: 'Souffle', rationale: 'stretch goal' },
];

describe('progressionStore', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null as Error | null,
    });
  });

  it('fetchCookStats stores result on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: makeStats() }),
    });

    await useProgressionStore.getState().fetchCookStats();

    expect(useProgressionStore.getState().cookStats).toHaveLength(1);
    expect(useProgressionStore.getState().cookStats[0].recipe_id).toBe('r1');
  });

  it('fetchSuggestions stores three entries', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: makeSuggestions() }),
    });

    await useProgressionStore.getState().fetchSuggestions();

    expect(useProgressionStore.getState().ambitionSuggestions).toHaveLength(3);
  });

  it('fetchVariations returns null on 400 BELOW_THRESHOLD', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'BELOW_THRESHOLD', code: 'BELOW_THRESHOLD' }),
    });

    const result = await useProgressionStore
      .getState()
      .fetchVariations('r1');

    expect(result).toBeNull();
  });

  it('fetchVariations returns string[] on 200', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      // Server response shape: { data: variations[], mode }. The store
      // unwraps `body.data` and asserts Array.isArray, so the test
      // payload mirrors the real route in packages/server/src/routes/
      // progression.ts (`return c.json({ data: variations, mode })`).
      json: async () => ({
        data: ['Add saffron', 'Try with shrimp'],
        mode: 'surprise',
      }),
    });

    const result = await useProgressionStore
      .getState()
      .fetchVariations('r1');

    expect(result).toEqual(['Add saffron', 'Try with shrimp']);
  });

  it('fetchTip returns string on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { tip: 'Use a wooden spoon' } }),
    });

    const result = await useProgressionStore
      .getState()
      .fetchTip('r1', 0, 'Stir the pot');

    expect(result).toBe('Use a wooden spoon');
  });

  it('fetchTip returns empty string when offline / error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const result = await useProgressionStore
      .getState()
      .fetchTip('r1', 0, 'Stir the pot');

    expect(result).toBe('');
  });
});
