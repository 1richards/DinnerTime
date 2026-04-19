/** STATIC_MAP always wins over AI. See Pitfall 1 in 18-RESEARCH.md. */

import { getClientFor } from '../ai/clientFactory.js';
import type { StructuredTool } from '../ai/types.js';
import type { SourceLocation } from './sourceLocation.js';
import { SOURCE_LOCATIONS } from './sourceLocation.js';

/**
 * Static map of ~150 common ingredients → kitchen location. O(1) zero-cost
 * classification for the happy path; unknown items fall through to
 * classifyBatchWithAI.
 *
 * Keys must be normalized (lowercase, trimmed) to match the caller's
 * normalizedName output. Defaults use US-household conventions; edge cases
 * are documented inline and resolve in a single user tap via the review-screen
 * override chip.
 *
 * Seed sourced from 18-RESEARCH.md Q1 "Static map seed content".
 */
export const LOCATION_STATIC_MAP: Record<string, SourceLocation> = {
  // === FRIDGE ===
  // Dairy
  milk: 'fridge',
  'whole milk': 'fridge',
  'skim milk': 'fridge',
  'almond milk': 'fridge', // edge case: unopened shelf-stable; user scan implies opened
  'oat milk': 'fridge',
  butter: 'fridge', // edge case: salted butter can live out; US default = fridge
  'salted butter': 'fridge',
  'unsalted butter': 'fridge',
  cheese: 'fridge',
  cheddar: 'fridge',
  mozzarella: 'fridge',
  parmesan: 'fridge',
  feta: 'fridge',
  ricotta: 'fridge',
  'cream cheese': 'fridge',
  'cottage cheese': 'fridge',
  yogurt: 'fridge',
  'greek yogurt': 'fridge',
  'sour cream': 'fridge',
  cream: 'fridge',
  'heavy cream': 'fridge',
  'half and half': 'fridge',

  // Eggs + protein
  egg: 'fridge', // edge case: UK/EU stores on counter; US = fridge (app is US-first)
  eggs: 'fridge',
  chicken: 'fridge', // fresh — frozen variant below
  'chicken breast': 'fridge',
  'chicken thigh': 'fridge',
  beef: 'fridge',
  'ground beef': 'fridge',
  steak: 'fridge',
  pork: 'fridge',
  'pork chop': 'fridge',
  bacon: 'fridge',
  sausage: 'fridge',
  turkey: 'fridge',
  'ground turkey': 'fridge',
  lamb: 'fridge',
  ham: 'fridge',
  prosciutto: 'fridge',
  deli: 'fridge',
  'deli meat': 'fridge',

  // Fresh seafood
  salmon: 'fridge',
  tuna: 'fridge', // fresh; canned lives in pantry
  cod: 'fridge',
  tilapia: 'fridge',
  shrimp: 'fridge', // fresh; frozen variant below
  'fresh shrimp': 'fridge',

  // Produce that refrigerates in US
  lettuce: 'fridge',
  spinach: 'fridge',
  kale: 'fridge',
  arugula: 'fridge',
  romaine: 'fridge',
  carrot: 'fridge',
  celery: 'fridge',
  cucumber: 'fridge',
  'bell pepper': 'fridge',
  broccoli: 'fridge',
  cauliflower: 'fridge',
  mushroom: 'fridge',
  cilantro: 'fridge',
  parsley: 'fridge',
  mint: 'fridge',
  dill: 'fridge',
  berry: 'fridge',
  strawberry: 'fridge',
  blueberry: 'fridge',
  raspberry: 'fridge',
  grape: 'fridge',
  lemon: 'fridge', // edge case: lemons hold on counter; fridge extends shelf life
  lime: 'fridge',

  // Opened condiments (US convention)
  ketchup: 'fridge', // "refrigerate after opening" → assume opened post-scan
  mayo: 'fridge',
  mayonnaise: 'fridge',
  mustard: 'fridge',
  'hot sauce': 'fridge', // edge case: many hot sauces are shelf-stable even opened; default fridge to be safe
  ranch: 'fridge',
  salsa: 'fridge', // fresh; jarred shelf-stable but scan implies opened
  hummus: 'fridge',
  pesto: 'fridge',
  jam: 'fridge',
  jelly: 'fridge',

  // Misc refrigerated
  tofu: 'fridge',
  tempeh: 'fridge',

  // === FREEZER ===
  'ice cream': 'freezer',
  'frozen pea': 'freezer',
  'frozen peas': 'freezer',
  'frozen corn': 'freezer',
  'frozen berry': 'freezer',
  'frozen berries': 'freezer',
  'frozen fruit': 'freezer',
  'frozen pizza': 'freezer',
  'frozen vegetable': 'freezer',
  'frozen vegetables': 'freezer',
  'frozen chicken': 'freezer',
  'frozen shrimp': 'freezer',
  'frozen fish': 'freezer',
  'frozen dinner': 'freezer',
  'frozen meal': 'freezer',
  'frozen waffle': 'freezer',
  'frozen waffles': 'freezer',
  'frozen dumpling': 'freezer',
  'frozen dumplings': 'freezer',
  popsicle: 'freezer',
  edamame: 'freezer', // edge case: most US pantries store frozen edamame
  sorbet: 'freezer',
  gelato: 'freezer',

  // === PANTRY ===
  // Grains / baking
  rice: 'pantry',
  'brown rice': 'pantry',
  'white rice': 'pantry',
  pasta: 'pantry',
  spaghetti: 'pantry',
  penne: 'pantry',
  flour: 'pantry',
  sugar: 'pantry',
  'brown sugar': 'pantry',
  salt: 'pantry',
  oat: 'pantry',
  oats: 'pantry',
  quinoa: 'pantry',
  bread: 'pantry', // edge case: some users fridge bread; counter/pantry is mainstream US default
  bagel: 'pantry',
  tortilla: 'pantry', // edge case: opened can go fridge; default pantry
  cereal: 'pantry',
  'baking powder': 'pantry',
  'baking soda': 'pantry',
  nuts: 'pantry',
  almond: 'pantry',
  walnut: 'pantry',
  pecan: 'pantry',

  // Oils + vinegars
  oil: 'pantry',
  'olive oil': 'pantry', // edge case: EU refrigerates extra-virgin; US pantry default
  'vegetable oil': 'pantry',
  'canola oil': 'pantry',
  'sesame oil': 'pantry', // edge case: some sources say fridge after opening; pantry default matches grocery shelf
  vinegar: 'pantry',
  'balsamic vinegar': 'pantry',

  // Canned + jarred shelf-stable
  'canned tomato': 'pantry',
  'canned tomatoes': 'pantry',
  'tomato sauce': 'pantry',
  'tomato paste': 'pantry',
  'canned beans': 'pantry',
  'black bean': 'pantry',
  chickpea: 'pantry',
  lentil: 'pantry',
  'canned tuna': 'pantry',
  'chicken broth': 'pantry',
  'vegetable broth': 'pantry',
  stock: 'pantry',
  broth: 'pantry',
  coconut: 'pantry',
  'coconut milk': 'pantry',
  'peanut butter': 'pantry',
  honey: 'pantry',
  'maple syrup': 'pantry', // edge case: once opened, fridge-refrigerate is common; pantry default acceptable
  'soy sauce': 'pantry',

  // Spices
  cumin: 'pantry',
  paprika: 'pantry',
  'black pepper': 'pantry',
  oregano: 'pantry',
  basil: 'pantry', // dried; fresh basil collision accepted (1-tap override)
  thyme: 'pantry',
  cinnamon: 'pantry',
  'chili powder': 'pantry',
  turmeric: 'pantry',
  ginger: 'pantry', // ground; fresh ginger → fridge via same normalized name; override tap
  rosemary: 'pantry',
  'garlic powder': 'pantry',
  'onion powder': 'pantry',
  'bay leaf': 'pantry',

  // Produce that pantries in US
  onion: 'pantry',
  'red onion': 'pantry',
  garlic: 'pantry',
  shallot: 'pantry',
  potato: 'pantry',
  'sweet potato': 'pantry',
  squash: 'pantry',
  tomato: 'pantry', // edge case: ripe tomatoes on counter; fridge controversial. Pantry = least wrong.
  banana: 'pantry',
  bananas: 'pantry',
  apple: 'pantry', // edge case: many fridge apples; pantry = "counter bowl" default
  apples: 'pantry',
  avocado: 'pantry', // ripens on counter; fridge once ripe. Pantry default.
  mango: 'pantry',
  pineapple: 'pantry',

  // Shelf-stable drinks
  coffee: 'pantry',
  tea: 'pantry',
  wine: 'pantry', // edge case: whites + rosé → fridge; red → pantry. Default pantry (typical red).
  beer: 'pantry', // same color-dependent logic — pantry default.

  // Unambiguous pantry misc
  ramen: 'pantry',
  noodle: 'pantry',
  granola: 'pantry',
  'protein bar': 'pantry',
  cookie: 'pantry',
  cracker: 'pantry',
  chip: 'pantry',
};

interface LocationBatchOutput {
  classifications: Array<{ name: string; source_location: SourceLocation }>;
}

/**
 * StructuredTool for AI classification of unknown items. The `enum` constraint
 * on source_location is the Pitfall 5 mitigation: Gemini respects `enum: [...]`
 * on string properties so we never receive a freeform fourth value.
 */
const classifyLocationsTool: StructuredTool<LocationBatchOutput> = {
  name: 'classify_item_locations',
  description:
    'Classify each item into fridge, pantry, or freezer. Every input name MUST appear in the output.',
  schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            source_location: {
              type: 'string',
              enum: [...SOURCE_LOCATIONS],
            },
          },
          required: ['name', 'source_location'],
        },
      },
    },
    required: ['classifications'],
  },
};

// Re-exported for schema-shape tests (mirrors ingredientCategories pattern).
export { classifyLocationsTool };

/**
 * Classify a single normalized ingredient name via LOCATION_STATIC_MAP with
 * token fallback. Returns null when no entry or token matches.
 *
 * Strategy (mirrors ingredientCategories.classifyStatic):
 *   1. Full-string lookup in LOCATION_STATIC_MAP.
 *   2. On miss, split on whitespace and try each token.
 *   3. Return null on all-miss (caller should route to classifyBatchWithAI).
 *
 * The caller is expected to pass a name already normalized (lowercase, trimmed).
 * This function does NOT re-normalize — passing "MILK" returns null by design
 * so the normalization contract stays honest upstream.
 */
export function classifyLocationStatic(normName: string): SourceLocation | null {
  const direct = LOCATION_STATIC_MAP[normName];
  if (direct) return direct;

  const tokens = normName.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return null;

  for (const token of tokens) {
    const hit = LOCATION_STATIC_MAP[token];
    if (hit) return hit;
  }
  return null;
}

/**
 * Classify a batch of unknown names via a single Gemini flash-lite call with
 * forced tool use. Returns a map of input name → location. Names absent from
 * the model's response are NOT defaulted here — callers (see classifyItems)
 * decide how to handle misses.
 *
 * Empty input short-circuits to `{}` without any AI call, which keeps
 * static-only call-sites cost-free.
 */
export async function classifyBatchWithAI(
  names: string[],
): Promise<Record<string, SourceLocation>> {
  if (names.length === 0) return {};

  const ai = getClientFor('ingredient.categorize');
  const { classifications } = await ai.generateStructured({
    user:
      `Classify each ingredient by where a typical US household stores it.\n\nIngredients:\n${names
        .map((n) => `- ${n}`)
        .join('\n')}`,
    tool: classifyLocationsTool,
    maxTokens: 1024,
  });

  const out: Record<string, SourceLocation> = {};
  for (const entry of classifications ?? []) {
    out[entry.name] = entry.source_location;
  }
  return out;
}

/**
 * Hybrid classification entry point. Static-first; unknowns batch to a single
 * AI call.
 *
 * Contract:
 *   - LOCATION_STATIC_MAP always wins (Pitfall 1). AI is never consulted for
 *     names already in the map — model drift on well-known items ("olive oil"
 *     → fridge) cannot slip through.
 *   - On AI failure (e.g. Gemini MalformedFunctionCallError, Pitfall 5), all
 *     unknowns fall back to 'pantry' (shelf-stable bias) and a console.warn is
 *     emitted for observability. The call is never fatal.
 *   - Unknowns omitted from a successful AI response default to 'pantry'.
 *   - Duplicate normalizedName inputs are deduplicated.
 */
export async function classifyItems(
  items: Array<{ normalizedName: string }>,
): Promise<Record<string, SourceLocation>> {
  const result: Record<string, SourceLocation> = {};
  const unknowns: string[] = [];

  for (const { normalizedName } of items) {
    if (result[normalizedName] !== undefined) continue;
    const hit = classifyLocationStatic(normalizedName);
    if (hit) {
      result[normalizedName] = hit;
    } else if (!unknowns.includes(normalizedName)) {
      unknowns.push(normalizedName);
    }
  }

  if (unknowns.length > 0) {
    let aiResolved: Record<string, SourceLocation> = {};
    try {
      aiResolved = await classifyBatchWithAI(unknowns);
    } catch (err) {
      console.warn(
        'itemLocation.classifyBatchWithAI failed, defaulting unknowns to pantry:',
        err,
      );
    }
    for (const name of unknowns) {
      result[name] = aiResolved[name] ?? 'pantry';
    }
  }

  return result;
}
