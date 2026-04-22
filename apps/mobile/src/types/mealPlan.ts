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

  // ---- Phase 22 extensions ----
  /**
   * Phase 22: optional free-form reason when status="skipped" (e.g.
   * "travel", "ate out"). Persisted server-side via meal_plan_entries
   * column added in migration 00026. Month view surfaces this as a chip.
   */
  skip_reason?: string | null;
  /**
   * Phase 22: derived client-side in plan 22-05 (stretch meal picker).
   * TRUE when this entry is the weekly stretch meal. Absent on fresh-fetch;
   * attached after running pickStretchDay().
   */
  is_stretch?: boolean;
  /**
   * Phase 22: derived client-side in plan 22-06 by comparing
   * ingredients[] to current pantry contents. TRUE when every ingredient
   * is pantry-ready. Absent on fresh-fetch.
   */
  pantry_ready?: boolean;
}

export interface MealPlan {
  id: string;
  profile_id: string;
  week_start: string; // ISO date (YYYY-MM-DD)
  generated_at: string;
  created_at: string;
  updated_at: string;
  entries: MealPlanEntry[]; // populated on fetch-with-entries

  // ---- Phase 22 extensions ----
  /**
   * Phase 22: optional weekly skill focus (e.g. "knife skills", "one-pan").
   * Generator nudge only — free-form text, NOT a controlled enum.
   * Persisted server-side via meal_plans column added in migration 00026.
   */
  focus_theme?: string | null;
}

/**
 * Phase 22: Plan tab view scale. Week is the default (current plan.tsx);
 * Month is a multi-week overview introduced in plan 22-03.
 */
export type PlanViewScale = 'week' | 'month';
