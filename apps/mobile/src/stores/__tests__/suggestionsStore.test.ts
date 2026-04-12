import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase using vi.hoisted() for variable hoisting with vi.mock
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token' } },
        error: null,
      })
    ),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

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
        data: { session: null },
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
});
