import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useNetworkStore } from './networkStore';
import type {
  RecipeCookStats,
  AmbitionSuggestion,
} from '../types/progression';

export type RemixMode = 'surprise' | 'protein' | 'veggies' | 'quicker';

interface ProgressionState {
  cookStats: RecipeCookStats[];
  ambitionSuggestions: AmbitionSuggestion[];
  loading: boolean;
  error: string | null;

  fetchCookStats: () => Promise<void>;
  fetchSuggestions: () => Promise<void>;
  fetchVariations: (
    recipeId: string,
    mode?: RemixMode,
  ) => Promise<string[] | null>;
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

      fetchVariations: async (recipeId: string, mode: RemixMode = 'surprise') => {
        if (!useNetworkStore.getState().isOnline) return null;
        try {
          const response = await authedFetch(
            `/progression/variations/${recipeId}?mode=${mode}`,
            { method: 'GET' }
          );
          if (!response.ok) {
            return null;
          }
          const body = await response.json();
          // Server returns { data: string[], mode }. Older builds wrapped
          // this in { data: { variations: [...] } } — tolerate both shapes.
          const raw = body?.data;
          if (Array.isArray(raw)) return raw as string[];
          if (raw && Array.isArray(raw.variations)) return raw.variations as string[];
          return null;
        } catch (err) {
          console.warn('[progressionStore] fetchVariations failed', err);
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
