import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedRecipe } from './recipeParser.js';
import { normalizeServings } from './recipeServings.js';
export { MIN_SERVINGS, normalizeServings } from './recipeServings.js';

// ---------- DB Row Type ----------

export interface RecipeRow {
  id: string;
  profile_id: string;
  title: string;
  description: string | null;
  ingredients: unknown[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  source_type: 'url' | 'photo' | 'manual';
  source_url: string | null;
  image_url: string | null;
  /** Supplementary preparation-step photos, generated lazily when the user
      opens the detail page. NULL until generated. */
  step_image_urls: string[] | null;
  calories_per_serving: number | null;
  protein_grams_per_serving: number | null;
  fat_grams_per_serving: number | null;
  /** Quick-task 6 — per-recipe skill scaffolding. NULL on legacy rows.
      AI-generated recipes (Discover + meal-plan) populate these. */
  difficulty: 'easy' | 'medium' | 'hard' | null;
  practiced_skills: string[] | null;
  skill_note: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Explicit column set for the recipe LIST query (O1 telemetry path).
 *
 * NOTE (CR-01 revert): `steps` and `step_image_urls` were briefly excluded
 * here as a payload optimization, but `recipe.steps` is read straight off the
 * in-memory list array by MANY flows that never re-hydrate the full detail row
 * — Cook Mode entered from the Recipe Box, cookingStore, cook.tsx, edit.tsx,
 * Cook Later in kitchen.tsx, and RecipeCard. Dropping the columns crashed all
 * of them. The dominant load cost is image generation (handled separately by
 * O2/O3), not this payload, so the columns are restored here. The list query
 * returns full rows again; the explicit select is kept only for the timing /
 * telemetry instrumentation around it.
 */
export const RECIPE_LIST_COLUMNS =
  'id, profile_id, title, description, ingredients, steps, step_image_urls, prep_time_minutes, cook_time_minutes, total_time_minutes, servings, source_type, source_url, image_url, is_favorite, labels, calories_per_serving, protein_grams_per_serving, fat_grams_per_serving, difficulty, practiced_skills, skill_note, created_at, updated_at';

/**
 * Hard cap on the list query (O1). Generous on purpose: bounds the worst-case
 * payload without breaking client-side search / offline cache, which both run
 * over the FULL in-memory recipes array. Typical libraries are < 100 rows.
 * This is "load-all (capped)", NOT incremental client paging.
 */
export const RECIPE_LIST_LIMIT = 200;

// ---------- Public API ----------

/**
 * Look up an existing recipe owned by the user whose title matches `title`
 * after case-insensitive trimming. Returns null if no match. Used by the
 * POST /recipes route to avoid creating duplicate library rows when the
 * AI surfaces the same suggestion twice or the user double-saves.
 */
export async function findRecipeByNormalizedTitle(
  supabase: SupabaseClient,
  profileId: string,
  title: string
): Promise<RecipeRow | null> {
  const normalized = title.trim();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('recipes')
    .select()
    .eq('profile_id', profileId)
    .ilike('title', normalized)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to look up recipe by title: ${error.message}`);
  }
  return (data as RecipeRow | null) ?? null;
}

/**
 * Save a parsed recipe to the database.
 */
export async function saveRecipe(
  supabase: SupabaseClient,
  profileId: string,
  recipe: ParsedRecipe
): Promise<RecipeRow> {
  const { data, error } = await supabase
    .from('recipes')
    .insert({
      profile_id: profileId,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      prep_time_minutes: recipe.prep_time_minutes,
      cook_time_minutes: recipe.cook_time_minutes,
      total_time_minutes: recipe.total_time_minutes,
      // Imported recipes (url/photo/manual) keep whatever serving count
      // the source specified — a 2-serving site recipe stays a 2-serving
      // recipe in the user's library, with the in-app stepper letting
      // them scale up at cook time. Only AI-generated recipes (Discover,
      // Plan generate) are floored at MIN_SERVINGS, and that clamp is
      // applied at the AI pipeline layer (discoverRecipes / mealPlanner)
      // before the row reaches saveRecipe.
      servings: recipe.servings,
      source_type: recipe.source_type,
      source_url: recipe.source_url,
      image_url: recipe.image_url,
      calories_per_serving: recipe.calories_per_serving,
      protein_grams_per_serving: recipe.protein_grams_per_serving,
      fat_grams_per_serving: recipe.fat_grams_per_serving,
      // Quick-task 6 — skill scaffolding. Discover + mealPlanner populate
      // these from the AI tool output; legacy / imported rows pass null.
      difficulty: recipe.difficulty ?? null,
      practiced_skills: recipe.practiced_skills ?? null,
      skill_note: recipe.skill_note ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save recipe: ${error.message}`);
  }

  return data as RecipeRow;
}

export interface GetRecipesOptions {
  q?: string;
  favoritesOnly?: boolean;
}

/**
 * Escape Postgres ILIKE wildcards (%, _) and backslashes so user-supplied
 * search terms can't expand into wildcard patterns.
 */
function escapeIlikePattern(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

/**
 * List recipes for a user, ordered by most recent first.
 *
 * Supports optional keyword search (ILIKE on title) and favorites-only filter.
 * Wildcard characters in `q` are escaped so they are treated as literals.
 */
export async function getRecipes(
  supabase: SupabaseClient,
  profileId: string,
  opts: GetRecipesOptions = {}
): Promise<{ rows: RecipeRow[]; queryMs: number; rowCount: number; truncated: boolean }> {
  // O1 — explicit column set (steps / step_image_urls restored per CR-01 so
  // off-list consumers like Cook Mode never see undefined steps). The explicit
  // select stays for the db_query_ms / payload_bytes telemetry around it.
  let query = supabase
    .from('recipes')
    .select(RECIPE_LIST_COLUMNS)
    .eq('profile_id', profileId);

  if (opts.q && opts.q.trim().length > 0) {
    const escaped = escapeIlikePattern(opts.q);
    query = query.ilike('title', `%${escaped}%`);
  }

  if (opts.favoritesOnly) {
    query = query.eq('is_favorite', true);
  }

  // T1 — time just the DB round-trip so the route can log db_query_ms.
  const t0 = Date.now();
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(RECIPE_LIST_LIMIT);
  const queryMs = Date.now() - t0;

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RecipeRow[];
  // WR-02 — when the row count saturates the hard cap, the user almost
  // certainly has more recipes than we returned. Those rows silently vanish
  // from the list AND from client-side (in-memory) search. Surface this so the
  // route can warn-log it and the client can fall back to server-side search.
  const truncated = rows.length >= RECIPE_LIST_LIMIT;
  return { rows, queryMs, rowCount: rows.length, truncated };
}

/**
 * Update whitelisted fields on a recipe owned by the given user.
 * Returns the updated row, or null when no matching row exists.
 */
export async function updateRecipe(
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string,
  patch: Record<string, unknown>
): Promise<RecipeRow | null> {
  const { data, error } = await supabase
    .from('recipes')
    .update(patch)
    .eq('id', recipeId)
    .eq('profile_id', profileId)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null;
    throw new Error(`Failed to update recipe: ${error.message}`);
  }

  return data as RecipeRow;
}

/**
 * Delete a recipe owned by the given user.
 */
export async function deleteRecipe(
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string
): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('profile_id', profileId);

  if (error) {
    throw new Error(`Failed to delete recipe: ${error.message}`);
  }
}

/**
 * Get a single recipe by ID for a user.
 */
export async function getRecipeById(
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string
): Promise<RecipeRow | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select()
    .eq('id', recipeId)
    .eq('profile_id', profileId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to fetch recipe: ${error.message}`);
  }

  return data as RecipeRow;
}

/**
 * Check if a recipe with the given source URL already exists for this user.
 */
export async function findRecipeBySourceUrl(
  supabase: SupabaseClient,
  profileId: string,
  sourceUrl: string
): Promise<RecipeRow | null> {
  const { data, error } = await supabase
    .from('recipes')
    .select()
    .eq('profile_id', profileId)
    .eq('source_url', sourceUrl)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check for duplicate recipe: ${error.message}`);
  }

  return data as RecipeRow | null;
}
