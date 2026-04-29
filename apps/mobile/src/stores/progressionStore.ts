import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useNetworkStore } from './networkStore';
import type {
  RecipeCookStats,
  AmbitionSuggestion,
} from '../types/progression';

export type RemixMode =
  | 'surprise'
  | 'protein'
  | 'add_protein'
  | 'veggies'
  | 'vegetarian'
  | 'quicker'
  | 'harder'
  | 'healthier'
  | 'decadent';

export interface RemixVariation {
  title: string;
  description: string;
}

/**
 * Generic recipe-ish context. Works for saved recipes and for in-memory
 * suggestions that haven't been persisted yet.
 */
export interface VariationContext {
  title: string;
  description?: string | null;
  ingredients?: Array<string | { name: string }>;
  total_time_minutes?: number | null;
}

interface ProgressionState {
  cookStats: RecipeCookStats[];
  ambitionSuggestions: AmbitionSuggestion[];
  loading: boolean;
  error: string | null;

  fetchCookStats: () => Promise<void>;
  fetchSuggestions: () => Promise<void>;
  /** Fetch variations for a saved recipe by id. */
  fetchVariations: (
    recipeId: string,
    mode?: RemixMode,
    customInstructions?: string,
  ) => Promise<RemixVariation[] | null>;
  /** Fetch variations for an unsaved context (Home suggestion, Discover). */
  fetchVariationsForContext: (
    context: VariationContext,
    mode?: RemixMode,
    customInstructions?: string,
  ) => Promise<RemixVariation[] | null>;
  fetchTip: (
    recipeId: string,
    stepIndex: number,
    stepText: string
  ) => Promise<string>;
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

const authedFetch = async (
  path: string,
  init: RequestInit = {}
): Promise<Response> => {
  const token = await getAuthToken();
  return fetch(`${getApiBaseUrl()}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
};

export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set, _get) => ({
      cookStats: [],
      ambitionSuggestions: [],
      loading: false,
      error: null,

      fetchCookStats: async () => {
        // Graceful offline degradation — keep persisted state.
        if (!useNetworkStore.getState().isOnline) return;
        set({ loading: true, error: null });
        try {
          const response = await authedFetch('/progression/cook-stats', {
            method: 'GET',
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            set({
              error: err.error ?? 'Failed to fetch cook stats',
              loading: false,
            });
            return;
          }
          const body = await response.json();
          set({
            cookStats: Array.isArray(body.data) ? body.data : [],
            loading: false,
            error: null,
          });
        } catch (err) {
          console.warn('[progressionStore] fetchCookStats failed', err);
          set({
            error:
              err instanceof Error
                ? err.message
                : 'Failed to fetch cook stats',
            loading: false,
          });
        }
      },

      fetchSuggestions: async () => {
        if (!useNetworkStore.getState().isOnline) return;
        set({ loading: true, error: null });
        try {
          const response = await authedFetch('/progression/suggestions', {
            method: 'GET',
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            set({
              error: err.error ?? 'Failed to fetch suggestions',
              loading: false,
            });
            return;
          }
          const body = await response.json();
          const suggestions: AmbitionSuggestion[] = Array.isArray(body.data)
            ? body.data.slice(0, 3)
            : [];
          set({
            ambitionSuggestions: suggestions,
            loading: false,
            error: null,
          });
        } catch (err) {
          console.warn('[progressionStore] fetchSuggestions failed', err);
          set({
            error:
              err instanceof Error
                ? err.message
                : 'Failed to fetch suggestions',
            loading: false,
          });
        }
      },

      fetchVariations: async (
        recipeId: string,
        mode: RemixMode = 'surprise',
        customInstructions?: string,
      ) => {
        if (!useNetworkStore.getState().isOnline) return null;
        try {
          const params = new URLSearchParams({ mode });
          if (customInstructions && customInstructions.trim().length > 0) {
            params.set('custom', customInstructions.trim());
          }
          const response = await authedFetch(
            `/progression/variations/${recipeId}?${params.toString()}`,
            { method: 'GET' }
          );
          if (!response.ok) return null;
          const body = await response.json();
          const raw = body?.data;
          if (Array.isArray(raw)) return raw as RemixVariation[];
          return null;
        } catch (err) {
          console.warn('[progressionStore] fetchVariations failed', err);
          return null;
        }
      },

      fetchVariationsForContext: async (
        context: VariationContext,
        mode: RemixMode = 'surprise',
        customInstructions?: string,
      ) => {
        if (!useNetworkStore.getState().isOnline) return null;
        try {
          const trimmed = customInstructions?.trim();
          const response = await authedFetch(`/progression/variations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...context,
              mode,
              ...(trimmed && trimmed.length > 0
                ? { custom_instructions: trimmed }
                : {}),
            }),
          });
          if (!response.ok) return null;
          const body = await response.json();
          const raw = body?.data;
          if (Array.isArray(raw)) return raw as RemixVariation[];
          return null;
        } catch (err) {
          console.warn('[progressionStore] fetchVariationsForContext failed', err);
          return null;
        }
      },

      fetchTip: async (
        recipeId: string,
        stepIndex: number,
        stepText: string
      ) => {
        if (!useNetworkStore.getState().isOnline) return '';
        try {
          const params = new URLSearchParams({
            recipe_id: recipeId,
            step_index: String(stepIndex),
            step_text: stepText,
          });
          const response = await authedFetch(
            `/cooking/tips?${params.toString()}`,
            { method: 'GET' }
          );
          if (!response.ok) return '';
          const body = await response.json();
          const tip = body?.data?.tip;
          return typeof tip === 'string' ? tip : '';
        } catch (err) {
          console.warn('[progressionStore] fetchTip failed', err);
          return '';
        }
      },
    }),
    {
      name: 'dinnertime-progression',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cookStats: state.cookStats,
        ambitionSuggestions: state.ambitionSuggestions,
      }),
      version: 1,
    }
  )
);
