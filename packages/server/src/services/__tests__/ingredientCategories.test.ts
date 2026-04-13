import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 11-04: ingredientCategories now routes via the AIClient factory
// (Gemini flash-lite). We mock the factory directly — no vendor SDK coupling.
const { mockGenerateStructured, mockGetClientFor } = vi.hoisted(() => ({
  mockGenerateStructured: vi.fn(),
  mockGetClientFor: vi.fn(),
}));

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

import {
  STATIC_MAP,
  classifyStatic,
  classifyBatchWithHaiku,
  classifyItems,
  classifyIngredientsTool,
} from '../ingredientCategories.js';
import type { GroceryCategory } from '../../types/shopping.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClientFor.mockReturnValue({
    generateText: vi.fn(),
    generateStructured: mockGenerateStructured,
    analyzeImageStructured: vi.fn(),
  });
});

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

describe('classifyIngredientsTool schema', () => {
  it('preserves the enum constraint on category (Pitfall 5)', () => {
    const enumVals = (
      classifyIngredientsTool.schema.properties?.classifications.items
        ?.properties?.category as { enum?: string[] }
    ).enum;
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
  it('returns empty map without invoking the AI client for empty input', async () => {
    const result = await classifyBatchWithHaiku([]);
    expect(result).toEqual({});
    expect(mockGetClientFor).not.toHaveBeenCalled();
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it('resolves unknowns via generateStructured and returns a name→category map', async () => {
    mockGenerateStructured.mockResolvedValue({
      classifications: [
        { name: 'dragon fruit', category: 'produce' },
        { name: 'kimchi', category: 'condiments' },
      ],
    });

    const result = await classifyBatchWithHaiku(['dragon fruit', 'kimchi']);
    expect(result).toEqual({
      'dragon fruit': 'produce',
      kimchi: 'condiments',
    });
    expect(mockGetClientFor).toHaveBeenCalledWith('ingredient.categorize');
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);

    const callArgs = mockGenerateStructured.mock.calls[0][0];
    expect(callArgs.maxTokens).toBe(1024);
    expect(callArgs.tool.name).toBe('classify_ingredients');
    expect(callArgs.user).toContain('dragon fruit');
    expect(callArgs.user).toContain('kimchi');
  });
});

describe('classifyItems', () => {
  it('uses static for knowns and AI for unknowns, merging results', async () => {
    mockGenerateStructured.mockResolvedValue({
      classifications: [{ name: 'dragon fruit', category: 'produce' }],
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
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);

    // AI was only asked about the unknown
    const callArgs = mockGenerateStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('dragon fruit');
    expect(callArgs.user).not.toContain('tomato');
  });

  it('does NOT invoke the AI client when all items are statically known', async () => {
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
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it('defaults unknowns absent from AI response to "other" (input coverage guard)', async () => {
    mockGenerateStructured.mockResolvedValue({
      classifications: [{ name: 'kimchi', category: 'condiments' }],
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
