import type { SupabaseClient } from '@supabase/supabase-js';
import { anthropic } from '../config/anthropic.js';
import type { MealPlan, MealPlanEntry } from '../types/mealPlan.js';

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
