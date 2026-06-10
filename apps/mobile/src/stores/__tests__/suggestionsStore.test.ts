import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase using vi.hoisted() for variable hoisting with vi.mock
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

// Phase 29-03: mock the hydration hook module so the store test controls
// background hydration deterministically (no real /hydrate fetch, no limiter
// timing). prefetchHydration resolves to whatever the test queues.
const mockPrefetchHydration = vi.hoisted(() => vi.fn());
const mockHydrationStatusFor = vi.hoisted(() => vi.fn(() => 'idle'));
vi.mock('../../hooks/useHydratedRecipeContent', () => ({
  prefetchHydration: mockPrefetchHydration,
  hydrationStatusFor: mockHydrationStatusFor,
  // Phase 29-04: previewFrom now lives in the hook module (single source of
  // truth shared with the save surfaces). The store maps each result through
  // it before prefetchHydration — a passthrough identity keeps the mocked
  // prefetch receiving the recipe, which is all this suite asserts on.
  previewFrom: (r: unknown) => r,
  MAX_CONCURRENT: 2,
}));

// Phase 29-03: spy on withBudget to assert the /search round-trip is measured,
// while still executing fn() so the store behavior is unchanged.
const mockWithBudget = vi.hoisted(() =>
  vi.fn((_name: string, _ms: number, fn: () => Promise<unknown>) => fn()),
);
vi.mock('../../lib/perfBudgets', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, withBudget: mockWithBudget };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mock setup
import { useSuggestionsStore } from '../suggestionsStore';
import type { DinnerSuggestion } from '../../types/suggestions';

const mockSuggestion: DinnerSuggestion = {
  title: 'Pasta Carbonara',
  description: 'Classic Italian pasta with eggs and cheese',
  ingredients_used: ['eggs', 'parmesan', 'pasta'],
  ingredients_needed: ['pancetta'],
  estimated_time_minutes: 30,
  difficulty: 'medium',
  kid_friendly: true,
  cuisine_type: 'Italian',
  why_suggested: 'Uses most of your available ingredients',
};

describe('suggestionsStore', () => {
  beforeEach(() => {
    useSuggestionsStore.setState({
      suggestions: [],
      isLoading: false,
      error: null,
      pantryItemCount: 0,
      generatedAt: null,
    });
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('fetchSuggestions', () => {
    it('sets loading then populates suggestions on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              suggestions: [mockSuggestion],
              pantry_item_count: 8,
              generated_at: '2026-04-10T12:00:00Z',
            },
          }),
      });

      await useSuggestionsStore.getState().fetchSuggestions();

      const state = useSuggestionsStore.getState();
      expect(state.suggestions).toHaveLength(1);
      expect(state.suggestions[0].title).toBe('Pasta Carbonara');
      expect(state.pantryItemCount).toBe(8);
      expect(state.generatedAt).toBe('2026-04-10T12:00:00Z');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();

      // Verify fetch was called with correct args
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/ai/suggest'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('sets error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      await useSuggestionsStore.getState().fetchSuggestions();

      const state = useSuggestionsStore.getState();
      expect(state.error).toBe('Internal server error');
      expect(state.suggestions).toHaveLength(0);
      expect(state.isLoading).toBe(false);
    });

    it('sets specific error on 400 (too few items)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            error: 'Not enough pantry items to generate suggestions',
          }),
      });

      await useSuggestionsStore.getState().fetchSuggestions();

      const state = useSuggestionsStore.getState();
      expect(state.error).toBe(
        'Not enough pantry items to generate suggestions'
      );
      expect(state.isLoading).toBe(false);
    });

    it('sets error on auth failure', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null as unknown as { access_token: string } },
        error: new Error('No session'),
      });

      await useSuggestionsStore.getState().fetchSuggestions();

      const state = useSuggestionsStore.getState();
      expect(state.error).toBe('Not authenticated');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('clearSuggestions', () => {
    it('resets suggestions to empty and clears error', () => {
      useSuggestionsStore.setState({
        suggestions: [mockSuggestion],
        error: 'some error',
        pantryItemCount: 5,
        generatedAt: '2026-04-10T12:00:00Z',
      });

      useSuggestionsStore.getState().clearSuggestions();

      const state = useSuggestionsStore.getState();
      expect(state.suggestions).toHaveLength(0);
      expect(state.error).toBeNull();
      expect(state.pantryItemCount).toBe(0);
      expect(state.generatedAt).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Phase 17 Wave 0 (plan 17-00) — red scaffolding for Plan 02.
  //
  // These cases bind to store fields and actions that don't exist yet:
  //   state.searchResults / recentQueries / lastQuery / pantryOnly
  //   actions.searchRecipes / clearHistory
  //
  // Legacy cases above (fetchSuggestions, clearSuggestions) MUST stay green —
  // CONTEXT D-10 locks byte-exact preservation of the autoFetch path.
  //
  // @see 17-CONTEXT.md D-02, D-05, D-06
  // -------------------------------------------------------------------------
  describe('Phase 17: searchRecipes + clearHistory (P17-03, P17-06)', () => {
    it('P17-03: searchRecipes POSTs to /api/v1/recipes/search with {query, pantryOnly}', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await useSuggestionsStore.getState().searchRecipes('pasta', { pantryOnly: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recipes/search'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"query":"pasta"'),
        }),
      );
      // Check pantryOnly also threaded through body
      const callArg = mockFetch.mock.calls[0]?.[1] as { body: string };
      expect(JSON.parse(callArg.body)).toMatchObject({
        query: 'pasta',
        pantryOnly: true,
      });
    });

    it('P17-03: searchRecipes populates searchResults and prepends recentQueries on success', async () => {
      const mockRecipe = {
        title: 'Pesto Pasta',
        description: 'Quick weeknight.',
        ingredients: [],
        steps: [],
        prep_time_minutes: null,
        cook_time_minutes: null,
        total_time_minutes: 20,
        servings: 2,
        source_url: null,
        source_type: 'ai',
        image_url: null,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [mockRecipe] }),
      });

      await useSuggestionsStore.getState().searchRecipes('pesto', { pantryOnly: false });

      const state = useSuggestionsStore.getState();
      expect(state.searchResults).toHaveLength(1);
      expect(state.searchResults[0].title).toBe('Pesto Pasta');
      expect(state.recentQueries).toContain('pesto');
      expect(state.lastQuery).toBe('pesto');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('P17-03: searchRecipes sets error + isLoading=false on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'AI request failed' }),
      });

      await useSuggestionsStore.getState().searchRecipes('foo', { pantryOnly: false });

      const state = useSuggestionsStore.getState();
      expect(state.error).toBe('AI request failed');
      expect(state.isLoading).toBe(false);
    });

    it('P17-03: searchRecipes sets error on network throw', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      await useSuggestionsStore.getState().searchRecipes('foo', { pantryOnly: false });

      const state = useSuggestionsStore.getState();
      expect(state.error).toBe('Network down');
      expect(state.isLoading).toBe(false);
    });

    it('P17-06: clearHistory resets recentQueries, searchResults, and lastQuery', () => {
      useSuggestionsStore.setState({
        searchResults: [
          {
            title: 'X',
            description: null,
            ingredients: [],
            steps: [],
            prep_time_minutes: null,
            cook_time_minutes: null,
            total_time_minutes: null,
            servings: null,
            source_url: null,
            source_type: 'ai',
            image_url: null,
          },
        ],
        recentQueries: ['a', 'b'],
        lastQuery: 'a',
      });

      useSuggestionsStore.getState().clearHistory();

      const state = useSuggestionsStore.getState();
      expect(state.searchResults).toEqual([]);
      expect(state.recentQueries).toEqual([]);
      expect(state.lastQuery).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Phase 29-03 (D4 + D7 + D8-client): lightweight-first + background hydration.
  //
  //   - searchRecipes/appendSearchResults send `light: true`
  //   - /search round-trip wrapped in withBudget('suggestions.search', ...)
  //   - each light preview is background-hydrated; searchResults[i] patched
  //     with ingredients/steps as each lands
  //   - D7: persisted un-hydrated previews re-trigger hydration on rehydrate
  // -------------------------------------------------------------------------
  describe('Phase 29-03: light mode + background hydration', () => {
    const lightPreview = {
      title: 'Light Soup',
      description: 'fast',
      ingredients: [], // empty in light mode (names live in ingredient_names)
      steps: [], // empty in light mode — hydration fills these
      prep_time_minutes: 5,
      cook_time_minutes: 10,
      total_time_minutes: 15,
      servings: 2,
      source_url: null,
      source_type: 'ai',
      image_url: null,
      ingredient_names: ['onion', 'broth'],
    };

    beforeEach(() => {
      mockPrefetchHydration.mockReset();
      mockHydrationStatusFor.mockReset();
      mockWithBudget.mockClear();
      // Default: hydration never resolves (tests that care queue their own).
      mockPrefetchHydration.mockResolvedValue(null);
    });

    it('searchRecipes sends light:true in the body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await useSuggestionsStore
        .getState()
        .searchRecipes('soup', { pantryOnly: false });

      const callArg = mockFetch.mock.calls[0]?.[1] as { body: string };
      expect(JSON.parse(callArg.body)).toMatchObject({ light: true });
    });

    it('appendSearchResults sends light:true in the body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await useSuggestionsStore
        .getState()
        .appendSearchResults('soup', { pantryOnly: true });

      const callArg = mockFetch.mock.calls[0]?.[1] as { body: string };
      expect(JSON.parse(callArg.body)).toMatchObject({ light: true });
    });

    it('wraps the /search round-trip in withBudget(suggestions.search)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await useSuggestionsStore
        .getState()
        .searchRecipes('soup', { pantryOnly: false });

      expect(mockWithBudget).toHaveBeenCalledWith(
        'suggestions.search',
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('background-hydrates each preview and patches searchResults[i] with ingredients/steps', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [lightPreview] }),
      });
      // Hydration resolves with full content.
      mockPrefetchHydration.mockResolvedValueOnce({
        ingredients: [
          { name: 'onion', quantity: 1, unit: null, notes: null },
          { name: 'broth', quantity: 2, unit: 'cup', notes: null },
        ],
        steps: ['Chop onion', 'Simmer in broth'],
        calories_per_serving: 200,
        protein_grams_per_serving: 8,
        servings: 2,
      });

      await useSuggestionsStore
        .getState()
        .searchRecipes('soup', { pantryOnly: false });

      // Let the background hydration patch settle.
      await new Promise((r) => setTimeout(r, 0));

      const state = useSuggestionsStore.getState();
      expect(state.searchResults).toHaveLength(1);
      expect(state.searchResults[0].steps).toEqual([
        'Chop onion',
        'Simmer in broth',
      ]);
      expect(state.searchResults[0].ingredients).toHaveLength(2);
      expect(mockPrefetchHydration).toHaveBeenCalled();
    });

    it('D7: rehydrateUnhydrated re-triggers hydration for persisted empty-steps previews', async () => {
      // Simulate a persisted preview with empty steps (un-hydrated).
      useSuggestionsStore.setState({
        searchResults: [lightPreview] as unknown as never,
      });
      mockPrefetchHydration.mockResolvedValueOnce({
        ingredients: [{ name: 'onion', quantity: 1, unit: null, notes: null }],
        steps: ['Cook it'],
      });

      await useSuggestionsStore.getState().rehydrateUnhydrated();
      await new Promise((r) => setTimeout(r, 0));

      expect(mockPrefetchHydration).toHaveBeenCalled();
      const state = useSuggestionsStore.getState();
      expect(state.searchResults[0].steps).toEqual(['Cook it']);
    });
  });
});
