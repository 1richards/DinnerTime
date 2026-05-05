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

/**
 * A single remix variation — a short bold title + a one-sentence
 * description. Shape was `string[]` originally; upgraded so the UI can
 * render a proper title and explanation side-by-side.
 */
export interface RemixVariation {
  title: string;
  description: string;
}

const variationsSchema: JsonSchema = {
  type: 'object',
  properties: {
    variations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description:
              'Short 2-5 word title for the variation. Use title case. Describe the defining change, e.g., "Sautéed Shrimp", "Weeknight Shortcut", "Coconut Curry Twist".',
          },
          description: {
            type: 'string',
            description:
              'One concrete actionable sentence explaining what to change and why it works.',
          },
        },
        required: ['title', 'description'],
      },
    },
  },
  required: ['variations'],
};

const variationsTool: StructuredTool<{ variations?: RemixVariation[] }> = {
  name: 'suggest_variations',
  description: 'Suggest 3 creative remix variations on a recipe.',
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
 * Generic recipe-ish context for variation generation. Works for both
 * saved recipes (from the DB) and unsaved Home suggestions.
 */
export interface RecipeContext {
  title: string;
  description?: string | null;
  ingredients?: Array<string | { name: string }>;
  total_time_minutes?: number | null;
}

/**
 * Remix modes — each produces a different kind of variation. The mode
 * controls the prompt steering, not the tool schema.
 */
export type RemixMode =
  | 'surprise'
  | 'protein'
  | 'add_protein'
  | 'veggies'
  | 'vegetarian'
  | 'quicker'
  | 'harder'
  | 'healthier'
  | 'decadent';

const REMIX_PROMPTS: Record<RemixMode, string> = {
  surprise:
    'Surprise the cook with 3 creative variations — ingredient swaps, technique tweaks, or flavor twists that introduce something new without abandoning what works. Mix bold and safe ideas.',
  protein:
    'Suggest 3 variations that keep the base dish and technique but SWAP THE MAIN PROTEIN (e.g., chicken → pork, beef → mushroom, salmon → tofu). Each variation must specify which new protein is being used.',
  add_protein:
    'Suggest 3 variations that ADD a substantial protein to the dish without changing what already works. Lean toward additive moves (grilled chicken on top, white beans stirred in, a fried egg, shrimp added at the end) rather than replacements. Each variation must specify which protein is being added and how it integrates.',
  veggies:
    'Suggest 3 variations that keep the protein and technique but SWAP OR ADD VEGETABLES/AROMATICS/NON-PROTEIN INGREDIENTS to change the flavor profile (e.g., swap spinach for kale, add roasted peppers, substitute sweet potato for regular potato).',
  vegetarian:
    'Suggest 3 variations that REPLACE the meat/seafood with a satisfying vegetarian alternative while keeping the dish recognizable. Every variation must be strictly vegetarian — NO meat, poultry, seafood, or cured/processed meats of any kind. This explicitly excludes bacon, pancetta, prosciutto, ham, sausage, salami, chorizo, anchovies, fish sauce, lard, and gelatin. Lean on hearty vegetables, legumes, mushrooms, paneer, tofu, tempeh, halloumi, or cheese — pick what fits the cuisine. Each variation must specify the replacement and any seasoning adjustments needed.',
  quicker:
    'Suggest 3 variations that deliver the same dish in LESS TIME. Shortcut techniques, pre-made ingredients, smaller cuts, or skipping non-essential steps. Each variation must explain what time-saver it uses.',
  harder:
    'Suggest 3 variations that LEVEL UP THE TECHNIQUE — make the dish more ambitious for a cook who wants to stretch. Lean on chef-y moves: from-scratch sauces, hand-shaped pastas/breads, advanced techniques (sous vide, confit, fermentation, layered braises), elaborate plating, or extra cooking steps that meaningfully deepen flavor. Each variation must specify what makes it more challenging and the payoff.',
  healthier:
    'Suggest 3 variations that meaningfully UPGRADE THE NUTRITIONAL PROFILE while keeping the dish recognizable and satisfying. Levers: swap refined grains for whole grains, reduce added sugar/oil/butter, increase vegetable volume, lean-up the protein (e.g., ground beef → ground turkey or lean turkey + lentils), boost fiber, swap heavy cream for Greek yogurt or evaporated milk, bake/air-fry instead of deep-fry. Each variation must call out the specific health upgrade made.',
  decadent:
    'Suggest 3 variations that LEAN INTO INDULGENCE — richer, more luxurious takes for a special occasion. Levers: brown butter, cream/crème fraîche, more cheese (or higher-grade cheese), bone-in cuts, finishing oils (truffle, chili crisp, infused olive), confit garlic, gold-leaf flourishes, dessert-style sauces, melted/torched toppings. Each variation must specify what makes it more decadent and how it transforms the dish.',
};

function contextIngredientList(context: RecipeContext): string {
  return (context.ingredients ?? [])
    .map((ing) => {
      if (typeof ing === 'string') return ing;
      if (ing && typeof ing === 'object' && 'name' in ing) {
        return String((ing as { name: unknown }).name);
      }
      return '';
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Core variation generator. Works against any RecipeContext — saved
 * recipe row, Home suggestion, anything with a title + ingredients.
 */
export async function generateVariationsForContext(
  context: RecipeContext,
  mode: RemixMode = 'surprise',
  customInstructions?: string,
): Promise<RemixVariation[]> {
  const ingredientList = contextIngredientList(context);
  const steering = REMIX_PROMPTS[mode] ?? REMIX_PROMPTS.surprise;
  const trimmedCustom = customInstructions?.trim();
  const hasCustom = trimmedCustom && trimmedCustom.length > 0;

  // When the cook types custom instructions, that becomes the PRIMARY
  // directive. The mode steering downgrades to a hint. Without this
  // ordering the model treated mode as primary and let custom drift —
  // e.g. "use hard shell tacos" on a salmon-tacos surprise remix
  // produced salmon glazes / air-fryer cubes, dropping the taco format
  // entirely.
  const directive = hasCustom
    ? `PRIMARY DIRECTIVE — every variation MUST honor this exactly: "${trimmedCustom}"\n\nCREATIVE DIRECTION (secondary, only where it doesn't conflict with the primary directive): ${steering}`
    : steering;

  // Mode-specific HARD CONSTRAINTS. The general "preserve dish identity"
  // line was being read as "keep the protein" by Claude in vegetarian
  // mode (e.g. "Korean Gochujang Beef" surfaced as a vegetarian variation
  // of beef tacos). Override per-mode where the protein IS the variation
  // axis so the model resolves the conflict the right way.
  const modeConstraints: Partial<Record<RemixMode, string>> = {
    vegetarian:
      '- ABSOLUTELY NO meat, poultry, seafood, or cured/processed meat in ANY variation. Every single variation must be 100% vegetarian. The dish FORMAT stays (tacos stay tacos, pasta stays pasta) but the protein/meat MUST change. Example: a valid vegetarian variation of "Beef Tacos" is "Black Bean Tacos" or "Mushroom and Walnut Tacos" — NEVER "Korean Beef Tacos" or "Spicy Pork Tacos". If you generate any variation containing meat, the output is invalid.',
    protein:
      '- Each variation MUST swap the main protein. Format stays the same, protein changes.',
    add_protein:
      '- Each variation MUST add a substantial protein. Format stays the same.',
  };
  const modeConstraint = modeConstraints[mode] ?? '';

  const prompt = `Recipe: "${context.title}"
${context.description ? `Description: ${context.description}` : ''}
Current ingredients: ${ingredientList || '(unknown)'}
${context.total_time_minutes ? `Current total time: ${context.total_time_minutes} minutes` : ''}

${directive}

HARD CONSTRAINTS for every variation:
- Preserve the fundamental dish FORMAT. If the recipe is tacos, every variation stays tacos; pasta stays pasta; soup stays soup. Don't pivot to a different dish format.
- Keep the recipe recognizable as a remix of the original, not a different recipe entirely.
${modeConstraint ? modeConstraint + '\n' : ''}
Each variation must have:
- A SHORT title (2-5 words, title case) naming the defining change — e.g., "Sautéed Shrimp", "Weeknight Shortcut", "Coconut Curry Twist"
- A ONE-SENTENCE description explaining what to change and why it works

Use the suggest_variations tool to return your 3 picks.`;

  const ai = getClientFor('progression.variations');
  const result = await ai.generateStructured({
    user: prompt,
    tool: variationsTool,
    maxTokens: 768,
  });

  if (!result || !Array.isArray(result.variations)) {
    throw new Error('AIClient did not return a variations array');
  }

  // Belt-and-suspenders for vegetarian mode: scan generated titles +
  // descriptions for meat words and reject the whole batch with a
  // single regeneration retry. If the retry also fails, surface what
  // we have rather than failing the user — UI can flag the issue, but
  // the prompt strengthening above should make this near-zero in
  // practice.
  if (mode === 'vegetarian') {
    const hasMeat = (v: RemixVariation) =>
      MEAT_WORD_REGEX.test(`${v.title} ${v.description}`);
    const dirty = result.variations.filter(hasMeat);
    if (dirty.length > 0) {
      const retry = await ai.generateStructured({
        user: `${prompt}\n\nIMPORTANT: A previous attempt produced ${dirty.length} non-vegetarian variation(s). Every variation MUST be 100% vegetarian — strip the meat references and try again.`,
        tool: variationsTool,
        maxTokens: 768,
      });
      if (retry && Array.isArray(retry.variations)) {
        const cleanedRetry = retry.variations.filter(
          (v: RemixVariation) => !hasMeat(v),
        );
        if (cleanedRetry.length >= 1) {
          // Mix: keep clean originals + cleaned retry, dedupe by title.
          const merged: RemixVariation[] = [];
          const seenTitles = new Set<string>();
          for (const v of [
            ...result.variations.filter((v: RemixVariation) => !hasMeat(v)),
            ...cleanedRetry,
          ]) {
            const key = v.title.toLowerCase().trim();
            if (!seenTitles.has(key)) {
              merged.push(v);
              seenTitles.add(key);
            }
          }
          if (merged.length >= 3) return merged.slice(0, 3);
        }
      }
    }
  }

  return result.variations;
}

// Words that are unambiguously meat/poultry/seafood. Ordered roughly by
// frequency in remix outputs. Word-boundaries (\b) prevent false positives
// like "beefcake" or "porkpie hat" — though those don't occur in recipe
// names anyway. Case-insensitive at the regex flag level.
const MEAT_WORD_REGEX =
  /\b(beef|pork|chicken|turkey|lamb|veal|duck|goose|venison|bison|rabbit|chorizo|bacon|pancetta|prosciutto|ham|sausage|salami|pepperoni|kielbasa|bratwurst|hot ?dog|jerky|guanciale|capicola|mortadella|carnitas|barbacoa|pastrami|gochujang beef|brisket|oxtail|tongue|tripe|liver|paté|foie gras|shrimp|prawn|crab|lobster|scallop|oyster|clam|mussel|squid|octopus|calamari|tuna|salmon|cod|halibut|tilapia|trout|sardine|anchovy|anchovies|mackerel|sea bass|sea bream|swordfish|fish sauce|nduja|lardo|lard|gelatin)\b/i;

/**
 * Return 3 creative variations for a SAVED recipe by id. Thin wrapper —
 * loads the recipe row, then delegates to generateVariationsForContext.
 */
export async function getRecipeVariations(
  supabase: SupabaseClient,
  profileId: string,
  recipeId: string,
  mode: RemixMode = 'surprise',
  customInstructions?: string,
): Promise<RemixVariation[]> {
  const { data: recipeData, error: recipeError } = await supabase
    .from('recipes')
    .select('id, profile_id, title, description, steps, ingredients, total_time_minutes')
    .eq('id', recipeId)
    .eq('profile_id', profileId)
    .single();

  if (recipeError || !recipeData) {
    const err = new Error('Recipe not found') as Error & { code?: string };
    err.code = 'NOT_FOUND';
    throw err;
  }

  const recipe = recipeData as RecipeRow & { description?: string | null };
  return generateVariationsForContext(
    {
      title: recipe.title,
      description: recipe.description ?? null,
      ingredients: recipe.ingredients as RecipeContext['ingredients'],
      total_time_minutes: recipe.total_time_minutes ?? null,
    },
    mode,
    customInstructions,
  );
}
