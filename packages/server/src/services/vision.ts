import { anthropic } from '../config/anthropic.js';

export interface ScanResult {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
  category: 'produce' | 'dairy' | 'protein' | 'grain' | 'condiment' | 'beverage' | 'frozen' | 'snack' | 'other';
}

const foodItemsTool = {
  name: 'report_food_items' as const,
  description: 'Report all food items visible in the image with confidence scores',
  input_schema: {
    type: 'object' as const,
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
  },
};

export async function identifyFoodItems(
  base64Image: string,
  sourceLocation: 'fridge' | 'pantry' | 'freezer'
): Promise<ScanResult[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [foodItemsTool],
    tool_choice: { type: 'tool', name: 'report_food_items' },
    messages: [
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
            text: `Identify all visible food items in this ${sourceLocation} photo. For each item, estimate quantity and provide a confidence score. Be thorough - include partially visible items with lower confidence.`,
          },
        ],
      },
    ],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') return [];
  return (toolBlock.input as { items: ScanResult[] }).items;
}
