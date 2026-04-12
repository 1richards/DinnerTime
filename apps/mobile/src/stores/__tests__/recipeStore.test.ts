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

import { useRecipeStore } from '../recipeStore';
import type { ParsedRecipe, Recipe } from '../../types/recipe';

const mockParsedRecipe: ParsedRecipe = {
  title: 'Spaghetti Bolognese',
  description: 'Classic Italian pasta dish',
  ingredients: [
    { name: 'spaghetti', quantity: 1, unit: 'lb', notes: null },
    { name: 'ground beef', quantity: 1, unit: 'lb', notes: null },
  ],
  steps: ['Boil pasta', 'Cook beef', 'Combine'],
  prep_time_minutes: 10,
  cook_time_minutes: 30,
  total_time_minutes: 40,
  servings: 4,
  source_url: 'https://example.com/recipe',
  source_type: 'url',
  image_url: null,
};

const mockRecipe: Recipe = {
  id: 'rec-1',
  profile_id: 'prof-1',
  ...mockParsedRecipe,
  created_at: '2026-04-10T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
};

describe('recipeStore', () => {
  beforeEach(() => {
    useRecipeStore.setState({
      recipes: [],
      isLoading: false,
      isImporting: false,
      error: null,
      importedRecipe: null,
      isDuplicate: false,
      existingRecipe: null,
    });
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null,
    });
  });

  describe('importFromUrl', () => {
    it('sets isImporting and stores importedRecipe on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockParsedRecipe }),
      });

      await useRecipeStore
        .getState()
        .importFromUrl('https://example.com/recipe');

      const state = useRecipeStore.getState();
      expect(state.importedRecipe?.title).toBe('Spaghetti Bolognese');
      expect(state.isImporting).toBe(false);
      expect(state.error).toBeNull();
      expect(state.isDuplicate).toBe(false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recipes/import/url'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
          body: JSON.stringify({ url: 'https://example.com/recipe' }),
        })
      );
    });

    it('sets isDuplicate and existingRecipe when duplicate flag returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: mockParsedRecipe,
            duplicate: true,
            existing: mockRecipe,
          }),
      });

      await useRecipeStore
        .getState()
        .importFromUrl('https://example.com/recipe');

      const state = useRecipeStore.getState();
      expect(state.isDuplicate).toBe(true);
      expect(state.existingRecipe?.id).toBe('rec-1');
    });

    it('sets error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Failed to parse URL' }),
      });

      await useRecipeStore.getState().importFromUrl('https://bad.example.com');

      const state = useRecipeStore.getState();
      expect(state.error).toBe('Failed to parse URL');
      expect(state.importedRecipe).toBeNull();
      expect(state.isImporting).toBe(false);
    });

    it('sets error on auth failure', async () => {
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null as unknown as { access_token: string } },
        error: new Error('No session'),
      });

      await useRecipeStore.getState().importFromUrl('https://example.com');

      const state = useRecipeStore.getState();
      expect(state.error).toBe('Not authenticated');
      expect(state.isImporting).toBe(false);
    });
  });

  describe('importFromPhoto', () => {
    it('POSTs base64 image and stores importedRecipe', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockParsedRecipe }),
      });

      await useRecipeStore.getState().importFromPhoto('base64imagedata');

      const state = useRecipeStore.getState();
      expect(state.importedRecipe?.title).toBe('Spaghetti Bolognese');
      expect(state.isImporting).toBe(false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recipes/import/photo'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ image: 'base64imagedata' }),
        })
      );
    });
  });

  describe('importFromText', () => {
    it('POSTs text and stores importedRecipe', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockParsedRecipe }),
      });

      await useRecipeStore.getState().importFromText('Recipe text here');

      const state = useRecipeStore.getState();
      expect(state.importedRecipe?.title).toBe('Spaghetti Bolognese');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recipes/import/text'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Recipe text here' }),
        })
      );
    });
  });

  describe('saveRecipe', () => {
    it('POSTs recipe, prepends to recipes list, clears importedRecipe', async () => {
      useRecipeStore.setState({ importedRecipe: mockParsedRecipe });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockRecipe }),
      });

      await useRecipeStore.getState().saveRecipe(mockParsedRecipe);

      const state = useRecipeStore.getState();
      expect(state.recipes).toHaveLength(1);
      expect(state.recipes[0].id).toBe('rec-1');
      expect(state.importedRecipe).toBeNull();
      expect(state.error).toBeNull();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recipes'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockParsedRecipe),
        })
      );
    });

    it('sets error when save fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Save failed' }),
      });

      await useRecipeStore.getState().saveRecipe(mockParsedRecipe);

      const state = useRecipeStore.getState();
      expect(state.error).toBe('Save failed');
      expect(state.recipes).toHaveLength(0);
    });
  });

  describe('fetchRecipes', () => {
    it('GETs /recipes and populates recipes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [mockRecipe] }),
      });

      await useRecipeStore.getState().fetchRecipes();

      const state = useRecipeStore.getState();
      expect(state.recipes).toHaveLength(1);
      expect(state.recipes[0].title).toBe('Spaghetti Bolognese');
      expect(state.isLoading).toBe(false);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/recipes'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('sets error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Fetch failed' }),
      });

      await useRecipeStore.getState().fetchRecipes();

      const state = useRecipeStore.getState();
      expect(state.error).toBe('Fetch failed');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('clearImport', () => {
    it('resets importedRecipe, error, duplicate state', () => {
      useRecipeStore.setState({
        importedRecipe: mockParsedRecipe,
        error: 'some error',
        isDuplicate: true,
        existingRecipe: mockRecipe,
      });

      useRecipeStore.getState().clearImport();

      const state = useRecipeStore.getState();
      expect(state.importedRecipe).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isDuplicate).toBe(false);
      expect(state.existingRecipe).toBeNull();
    });
  });
});
