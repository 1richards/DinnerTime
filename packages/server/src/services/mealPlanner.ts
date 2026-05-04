import type { SupabaseClient } from '@supabase/supabase-js';
import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import type { Difficulty, MealPlan, MealPlanEntry, MealPlanIngredient } from '../types/mealPlan.js';
import { matchIngredientsToPantry } from './ingredientMatching.js';
import type { PantryItem } from './pantry.js';
import { getCookStats, logRecipeCook } from './progression.js';
import {
  PRACTICED_SKILLS,
  validatePracticedSkills,
} from './recipeDiscovery.js';
import { normalizeServings } from './recipeServings.js';

// ---------- Context Types ----------

export interface MealPlanPantryItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface MealPlanPreferences {
  allergies: string[];
  restrictions: string[];
  cuisines: string[];
  dislikes: string[];
  kidFriendlyNeeded: boolean;
  householdSize: number;
}

export interface RecipeLibraryEntry {
  id: string;
  title: string;
}

export interface MealPlanContext {
  pantryItems: MealPlanPantryItem[];
  preferences: MealPlanPreferences;
  recipeLibrary: RecipeLibraryEntry[];
  recentMealTitles: string[];
  weekStart: string;
  // ---- Phase 22-05 extensions ----
  /**
   * Phase 22-05: derived skill tier (1=novice, 2=comfortable, 3=confident).
   * Inferred server-side via deriveSkillTier(cookStats). When tier < 2 the
   * prompt is gated to avoid hard-difficulty recipes and >60-min estimates.
   */
  skillTier?: 1 | 2 | 3;
  /**
   * Phase 22-05: optional weekly skill-focus theme (e.g. "knife skills",
   * "pan sauces"). Free-form text read from meal_plans.focus_theme when a
   * plan row exists for the target week_start. Generator nudges Claude to
   * include ≥2 recipes exercising the theme.
   */
  focusTheme?: string | null;
}

// ---------- Prompt Assembly ----------

/**
 * Build a structured prompt for the AI client to generate a 7-day meal plan.
 * Pure function, exported for testing.
 */
export function buildMealPlanPrompt(context: MealPlanContext): string {
  const {
    pantryItems,
    preferences,
    recipeLibrary,
    recentMealTitles,
    weekStart,
    skillTier,
    focusTheme,
  } = context;

  const ingredientsBlock = pantryItems
    .map((item) => `- ${item.name} (${item.quantity} ${item.unit}, ${item.category})`)
    .join('\n');

  const allergies = preferences.allergies ?? [];
  const restrictions = preferences.restrictions ?? [];
  const dislikes = preferences.dislikes ?? [];
  const cuisines = preferences.cuisines ?? [];

  const hardBlock = [
    allergies.length > 0
      ? `- Allergies: ${allergies.join(', ')} -- NEVER include these ingredients`
      : '- No allergies',
    dislikes.length > 0 ? `- Disliked ingredients: ${dislikes.join(', ')} -- avoid these` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const softBlock = [
    restrictions.length > 0
      ? `- Dietary preferences: ${restrictions.join(', ')}`
      : '- No specific dietary preferences',
    cuisines.length > 0 ? `- Preferred cuisines: ${cuisines.join(', ')}` : '- Open to any cuisine',
  ].join('\n');

  const recipeLibraryBlock =
    recipeLibrary.length > 0
      ? recipeLibrary.map((r) => `- ${r.title} (id: ${r.id})`).join('\n')
      : '(none)';

  const avoidBlock =
    recentMealTitles.length > 0 ? recentMealTitles.map((t) => `- ${t}`).join('\n') : '(none)';

  const kidRule = preferences.kidFriendlyNeeded
    ? '- At least 3 of 7 nights must be kid_friendly=true (familiar flavors, simple textures for children)'
    : '';

  // Phase 22-05: skill-tier gate. Tier 1 (<5 lifetime cooks) avoids hard
  // recipes + long estimates so novices don't get demotivated by unreachable
  // week plans. Tier 2/3 lifts the gate. When unspecified (existing callers
  // that pre-date 22-05) default to tier 2 (the "comfortable" baseline).
  const effectiveSkillTier = skillTier ?? 2;
  const tierGateLine =
    effectiveSkillTier < 2
      ? "- Avoid recipes with difficulty='hard' or estimated_time > 60. User is still building basics."
      : '';
  // Always emit the SKILL TIER line so downstream Claude calls can condition
  // on it even if the gate text is absent (tier >= 2 still affects phrasing).
  const skillBlock = `SKILL TIER: ${effectiveSkillTier}${tierGateLine ? `\n${tierGateLine}` : ''}`;

  // Phase 22-05: focus theme. Optional weekly nudge — when set, the
  // generator is asked to include ≥2 recipes exercising the theme and name
  // it in each recipe's `why_suggested`. Empty string is treated as absent.
  //
  // Hard guardrails to prevent the "test-style title" failure mode users
  // reported (titles like "Knife Skills: Recipe 1" or literal placeholders):
  //   1. Title must be a real, named dish — never echo the theme back as
  //      the title.
  //   2. Examples baked in so the model has a shape to imitate.
  //   3. Repeat the OUTPUT CONTRACT title rule so the theme block can't
  //      override it.
  //
  // Quick-task 6 — when focusTheme matches one of the 8-key taxonomy keys,
  // additionally require ≥2 themed recipes to include that key in their
  // practiced_skills array, so the matching-focus chip on Plan day cards
  // actually fires for the user's chosen focus.
  const themeKeyLc =
    typeof focusTheme === 'string' ? focusTheme.trim().toLowerCase() : '';
  const themeMatchesTaxonomy = (PRACTICED_SKILLS as readonly string[]).includes(
    themeKeyLc,
  );
  const themeTaggingHint = themeMatchesTaxonomy
    ? `\n- At least 2 themed recipes MUST include "${themeKeyLc}" in their practiced_skills array so the user can see the theme practiced day-by-day.`
    : '';
  const focusBlock =
    typeof focusTheme === 'string' && focusTheme.length > 0
      ? `

THIS WEEK'S THEME: ${focusTheme}.
- Include at least 2 dinner recipes that genuinely exercise this skill.
- Mention the theme in each themed recipe's why_suggested ("Practices ${focusTheme} via …").
- TITLES MUST BE REAL DISHES. Never name a recipe "${focusTheme}", "Recipe 1", "Test Pasta", "${focusTheme} Practice", or any placeholder. Use a specific dish name a person could Google (e.g. "Beef Bourguignon", "Cacio e Pepe", "Sheet-pan Harissa Salmon").${themeTaggingHint}`
      : '';

  // Quick-task 6 — Skill scaffolding block (mirrors recipeDiscovery's
  // SKILL TAGGING copy). Surfaces difficulty + practiced_skills + skill_note
  // on every plan-entry recipe so the Plan day card can show difficulty
  // chips and matching-focus chips, and Recipe detail can show the
  // "Skills practiced" card after the user opens an entry.
  const skillTaggingBlock = `
SKILL TAGGING (every recipe MUST tag these):
- difficulty: pick "easy" | "medium" | "hard". easy = ≤30min, basic technique. medium = 30-60min OR one new technique. hard = >60min OR advanced technique (braise, fresh pasta, lamination).
- practiced_skills: 1-3 keys from EXACTLY this set: knife skills, pan sauces, braising, stir-frying, plant-forward, pasta from scratch, global flavors, baking & breads. Match what the recipe genuinely exercises — don't tag "knife skills" on something that's just chop-and-toss.
- skill_note: optional one-line explanation of the technique payoff (e.g. "Practices fond → reduction → mounted butter"). Omit when there's no specific technique to call out.`;

  return `Generate a 7-day dinner meal plan for the week starting ${weekStart}.

AVAILABLE PANTRY:
${ingredientsBlock}

HOUSEHOLD:
- ${preferences.householdSize} members

HARD CONSTRAINTS (NEVER violate):
${hardBlock}

SOFT PREFERENCES:
${softBlock}

RECIPE LIBRARY (prefer these when they fit; set recipe_id to the matching id):
${recipeLibraryBlock}

AVOID REPEATING (recently cooked -- do NOT repeat these titles):
${avoidBlock}

WEEK STRUCTURE:
- Mon-Thu = weeknight simpler (15-30 min, easy difficulty, low effort)
- Fri-Sun = weekend ambitious allowed (longer cook times, medium/hard difficulty, projects OK)
${kidRule}

${skillBlock}${focusBlock}
${skillTaggingBlock}

OUTPUT CONTRACT:
- Return EXACTLY 7 days, one per day_of_week (0..6, 0=Monday, 6=Sunday)
- Each day MUST be a complete, cookable recipe — title + description + structured ingredients (with quantities) + at least 3 ordered cooking steps + prep_time_minutes + cook_time_minutes + servings (>= 4, recipes are sized for households). Not a sketch, a real recipe a person can follow start to finish.
- Each entry must include complexity_target ('weeknight' for Mon-Thu, 'weekend' for Fri-Sun)
- Set recipe_id from RECIPE LIBRARY when a listed recipe is reused; otherwise null
- Populate ingredients with the FULL recipe (everything the dish needs) and ingredients_needed with just the names not in AVAILABLE PANTRY
- Prefer pantry items to minimize shopping
- Vary cuisines and cooking methods across the week`;
}

// ---------- Tool Definition ----------

const generateMealPlanSchema: JsonSchema = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day_of_week: {
            type: 'string',
            enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
            description: 'Day of week (mon=0 through sun=6)',
          },
          title: {
            type: 'string',
            description:
              'Concrete dish name a person could Google (e.g. "Cacio e Pepe", "Beef Bourguignon"). NEVER a placeholder like "Test Pasta", "Recipe 1", or the literal week theme.',
          },
          description: { type: 'string', description: '1-2 sentence description' },
          recipe_id: {
            type: 'string',
            description: 'Matching recipe_id from RECIPE LIBRARY, or omit for new dish',
          },
          ingredients: {
            type: 'array',
            description:
              'Full structured ingredient list with quantities. Convert fractions to decimals (e.g. 0.5 not 1/2).',
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
          ingredients_needed: {
            type: 'array',
            items: { type: 'string' },
            description: 'Item names not in pantry that must be bought',
          },
          steps: {
            type: 'array',
            description:
              'Ordered cooking steps a home cook can follow start to finish. NOT optional — every recipe must include at least 3 steps.',
            items: { type: 'string' },
          },
          prep_time_minutes: { type: 'number', description: 'Active prep time in minutes' },
          cook_time_minutes: { type: 'number', description: 'Inactive cook time in minutes' },
          estimated_time_minutes: {
            type: 'number',
            description: 'Total time = prep + cook',
          },
          servings: {
            type: 'number',
            description:
              'Number of servings the recipe yields. MUST be at least 4 — DinnerTime targets households, not single portions. Scale ingredient quantities accordingly.',
          },
          difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
          complexity_target: {
            type: 'string',
            enum: ['weeknight', 'weekend'],
            description: "weeknight for Mon-Thu, weekend for Fri-Sun",
          },
          kid_friendly: { type: 'boolean' },
          why_suggested: { type: 'string' },
          // Quick-task 6 — skill scaffolding. Bound to the same 8-key
          // taxonomy as FocusPickerSheet so the matching-focus chip on
          // Plan day cards can render reliably.
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
              "Optional one-line technique payoff (≤120 chars). Omit when there's no specific technique to call out.",
          },
          // Quick task 12 — per-serving nutrition. Mirrors the recipes table
          // (migration 00033) and the parse_recipe tool's existing fields. Both
          // optional — Claude omits when it can't estimate confidently.
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
        required: [
          'day_of_week',
          'title',
          'description',
          'ingredients',
          'steps',
          'estimated_time_minutes',
          'difficulty',
          'complexity_target',
          'kid_friendly',
          'why_suggested',
          'practiced_skills',
        ],
      },
    },
  },
  required: ['days'],
};

export const generateMealPlanTool: StructuredTool<{ days: ClaudeMealDay[] }> = {
  name: 'generate_meal_plan',
  description:
    'Generate a 7-day dinner meal plan (one entry per day Mon-Sun) from pantry, preferences, and recipe library.',
  schema: generateMealPlanSchema,
};

// ---------- DB Row Types (narrow) ----------

interface PantryRow {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  status: string;
}

interface HouseholdMemberRow {
  member_type: 'adult' | 'kid' | string;
  dietary_restrictions: string[] | null;
  dietary_allergies: string[] | null;
  disliked_ingredients: string[] | null;
}

interface ProfileRow {
  cuisine_preferences: string[] | null;
  skill_level: string;
}

// ---------- AI Tool Output Shape ----------

interface ClaudeMealIngredient {
  name: string;
  quantity?: number;
  unit?: string;
  notes?: string;
}

interface ClaudeMealDay {
  day_of_week: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  title: string;
  description: string;
  recipe_id?: string | null;
  ingredients?: ClaudeMealIngredient[];
  ingredients_needed?: string[];
  steps?: string[];
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  estimated_time_minutes: number;
  servings?: number;
  difficulty: Difficulty;
  complexity_target: 'weeknight' | 'weekend';
  kid_friendly: boolean;
  why_suggested: string;
  // Quick-task 6 — skill scaffolding (taxonomy-bound 1-3 skills + optional note).
  practiced_skills?: string[];
  skill_note?: string;
  // Quick task 12 — per-serving nutrition (optional in tool output).
  calories_per_serving?: number;
  protein_grams_per_serving?: number;
}

const DAY_STRING_TO_INDEX: Record<ClaudeMealDay['day_of_week'], number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function dayStringToIndex(day: ClaudeMealDay['day_of_week']): number {
  return DAY_STRING_TO_INDEX[day];
}

// ---------- Main Service ----------

/**
 * Fetch context from Supabase, call the AI client via generate_meal_plan tool,
 * persist meal_plans + 7 meal_plan_entries (regenerating if one exists),
 * and return the resulting MealPlan with populated entries.
 */
export async function generateMealPlan(
  supabase: SupabaseClient,
  profileId: string,
  weekStart: string,
): Promise<MealPlan> {
  // 1. Fetch pantry (available only)
  const { data: pantryItems, error: pantryError } = await supabase
    .from('pantry_items')
    .select()
    .eq('profile_id', profileId)
    .eq('status', 'available');

  if (pantryError) {
    throw new Error(`Failed to fetch pantry items: ${pantryError.message}`);
  }

  if (!pantryItems || pantryItems.length < 3) {
    const err = new Error('EMPTY_PANTRY: Not enough pantry items to plan a week. Scan your fridge first.');
    (err as Error & { code?: string }).code = 'EMPTY_PANTRY';
    throw err;
  }

  // 2. Fetch household members
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select()
    .eq('profile_id', profileId);

  if (membersError) {
    throw new Error(`Failed to fetch household members: ${membersError.message}`);
  }

  // 3. Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('cuisine_preferences, skill_level')
    .eq('id', profileId)
    .single();

  if (profileError) {
    throw new Error(`Failed to fetch profile: ${profileError.message}`);
  }

  // 4. Fetch recipe library (cap 100)
  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('id, title')
    .eq('profile_id', profileId)
    .limit(100);

  if (recipesError) {
    throw new Error(`Failed to fetch recipe library: ${recipesError.message}`);
  }

  // 5. Fetch recent cooked meals (cap 21)
  const { data: recentMeals, error: recentError } = await supabase
    .from('meal_plan_entries')
    .select('title, cooked_at')
    .eq('status', 'cooked')
    .order('cooked_at', { ascending: false })
    .limit(21);

  if (recentError) {
    throw new Error(`Failed to fetch recent meals: ${recentError.message}`);
  }

  // 6. Assemble context
  const memberRows = (members ?? []) as HouseholdMemberRow[];
  const profileRow = profile as ProfileRow;

  const allergies = [
    ...new Set(memberRows.flatMap((m) => m.dietary_allergies ?? [])),
  ];
  const restrictions = [
    ...new Set(memberRows.flatMap((m) => m.dietary_restrictions ?? [])),
  ];
  const dislikes = [
    ...new Set(memberRows.flatMap((m) => m.disliked_ingredients ?? [])),
  ];
  const kidFriendlyNeeded = memberRows.some((m) => m.member_type === 'kid');

  // Phase 22-05: derive skill tier from lifetime cook stats. Mirrors the
  // mobile helper (apps/mobile/src/plan/skillTier.ts) so server + client
  // tier boundaries stay in lockstep: <5=1, <20=2, else 3. Best-effort —
  // getCookStats failure is non-fatal, tier defaults to 2 (comfortable).
  let skillTier: 1 | 2 | 3 = 2;
  try {
    const cookStats = await getCookStats(supabase, profileId);
    const totalCooks = cookStats.reduce((s, r) => s + r.cook_count, 0);
    skillTier = totalCooks < 5 ? 1 : totalCooks < 20 ? 2 : 3;
  } catch (e) {
    console.warn('[mealPlanner] getCookStats failed — defaulting skillTier=2', e);
  }

  // Phase 22-05: fetch the existing meal_plan row (if any) for this
  // week_start to surface focus_theme into the prompt. This intentionally
  // runs BEFORE the delete-then-insert regenerate flow below so we preserve
  // the user's focus theme across regenerations (the theme survives a wipe
  // via the re-POSTed PATCH on return trip — but for this generation pass
  // we read it now so the new plan honors the existing theme).
  let focusTheme: string | null = null;
  try {
    const { data: weekPlanRow } = await supabase
      .from('meal_plans')
      .select('focus_theme')
      .eq('profile_id', profileId)
      .eq('week_start', weekStart)
      .maybeSingle();
    if (weekPlanRow && typeof (weekPlanRow as { focus_theme?: unknown }).focus_theme === 'string') {
      focusTheme = (weekPlanRow as { focus_theme: string }).focus_theme;
    }
  } catch (e) {
    console.warn('[mealPlanner] focus_theme lookup failed — continuing without theme', e);
  }

  const context: MealPlanContext = {
    pantryItems: (pantryItems as PantryRow[]).map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      category: p.category,
    })),
    preferences: {
      allergies,
      restrictions,
      cuisines: profileRow.cuisine_preferences ?? [],
      dislikes,
      kidFriendlyNeeded,
      householdSize: memberRows.length,
    },
    recipeLibrary: (recipes ?? []) as RecipeLibraryEntry[],
    recentMealTitles: ((recentMeals ?? []) as Array<{ title: string }>).map((r) => r.title),
    weekStart,
    skillTier,
    focusTheme,
  };

  const promptText = buildMealPlanPrompt(context);

  // 7. Call AI client with tool forced. 8192 (was 4096) — quick-12 added
  // calories_per_serving + protein_grams_per_serving per entry which pushed
  // the response past 4096 mid-tool-call on full 7-day plans, causing
  // Gemini to return no functionCall part. 8192 leaves comfortable headroom.
  const { days } = await getClientFor('mealPlanner.week').generateStructured({
    user: promptText,
    tool: generateMealPlanTool,
    maxTokens: 8192,
  });

  if (!Array.isArray(days) || days.length !== 7) {
    const err = new Error(
      `INVALID_PLAN_LENGTH: AI returned ${days?.length ?? 0} days, expected exactly 7 days`,
    );
    (err as Error & { code?: string }).code = 'INVALID_PLAN_LENGTH';
    throw err;
  }

  // 8. Delete existing plan for (profile_id, week_start) if present (cascades entries)
  const { data: existingPlan, error: existingError } = await supabase
    .from('meal_plans')
    .select('id')
    .eq('profile_id', profileId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check existing meal plan: ${existingError.message}`);
  }

  if (existingPlan) {
    const { error: deleteError } = await supabase
      .from('meal_plans')
      .delete()
      .eq('id', (existingPlan as { id: string }).id);
    if (deleteError) {
      throw new Error(`Failed to delete existing meal plan: ${deleteError.message}`);
    }
  }

  // 9. Insert fresh meal_plans row
  const { data: newPlan, error: insertPlanError } = await supabase
    .from('meal_plans')
    .insert({ profile_id: profileId, week_start: weekStart })
    .select()
    .single();

  if (insertPlanError || !newPlan) {
    throw new Error(
      `Failed to insert meal plan: ${insertPlanError?.message ?? 'unknown error'}`,
    );
  }

  const newPlanRow = newPlan as { id: string; profile_id: string; week_start: string; generated_at: string; created_at: string; updated_at: string };

  // 10. Insert 7 meal_plan_entries (map day strings -> 0..6)
  //
  // recipe_id coercion: the AI may return the literal string "null", an empty
  // string, or a hallucinated UUID that isn't in the user's library. Only keep
  // IDs that match a real recipe; otherwise null. This prevents the insert
  // from failing with "invalid input syntax for type uuid: 'null'".
  const recipeLibraryIds = new Set(context.recipeLibrary.map((r) => r.id));
  const coerceRecipeId = (id: string | null | undefined): string | null => {
    if (!id || id === 'null' || id === '') return null;
    return recipeLibraryIds.has(id) ? id : null;
  };

  const entryRows = days.map((d) => ({
    meal_plan_id: newPlanRow.id,
    day_of_week: dayStringToIndex(d.day_of_week),
    recipe_id: coerceRecipeId(d.recipe_id),
    title: d.title,
    description: d.description,
    // Full structured ingredients straight from the tool. Falls back to
    // empty so an old client that doesn't return them still inserts.
    ingredients: (d.ingredients ?? []).map((ing) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      notes: ing.notes ?? null,
    })),
    ingredients_needed: (d.ingredients_needed ?? []).map((name) => ({ name })),
    steps: d.steps ?? [],
    prep_time_minutes: d.prep_time_minutes ?? null,
    cook_time_minutes: d.cook_time_minutes ?? null,
    estimated_time_minutes: d.estimated_time_minutes,
    servings: normalizeServings(d.servings),
    difficulty: d.difficulty,
    // Quick-task 6 — skill scaffolding. validatePracticedSkills filters
    // to the 8-key allowlist (silent drop for "wok / stir-fry" → null
    // when nothing survives), skill_note clamped to 200 chars.
    practiced_skills: validatePracticedSkills(d.practiced_skills),
    skill_note:
      typeof d.skill_note === 'string' && d.skill_note.trim().length > 0
        ? d.skill_note.slice(0, 200)
        : null,
    // Quick task 12 — per-serving nutrition straight from the tool.
    // Coerce to null when the AI omits OR returns a non-number; the
    // INTEGER + NUMERIC(5,1) columns reject strings.
    calories_per_serving:
      typeof d.calories_per_serving === 'number' ? d.calories_per_serving : null,
    protein_grams_per_serving:
      typeof d.protein_grams_per_serving === 'number' ? d.protein_grams_per_serving : null,
    kid_friendly: d.kid_friendly,
    why_suggested: d.why_suggested,
    status: 'planned' as const,
  }));

  const { data: insertedEntries, error: insertEntriesError } = await supabase
    .from('meal_plan_entries')
    .insert(entryRows)
    .select();

  if (insertEntriesError) {
    throw new Error(`Failed to insert meal plan entries: ${insertEntriesError.message}`);
  }

  const entries = (insertedEntries ?? entryRows) as unknown as MealPlanEntry[];

  return {
    id: newPlanRow.id,
    profile_id: newPlanRow.profile_id,
    week_start: newPlanRow.week_start,
    generated_at: newPlanRow.generated_at,
    created_at: newPlanRow.created_at,
    updated_at: newPlanRow.updated_at,
    entries,
  };
}

// ---------- regenerateDay ----------

/**
 * Regenerate a single day's meal plan entry, excluding the current title.
 * Re-fetches pantry/prefs/recipes (Pitfall 2: never use snapshot).
 */
export async function regenerateDay(
  supabase: SupabaseClient,
  profileId: string,
  planId: string,
  dayOfWeek: number,
): Promise<MealPlanEntry> {
  // 1. Load the existing entry (verify plan belongs to profile via RLS + explicit join filter)
  const { data: planCheck, error: planErr } = await supabase
    .from('meal_plans')
    .select('id, profile_id, week_start')
    .eq('id', planId)
    .eq('profile_id', profileId)
    .single();

  if (planErr || !planCheck) {
    throw new Error(`Plan not found or not owned by profile: ${planErr?.message ?? 'no data'}`);
  }

  const planInfo = planCheck as { id: string; profile_id: string; week_start: string };

  const { data: currentEntry, error: entryErr } = await supabase
    .from('meal_plan_entries')
    .select()
    .eq('meal_plan_id', planId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (entryErr || !currentEntry) {
    throw new Error(`Entry not found for day ${dayOfWeek}: ${entryErr?.message ?? 'no data'}`);
  }

  const existing = currentEntry as MealPlanEntry;
  const excludedTitle = existing.title;

  // 2. Re-fetch fresh pantry (Pitfall 2)
  const { data: pantryItems, error: pantryError } = await supabase
    .from('pantry_items')
    .select()
    .eq('profile_id', profileId)
    .eq('status', 'available');

  if (pantryError) {
    throw new Error(`Failed to fetch pantry: ${pantryError.message}`);
  }

  // 3. Re-fetch household members + profile + recipe library
  const { data: members, error: membersError } = await supabase
    .from('household_members')
    .select()
    .eq('profile_id', profileId);
  if (membersError) throw new Error(`Failed to fetch members: ${membersError.message}`);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('cuisine_preferences, skill_level')
    .eq('id', profileId)
    .single();
  if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);

  const { data: recipes, error: recipesError } = await supabase
    .from('recipes')
    .select('id, title')
    .eq('profile_id', profileId)
    .limit(100);
  if (recipesError) throw new Error(`Failed to fetch recipes: ${recipesError.message}`);

  // 4. Build scoped prompt
  const memberRows = (members ?? []) as HouseholdMemberRow[];
  const profileRow = profile as ProfileRow;
  const context: MealPlanContext = {
    pantryItems: ((pantryItems ?? []) as PantryRow[]).map((p) => ({
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
      category: p.category,
    })),
    preferences: {
      allergies: [...new Set(memberRows.flatMap((m) => m.dietary_allergies ?? []))],
      restrictions: [...new Set(memberRows.flatMap((m) => m.dietary_restrictions ?? []))],
      cuisines: profileRow.cuisine_preferences ?? [],
      dislikes: [...new Set(memberRows.flatMap((m) => m.disliked_ingredients ?? []))],
      kidFriendlyNeeded: memberRows.some((m) => m.member_type === 'kid'),
      householdSize: memberRows.length,
    },
    recipeLibrary: (recipes ?? []) as RecipeLibraryEntry[],
    recentMealTitles: [],
    weekStart: planInfo.week_start,
  };

  const basePrompt = buildMealPlanPrompt(context);
  const scopedPrompt = `${basePrompt}

REGENERATION CONTEXT:
- Replace ONLY day_of_week=${dayOfWeek} with ONE new alternative.
- EXCLUDE the current title and do NOT return it: "${excludedTitle}"
- Return the full 7-day array; we will only use the entry for day ${dayOfWeek}.`;

  // 5. Call AI client. 8192 to match the full-week generator — same shape,
  // same per-entry nutrition fields added in quick-12.
  const { days } = await getClientFor('mealPlanner.week').generateStructured({
    user: scopedPrompt,
    tool: generateMealPlanTool,
    maxTokens: 8192,
  });

  if (!Array.isArray(days) || days.length === 0) {
    throw new Error('INVALID_PLAN_LENGTH: regenerate returned no days');
  }

  // Pick the day matching dayOfWeek, or fall back to first
  const replacement =
    days.find((d) => dayStringToIndex(d.day_of_week) === dayOfWeek) ?? days[0];

  if (replacement.title === excludedTitle) {
    throw new Error(`Regeneration returned the excluded title: ${excludedTitle}`);
  }

  // 6. Update the entry row in place
  const swapLibraryIds = new Set(context.recipeLibrary.map((r) => r.id));
  const swapRecipeId =
    replacement.recipe_id && replacement.recipe_id !== 'null' && swapLibraryIds.has(replacement.recipe_id)
      ? replacement.recipe_id
      : null;
  const patch = {
    recipe_id: swapRecipeId,
    title: replacement.title,
    description: replacement.description,
    ingredients: (replacement.ingredients ?? []).map((ing) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      notes: ing.notes ?? null,
    })),
    ingredients_needed: (replacement.ingredients_needed ?? []).map((name) => ({ name })),
    steps: replacement.steps ?? [],
    prep_time_minutes: replacement.prep_time_minutes ?? null,
    cook_time_minutes: replacement.cook_time_minutes ?? null,
    estimated_time_minutes: replacement.estimated_time_minutes,
    servings: normalizeServings(replacement.servings),
    difficulty: replacement.difficulty,
    // Quick-task 6 — mirror the entryRows skill-tag mapping for single-
    // day regen so swapped days keep their difficulty + skill chips.
    practiced_skills: validatePracticedSkills(replacement.practiced_skills),
    skill_note:
      typeof replacement.skill_note === 'string' &&
      replacement.skill_note.trim().length > 0
        ? replacement.skill_note.slice(0, 200)
        : null,
    // Quick task 12 — preserve nutrition on day-swap so the chip
    // doesn't lose the value when a single day is regenerated.
    calories_per_serving:
      typeof replacement.calories_per_serving === 'number'
        ? replacement.calories_per_serving
        : null,
    protein_grams_per_serving:
      typeof replacement.protein_grams_per_serving === 'number'
        ? replacement.protein_grams_per_serving
        : null,
    kid_friendly: replacement.kid_friendly,
    why_suggested: replacement.why_suggested,
  };

  const { data: updated, error: updateError } = await supabase
    .from('meal_plan_entries')
    .update(patch)
    .eq('id', existing.id)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update entry: ${updateError?.message ?? 'no data'}`);
  }

  return updated as MealPlanEntry;
}

// ---------- markCooked ----------

export interface PantryDelta {
  pantryItemId: string;
  newQuantity: number;
  status: string;
}

export interface MarkCookedResult {
  entry: MealPlanEntry;
  pantryDelta: PantryDelta[];
}

/**
 * Mark a meal plan entry as cooked and deduct matched pantry items.
 * Idempotent: a second call on an already-cooked entry throws ALREADY_COOKED (409).
 */
export async function markCooked(
  supabase: SupabaseClient,
  profileId: string,
  planId: string,
  dayOfWeek: number,
): Promise<MarkCookedResult> {
  // 1. Load entry
  const { data: entryData, error: entryError } = await supabase
    .from('meal_plan_entries')
    .select()
    .eq('meal_plan_id', planId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (entryError || !entryData) {
    throw new Error(`Entry not found: ${entryError?.message ?? 'no data'}`);
  }

  const entry = entryData as MealPlanEntry;

  if (entry.status === 'cooked') {
    const err = new Error('ALREADY_COOKED: entry already marked as cooked') as Error & {
      code?: string;
      status?: number;
    };
    err.code = 'ALREADY_COOKED';
    err.status = 409;
    throw err;
  }

  // 2. Load pantry
  const { data: pantryRows, error: pantryError } = await supabase
    .from('pantry_items')
    .select()
    .eq('profile_id', profileId)
    .eq('status', 'available');

  if (pantryError) {
    throw new Error(`Failed to fetch pantry: ${pantryError.message}`);
  }

  const pantryItems = (pantryRows ?? []) as PantryItem[];

  // 3. Match ingredients to pantry
  const ingredients = (entry.ingredients ?? []) as MealPlanIngredient[];
  const { matches } = matchIngredientsToPantry(ingredients, pantryItems);

  // 4. Apply pantry updates
  const pantryDelta: PantryDelta[] = [];
  for (const match of matches) {
    const pantryItem = pantryItems.find((p) => p.id === match.pantryItemId);
    if (!pantryItem) continue;

    const newQuantity = Math.max(0, pantryItem.quantity - match.deductQuantity);
    const newStatus = match.willDeplete ? 'used' : 'available';

    const { error: updateError } = await supabase
      .from('pantry_items')
      .update({ quantity: newQuantity, status: newStatus })
      .eq('id', pantryItem.id);

    if (updateError) {
      throw new Error(`Failed to update pantry item ${pantryItem.id}: ${updateError.message}`);
    }

    pantryDelta.push({
      pantryItemId: pantryItem.id,
      newQuantity,
      status: newStatus,
    });
  }

  // 5. Mark entry cooked
  const { data: updatedEntryData, error: updateEntryError } = await supabase
    .from('meal_plan_entries')
    .update({ status: 'cooked', cooked_at: new Date().toISOString() })
    .eq('meal_plan_id', planId)
    .eq('day_of_week', dayOfWeek)
    .select()
    .single();

  if (updateEntryError || !updatedEntryData) {
    throw new Error(
      `Failed to update entry status: ${updateEntryError?.message ?? 'no data'}`,
    );
  }

  // 6. Log to recipe_cooks (best-effort, non-fatal -- Phase 10-02)
  // Only log when the entry references a real recipe; non-recipe entries
  // (Claude-generated free-form meals) don't have a recipe to track.
  if (entry.recipe_id) {
    try {
      await logRecipeCook(supabase, profileId, entry.recipe_id);
    } catch (e) {
      console.warn('[mealPlanner] logRecipeCook threw -- ignoring', e);
    }
  }

  return {
    entry: updatedEntryData as MealPlanEntry,
    pantryDelta,
  };
}
