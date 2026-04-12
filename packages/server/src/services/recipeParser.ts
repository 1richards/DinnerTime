import * as cheerio from 'cheerio';
import { anthropic } from '../config/anthropic.js';

// ---------- Types ----------

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
  source_type: 'url' | 'photo' | 'manual' | 'ai';
  image_url: string | null;
}

// ---------- Tool Definition ----------

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

// ---------- Duration Parser ----------

/**
 * Parse ISO 8601 duration string to minutes.
 * Supports formats like PT1H30M, PT45M, PT2H, PT1H30M15S.
 * Returns null for null/undefined or unrecognized formats.
 */
export function parseDuration(iso8601: string | null | undefined): number | null {
  if (!iso8601) return null;
  const match = iso8601.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  const total = hours * 60 + minutes + Math.round(seconds / 60);
  return total > 0 ? total : null;
}

// ---------- JSON-LD Extraction ----------

/**
 * Extract a schema.org Recipe object from HTML JSON-LD script tags.
 * Handles direct @type: "Recipe", @graph arrays, and nested structures.
 * Returns null if no Recipe found.
 */
export function extractRecipeJsonLd(html: string): Record<string, unknown> | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    const content = $(scripts[i]).html();
    if (!content) continue;

    try {
      const data = JSON.parse(content);
      const recipe = findRecipeInJsonLd(data);
      if (recipe) return recipe;
    } catch {
      // Invalid JSON, skip
    }
  }

  return null;
}

/**
 * Recursively search for @type: "Recipe" in a JSON-LD structure.
 */
function findRecipeInJsonLd(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;

  // Check @type
  if (obj['@type'] === 'Recipe') return obj;

  // Check @graph array
  if (Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) {
      const found = findRecipeInJsonLd(item);
      if (found) return found;
    }
  }

  return null;
}

// ---------- JSON-LD to ParsedRecipe Mapping ----------

/**
 * Map a schema.org Recipe JSON-LD object to our ParsedRecipe type.
 * Ingredient strings are kept as-is (will be parsed by Claude later).
 */
export function mapJsonLdToRecipe(
  jsonLd: Record<string, unknown>,
  sourceUrl: string
): ParsedRecipe {
  const rawIngredients = (jsonLd.recipeIngredient as string[]) || [];
  const rawInstructions = jsonLd.recipeInstructions;

  // Parse steps from various formats
  let steps: string[] = [];
  if (Array.isArray(rawInstructions)) {
    steps = rawInstructions.map((inst: unknown) => {
      if (typeof inst === 'string') return inst;
      if (inst && typeof inst === 'object' && 'text' in inst) {
        return (inst as { text: string }).text;
      }
      return String(inst);
    });
  } else if (typeof rawInstructions === 'string') {
    steps = [rawInstructions];
  }

  // Parse servings from yield
  let servings: number | null = null;
  const yield_ = jsonLd.recipeYield;
  if (typeof yield_ === 'number') {
    servings = yield_;
  } else if (typeof yield_ === 'string') {
    const match = yield_.match(/(\d+)/);
    if (match) servings = parseInt(match[1], 10);
  }

  // Parse image URL
  let imageUrl: string | null = null;
  if (typeof jsonLd.image === 'string') {
    imageUrl = jsonLd.image;
  } else if (Array.isArray(jsonLd.image) && jsonLd.image.length > 0) {
    imageUrl = typeof jsonLd.image[0] === 'string' ? jsonLd.image[0] : null;
  } else if (jsonLd.image && typeof jsonLd.image === 'object' && 'url' in jsonLd.image) {
    imageUrl = (jsonLd.image as { url: string }).url;
  }

  return {
    title: (jsonLd.name as string) || 'Untitled Recipe',
    description: (jsonLd.description as string) || null,
    ingredients: rawIngredients.map((text) => ({
      name: text,
      quantity: null,
      unit: null,
      notes: null,
    })),
    steps,
    prep_time_minutes: parseDuration(jsonLd.prepTime as string | undefined),
    cook_time_minutes: parseDuration(jsonLd.cookTime as string | undefined),
    total_time_minutes: parseDuration(jsonLd.totalTime as string | undefined),
    servings,
    source_url: sourceUrl,
    source_type: 'url',
    image_url: imageUrl,
  };
}

// ---------- Claude Helpers ----------

/**
 * Call Claude with parse_recipe tool and extract the structured result.
 */
async function callClaudeParseRecipe(
  messages: Parameters<typeof anthropic.messages.create>[0]['messages']
): Promise<Record<string, unknown>> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [parseRecipeTool],
    tool_choice: { type: 'tool', name: 'parse_recipe' },
    messages,
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return a tool_use response');
  }

  return toolBlock.input as Record<string, unknown>;
}

/**
 * Convert Claude tool output to ParsedRecipe with proper defaults.
 */
function toolOutputToRecipe(
  input: Record<string, unknown>,
  sourceType: 'url' | 'photo' | 'manual',
  sourceUrl: string | null = null
): ParsedRecipe {
  const ingredients = (input.ingredients as ParsedIngredient[]) || [];
  const steps = (input.steps as string[]) || [];

  return {
    title: (input.title as string) || 'Untitled Recipe',
    description: (input.description as string) || null,
    ingredients,
    steps,
    prep_time_minutes: (input.prep_time_minutes as number) ?? null,
    cook_time_minutes: (input.cook_time_minutes as number) ?? null,
    total_time_minutes: (input.total_time_minutes as number) ?? null,
    servings: (input.servings as number) ?? null,
    source_url: sourceUrl,
    source_type: sourceType,
    image_url: (input.image_url as string) || null,
  };
}

// ---------- Public API ----------

/**
 * Parse a recipe from a URL. Tries JSON-LD extraction first,
 * falls back to Claude extraction for non-structured pages.
 */
export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  // 1. Fetch the page
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DinnerTime/1.0' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status} ${response.statusText}): ${url}`);
  }

  const html = await response.text();

  // 2. Try JSON-LD extraction
  const jsonLd = extractRecipeJsonLd(html);

  if (jsonLd) {
    // Map JSON-LD to our format, then send ingredients through Claude for structured parsing
    const mapped = mapJsonLdToRecipe(jsonLd, url);
    const ingredientText = (jsonLd.recipeIngredient as string[])?.join('\n') || '';

    const input = await callClaudeParseRecipe([
      {
        role: 'user',
        content: `Parse this recipe into structured format. Convert fractions to decimals for quantities.\n\nTitle: ${mapped.title}\n\nIngredients:\n${ingredientText}\n\nSteps:\n${mapped.steps.join('\n')}`,
      },
    ]);

    const recipe = toolOutputToRecipe(input, 'url', url);
    // Preserve JSON-LD metadata that Claude might not return
    recipe.prep_time_minutes = mapped.prep_time_minutes ?? recipe.prep_time_minutes;
    recipe.cook_time_minutes = mapped.cook_time_minutes ?? recipe.cook_time_minutes;
    recipe.total_time_minutes = mapped.total_time_minutes ?? recipe.total_time_minutes;
    recipe.servings = mapped.servings ?? recipe.servings;
    recipe.image_url = mapped.image_url ?? recipe.image_url;

    return recipe;
  }

  // 3. No JSON-LD -- extract visible text and send to Claude
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  const visibleText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

  const input = await callClaudeParseRecipe([
    {
      role: 'user',
      content: `Extract the recipe from this web page text. Parse into structured format with title, ingredients (with quantities), and steps. Convert fractions to decimals.\n\n${visibleText}`,
    },
  ]);

  return toolOutputToRecipe(input, 'url', url);
}

/**
 * Parse a recipe from a photo (base64 image data).
 * Uses Claude Vision with parse_recipe tool.
 */
export async function parseRecipeFromPhoto(base64Image: string): Promise<ParsedRecipe> {
  const input = await callClaudeParseRecipe([
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: 'Extract the recipe from this image. Parse into structured format with title, ingredients (with quantities as decimals), and cooking steps.',
        },
      ],
    },
  ]);

  return toolOutputToRecipe(input, 'photo');
}

/**
 * Parse a recipe from freeform text.
 * Uses Claude with parse_recipe tool.
 */
export async function parseRecipeFromText(text: string): Promise<ParsedRecipe> {
  const input = await callClaudeParseRecipe([
    {
      role: 'user',
      content: `Parse this recipe text into structured format. Convert fractions to decimals for quantities.\n\n${text}`,
    },
  ]);

  return toolOutputToRecipe(input, 'manual');
}
