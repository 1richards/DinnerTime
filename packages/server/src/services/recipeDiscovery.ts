import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import type { ParsedIngredient, ParsedRecipe } from './recipeParser.js';
import { normalizeServings } from './recipeServings.js';
import { sanitizeRecipeTextFields } from './recipeTextSanitizer.js';

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
  /**
   * Force an exact recipe count. When set, overrides the cuisine-derived
   * default and instructs the model to return exactly this many recipes.
   * Used by the "Show me more ideas" load-more action (count: 2) to keep
   * each incremental fetch fast.
   */
  count?: number;
  /**
   * Additional titles to avoid beyond `existingTitles`. The load-more flow
   * passes the recipes already on screen (which aren't saved to the library
   * yet) so the next batch is genuinely new, not a repeat of visible cards.
   */
  excludeTitles?: string[];
  /**
   * Phase 29 (D1) — OPT-IN lightweight generation. When true, the generation
   * schema/prompt DROPS the heavy `ingredients[]` (full objects) and `steps[]`
   * from the REQUIRED set (the ~29s cost driver) and instead requests a cheap
   * `ingredient_names: string[]` (bare names, for the pantry-match badge). The
   * full ingredients + steps are hydrated in the background afterward.
   *
   * CRITICAL: this is OPT-IN. The default (undefined/false) path stays
   * BYTE-IDENTICAL to today so the currently-shipped app — which expects full
   * recipes — keeps working when the server deploys ahead of the EAS build.
   */
  light?: boolean;
}

// ---------- Tool Definition ----------

interface SuggestRecipesOutput {
  recipes: Array<
    Partial<ParsedRecipe> & {
      ingredients?: ParsedIngredient[];
      steps?: string[];
      ingredient_names?: string[];
      difficulty?: 'easy' | 'medium' | 'hard';
      practiced_skills?: string[];
      skill_note?: string;
    }
  >;
}

// Shared scalar/cheap properties present in BOTH the full and light schemas.
// Extracted so the two variants can't drift on the fields the cards render.
const COMMON_RECIPE_PROPERTIES: Record<string, JsonSchema> = {
  title: { type: 'string', description: 'Recipe title' },
  description: {
    type: 'string',
    description: 'Short 1-2 sentence description',
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
};

// Heavy properties — full ingredient objects + ordered steps. These are the
// ~29s cost driver and are present ONLY in the full schema.
const HEAVY_INGREDIENTS_PROPERTY: JsonSchema = {
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
};

const HEAVY_STEPS_PROPERTY: JsonSchema = {
  type: 'array',
  items: { type: 'string' },
  description: 'Ordered cooking steps',
};

// Light replacement for the heavy ingredients list: bare names only, NOT
// required. Cheap to generate and enough for the pantry-match badge (D1a).
const LIGHT_INGREDIENT_NAMES_PROPERTY: JsonSchema = {
  type: 'array',
  items: { type: 'string' },
  description:
    'Bare ingredient names only — no quantities/units. Used for the pantry-match badge.',
};

/**
 * Build the `suggest_recipes` tool schema. Exported for testing.
 *
 * - `light === false` (DEFAULT): BYTE-IDENTICAL to the pre-Phase-29 schema —
 *   heavy `ingredients[]` + `steps[]` properties present and REQUIRED.
 * - `light === true`: drops the heavy `ingredients`/`steps` properties, drops
 *   them from `required`, and adds a cheap `ingredient_names: string[]`
 *   (NOT required). Keeps title/difficulty/practiced_skills required.
 */
export function buildSuggestRecipesSchema(light: boolean): JsonSchema {
  if (light) {
    return {
      type: 'object',
      properties: {
        recipes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...COMMON_RECIPE_PROPERTIES,
              ingredient_names: LIGHT_INGREDIENT_NAMES_PROPERTY,
            },
            required: ['title', 'difficulty', 'practiced_skills'],
          },
        },
      },
      required: ['recipes'],
    };
  }

  return {
    type: 'object',
    properties: {
      recipes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: COMMON_RECIPE_PROPERTIES.title,
            description: COMMON_RECIPE_PROPERTIES.description,
            ingredients: HEAVY_INGREDIENTS_PROPERTY,
            steps: HEAVY_STEPS_PROPERTY,
            prep_time_minutes: COMMON_RECIPE_PROPERTIES.prep_time_minutes,
            cook_time_minutes: COMMON_RECIPE_PROPERTIES.cook_time_minutes,
            total_time_minutes: COMMON_RECIPE_PROPERTIES.total_time_minutes,
            servings: COMMON_RECIPE_PROPERTIES.servings,
            difficulty: COMMON_RECIPE_PROPERTIES.difficulty,
            practiced_skills: COMMON_RECIPE_PROPERTIES.practiced_skills,
            skill_note: COMMON_RECIPE_PROPERTIES.skill_note,
            calories_per_serving: COMMON_RECIPE_PROPERTIES.calories_per_serving,
            protein_grams_per_serving:
              COMMON_RECIPE_PROPERTIES.protein_grams_per_serving,
          },
          required: ['title', 'ingredients', 'steps', 'difficulty', 'practiced_skills'],
        },
      },
    },
    required: ['recipes'],
  };
}

const suggestRecipesSchema: JsonSchema = buildSuggestRecipesSchema(false);

/**
 * Build the `suggest_recipes` tool. In light mode the description signals the
 * model that previews (no ingredients/steps) are expected.
 */
function buildSuggestRecipesTool(
  light: boolean,
): StructuredTool<SuggestRecipesOutput> {
  return {
    name: 'suggest_recipes',
    description: light
      ? 'Suggest dinner recipe PREVIEWS (no ingredients/steps) tailored to the household preferences. Return title, description, times, servings, difficulty, skills, nutrition, and a bare ingredient_names list.'
      : 'Suggest dinner recipes tailored to the household preferences. Return a list of full recipes with ingredients and steps.',
    schema: buildSuggestRecipesSchema(light),
  };
}

export const suggestRecipesTool: StructuredTool<SuggestRecipesOutput> =
  buildSuggestRecipesTool(false);

// ---------- Prompt Assembly ----------

/**
 * Build the system prompt for recipe discovery. Pure function, exported for
 * testing. Mirrors the HARD CONSTRAINTS / SOFT PREFERENCES structure used by
 * Phase 4 suggestions so allergies are always treated as absolute blocks.
 */
export function buildDiscoveryPrompt(
  preferences: DiscoveryPreferences,
  existingTitles?: string[],
  pantryManifest?: string[],
  /**
   * Exact recipe count requested by the caller. When set, the count is
   * authoritative: the per-cuisine "at least one of each" guarantee is
   * dropped (it would otherwise force more recipes than asked for) and an
   * explicit hard count line is added. Undefined = legacy behavior (the
   * /discover D-07 path passes nothing and stays byte-identical).
   */
  count?: number,
  /**
   * Phase 29 (D1) — OPT-IN lightweight mode. When true, the full-detail
   * "Return full recipes with structured ingredients ... and ordered steps"
   * instruction is SKIPPED and replaced with a short "previews only" line that
   * asks for a bare `ingredient_names` list instead. Default (false) is
   * byte-identical to today.
   */
  light = false
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
      ? count != null
        ? // Exact-count path (load-more): keep the cuisine preference but
          // DROP the per-cuisine "at least one of each" requirement, which
          // would otherwise force the model to exceed the requested count.
          `- Preferred cuisines: ${cuisines.join(', ')} — strongly prefer these, but do not pad the count to cover every cuisine.`
        : `- Preferred cuisines: ${cuisines.join(', ')} — strongly prefer these. When feasible, include AT LEAST ONE recipe from EACH listed cuisine before filling remaining slots with others or repeats.`
      : '- Open to any cuisine'
  );

  if (count != null) {
    lines.push('');
    lines.push(
      `OUTPUT COUNT (strict): return EXACTLY ${count} recipe${count === 1 ? '' : 's'} — no more, no fewer. This overrides any cuisine-coverage preference above.`
    );
  }

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
  lines.push('NUTRITION (per serving — populate for every recipe):');
  lines.push(
    '- calories_per_serving: integer kcal estimate from ingredients + quantities. Reasonable home-cooked dinner range is ~300-900 kcal. Round to nearest 10.'
  );
  lines.push(
    '- protein_grams_per_serving: integer or 1-decimal grams. Use ingredient nutrition (chicken ~25g/100g, beef ~26g/100g, fish ~22g/100g, eggs ~6g each, tofu ~8g/100g, beans ~7g/100g cooked) + serving math. Don\'t omit — make a best estimate.'
  );

  lines.push('');
  if (light) {
    // Phase 29 (D1): lightweight previews. Skip the heavy full-recipe
    // instruction entirely — the model returns scalar card fields + a bare
    // ingredient_names list; full ingredients/steps hydrate in the background.
    lines.push(
      'Return LIGHTWEIGHT previews — title, description, times, servings, difficulty, skills, nutrition, and a bare `ingredient_names` list (names only, no quantities or units). Do NOT generate quantities, units, or steps. Each recipe MUST have servings >= 4 — DinnerTime is built for households.'
    );
  } else {
    lines.push(
      'Return full recipes with structured ingredients (name, quantity, unit, notes) and ordered steps. Convert fractions to decimals for quantities. Each recipe MUST have servings >= 4 — DinnerTime is built for households, scale ingredient quantities accordingly.'
    );
  }

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
  // Merge the not-yet-saved on-screen titles into the avoid list so a
  // load-more batch never repeats a card the user is already looking at.
  const avoidTitles = [
    ...(opts.existingTitles ?? []),
    ...(opts.excludeTitles ?? []),
  ];
  const light = opts.light === true;
  const system = buildDiscoveryPrompt(
    opts.preferences,
    avoidTitles,
    opts.pantryManifest,
    opts.count,
    light
  );
  // Give the AI room to honor the per-cuisine guarantee in the system
  // prompt. 2-recipe headroom over the cuisine count lets the AI mix in
  // variety beyond the per-cuisine minimum.
  const cuisineCount = opts.preferences.cuisine_preferences?.length ?? 0;
  // Decision 5 / Fix 4a: initial batch 3 (was 6). The remaining recipes
  // lazy-append via the existing load-more path
  // (suggestionsStore.appendSearchResults, count:2). Floor 3 keeps
  // zero-cuisine users on a sane minimum; 2-recipe headroom over cuisine
  // count preserved.
  const defaultCount = Math.max(3, cuisineCount + 2);
  // Preserve the exact pre-existing default behavior when no explicit count
  // is requested (note: opts.prompt === '' stays '' — pantry-only initial
  // load relies on the system prompt for count). When count IS set, make it
  // authoritative with an explicit exact-N instruction.
  const defaultUserPrompt = opts.prompt ?? `Suggest ${defaultCount} dinner recipes.`;
  const userPrompt = opts.count
    ? `${
        opts.prompt && opts.prompt.trim().length > 0
          ? opts.prompt
          : `Suggest ${opts.count} dinner recipes.`
      }\n\nReturn EXACTLY ${opts.count} recipe${opts.count === 1 ? '' : 's'} — no more, no fewer.`
    : defaultUserPrompt;

  const ai = getClientFor('recipe.discovery');
  const { recipes } = await ai.generateStructured({
    system,
    user: userPrompt,
    // Phase 29 (D1): in light mode the tool schema drops the heavy
    // ingredients/steps from required and swaps in a cheap ingredient_names
    // list. Default path uses the byte-identical full tool.
    tool: light ? buildSuggestRecipesTool(true) : suggestRecipesTool,
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

    // Phase 29 (D1): in light mode the model returns bare `ingredient_names`
    // (no quantities/units) and NO steps. Map names into the ParsedRecipe
    // ingredient shape so the existing card + save flow holds; steps stay [].
    // In full mode, keep the existing heavy `ingredients`/`steps` behavior
    // EXACTLY (byte-identical default path).
    const rawNames = (r as { ingredient_names?: unknown }).ingredient_names;
    const sourceIngredients: ParsedIngredient[] = light
      ? (Array.isArray(rawNames) ? rawNames : [])
          .filter(
            (n: unknown) => typeof n === 'string' || typeof n === 'number',
          )
          .map((n: unknown) => ({
            name: String(n),
            quantity: null,
            unit: null,
            notes: null,
          }))
      : ((r.ingredients as ParsedIngredient[]) ?? []);
    const sourceSteps: string[] = light ? [] : ((r.steps as string[]) ?? []);

    // Defend against Gemini-preview degeneration leaking CJK filler tokens
    // (调整/碎/块/条) into English recipe text — scrub before returning so
    // garbage is never persisted. See services/recipeTextSanitizer.ts.
    const { value: cleaned, changed } = sanitizeRecipeTextFields({
      title: (r.title as string) || 'Untitled Recipe',
      description: (r.description as string | null | undefined) ?? null,
      ingredients: sourceIngredients,
      steps: sourceSteps,
    });
    if (changed) {
      console.warn(
        `[recipeDiscovery] stripped non-Latin contamination from discovered recipe "${cleaned.title}"`,
      );
    }

    return {
      title: cleaned.title || 'Untitled Recipe',
      description: cleaned.description ?? null,
      ingredients: (cleaned.ingredients as ParsedIngredient[]) ?? [],
      steps: (cleaned.steps as string[]) ?? [],
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
