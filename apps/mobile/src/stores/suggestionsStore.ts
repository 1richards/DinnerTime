import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { DinnerSuggestion } from '../types/suggestions';
import type { ParsedRecipe } from '../types/recipe';
import { dedupPrepend } from './dedupPrepend';

const MAX_RECENT = 5;

export interface SearchOptions {
  pantryOnly: boolean;
}

interface SuggestionsState {
  // Legacy (D-10 lock — byte-exact preservation of the autoFetch / fetchSuggestions path)
  suggestions: DinnerSuggestion[];
  isLoading: boolean;
  error: string | null;
  pantryItemCount: number;
  generatedAt: string | null;
  autoFetch: boolean;
  fetchSuggestions: () => Promise<void>;
  clearSuggestions: () => void;
  setAutoFetch: (value: boolean) => void;

  // Phase 17 additions (P17-02, P17-03, P17-06)
  searchResults: ParsedRecipe[];
  recentQueries: string[];
  lastQuery: string | null;
  pantryOnly: boolean;
  isAppending: boolean;
  searchRecipes: (query: string, options: SearchOptions) => Promise<void>;
  appendSearchResults: (query: string, options: SearchOptions) => Promise<void>;
  clearHistory: () => void;
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

export const useSuggestionsStore = create<SuggestionsState>()(
  persist(
    (set) => ({
      // Legacy initial state
      suggestions: [],
      isLoading: false,
      error: null,
      pantryItemCount: 0,
      generatedAt: null,
      autoFetch: false,

      // Phase 17 initial state
      searchResults: [],
      recentQueries: [],
      lastQuery: null,
      pantryOnly: false,
      isAppending: false,

      // Legacy actions — D-10 byte-exact lock. DO NOT REFACTOR.
      fetchSuggestions: async () => {
        set({ isLoading: true, error: null });
        try {
          const token = await getAuthToken();
          const response = await fetch(`${getApiBaseUrl()}/api/v1/ai/suggest`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            const err = await response.json();
            set({
              error: err.error ?? 'Failed to get suggestions',
              isLoading: false,
            });
            return;
          }

          const data = await response.json();
          const result = data.data;

          set({
            suggestions: result.suggestions,
            pantryItemCount: result.pantry_item_count,
            generatedAt: result.generated_at,
            isLoading: false,
            error: null,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to get suggestions',
            isLoading: false,
          });
        }
      },

      clearSuggestions: () => {
        set({
          suggestions: [],
          error: null,
          pantryItemCount: 0,
          generatedAt: null,
        });
      },

      setAutoFetch: (value: boolean) => {
        set({ autoFetch: value });
      },

      // Phase 17 actions
      searchRecipes: async (query, options) => {
        set({
          isLoading: true,
          error: null,
          lastQuery: query,
          pantryOnly: options.pantryOnly,
        });
        try {
          const token = await getAuthToken();
          const response = await fetch(
            `${getApiBaseUrl()}/api/v1/recipes/search`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ query, pantryOnly: options.pantryOnly }),
            }
          );

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            set({
              error: err.error ?? 'Search failed',
              isLoading: false,
            });
            return;
          }

          const { data } = await response.json();
          set((s) => ({
            searchResults: (data ?? []) as ParsedRecipe[],
            recentQueries: dedupPrepend(query, s.recentQueries, MAX_RECENT),
            isLoading: false,
            error: null,
          }));
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Search failed',
            isLoading: false,
          });
        }
      },

      appendSearchResults: async (query, options) => {
        // Guard: no base query to append against. /api/v1/recipes/search needs
        // a non-empty query string — without it the endpoint returns nothing
        // useful, so we short-circuit.
        if (!query || query.trim().length === 0) return;

        // NOTE: do NOT set isLoading here. The SomethingNewResults skeleton
        // branch is keyed on isLoading; flipping it would replace the current
        // grid with a skeleton which is the exact UX this action was built to
        // avoid. `isAppending` is a separate flag that only the load-more
        // button consumes.
        set({ isAppending: true, error: null });
        try {
          const token = await getAuthToken();
          const response = await fetch(
            `${getApiBaseUrl()}/api/v1/recipes/search`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ query, pantryOnly: options.pantryOnly }),
            }
          );

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            // Surface the error but KEEP existing searchResults — user's
            // current grid is preserved so they can try again.
            set({
              error: err.error ?? 'Failed to load more ideas',
              isAppending: false,
            });
            return;
          }

          const { data } = await response.json();
          set((s) => ({
            searchResults: [
              ...s.searchResults,
              ...((data ?? []) as ParsedRecipe[]),
            ],
            isAppending: false,
            error: null,
          }));
        } catch (err) {
          set({
            error:
              err instanceof Error ? err.message : 'Failed to load more ideas',
            isAppending: false,
          });
        }
      },

      clearHistory: () => {
        set({
          recentQueries: [],
          searchResults: [],
          lastQuery: null,
          isAppending: false,
        });
      },
    }),
    {
      name: 'dinnertime-suggestions',
      storage: createJSONStorage(() => AsyncStorage),
      // Pitfall 1: autoFetch is a cross-screen signal flag (scan-review → Kitchen).
      // Persisting it would re-fire SuggestionList on cold launch even when the
      // user is no longer in a post-scan flow. Partialize explicitly excludes it.
      // Also excludes isLoading + error (transient runtime state).
      partialize: (state) => ({
        searchResults: state.searchResults,
        recentQueries: state.recentQueries,
        lastQuery: state.lastQuery,
        pantryOnly: state.pantryOnly,
      }),
      version: 1,
    }
  )
);
