import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DinnerSuggestion } from '../types/suggestions';

interface SuggestionsState {
  suggestions: DinnerSuggestion[];
  isLoading: boolean;
  error: string | null;
  pantryItemCount: number;
  generatedAt: string | null;
  autoFetch: boolean;

  fetchSuggestions: () => Promise<void>;
  clearSuggestions: () => void;
  setAutoFetch: (value: boolean) => void;
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

export const useSuggestionsStore = create<SuggestionsState>((set) => ({
  suggestions: [],
  isLoading: false,
  error: null,
  pantryItemCount: 0,
  generatedAt: null,
  autoFetch: false,

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
}));
