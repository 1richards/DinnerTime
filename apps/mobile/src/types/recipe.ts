export interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

/**
 * Quick-task 6 — Canonical 8-key practiced-skill taxonomy.
 *
 * MUST stay byte-identical to:
 *   - apps/mobile/src/components/plan/FocusPickerSheet.tsx FOCUS_OPTIONS keys
 *   - packages/server/src/services/recipeDiscovery.ts PRACTICED_SKILLS
 *
 * The matching-focus chip on Plan day cards compares
 * entry.practiced_skills against meal_plans.focus_theme using lowercase
 * equality, so any drift between client and server allowlists silently
 * breaks the chip.
 */
export const PRACTICED_SKILLS = [
  'knife skills',
  'pan sauces',
  'braising',
  'stir-frying',
  'plant-forward',
  'pasta from scratch',
  'global flavors',
  'baking & breads',
] as const;
export type PracticedSkill = (typeof PRACTICED_SKILLS)[number];

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
  /** Per-serving nutrition estimates from Claude. Null on legacy rows. */
  calories_per_serving?: number | null;
  protein_grams_per_serving?: number | null;
  fat_grams_per_serving?: number | null;
  /** Quick-task 6 — skill scaffolding (Discover + meal-plan AI). NULL on
      legacy rows / non-AI imports — UI hides chips on null. */
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  practiced_skills?: string[] | null;
  skill_note?: string | null;
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
  /** Supplementary preparation-step photos, generated lazily when the user
      opens the detail page. NULL/absent until generated. */
  step_image_urls?: string[] | null;
  is_favorite: boolean;
  /** User-defined free-form labels (e.g. "tacos", "game nights"). */
  labels?: string[];
  /** Per-serving nutrition estimates. Null on legacy rows. */
  calories_per_serving?: number | null;
  protein_grams_per_serving?: number | null;
  fat_grams_per_serving?: number | null;
  /** Quick-task 6 — skill scaffolding. NULL on legacy / imported rows. */
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  practiced_skills?: string[] | null;
  skill_note?: string | null;
  created_at: string;
  updated_at: string;
}
