export type MealPlanEntryStatus = 'planned' | 'cooked' | 'skipped';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MealPlanIngredient {
  name: string;
  quantity?: number;
  unit?: string;
}

export interface MealPlanEntry {
  id: string;
  meal_plan_id: string;
  day_of_week: number; // 0 = Monday
  recipe_id: string | null;
  title: string;
  description: string | null;
  ingredients: MealPlanIngredient[];
  ingredients_needed: MealPlanIngredient[];
  estimated_time_minutes: number | null;
  difficulty: Difficulty | null;
  kid_friendly: boolean;
  why_suggested: string | null;
  status: MealPlanEntryStatus;
  cooked_at: string | null;
  created_at: string;
}

export interface MealPlan {
  id: string;
  profile_id: string;
  week_start: string; // ISO date (YYYY-MM-DD)
  generated_at: string;
  created_at: string;
  updated_at: string;
  entries: MealPlanEntry[]; // populated on fetch-with-entries
}
