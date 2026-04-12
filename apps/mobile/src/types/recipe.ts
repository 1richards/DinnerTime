export interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

export interface ParsedRecipe {
  title: string;
  description: string | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  source_url: string | null;
  source_type: 'url' | 'photo' | 'manual' | 'ai';
  image_url: string | null;
}

export type ImportSource = 'url' | 'photo' | 'manual' | 'ai';

export interface Recipe {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  source_type: ImportSource;
  source_url: string | null;
  image_url: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}
