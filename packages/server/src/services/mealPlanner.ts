import type { SupabaseClient } from '@supabase/supabase-js';
import { anthropic } from '../config/anthropic.js';
import type { Difficulty, MealPlan, MealPlanEntry, MealPlanIngredient } from '../types/mealPlan.js';
import { matchIngredientsToPantry } from './ingredientMatching.js';
import type { PantryItem } from './pantry.js';

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
}

// ---------- Prompt Assembly ----------

/**
 * Build a structured prompt for Claude to generate a 7-day meal plan.
 * Pure function, exported for testing.
 */
export function buildMealPlanPrompt(context: MealPlanContext): string {
  const { pantryItems, preferences, recipeLibrary, recentMealTitles, weekStart } = context;

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

OUTPUT CONTRACT:
- Return EXACTLY 7 days, one per day_of_week (0..6, 0=Monday, 6=Sunday)
- Each entry must include complexity_target ('weeknight' for Mon-Thu, 'weekend' for Fri-Sun)
- Set recipe_id from RECIPE LIBRARY when a listed recipe is reused; otherwise null
- Fill ingredients_used from AVAILABLE PANTRY and ingredients_needed for missing items
- Prefer pantry items to minimize shopping
- Vary cuisines and cooking methods across the week`;
}

// ---------- Tool Definition ----------

export const generateMealPlanTool = {
  name: 'generate_meal_plan' as const,
  description:
    'Generate a 7-day dinner meal plan (one entry per day Mon-Sun) from pantry, preferences, and recipe library.',
  input_schema: {
    type: 'object' as const,
    properties: {
      days: {
        type: 'array',
        minItems: 7,
        maxItems: 7,
        items: {
          type: 'object',
          properties: {
            day_of_week: {
              type: 'string',
              enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
              description: 'Day of week (mon=0 through sun=6)',
            },
            title: { type: 'string', description: 'Recipe title' },
            description: { type: 'string', description: '1-2 sentence description' },
            recipe_id: {
              type: ['string', 'null'],
              description: 'Matching recipe_id from RECIPE LIBRARY, or null for new dish',
            },
            ingredients_used: {
              type: 'array',
              items: { type: 'string' },
              description: 'Pantry items this recipe uses',
            },
            ingredients_needed: {
              type: 'array',
              items: { type: 'string' },
              description: 'Items not in pantry that must be bought',
            },
            estimated_time_minutes: { type: 'number' },
            difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
            complexity_target: {
              type: 'string',
              enum: ['weeknight', 'weekend'],
              description: "weeknight for Mon-Thu, weekend for Fri-Sun",
            },
            kid_friendly: { type: 'boolean' },
            why_suggested: { type: 'string' },
          },
          required: [
            'day_of_week',
            'title',
            'description',
            'estimated_time_minutes',
            'difficulty',
            'complexity_target',
            'kid_friendly',
            'why_suggested',
          ],
        },
      },
    },
    required: ['days'],
  },
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

// ---------- Claude Tool Output Shape ----------

interface ClaudeMealDay {
  day_of_week: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
  title: string;
  description: string;
  recipe_id?: string | null;
  ingredients_used?: string[];
  ingredients_needed?: string[];
  estimated_time_minutes: number;
  difficulty: Difficulty;
  complexity_target: 'weeknight' | 'weekend';
  kid_friendly: boolean;
  why_suggested: string;
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
 * Fetch context from Supabase, call Claude via generate_meal_plan tool,
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
  };

  const promptText = buildMealPlanPrompt(context);

  // 7. Call Claude with tool forced
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [generateMealPlanTool],
    tool_choice: { type: 'tool', name: 'generate_meal_plan' },
    messages: [{ role: 'user', content: promptText }],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a tool_use response');
  }

  const { days } = toolBlock.input as { days: ClaudeMealDay[] };
  if (!Array.isArray(days) || days.length !== 7) {
    const err = new Error(
      `INVALID_PLAN_LENGTH: Claude returned ${days?.length ?? 0} days, expected exactly 7 days`,
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
  const entryRows = days.map((d) => ({
    meal_plan_id: newPlanRow.id,
    day_of_week: dayStringToIndex(d.day_of_week),
    recipe_id: d.recipe_id ?? null,
    title: d.title,
    description: d.description,
    ingredients: (d.ingredients_used ?? []).map((name) => ({ name })),
    ingredients_needed: (d.ingredients_needed ?? []).map((name) => ({ name })),
    estimated_time_minutes: d.estimated_time_minutes,
    difficulty: d.difficulty,
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

  // 5. Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [generateMealPlanTool],
    tool_choice: { type: 'tool', name: 'generate_meal_plan' },
    messages: [{ role: 'user', content: scopedPrompt }],
  });

  const toolBlock = response.content.find((b: { type: string }) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a tool_use response');
  }

  const { days } = (toolBlock as { input: { days: ClaudeMealDay[] } }).input;
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
  const patch = {
    recipe_id: replacement.recipe_id ?? null,
    title: replacement.title,
    description: replacement.description,
    ingredients: (replacement.ingredients_used ?? []).map((name) => ({ name })),
    ingredients_needed: (replacement.ingredients_needed ?? []).map((name) => ({ name })),
    estimated_time_minutes: replacement.estimated_time_minutes,
    difficulty: replacement.difficulty,
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

  return {
    entry: updatedEntryData as MealPlanEntry,
    pantryDelta,
  };
}
