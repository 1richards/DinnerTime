import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ParsedRecipe, Recipe } from '../types/recipe';

interface RecipeState {
  recipes: Recipe[];
  isLoading: boolean;
  isImporting: boolean;
  error: string | null;
  importedRecipe: ParsedRecipe | null;
  isDuplicate: boolean;
  existingRecipe: Recipe | null;

  importFromUrl: (url: string) => Promise<void>;
  importFromPhoto: (image: string) => Promise<void>;
  importFromText: (text: string) => Promise<void>;
  saveRecipe: (recipe: ParsedRecipe) => Promise<void>;
  fetchRecipes: () => Promise<void>;
  clearImport: () => void;
}

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

const getAuthToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
};

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  isLoading: false,
  isImporting: false,
  error: null,
  importedRecipe: null,
  isDuplicate: false,
  existingRecipe: null,

  importFromUrl: async (url: string) => {
    set({
      isImporting: true,
      error: null,
      importedRecipe: null,
      isDuplicate: false,
      existingRecipe: null,
    });
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/recipes/import/url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          error: err.error ?? 'Failed to import recipe',
          isImporting: false,
        });
        return;
      }

      const body = await response.json();
      set({
        importedRecipe: body.data,
        isDuplicate: body.duplicate === true,
        existingRecipe: body.existing ?? null,
        isImporting: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to import recipe',
        isImporting: false,
      });
    }
  },

  importFromPhoto: async (image: string) => {
    set({ isImporting: true, error: null, importedRecipe: null });
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/recipes/import/photo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ image }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          error: err.error ?? 'Failed to import recipe from photo',
          isImporting: false,
        });
        return;
      }

      const body = await response.json();
      set({
        importedRecipe: body.data,
        isImporting: false,
        error: null,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to import recipe from photo',
        isImporting: false,
      });
    }
  },

  importFromText: async (text: string) => {
    set({ isImporting: true, error: null, importedRecipe: null });
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/recipes/import/text`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          error: err.error ?? 'Failed to import recipe from text',
          isImporting: false,
        });
        return;
      }

      const body = await response.json();
      set({
        importedRecipe: body.data,
        isImporting: false,
        error: null,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to import recipe from text',
        isImporting: false,
      });
    }
  },

  saveRecipe: async (recipe: ParsedRecipe) => {
    set({ isLoading: true, error: null });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/recipes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(recipe),
      });

      if (!response.ok) {
        const err = await response.json();
        set({
          error: err.error ?? 'Failed to save recipe',
          isLoading: false,
        });
        return;
      }

      const body = await response.json();
      const saved: Recipe = body.data;
      set((state) => ({
        recipes: [saved, ...state.recipes],
        importedRecipe: null,
        isDuplicate: false,
        existingRecipe: null,
        isLoading: false,
        error: null,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to save recipe',
        isLoading: false,
      });
    }
  },

  fetchRecipes: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/recipes`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        set({
          error: err.error ?? 'Failed to fetch recipes',
          isLoading: false,
        });
        return;
      }

      const body = await response.json();
      set({
        recipes: body.data ?? [],
        isLoading: false,
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch recipes',
        isLoading: false,
      });
    }
  },

  clearImport: () => {
    set({
      importedRecipe: null,
      error: null,
      isDuplicate: false,
      existingRecipe: null,
    });
  },
}));
