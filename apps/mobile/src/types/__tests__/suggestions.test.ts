import { describe, it, expect } from 'vitest';
import type { DinnerSuggestion, SuggestionsResponse } from '../suggestions';

describe('suggestion types', () => {
  it('DinnerSuggestion has all required fields', () => {
    const suggestion: DinnerSuggestion = {
      title: 'Pasta Carbonara',
      description: 'Classic Italian pasta with eggs and cheese',
      ingredients_used: ['eggs', 'cheese', 'pasta'],
      ingredients_needed: ['pancetta'],
      estimated_time_minutes: 30,
      difficulty: 'medium',
      kid_friendly: true,
      cuisine_type: 'Italian',
      why_suggested: 'Uses most of your available ingredients',
    };

    expect(suggestion.title).toBe('Pasta Carbonara');
    expect(suggestion.ingredients_used).toHaveLength(3);
    expect(suggestion.difficulty).toBe('medium');
    expect(suggestion.kid_friendly).toBe(true);
  });

  it('SuggestionsResponse wraps suggestions with metadata', () => {
    const response: SuggestionsResponse = {
      suggestions: [
        {
          title: 'Test Recipe',
          description: 'A test recipe',
          ingredients_used: ['item1'],
          ingredients_needed: [],
          estimated_time_minutes: 15,
          difficulty: 'easy',
          kid_friendly: false,
          cuisine_type: 'American',
          why_suggested: 'Quick and easy',
        },
      ],
      pantry_item_count: 5,
      generated_at: '2026-04-10T00:00:00Z',
    };

    expect(response.suggestions).toHaveLength(1);
    expect(response.pantry_item_count).toBe(5);
    expect(response.generated_at).toBeDefined();
  });
});
