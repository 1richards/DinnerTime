import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedRecipe } from './recipeParser.js';

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
  created_at: string;
  updated_at: string;
}

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
      servings: recipe.servings,
      source_type: recipe.source_type,
      source_url: recipe.source_url,
      image_url: recipe.image_url,
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
): Promise<RecipeRow[]> {
  let query = supabase.from('recipes').select().eq('profile_id', profileId);

  if (opts.q && opts.q.trim().length > 0) {
    const escaped = escapeIlikePattern(opts.q);
    query = query.ilike('title', `%${escaped}%`);
  }

  if (opts.favoritesOnly) {
    query = query.eq('is_favorite', true);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`);
  }

  return (data ?? []) as RecipeRow[];
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
