import * as cheerio from 'cheerio';
import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import { sanitizeRecipeTextFields } from './recipeTextSanitizer.js';

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
  /** Per-serving nutrition estimates from Claude. Null for legacy rows
      and when the AI couldn't estimate confidently. */
  calories_per_serving: number | null;
  protein_grams_per_serving: number | null;
  fat_grams_per_serving: number | null;
  /** Quick-task 6 — skill scaffolding. AI-generated recipes (Discover +
      meal-plan generation) populate these; legacy / imported rows leave
      them null and the UI hides their chips. */
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  practiced_skills?: string[] | null;
  skill_note?: string | null;
}

// ---------- Tool Definition ----------
//
// NOTE: Schema simplified from the legacy Anthropic definition. The old schema
// used `type: ['string', 'null']` union types which Anthropic tolerated but are
// not valid in our stricter JsonSchema type or Gemini's parametersJsonSchema.
// Nullable fields are now omitted from `required` so providers can skip them;
// toolOutputToRecipe still defaults missing fields to null.

const parseRecipeSchema: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Recipe title' },
    description: { type: 'string', description: 'Short recipe description or summary' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ingredient name (e.g., "chicken breast")' },
          quantity: { type: 'number', description: 'Numeric quantity (e.g., 2, 0.5)' },
          unit: { type: 'string', description: 'Unit of measurement (e.g., "cup", "tbsp", "lb")' },
          notes: { type: 'string', description: 'Preparation notes (e.g., "diced", "room temperature")' },
        },
        required: ['name'],
      },
    },
    steps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Ordered cooking steps as plain text',
    },
    prep_time_minutes: { type: 'number', description: 'Preparation time in minutes' },
    cook_time_minutes: { type: 'number', description: 'Cooking time in minutes' },
    total_time_minutes: { type: 'number', description: 'Total time in minutes' },
    servings: { type: 'number', description: 'Number of servings' },
    source_url: { type: 'string', description: 'Original recipe URL if imported from web' },
    image_url: { type: 'string', description: 'URL of recipe hero image' },
    calories_per_serving: { type: 'number', description: 'Estimated kcal per serving. Best-effort from ingredient list and quantities — omit if uncertain.' },
    protein_grams_per_serving: { type: 'number', description: 'Estimated grams of protein per serving (whole or 1-decimal). Omit if uncertain.' },
    fat_grams_per_serving: { type: 'number', description: 'Estimated grams of total fat per serving (whole or 1-decimal). Omit if uncertain.' },
  },
  required: ['title', 'ingredients', 'steps'],
};

export const parseRecipeTool: StructuredTool<Record<string, unknown>> = {
  name: 'parse_recipe',
  description: 'Extract structured recipe data from text or HTML content',
  schema: parseRecipeSchema,
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
    // JSON-LD's nutrition object isn't normalized across sites and the
    // shape varies (calories sometimes string "210 calories", sometimes
    // numeric, sometimes a NutritionInformation @type object). Skip the
    // parsing here; null is fine and Discover/text/photo paths still
    // populate via Claude.
    calories_per_serving: null,
    protein_grams_per_serving: null,
    fat_grams_per_serving: null,
    // Quick-task 6 — JSON-LD doesn't carry skill metadata; null is fine.
    // Imported URL/photo recipes get no skill chips by design (only AI
    // generation populates these).
    difficulty: null,
    practiced_skills: null,
    skill_note: null,
  };
}

// ---------- AIClient Helpers ----------

async function callAIParseRecipeText(
  task: 'recipe.parseUrl' | 'recipe.parseText',
  userPrompt: string
): Promise<Record<string, unknown>> {
  const ai = getClientFor(task);
  return ai.generateStructured<Record<string, unknown>>({
    user: userPrompt,
    tool: parseRecipeTool,
    maxTokens: 4096,
  });
}

async function callAIParseRecipePhoto(
  base64Image: string,
  userPrompt: string
): Promise<Record<string, unknown>> {
  const ai = getClientFor('recipe.parsePhoto');
  return ai.analyzeImageStructured<Record<string, unknown>>({
    user: userPrompt,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: parseRecipeTool,
    maxTokens: 4096,
  });
}

/**
 * Convert tool output to ParsedRecipe with proper defaults.
 */
function toolOutputToRecipe(
  input: Record<string, unknown>,
  sourceType: 'url' | 'photo' | 'manual' | 'ai',
  sourceUrl: string | null = null
): ParsedRecipe {
  const rawIngredients = (input.ingredients as Partial<ParsedIngredient>[]) || [];
  const ingredients: ParsedIngredient[] = rawIngredients.map((ing) => ({
    name: (ing.name as string) || '',
    quantity: (ing.quantity as number) ?? null,
    unit: (ing.unit as string) ?? null,
    notes: (ing.notes as string) ?? null,
  }));
  const steps = (input.steps as string[]) || [];

  // Defend against Gemini-preview degeneration leaking CJK filler tokens
  // (调整/碎/块/条) into English recipe text. tool_use constrains JSON shape
  // but not string CONTENT, so we scrub at the parse boundary before the
  // recipe is ever returned/stored. See services/recipeTextSanitizer.ts.
  const { value: cleaned, changed } = sanitizeRecipeTextFields({
    title: (input.title as string) || 'Untitled Recipe',
    description: (input.description as string) || null,
    ingredients,
    steps,
  });
  if (changed) {
    console.warn(
      `[recipeParser] stripped non-Latin contamination from generated recipe "${cleaned.title}" (source=${sourceType})`,
    );
  }

  return {
    title: cleaned.title || 'Untitled Recipe',
    description: cleaned.description ?? null,
    ingredients: cleaned.ingredients as ParsedIngredient[],
    steps: cleaned.steps as string[],
    prep_time_minutes: (input.prep_time_minutes as number) ?? null,
    cook_time_minutes: (input.cook_time_minutes as number) ?? null,
    total_time_minutes: (input.total_time_minutes as number) ?? null,
    // Imported recipes (URL/photo/manual) preserve whatever serving
    // count the source specified — only AI-generated paths floor at
    // MIN_SERVINGS, and they apply that clamp explicitly in
    // discoverRecipes / mealPlanner before persistence.
    servings: (input.servings as number) ?? null,
    source_url: sourceUrl,
    source_type: sourceType,
    image_url: (input.image_url as string) || null,
    calories_per_serving: (input.calories_per_serving as number) ?? null,
    protein_grams_per_serving: (input.protein_grams_per_serving as number) ?? null,
    fat_grams_per_serving: (input.fat_grams_per_serving as number) ?? null,
    // Quick-task 6 — only Discover / mealPlanner populate these via their
    // own tools (suggestRecipesTool / generateMealPlanTool). Generic
    // url/photo/text imports don't tag — null is correct.
    difficulty: null,
    practiced_skills: null,
    skill_note: null,
  };
}

// ---------- Public API ----------

/**
 * Parse a recipe from a URL. Tries JSON-LD extraction first,
 * falls back to AIClient (Gemini) extraction for non-structured pages.
 */
// Real browser UA — most recipe sites bot-block obvious scrapers.
// Also send Accept and Accept-Language so we look like a normal browser.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
} as const;

export async function parseRecipeFromUrl(url: string): Promise<ParsedRecipe> {
  // 1. Fetch the page (with browser-like headers + redirect following)
  const response = await fetch(url, {
    headers: BROWSER_HEADERS,
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (${response.status} ${response.statusText}): ${url}`);
  }

  const html = await response.text();

  // 2. Try JSON-LD extraction
  const jsonLd = extractRecipeJsonLd(html);

  if (jsonLd) {
    // Map JSON-LD to our format, then send ingredients through AI for structured parsing
    const mapped = mapJsonLdToRecipe(jsonLd, url);
    const ingredientText = (jsonLd.recipeIngredient as string[])?.join('\n') || '';

    const input = await callAIParseRecipeText(
      'recipe.parseUrl',
      `Parse this recipe into structured format. Convert fractions to decimals for quantities.\n\nTitle: ${mapped.title}\n\nIngredients:\n${ingredientText}\n\nSteps:\n${mapped.steps.join('\n')}`
    );

    const recipe = toolOutputToRecipe(input, 'url', url);
    // Preserve JSON-LD metadata that the AI might not return
    recipe.prep_time_minutes = mapped.prep_time_minutes ?? recipe.prep_time_minutes;
    recipe.cook_time_minutes = mapped.cook_time_minutes ?? recipe.cook_time_minutes;
    recipe.total_time_minutes = mapped.total_time_minutes ?? recipe.total_time_minutes;
    recipe.servings = mapped.servings ?? recipe.servings;
    recipe.image_url = mapped.image_url ?? recipe.image_url;

    return recipe;
  }

  // 3. No JSON-LD -- extract visible text and send to AI
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  const visibleText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 5000);

  const input = await callAIParseRecipeText(
    'recipe.parseUrl',
    `Extract the recipe from this web page text. Parse into structured format with title, ingredients (with quantities), and steps. Convert fractions to decimals.\n\n${visibleText}`
  );

  return toolOutputToRecipe(input, 'url', url);
}

/**
 * Parse a recipe from a photo (base64 image data).
 * Uses Anthropic Vision via the AIClient abstraction.
 */
export async function parseRecipeFromPhoto(base64Image: string): Promise<ParsedRecipe> {
  const input = await callAIParseRecipePhoto(
    base64Image,
    'Extract the recipe from this image. Parse into structured format with title, ingredients (with quantities as decimals), and cooking steps.'
  );

  return toolOutputToRecipe(input, 'photo');
}

/**
 * Parse a recipe from freeform text.
 * Uses Gemini via the AIClient abstraction.
 */
export async function parseRecipeFromText(text: string): Promise<ParsedRecipe> {
  const input = await callAIParseRecipeText(
    'recipe.parseText',
    `Parse this recipe text into structured format. Convert fractions to decimals for quantities.\n\n${text}`
  );

  return toolOutputToRecipe(input, 'manual');
}

/**
 * Apply a remix variation to a base recipe and produce a FULL parsed
 * recipe (title, ingredients, steps). Used by POST /recipes/remix when
 * the user taps "Save as recipe" on a variation card.
 */
export async function applyRemixVariation(
  base: {
    title: string;
    description?: string | null;
    ingredients?: Array<string | { name: string; quantity?: number; unit?: string; notes?: string }>;
    steps?: string[];
    total_time_minutes?: number | null;
  },
  variation: { title: string; description: string },
): Promise<ParsedRecipe> {
  const ingredientText = (base.ingredients ?? [])
    .map((ing) => {
      if (typeof ing === 'string') return `- ${ing}`;
      const qty = [ing.quantity, ing.unit].filter(Boolean).join(' ');
      const notes = ing.notes ? ` (${ing.notes})` : '';
      return `- ${qty ? qty + ' ' : ''}${ing.name}${notes}`;
    })
    .join('\n');
  const stepsText = (base.steps ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n');

  const prompt = `Apply a remix to the base recipe below and return the COMPLETE updated recipe.

Base recipe:
Title: ${base.title}
${base.description ? `Description: ${base.description}` : ''}
${base.total_time_minutes ? `Total time: ${base.total_time_minutes} minutes` : ''}

Base ingredients:
${ingredientText || '(none provided)'}

Base steps:
${stepsText || '(none provided)'}

Remix to apply — "${variation.title}": ${variation.description}

Produce a full parsed recipe incorporating the remix. Use "${variation.title}" (or a close variant) as the new recipe title so the user can tell it apart from the base. Rewrite ingredients and steps to reflect the change. Convert fractions to decimals for quantities.

Populate calories_per_serving (integer kcal, ~300-900 typical, round to nearest 10) AND protein_grams_per_serving (integer or 1-decimal grams) from the rewritten ingredients + serving math. Use chicken ~25g protein/100g, beef ~26g/100g, fish ~22g/100g, eggs ~6g each, tofu ~8g/100g, beans ~7g/100g cooked. Don't omit — best estimate.`;

  const input = await callAIParseRecipeText('recipe.parseText', prompt);
  return toolOutputToRecipe(input, 'ai');
}
