import { beforeEach, describe, expect, it, vi } from 'vitest';

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
import {
  consolidateIngredients,
  subtractPantry,
  suggestVariations,
} from '../shoppingList.js';
import type { MealPlanEntry } from '../../types/mealPlan.js';
import type { ConsolidatedItem } from '../../types/shopping.js';
import type { PantryItem } from '../pantry.js';

// ----- test helpers -----

function makeEntry(
  title: string,
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>,
): MealPlanEntry {
  return {
    id: `entry-${title}`,
    meal_plan_id: 'mp-1',
    day_of_week: 0,
    recipe_id: null,
    title,
    description: null,
    ingredients,
    ingredients_needed: ingredients,
    estimated_time_minutes: null,
    difficulty: null,
    kid_friendly: false,
    why_suggested: null,
    status: 'planned',
    cooked_at: null,
    created_at: '2026-04-10T00:00:00Z',
  };
}

function makePantryItem(name: string, quantity: number, unit = 'cups'): PantryItem {
  return {
    id: `p-${name}`,
    profile_id: 'prof-1',
    name,
    normalized_name: name.toLowerCase(),
    quantity,
    unit,
    category: 'produce',
    source_location: 'fridge',
    confidence: 1,
    status: 'active',
    last_seen_at: '2026-04-10T00:00:00Z',
  };
}

// ============================================================
// consolidateIngredients
// ============================================================

describe('consolidateIngredients', () => {
  it('sums matching-unit quantities for same ingredient', () => {
    const entries = [
      makeEntry('Soup', [{ name: 'tomato', quantity: 2, unit: 'cups' }]),
      makeEntry('Salad', [{ name: 'tomato', quantity: 2, unit: 'cups' }]),
    ];
    const result = consolidateIngredients(entries);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('tomato');
    expect(result[0].normalizedName).toBe('tomato');
    expect(result[0].quantity).toBe(4);
    expect(result[0].unit).toBe('cups');
    expect(result[0].sources).toEqual(expect.arrayContaining(['Soup', 'Salad']));
  });

  it('nulls unit and takes max when units conflict', () => {
    const entries = [
      makeEntry('Stew', [{ name: 'chicken broth', quantity: 2, unit: 'cups' }]),
      makeEntry('Risotto', [{ name: 'chicken broth', quantity: 1, unit: 'can' }]),
    ];
    const result = consolidateIngredients(entries);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
    expect(result[0].unit).toBeNull();
    expect(result[0].sources).toEqual(expect.arrayContaining(['Stew', 'Risotto']));
  });

  it('collapses Tomatoes and tomato via normalizeIngredientName', () => {
    const entries = [
      makeEntry('A', [{ name: 'Tomatoes', quantity: 1, unit: 'cup' }]),
      makeEntry('B', [{ name: 'tomato', quantity: 2, unit: 'cup' }]),
    ];
    const result = consolidateIngredients(entries);
    expect(result).toHaveLength(1);
    expect(result[0].normalizedName).toBe('tomato');
    expect(result[0].quantity).toBe(3);
    expect(result[0].unit).toBe('cup');
  });

  it('dedupes duplicate source recipe titles', () => {
    const entries = [
      makeEntry('Soup', [{ name: 'onion', quantity: 1, unit: 'cup' }]),
      makeEntry('Soup', [{ name: 'onion', quantity: 1, unit: 'cup' }]),
    ];
    const result = consolidateIngredients(entries);
    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual(['Soup']);
  });

  it('does not mutate the input entries array', () => {
    const entries = [makeEntry('Soup', [{ name: 'tomato', quantity: 2, unit: 'cups' }])];
    const snapshot = JSON.parse(JSON.stringify(entries));
    consolidateIngredients(entries);
    expect(entries).toEqual(snapshot);
  });
});

// ============================================================
// subtractPantry
// ============================================================

describe('subtractPantry', () => {
  const makeItem = (name: string, quantity: number, unit: string | null = 'cups'): ConsolidatedItem => ({
    name,
    normalizedName: name.toLowerCase(),
    quantity,
    unit,
    sources: ['Recipe'],
  });

  it('removes item entirely when pantry fully stocks it', () => {
    const needed = [makeItem('tomato', 3)];
    const pantry = [makePantryItem('tomato', 5)];
    const result = subtractPantry(needed, pantry);
    expect(result).toHaveLength(0);
  });

  it('reduces quantity when pantry partially covers need', () => {
    const needed = [makeItem('tomato', 5)];
    const pantry = [makePantryItem('tomato', 2)];
    const result = subtractPantry(needed, pantry);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(3);
  });

  it('matches pantry tomato to needed Tomatoes via normalization', () => {
    const needed = [makeItem('Tomatoes', 4)];
    const pantry = [makePantryItem('tomato', 4)];
    const result = subtractPantry(needed, pantry);
    expect(result).toHaveLength(0);
  });

  it('passes item through unchanged when no pantry match', () => {
    const needed = [makeItem('saffron', 1)];
    const pantry = [makePantryItem('tomato', 5)];
    const result = subtractPantry(needed, pantry);
    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(1);
    expect(result[0].name).toBe('saffron');
  });

  it('does not mutate the input needed array', () => {
    const needed = [makeItem('tomato', 5)];
    const pantry = [makePantryItem('tomato', 2)];
    const snapshot = JSON.parse(JSON.stringify(needed));
    subtractPantry(needed, pantry);
    expect(needed).toEqual(snapshot);
  });
});

// ============================================================
// suggestVariations
// ============================================================

describe('suggestVariations', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  const items: ConsolidatedItem[] = [
    { name: 'chicken breast', normalizedName: 'chicken breast', quantity: 2, unit: 'lb', sources: ['A'] },
    { name: 'white rice', normalizedName: 'white rice', quantity: 1, unit: 'cup', sources: ['B'] },
    { name: 'broccoli', normalizedName: 'broccoli', quantity: 1, unit: 'head', sources: ['C'] },
  ];

  function mockSwapResponse(swaps: Array<{ instead_of: string; swap: string; rationale: string }>) {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          name: 'suggest_swaps',
          input: { swaps },
        },
      ],
    });
  }

  it('calls Claude Haiku with suggest_swaps tool forced', async () => {
    mockSwapResponse([
      { instead_of: 'chicken breast', swap: 'chicken thigh', rationale: 'cheaper, juicier' },
      { instead_of: 'white rice', swap: 'brown rice', rationale: 'more fiber' },
      { instead_of: 'broccoli', swap: 'broccolini', rationale: 'faster cook' },
    ]);

    await suggestVariations(items);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const call = mockCreate.mock.calls[0][0];
    expect(call.model).toBe('claude-haiku-4-latest');
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'suggest_swaps' });
    expect(Array.isArray(call.tools)).toBe(true);
    const tool = call.tools.find((t: { name: string }) => t.name === 'suggest_swaps');
    expect(tool).toBeDefined();
    expect(tool.input_schema.properties.swaps.maxItems).toBe(5);
  });

  it('parses tool_use block and returns VariationSuggestion[] (3-5 items)', async () => {
    mockSwapResponse([
      { instead_of: 'chicken breast', swap: 'tofu', rationale: 'plant-based' },
      { instead_of: 'white rice', swap: 'quinoa', rationale: 'protein' },
      { instead_of: 'broccoli', swap: 'asparagus', rationale: 'seasonal' },
    ]);

    const result = await suggestVariations(items);
    expect(result).toHaveLength(3);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(5);
    for (const suggestion of result) {
      expect(typeof suggestion.instead_of).toBe('string');
      expect(typeof suggestion.swap).toBe('string');
      expect(typeof suggestion.rationale).toBe('string');
    }
    expect(result[0].swap).toBe('tofu');
  });

  it('throws when Claude returns no tool_use block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'sorry no tools today' }],
    });

    await expect(suggestVariations(items)).rejects.toThrow(/no tool_use/i);
  });
});
