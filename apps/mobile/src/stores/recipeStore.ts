import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { ParsedRecipe, Recipe } from '../types/recipe';

interface FetchRecipesOptions {
  q?: string;
  favoritesOnly?: boolean;
}

interface RecipeState {
  recipes: Recipe[];
  isLoading: boolean;
  isImporting: boolean;
  error: string | null;
  importedRecipe: ParsedRecipe | null;
  isDuplicate: boolean;
  existingRecipe: Recipe | null;
  searchQuery: string;
  showFavoritesOnly: boolean;

  importFromUrl: (url: string) => Promise<void>;
  importFromPhoto: (image: string) => Promise<void>;
  importFromText: (text: string) => Promise<void>;
  saveRecipe: (recipe: ParsedRecipe) => Promise<Recipe | null>;
  fetchRecipes: (opts?: FetchRecipesOptions) => Promise<void>;
  updateRecipe: (id: string, patch: Partial<Recipe>) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setShowFavoritesOnly: (v: boolean) => void;
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

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
  recipes: [],
  isLoading: false,
  isImporting: false,
  error: null,
  importedRecipe: null,
  isDuplicate: false,
  existingRecipe: null,
  searchQuery: '',
  showFavoritesOnly: false,

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

  saveRecipe: async (recipe: ParsedRecipe): Promise<Recipe | null> => {
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
        return null;
      }

      const body = await response.json();
      const saved: Recipe = body.data;
      const isDuplicate = body.duplicate === true;
      set((state) => {
        // Server-side dedup may return an existing row; don't unshift
        // another copy if we already have it locally.
        const alreadyHave = state.recipes.some((r) => r.id === saved.id);
        return {
          recipes: alreadyHave ? state.recipes : [saved, ...state.recipes],
          importedRecipe: null,
          isDuplicate,
          existingRecipe: isDuplicate ? saved : null,
          isLoading: false,
          error: null,
        };
      });
      return saved;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to save recipe',
        isLoading: false,
      });
      return null;
    }
  },

  fetchRecipes: async (opts?: FetchRecipesOptions) => {
    set({ isLoading: true, error: null });
    try {
      const token = await getAuthToken();
      const params = new URLSearchParams();
      if (opts?.q) params.append('q', opts.q);
      if (opts?.favoritesOnly) params.append('favorites', 'true');
      const qs = params.toString();
      const url = `${getApiBaseUrl()}/api/v1/recipes${qs ? `?${qs}` : ''}`;

      const response = await fetch(url, {
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

  updateRecipe: async (id: string, patch: Partial<Recipe>) => {
    const snapshot = get().recipes;
    set({
      recipes: snapshot.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      error: null,
    });
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/recipes/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(patch),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          recipes: snapshot,
          error: err.error ?? 'Failed to update recipe',
        });
        return;
      }

      const body = await response.json();
      const updated: Recipe = body.data;
      set((state) => ({
        recipes: state.recipes.map((r) => (r.id === id ? updated : r)),
        error: null,
      }));
    } catch (err) {
      set({
        recipes: snapshot,
        error: err instanceof Error ? err.message : 'Failed to update recipe',
      });
    }
  },

  deleteRecipe: async (id: string) => {
    const snapshot = get().recipes;
    set({
      recipes: snapshot.filter((r) => r.id !== id),
      error: null,
    });
    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/recipes/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          recipes: snapshot,
          error: err.error ?? 'Failed to delete recipe',
        });
        return;
      }
    } catch (err) {
      set({
        recipes: snapshot,
        error: err instanceof Error ? err.message : 'Failed to delete recipe',
      });
    }
  },

  toggleFavorite: async (id: string) => {
    const snapshot = get().recipes;
    const current = snapshot.find((r) => r.id === id);
    if (!current) return;
    const nextValue = !current.is_favorite;

    set({
      recipes: snapshot.map((r) =>
        r.id === id ? { ...r, is_favorite: nextValue } : r
      ),
      error: null,
    });

    try {
      const token = await getAuthToken();
      const response = await fetch(
        `${getApiBaseUrl()}/api/v1/recipes/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ is_favorite: nextValue }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          recipes: snapshot,
          error: err.error ?? 'Failed to toggle favorite',
        });
        return;
      }

      const body = await response.json();
      const updated: Recipe = body.data;
      set((state) => ({
        recipes: state.recipes.map((r) => (r.id === id ? updated : r)),
        error: null,
      }));
    } catch (err) {
      set({
        recipes: snapshot,
        error:
          err instanceof Error ? err.message : 'Failed to toggle favorite',
      });
    }
  },

  setSearchQuery: (q: string) => set({ searchQuery: q }),
  setShowFavoritesOnly: (v: boolean) => set({ showFavoritesOnly: v }),

  clearImport: () => {
    set({
      importedRecipe: null,
      error: null,
      isDuplicate: false,
      existingRecipe: null,
    });
  },
    }),
    {
      name: 'dinnertime-recipes',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ recipes: state.recipes }),
      version: 1,
    }
  )
);
