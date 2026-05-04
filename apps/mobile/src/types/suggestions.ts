export interface DinnerSuggestion {
  title: string;
  description: string;
  ingredients_used: string[];
  ingredients_needed: string[];
  estimated_time_minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  kid_friendly: boolean;
  cuisine_type: string;
  why_suggested: string;
  // Quick-12 follow-up — per-serving nutrition. Both optional; AI omits when
  // uncertain. Surfaced as an inline pill on SuggestionCard.
  calories_per_serving?: number | null;
  protein_grams_per_serving?: number | null;
}

export interface SuggestionsResponse {
  suggestions: DinnerSuggestion[];
  pantry_item_count: number;
  generated_at: string;
}
