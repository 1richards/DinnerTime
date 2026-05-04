import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import type { ParsedIngredient, ParsedRecipe } from './recipeParser.js';
import { normalizeServings } from './recipeServings.js';

// Quick-task 6 — Canonical 8-key practiced-skill taxonomy.
//
// MUST stay byte-identical to apps/mobile/src/components/plan/FocusPickerSheet.tsx
// FOCUS_OPTIONS keys. The matching-focus chip on Plan day cards compares
// entry.practiced_skills against meal_plans.focus_theme using lowercase
// equality, so any drift between server allowlist and mobile picker would
// silently break the chip.
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

/**
 * Filter an unknown input to the 8-key allowlist. Drops invalid keys
 * silently (don't fail the whole recipe — Claude occasionally invents
 * "wok / stir-fry" when the canonical key is "stir-frying"). Returns
 * null when nothing survives the filter (so DB stores a clean null
 * instead of an empty array, matching legacy-row rendering).
 */
export function validatePracticedSkills(
  input: unknown,
): PracticedSkill[] | null {
  if (!Array.isArray(input)) return null;
  const allow = new Set<string>(PRACTICED_SKILLS);
  const seen = new Set<string>();
  const out: PracticedSkill[] = [];
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const lc = raw.trim().toLowerCase();
    if (!allow.has(lc)) continue;
    if (seen.has(lc)) continue;
    seen.add(lc);
    out.push(lc as PracticedSkill);
    if (out.length === 3) break; // cap at 3 — matches schema.maxItems
  }
  return out.length > 0 ? out : null;
}

// ---------- Types ----------

/**
 * Flattened preferences shape used by the discovery prompt.
 *
 * In the route layer, this is assembled from `household_members` (allergies,
 * dietary_restrictions, disliked_ingredients -- deduped across members) and
 * `profiles.cuisine_preferences`. Keeping it flat makes the service
 * trivially testable without needing to mock Supabase.
 */
export interface DiscoveryPreferences {
  allergies: string[];
  dietary_restrictions: string[];
  disliked_ingredients: string[];
  cuisine_preferences: string[];
}

export interface DiscoverRecipesOptions {
  preferences: DiscoveryPreferences;
  existingTitles?: string[];
  prompt?: string;
  /**
   * Phase 17 (P17-04): when provided and non-empty, constrains the AI to
   * only suggest recipes that are 100% feasible from these pantry items
   * (plus common staples: salt, pepper, water, oil). Empty/undefined =
   * no constraint. Server route POST /recipes/search populates this
   * from `pantry_items` (status='available', confidence desc, capped at 50).
   */
  pantryManifest?: string[];
}

// ---------- Tool Definition ----------

interface SuggestRecipesOutput {
  recipes: Array<
    Partial<ParsedRecipe> & {
      ingredients?: ParsedIngredient[];
      steps?: string[];
      difficulty?: 'easy' | 'medium' | 'hard';
      practiced_skills?: string[];
      skill_note?: string;
    }
  >;
}

const suggestRecipesSchema: JsonSchema = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Recipe title' },
          description: {
            type: 'string',
            description: 'Short 1-2 sentence description',
          },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                notes: { type: 'string' },
              },
              required: ['name'],
            },
          },
          steps: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ordered cooking steps',
          },
          prep_time_minutes: { type: 'number' },
          cook_time_minutes: { type: 'number' },
          total_time_minutes: { type: 'number' },
          servings: { type: 'number' },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description:
              "Tier based on technique count + active cook time + ingredient count. easy=≤30min, basic technique. medium=30-60min OR one new technique. hard=>60min OR multiple advanced techniques (braise, lamination, fermentation).",
          },
          practiced_skills: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'knife skills',
                'pan sauces',
                'braising',
                'stir-frying',
                'plant-forward',
                'pasta from scratch',
                'global flavors',
                'baking & breads',
              ],
            },
            minItems: 1,
            maxItems: 3,
            description:
              "1-3 skills this recipe genuinely exercises. Pick from the EXACT 8-key list — do not invent new keys.",
          },
          skill_note: {
            type: 'string',
            description:
              "One short line (≤120 chars) explaining the technique payoff, e.g. 'Practices fond → reduction → mounted butter'. Optional — omit when there's no specific technique to call out.",
          },
          calories_per_serving: {
            type: 'number',
            description:
              'Estimated kcal per serving. Best-effort from ingredient list and quantities — omit if uncertain.',
          },
          protein_grams_per_serving: {
            type: 'number',
            description:
              'Estimated grams of protein per serving (whole or 1-decimal). Omit if uncertain.',
          },
        },
        required: ['title', 'ingredients', 'steps', 'difficulty', 'practiced_skills'],
      },
    },
  },
  required: ['recipes'],
};

export const suggestRecipesTool: StructuredTool<SuggestRecipesOutput> = {
  name: 'suggest_recipes',
  description:
    'Suggest dinner recipes tailored to the household preferences. Return a list of full recipes with ingredients and steps.',
  schema: suggestRecipesSchema,
};

// ---------- Prompt Assembly ----------

/**
 * Build the system prompt for recipe discovery. Pure function, exported for
 * testing. Mirrors the HARD CONSTRAINTS / SOFT PREFERENCES structure used by
 * Phase 4 suggestions so allergies are always treated as absolute blocks.
 */
export function buildDiscoveryPrompt(
  preferences: DiscoveryPreferences,
  existingTitles?: string[],
  pantryManifest?: string[]
): string {
  const allergies = preferences.allergies ?? [];
  const restrictions = preferences.dietary_restrictions ?? [];
  const dislikes = preferences.disliked_ingredients ?? [];
  const cuisines = preferences.cuisine_preferences ?? [];

  const lines: string[] = [];
  lines.push(
    'You are a recipe discovery assistant. Suggest dinner recipes tailored to the household below.'
  );
  lines.push('');
  lines.push('HARD CONSTRAINTS (NEVER violate):');
  if (allergies.length > 0) {
    lines.push(
      `- Allergies: ${allergies.join(', ')} -- absolutely no recipes containing these`
    );
  } else {
    lines.push('- No allergies');
  }
  lines.push('');
  lines.push('SOFT PREFERENCES:');
  lines.push(
    restrictions.length > 0
      ? `- Dietary preferences: ${restrictions.join(', ')}`
      : '- No specific dietary preferences'
  );
  lines.push(
    dislikes.length > 0
      ? `- Disliked ingredients: ${dislikes.join(', ')} -- try to avoid`
      : '- No disliked ingredients'
  );
  lines.push(
    cuisines.length > 0
      ? `- Preferred cuisines: ${cuisines.join(', ')}`
      : '- Open to any cuisine'
  );

  if (existingTitles && existingTitles.length > 0) {
    lines.push('');
    lines.push('AVOID suggesting recipes similar to these already in the library:');
    for (const title of existingTitles) {
      lines.push(`- ${title}`);
    }
  }

  // Phase 17 (P17-04): optional pantry constraint. Only render when the
  // caller supplies a non-empty manifest -- the /discover route passes
  // nothing here and must stay byte-exact (D-07 lock).
  if (pantryManifest && pantryManifest.length > 0) {
    lines.push('');
    lines.push('PANTRY CONSTRAINT (HARD):');
    lines.push('- Only suggest recipes that are 100% feasible using ONLY these pantry items:');
    for (const name of pantryManifest) {
      lines.push(`  - ${name}`);
    }
    lines.push('- Common pantry staples (salt, pepper, water, oil) can be assumed available.');
    lines.push(
      '- If you cannot find 4+ recipes that fit this constraint, return fewer recipes rather than violate it.'
    );
  }

  // Quick-task 6 — Skill scaffolding. Every recipe is tagged with a
  // difficulty tier, 1-3 practiced skills (taxonomy-bound to the same
  // 8-key set the FocusPickerSheet uses), and an optional one-line
  // technique note. The mobile UI consumes these for chip rendering on
  // Plan day cards + Recipe detail.
  lines.push('');
  lines.push('SKILL TAGGING (every recipe MUST tag these):');
  lines.push(
    '- difficulty: pick "easy" | "medium" | "hard". easy = ≤30min, basic technique. medium = 30-60min OR one new technique. hard = >60min OR advanced technique (braise, fresh pasta, lamination).'
  );
  lines.push(
    '- practiced_skills: 1-3 keys from EXACTLY this set: knife skills, pan sauces, braising, stir-frying, plant-forward, pasta from scratch, global flavors, baking & breads. Match what the recipe genuinely exercises — don\'t tag "knife skills" on something that\'s just chop-and-toss.'
  );
  lines.push(
    '- skill_note: optional one-line explanation of the technique payoff (e.g. "Practices fond → reduction → mounted butter"). Omit when there\'s no specific technique to call out.'
  );

  lines.push('');
  lines.push(
    'Return full recipes with structured ingredients (name, quantity, unit, notes) and ordered steps. Convert fractions to decimals for quantities. Each recipe MUST have servings >= 4 — DinnerTime is built for households, scale ingredient quantities accordingly.'
  );

  return lines.join('\n');
}

// ---------- Main Service ----------

/**
 * Generate a list of ParsedRecipe-shaped discoveries using the AIClient with
 * the `suggest_recipes` tool. Always stamps `source_type: 'ai'` and leaves
 * `source_url` / `image_url` null -- discovered recipes have no canonical URL
 * until the user explicitly saves them.
 */
export async function discoverRecipes(
  opts: DiscoverRecipesOptions
): Promise<ParsedRecipe[]> {
  const system = buildDiscoveryPrompt(
    opts.preferences,
    opts.existingTitles,
    opts.pantryManifest
  );
  const userPrompt = opts.prompt ?? 'Suggest 6 dinner recipes.';

  const ai = getClientFor('recipe.discovery');
  const { recipes } = await ai.generateStructured({
    system,
    user: userPrompt,
    tool: suggestRecipesTool,
    // 8192 (was 4096) — adding nutrition fields per recipe × 6 recipes
    // can push response past 4096, same gemini-no-functionCall pattern
    // we hit on mealPlanner. Generous headroom.
    maxTokens: 8192,
  });

  return (recipes ?? []).map((r) => {
    // Quick-task 6 — pass skill fields through. validatePracticedSkills
    // drops anything outside the 8-key allowlist (silent — don't fail
    // the whole recipe over a single bad key); skill_note is capped at
    // 200 chars defensively.
    const rawDifficulty = r.difficulty as unknown;
    const difficulty: 'easy' | 'medium' | 'hard' | null =
      rawDifficulty === 'easy' || rawDifficulty === 'medium' || rawDifficulty === 'hard'
        ? rawDifficulty
        : null;
    const practicedSkills = validatePracticedSkills(
      (r as { practiced_skills?: unknown }).practiced_skills,
    );
    const rawSkillNote = (r as { skill_note?: unknown }).skill_note;
    const skillNote =
      typeof rawSkillNote === 'string' && rawSkillNote.trim().length > 0
        ? rawSkillNote.slice(0, 200)
        : null;

    return {
      title: (r.title as string) || 'Untitled Recipe',
      description: (r.description as string | null | undefined) ?? null,
      ingredients: (r.ingredients as ParsedIngredient[]) ?? [],
      steps: (r.steps as string[]) ?? [],
      prep_time_minutes: (r.prep_time_minutes as number | null | undefined) ?? null,
      cook_time_minutes: (r.cook_time_minutes as number | null | undefined) ?? null,
      total_time_minutes: (r.total_time_minutes as number | null | undefined) ?? null,
      servings: normalizeServings(r.servings as number | null | undefined),
      source_url: null,
      source_type: 'ai' as ParsedRecipe['source_type'],
      image_url: null,
      calories_per_serving:
        typeof r.calories_per_serving === 'number'
          ? (r.calories_per_serving as number)
          : null,
      protein_grams_per_serving:
        typeof r.protein_grams_per_serving === 'number'
          ? (r.protein_grams_per_serving as number)
          : null,
      fat_grams_per_serving: null,
      difficulty,
      practiced_skills: practicedSkills,
      skill_note: skillNote,
    };
  });
}
