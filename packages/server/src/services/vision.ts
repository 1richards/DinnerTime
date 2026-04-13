import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';

export interface ScanResult {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
  category: 'produce' | 'dairy' | 'protein' | 'grain' | 'condiment' | 'beverage' | 'frozen' | 'snack' | 'other';
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
            description: 'Category: produce, dairy, protein, grain, condiment, beverage, frozen, snack, other',
          },
        },
        required: ['name', 'quantity', 'unit', 'confidence', 'category'],
      },
    },
  },
  required: ['items'],
};

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
    user: `Identify all visible food items in this ${sourceLocation} photo. For each item, estimate quantity and provide a confidence score. Be thorough - include partially visible items with lower confidence.`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: foodItemsTool,
    maxTokens: 4096,
  });
  return result.items ?? [];
}
