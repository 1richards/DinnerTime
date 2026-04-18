import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';

export const VALID_CATEGORIES = [
  'produce',
  'dairy',
  'protein',
  'grain',
  'condiment',
  'beverage',
  'frozen',
  'snack',
  'other',
] as const;
export type PantryCategory = (typeof VALID_CATEGORIES)[number];

export interface ScanResult {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
  category: PantryCategory;
}

const foodItemsSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Common name of the food item (lowercase, singular)' },
          quantity: { type: 'number', description: 'Estimated quantity (default 1)' },
          unit: { type: 'string', description: 'Unit of measurement (e.g., "piece", "bag", "bottle", "lb", "bunch")' },
          confidence: { type: 'number', description: 'Confidence score 0.0-1.0 for identification accuracy' },
          category: {
            type: 'string',
            enum: [...VALID_CATEGORIES],
            description:
              'MUST be exactly one of: produce, dairy, protein, grain, condiment, beverage, frozen, snack, other. Meat/fish goes under "protein". Vegetables/fruit go under "produce". Anything unclear goes under "other".',
          },
        },
        required: ['name', 'quantity', 'unit', 'confidence', 'category'],
      },
    },
  },
  required: ['items'],
};

/**
 * Normalize a category string — if the AI returned something outside the
 * allowed set, coerce it to 'other' rather than failing the DB insert.
 */
export function coerceCategory(raw: unknown): PantryCategory {
  if (typeof raw !== 'string') return 'other';
  const lower = raw.trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as PantryCategory;
  }
  // Common fallbacks the AI might emit despite the enum.
  if (lower === 'meat' || lower === 'fish' || lower === 'poultry' || lower === 'seafood') return 'protein';
  if (lower === 'vegetable' || lower === 'vegetables' || lower === 'fruit' || lower === 'fruits' || lower === 'veggies') return 'produce';
  if (lower === 'bread' || lower === 'pasta' || lower === 'cereal' || lower === 'rice') return 'grain';
  if (lower === 'sauce' || lower === 'spice' || lower === 'oil' || lower === 'vinegar') return 'condiment';
  if (lower === 'drink' || lower === 'juice') return 'beverage';
  return 'other';
}

const foodItemsTool: StructuredTool<{ items: ScanResult[] }> = {
  name: 'report_food_items',
  description: 'Report all food items visible in the image with confidence scores',
  schema: foodItemsSchema,
};

const MAX_BASE64_BYTES = 5 * 1024 * 1024; // Anthropic's 5 MB limit

const FILTERING_RULES = `For each item, report ONLY items you can specifically name as a cooking ingredient or food product. Examples of GOOD items: "milk", "cheddar cheese", "sriracha", "ground beef", "sourdough bread", "olive oil".

DO NOT report:
- Vague or unidentifiable items ("leftover container", "unidentified dairy item", "mystery sauce")
- Generic descriptions ("condiment packet", "sauce packet", "plastic container with food")
- Non-food items (cleaning supplies, utensils, containers without identifiable contents)
- Items you cannot specifically name -- if you can't tell what it is, exclude it entirely

Named condiments and sauces ARE included (e.g., ketchup, soy sauce, ranch dressing).
All beverages ARE included (e.g., orange juice, soda, water, beer).

Assign confidence 0.0-1.0 based on how clearly you can identify each item. Only report items with confidence >= 0.5.
The category field MUST be exactly one of the nine values in the schema.`;

export async function identifyFoodItems(
  base64Image: string,
  sourceLocation: 'fridge' | 'pantry' | 'freezer'
): Promise<ScanResult[]> {
  const imageBytes = Buffer.from(base64Image, 'base64').length;
  if (imageBytes > MAX_BASE64_BYTES) {
    throw new Error(
      `Image too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please retake at lower resolution.`
    );
  }
  const ai = getClientFor('vision.pantryScan');
  const result = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
    user: `You are analyzing a photo of a ${sourceLocation}. Identify all visible food items.\n\n${FILTERING_RULES}`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: foodItemsTool,
    maxTokens: 4096,
  });
  // Coerce category in case the model ignored the enum.
  return (result.items ?? []).map((item) => ({
    ...item,
    category: coerceCategory(item.category),
  }));
}

export async function identifyFoodItemsBatch(
  base64Images: string[],
  sourceLocation: 'fridge' | 'pantry' | 'freezer',
  existingItemNames: string[] = []
): Promise<ScanResult[]> {
  // Validate each image against the 5MB limit.
  for (let i = 0; i < base64Images.length; i++) {
    const imageBytes = Buffer.from(base64Images[i], 'base64').length;
    if (imageBytes > MAX_BASE64_BYTES) {
      throw new Error(
        `Image ${i + 1} too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please retake at lower resolution.`
      );
    }
  }

  const count = base64Images.length;
  const ai = getClientFor('vision.pantryScan');

  // Build the "already in pantry" directive when items exist. This prevents
  // shelf-stable items (condiments, oils, etc.) from cluttering review results
  // on every scan. The reconciler still updates last_seen_at for matched items
  // via a separate code path, so skipping them here is purely a UX filter.
  const existingBlock = existingItemNames.length > 0
    ? `\n\nALREADY IN PANTRY (do NOT report these — they are already tracked):\n${existingItemNames.map((n) => `- ${n}`).join('\n')}\n\nIf you see any of the above items in the photos, exclude them from your response. Only report NEW items not already in this list.`
    : '';

  const result = await ai.analyzeImagesStructured<{ items: ScanResult[] }>({
    user: `You are analyzing ${count} photos of a ${sourceLocation}. These photos may show overlapping areas -- deduplicate items that appear in multiple photos.\n\n${FILTERING_RULES}${existingBlock}`,
    images: base64Images.map((b64) => ({ base64: b64, mimeType: 'image/jpeg' as const })),
    tool: foodItemsTool,
    maxTokens: 8192,
  });
  // Coerce category in case the model ignored the enum.
  return (result.items ?? []).map((item) => ({
    ...item,
    category: coerceCategory(item.category),
  }));
}
