export type MealPlanEntryStatus = 'planned' | 'cooked' | 'skipped';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MealPlanIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
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
  // Phase v1.0.2 — entries now ARE full recipes. The planner emits
  // ordered steps + prep/cook times + servings in the same structured
  // tool call so opening a plan day shows a real, cookable recipe with
  // no follow-up Claude round-trip required.
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
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

  // ---- Quick-task 6 extensions ----
  /**
   * 1-3 practiced skills from the 8-key taxonomy (FocusPickerSheet keys).
   * The Plan day card emits a matching-focus chip when this array contains
   * the active meal_plans.focus_theme (case-insensitive). NULL on legacy
   * entries generated before the planner started tagging.
   */
  practiced_skills?: string[] | null;
  /**
   * Optional one-line technique payoff (≤120 chars) — e.g. "Practices
   * fond → reduction → mounted butter". Surfaced on Recipe detail.
   */
  skill_note?: string | null;

  // ---- Quick task 12 extensions ----
  /**
   * Per-serving calorie estimate from the AI planner. Mirrors
   * recipes.calories_per_serving (migration 00033) for entries that
   * aren't linked to a saved recipe. NULL on legacy rows generated
   * before migration 00036.
   */
  calories_per_serving?: number | null;
  /**
   * Per-serving protein grams from the AI planner. NUMERIC(5,1)
   * server-side, so values arrive as numbers (e.g. 24.5). NULL on
   * legacy rows.
   */
  protein_grams_per_serving?: number | null;
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
