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

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: vi.fn(() => () => {}),
    fetch: vi.fn(async () => ({ isConnected: true, isInternetReachable: true })),
  },
}));

const STORAGE_KEY = 'dinnertime-recipes';

const seedRecipe = {
  id: 'r-1',
  profile_id: 'p-1',
  title: 'Persisted Recipe',
  description: null,
  ingredients: [],
  steps: [],
  prep_time_minutes: null,
  cook_time_minutes: null,
  total_time_minutes: null,
  servings: null,
  source_url: null,
  source_type: 'manual' as const,
  image_url: null,
  is_favorite: false,
  created_at: '2026-04-10T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
};

describe('recipeStore persist', () => {
  beforeEach(() => {
    asyncStorageMock.store.clear();
    vi.resetModules();
  });

  it('rehydrates recipes from AsyncStorage on cold start', async () => {
    asyncStorageMock.store.set(
      STORAGE_KEY,
      JSON.stringify({
        state: { recipes: [seedRecipe] },
        version: 1,
      })
    );

    const { useRecipeStore } = await import('../recipeStore');
    // Wait for async hydration to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(useRecipeStore.getState().recipes).toHaveLength(1);
    expect(useRecipeStore.getState().recipes[0]?.id).toBe('r-1');
  });

  it('partialize excludes loading/error/import flags from persisted state', async () => {
    const { useRecipeStore } = await import('../recipeStore');
    useRecipeStore.setState({
      recipes: [seedRecipe],
      isLoading: true,
      isImporting: true,
      error: 'something',
    });
    // Allow persist write to flush
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.state).toBeDefined();
    expect(parsed.state.isLoading).toBeUndefined();
    expect(parsed.state.error).toBeUndefined();
    expect(parsed.state.isImporting).toBeUndefined();
    expect(parsed.state.importedRecipe).toBeUndefined();
  });

  it('persists with version field', async () => {
    const { useRecipeStore } = await import('../recipeStore');
    useRecipeStore.setState({ recipes: [seedRecipe] });
    await new Promise((r) => setTimeout(r, 10));

    const raw = asyncStorageMock.store.get(STORAGE_KEY);
    expect(raw).toBeDefined();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
  });
});
