export interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}

export interface ParsedRecipe {
  title: string;
  description: string | null;
  ingredients: ParsedIngredient[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  servings: number | null;
  source_url: string | null;
  source_type: 'url' | 'photo' | 'manual';
  image_url: string | null;
}

export const parseRecipeTool = {
  name: 'parse_recipe' as const,
  description: 'Extract structured recipe data from text or HTML content',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: 'Recipe title' },
      description: {
        type: ['string', 'null'] as const,
        description: 'Short recipe description or summary',
      },
      ingredients: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Ingredient name (e.g., "chicken breast")' },
            quantity: {
              type: ['number', 'null'] as const,
              description: 'Numeric quantity (e.g., 2, 0.5)',
            },
            unit: {
              type: ['string', 'null'] as const,
              description: 'Unit of measurement (e.g., "cup", "tbsp", "lb")',
            },
            notes: {
              type: ['string', 'null'] as const,
              description: 'Preparation notes (e.g., "diced", "room temperature")',
            },
          },
          required: ['name', 'quantity', 'unit', 'notes'],
        },
      },
      steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ordered cooking steps as plain text',
      },
      prep_time_minutes: {
        type: ['number', 'null'] as const,
        description: 'Preparation time in minutes',
      },
      cook_time_minutes: {
        type: ['number', 'null'] as const,
        description: 'Cooking time in minutes',
      },
      total_time_minutes: {
        type: ['number', 'null'] as const,
        description: 'Total time in minutes',
      },
      servings: {
        type: ['number', 'null'] as const,
        description: 'Number of servings',
      },
      source_url: {
        type: ['string', 'null'] as const,
        description: 'Original recipe URL if imported from web',
      },
      image_url: {
        type: ['string', 'null'] as const,
        description: 'URL of recipe hero image',
      },
    },
    required: ['title', 'ingredients', 'steps'],
  },
};

/**
 * Parse ISO 8601 duration string to minutes.
 * Supports formats like PT1H30M, PT45M, PT2H, PT1H30M15S.
 * Returns null for unrecognized formats.
 */
export function parseDuration(iso8601: string): number | null {
  const match = iso8601.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const total = hours * 60 + minutes + Math.round(seconds / 60);
  return total > 0 ? total : null;
}

// TODO: Plan 02 will implement parseRecipeFromUrl(url: string): Promise<ParsedRecipe>
// TODO: Plan 02 will implement parseRecipeFromHtml(html: string, url: string): Promise<ParsedRecipe>
// TODO: Plan 02 will implement parseRecipeFromPhoto(base64Image: string): Promise<ParsedRecipe>
