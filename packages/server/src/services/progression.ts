// Phase 10-02 / 11-03: Progression service
//
// Backend layer for skill progression: cook history logging, aggregated
// cook stats, AI-powered ambition ranker, and creative variations.
//
// Design notes:
//   - Cook history aggregation lives here (not a Postgres view) so it stays
//     unit-testable -- matches the 10-01 decision.
//   - rankAmbition / getRecipeVariations route through the AIClient
//     abstraction (`getClientFor`). Tests mock the factory directly.
//   - logRecipeCook failures are swallowed: the cook itself succeeded;
//     missing a stats row is best-effort and must not roll back the cook.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import type {
  AmbitionRankRequest,
  AmbitionSuggestion,
  RecipeCookStats,
} from '../types/progression.js';

// ---------- logRecipeCook ----------

/**
 * Append a row to recipe_cooks for a (profile, recipe) pair.
 *
 * Best-effort: any insert error is logged via console.warn and swallowed.
 * Callers (notably markCooked) must not depend on success -- the cook
 * itself is the source of truth, stats are derived data.
 */
export async function logRecipeCook(
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from('recipe_cooks')
      .insert({ profile_id: profileId, recipe_id: recipeId });
    if (error) {
      console.warn(
        `[progression] logRecipeCook failed for profile=${profileId} recipe=${recipeId}: ${error.message}`,
      );
    }
  } catch (e) {
    console.warn(
      `[progression] logRecipeCook threw for profile=${profileId} recipe=${recipeId}:`,
      e,
    );
  }
}

// ---------- getCookStats ----------

interface RawCookRow {
  recipe_id: string;
  cooked_at: string;
  recipes: { title: string } | null;
}

/**
 * Aggregate recipe_cooks rows for a profile into per-recipe stats.
 */
export async function getCookStats(
  supabase: SupabaseClient,
  profileId: string,
): Promise<RecipeCookStats[]> {
  const { data, error } = await supabase
    .from('recipe_cooks')
    .select('recipe_id, cooked_at, recipes(title)')
    .eq('profile_id', profileId)
    .order('cooked_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch cook stats: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawCookRow[];
  const byRecipe = new Map<string, RecipeCookStats>();

  for (const row of rows) {
    const existing = byRecipe.get(row.recipe_id);
    const title = row.recipes?.title ?? '';
    if (!existing) {
      byRecipe.set(row.recipe_id, {
        recipe_id: row.recipe_id,
        title,
        cook_count: 1,
        last_cooked_at: row.cooked_at,
      });
      continue;
    }
    existing.cook_count += 1;
    if (row.cooked_at > existing.last_cooked_at) {
      existing.last_cooked_at = row.cooked_at;
    }
  }

  return Array.from(byRecipe.values());
}

// ---------- computeComplexity ----------

/**
 * Heuristic complexity score from research Pattern 4:
 *   complexity = steps.length + ingredients.length + floor(total_time / 15)
 */
export function computeComplexity(recipe: {
  steps: unknown[];
  ingredients: unknown[];
  total_time_minutes: number | null;
}): number {
  const stepCount = recipe.steps?.length ?? 0;
  const ingCount = recipe.ingredients?.length ?? 0;
  const timeBucket = Math.floor((recipe.total_time_minutes ?? 0) / 15);
  return stepCount + ingCount + timeBucket;
}

// ---------- rankAmbition ----------

const rankRecipesSchema: JsonSchema = {
  type: 'object',
  properties: {
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          recipe_id: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['recipe_id', 'rationale'],
      },
    },
  },
  required: ['recommendations'],
};

const rankRecipesTool: StructuredTool<{
  recommendations?: Array<{ recipe_id: string; rationale: string }>;
}> = {
  name: 'rank_recipes',
  description:
    'Rank candidate recipes as ambition suggestions for a home cook based on their cook history.',
  schema: rankRecipesSchema,
};

export function buildAmbitionPrompt(req: AmbitionRankRequest): string {
  const historyBlock =
    req.history.length > 0
      ? req.history
          .map(
            (h) =>
              `- ${h.title} (id: ${h.recipe_id}, complexity: ${h.complexity}, cooked ${h.cook_count}x)`,
          )
          .join('\n')
      : '(none -- this user is just starting out)';

  const candidatesBlock = req.candidates
    .map(
      (c) =>
        `- ${c.title} (id: ${c.recipe_id}, complexity: ${c.complexity})`,
    )
    .join('\n');

  return `You are a culinary coach helping a home cook level up their skills.

COOK HISTORY (recipes already cooked, with cook count and complexity score):
${historyBlock}

CANDIDATE RECIPES (unseen recipes from their library to consider):
${candidatesBlock}

TASK:
Pick the 3 best "ambition" recipes from the candidates -- something this cook
should plausibly try next that stretches their skills slightly above their
current comfort level. Avoid suggesting anything wildly above their current
complexity ceiling. Provide a one-sentence rationale per recommendation that
references their existing history when possible.

Use the rank_recipes tool to return your picks. Each recipe_id MUST match
one from the CANDIDATE RECIPES list above -- do not invent ids.`;
}

/**
 * Ask the AIClient to rank candidates into up to 3 ambition suggestions.
 */
export async function rankAmbition(
  req: AmbitionRankRequest,
): Promise<AmbitionSuggestion[]> {
  const overcookedIds = new Set(
    req.history.filter((h) => h.cook_count >= 2).map((h) => h.recipe_id),
  );
  const filteredCandidates = req.candidates.filter(
    (c) => !overcookedIds.has(c.recipe_id),
  );
  const candidateById = new Map(filteredCandidates.map((c) => [c.recipe_id, c]));

  const prompt = buildAmbitionPrompt({ history: req.history, candidates: filteredCandidates });

  let picks: Array<{ recipe_id: string; rationale: string }> = [];
  try {
    const ai = getClientFor('progression.ambition');
    const result = await ai.generateStructured({
      user: prompt,
      tool: rankRecipesTool,
      maxTokens: 1024,
    });
    picks = result?.recommendations ?? [];
  } catch (e) {
    console.warn('[progression] rankAmbition: AI call failed, using fallback', e);
  }

  // Filter hallucinations (recipe_id not in candidate pool)
  const valid = picks
    .map((p) => {
      const candidate = candidateById.get(p.recipe_id);
      if (!candidate) return null;
      return {
        recipe_id: candidate.recipe_id,
        title: candidate.title,
        rationale: p.rationale,
      } satisfies AmbitionSuggestion;
    })
    .filter((s): s is AmbitionSuggestion => s !== null);

  if (valid.length >= 3) {
    return valid.slice(0, 3);
  }

  // Fallback: lowest-complexity candidates not already chosen
  const chosenIds = new Set(valid.map((v) => v.recipe_id));
  const fallback = [...filteredCandidates]
    .filter((c) => !chosenIds.has(c.recipe_id))
    .sort((a, b) => a.complexity - b.complexity)
    .slice(0, 3 - valid.length)
    .map<AmbitionSuggestion>((c) => ({
      recipe_id: c.recipe_id,
      title: c.title,
      rationale: 'A gentle next step based on its complexity profile.',
    }));

  return [...valid, ...fallback];
}

// ---------- getRecipeVariations ----------

const variationsSchema: JsonSchema = {
  type: 'object',
  properties: {
    variations: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['variations'],
};

const variationsTool: StructuredTool<{ variations?: string[] }> = {
  name: 'suggest_variations',
  description: 'Suggest 3 creative variations on a recipe the cook has mastered.',
  schema: variationsSchema,
};

interface RecipeRow {
  id: string;
  profile_id: string;
  title: string;
  steps: unknown[];
  ingredients: unknown[];
  total_time_minutes: number | null;
}

/**
 * Remix modes — each produces a different kind of variation. The mode
 * controls the prompt steering, not the tool schema.
 */
export type RemixMode = 'surprise' | 'protein' | 'veggies' | 'quicker';

const REMIX_PROMPTS: Record<RemixMode, string> = {
  surprise:
    'Surprise the cook with 3 creative variations — ingredient swaps, technique tweaks, or flavor twists that introduce something new without abandoning what works. Mix bold and safe ideas.',
  protein:
    'Suggest 3 variations that keep the base dish and technique but SWAP THE MAIN PROTEIN (e.g., chicken → pork, beef → mushroom, salmon → tofu). Each variation must specify which new protein is being used.',
  veggies:
    'Suggest 3 variations that keep the protein and technique but SWAP OR ADD VEGETABLES/AROMATICS/NON-PROTEIN INGREDIENTS to change the flavor profile (e.g., swap spinach for kale, add roasted peppers, substitute sweet potato for regular potato).',
  quicker:
    'Suggest 3 variations that deliver the same dish in LESS TIME. Shortcut techniques, pre-made ingredients, smaller cuts, or skipping non-essential steps. Each variation must explain what time-saver it uses.',
};

/**
 * Return 3 creative variations for a recipe. No gating — variations are
 * always available. Optional `mode` steers the prompt toward a specific
 * kind of remix (surprise | protein | veggies | quicker).
 */
export async function getRecipeVariations(
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string,
  mode: RemixMode = 'surprise',
): Promise<string[]> {
  const { data: recipeData, error: recipeError } = await supabase
    .from('recipes')
    .select('id, profile_id, title, steps, ingredients, total_time_minutes')
    .eq('id', recipeId)
    .eq('profile_id', profileId)
    .single();

  if (recipeError || !recipeData) {
    const err = new Error('Recipe not found') as Error & { code?: string };
    err.code = 'NOT_FOUND';
    throw err;
  }

  const recipe = recipeData as RecipeRow;

  const ingredientList = (recipe.ingredients ?? [])
    .map((ing) => {
      if (typeof ing === 'string') return ing;
      if (ing && typeof ing === 'object' && 'name' in ing) {
        return String((ing as { name: unknown }).name);
      }
      return '';
    })
    .filter(Boolean)
    .join(', ');

  const steering = REMIX_PROMPTS[mode] ?? REMIX_PROMPTS.surprise;
  const prompt = `Recipe: "${recipe.title}"
Current ingredients: ${ingredientList || '(unknown)'}
${recipe.total_time_minutes ? `Current total time: ${recipe.total_time_minutes} minutes` : ''}

${steering}

Each variation should be a single sentence, actionable, and specific.
Use the suggest_variations tool to return your picks.`;

  const ai = getClientFor('progression.variations');
  const result = await ai.generateStructured({
    user: prompt,
    tool: variationsTool,
    maxTokens: 512,
  });

  if (!result || !Array.isArray(result.variations)) {
    throw new Error('AIClient did not return a variations array');
  }
  return result.variations;
}
