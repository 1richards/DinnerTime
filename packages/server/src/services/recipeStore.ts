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

/**
 * List all recipes for a user, ordered by most recent first.
 */
export async function getRecipes(
  supabase: SupabaseClient,
  profileId: string
): Promise<RecipeRow[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select()
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch recipes: ${error.message}`);
  }

  return (data ?? []) as RecipeRow[];
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
