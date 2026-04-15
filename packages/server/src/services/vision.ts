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

export async function identifyFoodItems(
  base64Image: string,
  sourceLocation: 'fridge' | 'pantry' | 'freezer'
): Promise<ScanResult[]> {
  const ai = getClientFor('vision.pantryScan');
  const result = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
    user: `Identify all visible food items in this ${sourceLocation} photo. For each item, estimate quantity and provide a confidence score. Be thorough — include partially visible items with lower confidence. The category field MUST be exactly one of the nine values in the schema.`,
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
