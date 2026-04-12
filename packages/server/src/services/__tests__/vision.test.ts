import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock fn is available before vi.mock hoisting
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

// Must import after mock setup
import { identifyFoodItems } from '../vision.js';

describe('identifyFoodItems', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('sends correct message structure to Claude (image block + text with source_location)', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'report_food_items',
          input: { items: [] },
        },
      ],
    });

    await identifyFoodItems('base64data', 'fridge');

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];

    // Should have messages with image block + text block
    expect(callArgs.messages).toHaveLength(1);
    const content = callArgs.messages[0].content;
    expect(content).toHaveLength(2);

    // Image block
    expect(content[0]).toMatchObject({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: 'base64data',
      },
    });

    // Text block mentions source location
    expect(content[1].type).toBe('text');
    expect(content[1].text).toContain('fridge');
  });

  it('parses tool_use response into ScanResult array', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'report_food_items',
          input: {
            items: [
              {
                name: 'milk',
                quantity: 1,
                unit: 'gallon',
                confidence: 0.95,
                category: 'dairy',
              },
              {
                name: 'eggs',
                quantity: 12,
                unit: 'piece',
                confidence: 0.9,
                category: 'protein',
              },
            ],
          },
        },
      ],
    });

    const result = await identifyFoodItems('base64data', 'fridge');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'milk',
      quantity: 1,
      unit: 'gallon',
      confidence: 0.95,
      category: 'dairy',
    });
    expect(result[1]).toEqual({
      name: 'eggs',
      quantity: 12,
      unit: 'piece',
      confidence: 0.9,
      category: 'protein',
    });
  });

  it('returns empty array when no tool_use block in response', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'I cannot identify items in this image.',
        },
      ],
    });

    const result = await identifyFoodItems('base64data', 'fridge');
    expect(result).toEqual([]);
  });

  it('uses claude-sonnet-4-20250514 model', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'report_food_items',
          input: { items: [] },
        },
      ],
    });

    await identifyFoodItems('base64data', 'fridge');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-20250514');
  });

  it('works for all three source locations (fridge, pantry, freezer)', async () => {
    const locations = ['fridge', 'pantry', 'freezer'] as const;

    for (const location of locations) {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'report_food_items',
            input: { items: [] },
          },
        ],
      });

      await identifyFoodItems('base64data', location);

      const callArgs = mockCreate.mock.calls[mockCreate.mock.calls.length - 1][0];
      const textBlock = callArgs.messages[0].content[1];
      expect(textBlock.text).toContain(location);
    }
  });
});
