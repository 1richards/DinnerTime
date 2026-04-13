import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import type { ParsedIngredient, ParsedRecipe } from './recipeParser.js';

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
}

// ---------- Tool Definition ----------

interface SuggestRecipesOutput {
  recipes: Array<Partial<ParsedRecipe> & { ingredients?: ParsedIngredient[]; steps?: string[] }>;
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
        },
        required: ['title', 'ingredients', 'steps'],
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
  existingTitles?: string[]
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

  lines.push('');
  lines.push(
    'Return full recipes with structured ingredients (name, quantity, unit, notes) and ordered steps. Convert fractions to decimals for quantities.'
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
  const system = buildDiscoveryPrompt(opts.preferences, opts.existingTitles);
  const userPrompt = opts.prompt ?? 'Suggest 6 dinner recipes.';

  const ai = getClientFor('recipe.discovery');
  const { recipes } = await ai.generateStructured({
    system,
    user: userPrompt,
    tool: suggestRecipesTool,
    maxTokens: 4096,
  });

  return (recipes ?? []).map((r) => ({
    title: (r.title as string) || 'Untitled Recipe',
    description: (r.description as string | null | undefined) ?? null,
    ingredients: (r.ingredients as ParsedIngredient[]) ?? [],
    steps: (r.steps as string[]) ?? [],
    prep_time_minutes: (r.prep_time_minutes as number | null | undefined) ?? null,
    cook_time_minutes: (r.cook_time_minutes as number | null | undefined) ?? null,
    total_time_minutes: (r.total_time_minutes as number | null | undefined) ?? null,
    servings: (r.servings as number | null | undefined) ?? null,
    source_url: null,
    source_type: 'ai' as ParsedRecipe['source_type'],
    image_url: null,
  }));
}
