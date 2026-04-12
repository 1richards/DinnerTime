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
}

export interface SuggestionsResponse {
  suggestions: DinnerSuggestion[];
  pantry_item_count: number;
  generated_at: string;
}
