import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { DinnerSuggestion } from '../types/suggestions';
import type { ParsedRecipe } from '../types/recipe';
import { dedupPrepend } from './dedupPrepend';
import { withBudget, SUGGESTIONS_SEARCH_MS } from '../lib/perfBudgets';
import {
  prefetchHydration,
  previewFrom,
  cacheKeyFor,
} from '../hooks/useHydratedRecipeContent';

const MAX_RECENT = 5;

/** A preview still needs hydration if either ingredients OR steps are empty. */
function isUnhydrated(r: ParsedRecipe): boolean {
  return (
    !r.ingredients ||
    r.ingredients.length === 0 ||
    !r.steps ||
    r.steps.length === 0
  );
}

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
  /**
   * D7 persistence safety: re-trigger background hydration for any persisted
   * searchResults preview that came back from AsyncStorage with empty
   * ingredients/steps, so a relaunched preview never stays permanently empty.
   * Called from the persist `onRehydrateStorage` callback (next tick) and
   * safe to call manually.
   */
  rehydrateUnhydrated: () => Promise<void>;
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

/**
 * Phase 29-03 (D4): background-hydrate the supplied previews (throttled by the
 * hook's MAX_CONCURRENT=2 FIFO limiter) and patch each into searchResults as
 * its content lands.
 *
 * WR-01: match the patch target by the SAME composite content-address key the
 * hydration cache uses (`cacheKeyFor` = title + fingerprint(ingredient_names)),
 * NOT by bare title. Two on-screen previews that share a title but carry
 * different `ingredient_names` hydrate to DIFFERENT content; a title-only patch
 * would cross-assign card A's ingredients onto card B (user saves B, gets A).
 * Matching on the composite key keeps each preview's hydrated content bound to
 * its own row. Previews with no `ingredient_names` fall back to a title-only
 * key (same as the hook), which is stable for unique Something New titles.
 *
 * Returns the in-flight promise so callers (and tests) can await the whole
 * batch; fire-and-forget at the call sites.
 */
function hydrateAll(
  previews: ParsedRecipe[],
  set: (
    fn: (s: SuggestionsState) => Partial<SuggestionsState>,
  ) => void,
): Promise<void> {
  return Promise.all(
    previews.map(async (r) => {
      const targetKey = cacheKeyFor(previewFrom(r));
      const content = await prefetchHydration(previewFrom(r));
      if (!content) return; // failed/empty — leave the light preview as-is
      set((s) => ({
        searchResults: s.searchResults.map((x) =>
          cacheKeyFor(previewFrom(x)) === targetKey
            ? {
                ...x,
                ingredients: content.ingredients,
                steps: content.steps,
                calories_per_serving:
                  content.calories_per_serving ?? x.calories_per_serving,
                protein_grams_per_serving:
                  content.protein_grams_per_serving ??
                  x.protein_grams_per_serving,
                servings: content.servings ?? x.servings,
              }
            : x,
        ),
      }));
    }),
  ).then(() => undefined);
}

export const useSuggestionsStore = create<SuggestionsState>()(
  persist(
    (set, get) => ({
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
          // D8: measure the full light /search round-trip against the 3-5s
          // target band. light:true → server returns lightweight previews
          // (no full ingredients/steps); the background hydration below fills
          // them in.
          const response = await withBudget(
            'suggestions.search',
            SUGGESTIONS_SEARCH_MS,
            () =>
              fetch(`${getApiBaseUrl()}/api/v1/recipes/search`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  query,
                  pantryOnly: options.pantryOnly,
                  light: true,
                }),
              }),
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
          const previews = (data ?? []) as ParsedRecipe[];
          set((s) => ({
            searchResults: previews,
            recentQueries: dedupPrepend(query, s.recentQueries, MAX_RECENT),
            isLoading: false,
            error: null,
          }));
          // D4: background-hydrate every preview (throttled), patching
          // searchResults[i] with ingredients/steps as each lands. Fire-and-
          // forget — the grid renders from the light previews immediately.
          void hydrateAll(previews, set);
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Search failed',
            isLoading: false,
          });
        }
      },

      appendSearchResults: async (query, options) => {
        // Pantry-only searches legitimately run with an empty query (the
        // endpoint uses pantry contents as the seed). Only short-circuit
        // when there's NEITHER a query NOR a pantry-scope to ground the
        // request.
        const trimmed = (query ?? '').trim();
        if (trimmed.length === 0 && !options.pantryOnly) return;

        // NOTE: do NOT set isLoading here. The SomethingNewResults skeleton
        // branch is keyed on isLoading; flipping it would replace the current
        // grid with a skeleton which is the exact UX this action was built to
        // avoid. `isAppending` is a separate flag that only the load-more
        // button consumes.
        set({ isAppending: true, error: null });
        try {
          const token = await getAuthToken();
          // Load-more fetches a small batch (2) for speed, and excludes the
          // titles already on screen so the new cards are genuinely novel
          // rather than repeats of what the user is looking at.
          const excludeTitles = get().searchResults.map((r) => r.title);
          const response = await fetch(
            `${getApiBaseUrl()}/api/v1/recipes/search`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                query,
                pantryOnly: options.pantryOnly,
                count: 2,
                excludeTitles,
                light: true,
              }),
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
          const appendedRaw = (data ?? []) as ParsedRecipe[];
          // WR-01: the server `excludeTitles` is only a SOFT prompt constraint
          // the AI can violate, so a duplicate composite key (same title +
          // ingredient_names) can slip through. Hard-dedup against what's
          // already on screen by the same content-address key hydrateAll
          // patches on — two rows with the same key must never coexist, or the
          // background patch would write the same content onto both.
          const existingKeys = new Set(
            get().searchResults.map((r) => cacheKeyFor(previewFrom(r))),
          );
          const appended = appendedRaw.filter((r) => {
            const k = cacheKeyFor(previewFrom(r));
            if (existingKeys.has(k)) return false;
            existingKeys.add(k);
            return true;
          });
          set((s) => ({
            searchResults: [...s.searchResults, ...appended],
            isAppending: false,
            error: null,
          }));
          // D4: hydrate only the newly appended previews.
          void hydrateAll(appended, set);
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

      // D7 persistence safety: re-trigger hydration for any persisted preview
      // whose ingredients OR steps are empty, then patch it back into the grid
      // so a relaunched preview is never permanently empty (which would break
      // Save/Cook per D5).
      rehydrateUnhydrated: async () => {
        const stale = get().searchResults.filter(isUnhydrated);
        if (stale.length === 0) return;
        await hydrateAll(stale, set);
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
      // D7: after the persisted state is restored, kick off hydration for any
      // preview that came back empty (un-hydrated). Deferred to the next tick
      // so the store + the hydration hook module are fully initialized before
      // we call rehydrateUnhydrated (which reads get()).
      onRehydrateStorage: () => (state) => {
        if (!state?.searchResults?.length) return;
        const hasUnhydrated = state.searchResults.some(isUnhydrated);
        if (!hasUnhydrated) return;
        setTimeout(() => {
          void useSuggestionsStore.getState().rehydrateUnhydrated();
        }, 0);
      },
    }
  )
);
