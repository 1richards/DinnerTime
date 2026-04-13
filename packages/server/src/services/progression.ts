// Phase 10-02: Progression service
//
// Backend layer for skill progression: cook history logging, aggregated
// cook stats, Claude Sonnet ambition ranker, and creative variations.
//
// Design notes:
//   - Cook history aggregation lives here (not a Postgres view) so it stays
//     unit-testable -- matches the 10-01 decision.
//   - rankAmbition / getRecipeVariations take an `anthropic` client as a
//     parameter (not the module-level singleton) so tests pass a plain mock
//     object instead of patching the SDK module. Production callers pass
//     the singleton from config/anthropic.
//   - logRecipeCook failures are swallowed: the cook itself succeeded;
//     missing a stats row is best-effort and must not roll back the cook.

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AmbitionRankRequest,
  AmbitionSuggestion,
  RecipeCookStats,
} from '../types/progression.js';

// ---------- Minimal Anthropic client shape ----------

/**
 * Structural type for the subset of the Anthropic SDK we use.
 * Lets tests pass a plain `{ messages: { create: vi.fn() } }` object
 * without importing the full SDK type surface.
 */
export interface AnthropicLike {
  messages: {
    create: (args: unknown) => Promise<{
      content: Array<{
        type: string;
        name?: string;
        input?: unknown;
      }>;
    }>;
  };
}

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
 *
 * One query joins recipe_cooks → recipes to pull title alongside the cook
 * timestamp. Aggregation (count, last_cooked_at) is done in JS so the
 * shape stays unit-testable without a real Postgres group-by view.
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
 *
 * Pure function, used by both rankAmbition prompt assembly and the
 * empty-history fallback ordering.
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

const RANK_RECIPES_TOOL = {
  name: 'rank_recipes' as const,
  description:
    'Rank candidate recipes as ambition suggestions for a home cook based on their cook history.',
  input_schema: {
    type: 'object' as const,
    properties: {
      recommendations: {
        type: 'array',
        minItems: 1,
        maxItems: 3,
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
  },
};

/**
 * Build the prompt sent to Sonnet for ambition ranking.
 * Pure helper -- exported for future testing if we add prompt tests.
 */
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
 * Ask Sonnet to rank candidates into 3 ambition suggestions.
 *
 * Pre-filtering: recipes the user has already cooked >=2 times are
 * dropped from the candidate pool before prompt assembly (they aren't
 * "ambition" -- they're routine).
 *
 * Hallucination guard: any recipe_id Sonnet returns that is not in the
 * candidate pool is dropped silently.
 *
 * Empty-history fallback: if Sonnet returns nothing usable, return the
 * 3 candidates with the lowest complexity (gentle starting point).
 */
export async function rankAmbition(
  anthropic: AnthropicLike,
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

  let sonnetPicks: Array<{ recipe_id: string; rationale: string }> = [];
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: [RANK_RECIPES_TOOL],
      tool_choice: { type: 'tool', name: 'rank_recipes' },
      messages: [{ role: 'user', content: prompt }],
    });

    const toolBlock = response.content.find(
      (b) => b.type === 'tool_use' && b.name === 'rank_recipes',
    );
    if (toolBlock && toolBlock.input) {
      const input = toolBlock.input as {
        recommendations?: Array<{ recipe_id: string; rationale: string }>;
      };
      sonnetPicks = input.recommendations ?? [];
    }
  } catch (e) {
    console.warn('[progression] rankAmbition: Sonnet call failed, using fallback', e);
  }

  // Filter hallucinations (recipe_id not in candidate pool)
  const valid = sonnetPicks
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

const VARIATIONS_TOOL = {
  name: 'suggest_variations' as const,
  description: 'Suggest 3 creative variations on a recipe the cook has mastered.',
  input_schema: {
    type: 'object' as const,
    properties: {
      variations: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: { type: 'string' },
      },
    },
    required: ['variations'],
  },
};

interface RecipeRow {
  id: string;
  profile_id: string;
  title: string;
  steps: unknown[];
  ingredients: unknown[];
  total_time_minutes: number | null;
}

export class BelowThresholdError extends Error {
  code = 'BELOW_THRESHOLD' as const;
  constructor(message = 'Recipe must be cooked at least 3 times before unlocking variations') {
    super(message);
    this.name = 'BelowThresholdError';
  }
}

/**
 * Return 3 creative variations for a recipe the user has cooked >= 3 times.
 *
 * Throws BelowThresholdError ({ code: 'BELOW_THRESHOLD' }) if the recipe
 * has not been cooked enough times yet -- the route layer maps this to
 * HTTP 400 so the mobile UI can show an "unlock at 3 cooks" prompt.
 */
export async function getRecipeVariations(
  anthropic: AnthropicLike,
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string,
): Promise<string[]> {
  // Load the recipe (must be owned by profile)
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

  // Check cook count for this recipe
  const stats = await getCookStats(supabase, profileId);
  const recipeStats = stats.find((s) => s.recipe_id === recipeId);
  const cookCount = recipeStats?.cook_count ?? 0;

  if (cookCount < 3) {
    throw new BelowThresholdError();
  }

  // Call Haiku for variations
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

  const prompt = `The cook has made "${recipe.title}" ${cookCount} times and clearly enjoys it.
Suggest 3 creative variations that build on this recipe -- ingredient swaps,
technique tweaks, or flavor twists that introduce something new without
abandoning what works. Each variation should be a single sentence.

Current ingredients: ${ingredientList || '(unknown)'}

Use the suggest_variations tool to return your picks.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-latest',
    max_tokens: 512,
    tools: [VARIATIONS_TOOL],
    tool_choice: { type: 'tool', name: 'suggest_variations' },
    messages: [{ role: 'user', content: prompt }],
  });

  const toolBlock = response.content.find(
    (b) => b.type === 'tool_use' && b.name === 'suggest_variations',
  );
  if (!toolBlock || !toolBlock.input) {
    throw new Error('Claude did not return a tool_use response for variations');
  }

  const input = toolBlock.input as { variations?: string[] };
  return input.variations ?? [];
}
