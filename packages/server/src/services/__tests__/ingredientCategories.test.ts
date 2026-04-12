import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock for anthropic client (must be declared before vi.mock hoisting)
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('../../config/anthropic.js', () => ({
  anthropic: {
    messages: { create: mockCreate },
  },
}));

import {
  STATIC_MAP,
  classifyStatic,
  classifyBatchWithHaiku,
  classifyItems,
} from '../ingredientCategories.js';
import type { GroceryCategory } from '../../types/shopping.js';

describe('STATIC_MAP', () => {
  it('has at least 150 entries', () => {
    expect(Object.keys(STATIC_MAP).length).toBeGreaterThanOrEqual(150);
  });

  it('covers at least 9 grocery categories (all except other)', () => {
    const categories = new Set<GroceryCategory>(Object.values(STATIC_MAP));
    const expected: GroceryCategory[] = [
      'produce',
      'dairy',
      'protein',
      'pantry',
      'bakery',
      'frozen',
      'beverages',
      'condiments',
      'spices',
    ];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });
});

describe('classifyStatic', () => {
  it('returns produce for tomato', () => {
    expect(classifyStatic('tomato')).toBe('produce');
  });

  it('returns dairy for milk', () => {
    expect(classifyStatic('milk')).toBe('dairy');
  });

  it('returns protein for chicken', () => {
    expect(classifyStatic('chicken')).toBe('protein');
  });

  it('returns protein for ground beef via token fallback on beef', () => {
    expect(classifyStatic('ground beef')).toBe('protein');
  });

  it('returns null for unknown items', () => {
    expect(classifyStatic('unicorn meat')).toBeNull();
  });

  it('handles multi-token fallback: "organic baby spinach" → produce', () => {
    expect(classifyStatic('organic baby spinach')).toBe('produce');
  });
});

describe('classifyBatchWithHaiku', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('returns empty map without calling Claude for empty input', async () => {
    const result = await classifyBatchWithHaiku([]);
    expect(result).toEqual({});
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('resolves unknowns via Claude tool-use and returns a name→category map', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'classify_ingredients',
          input: {
            classifications: [
              { name: 'dragon fruit', category: 'produce' },
              { name: 'kimchi', category: 'condiments' },
            ],
          },
        },
      ],
    });

    const result = await classifyBatchWithHaiku(['dragon fruit', 'kimchi']);
    expect(result).toEqual({
      'dragon fruit': 'produce',
      kimchi: 'condiments',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Verify the call used claude-haiku with forced tool_choice + enum
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toMatch(/haiku/);
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'classify_ingredients' });
    const tool = callArgs.tools[0];
    expect(tool.name).toBe('classify_ingredients');
    const enumVals =
      tool.input_schema.properties.classifications.items.properties.category.enum;
    expect(enumVals).toEqual([
      'produce',
      'dairy',
      'protein',
      'pantry',
      'bakery',
      'frozen',
      'beverages',
      'condiments',
      'spices',
      'other',
    ]);
  });
});

describe('classifyItems', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('uses static for knowns and Haiku for unknowns, merging results', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'classify_ingredients',
          input: {
            classifications: [{ name: 'dragon fruit', category: 'produce' }],
          },
        },
      ],
    });

    const result = await classifyItems([
      { normalizedName: 'tomato' },
      { normalizedName: 'chicken' },
      { normalizedName: 'dragon fruit' },
    ]);

    expect(result).toEqual({
      tomato: 'produce',
      chicken: 'protein',
      'dragon fruit': 'produce',
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);

    // Haiku was only asked about the unknown
    const callArgs = mockCreate.mock.calls[0][0];
    const userMsg = JSON.stringify(callArgs.messages);
    expect(userMsg).toContain('dragon fruit');
    expect(userMsg).not.toContain('tomato');
  });

  it('does NOT invoke Claude when all items are statically known', async () => {
    const result = await classifyItems([
      { normalizedName: 'tomato' },
      { normalizedName: 'milk' },
      { normalizedName: 'chicken' },
    ]);

    expect(result).toEqual({
      tomato: 'produce',
      milk: 'dairy',
      chicken: 'protein',
    });
    expect(mockCreate).toHaveBeenCalledTimes(0);
  });

  it('defaults unknowns absent from AI response to "other"', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'classify_ingredients',
          input: {
            classifications: [{ name: 'kimchi', category: 'condiments' }],
          },
        },
      ],
    });

    const result = await classifyItems([
      { normalizedName: 'kimchi' },
      { normalizedName: 'gloopworts' },
    ]);

    expect(result).toEqual({
      kimchi: 'condiments',
      gloopworts: 'other',
    });
  });
});
