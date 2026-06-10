/**
 * Phase 29 Plan 02 (D3): recipeHydration — preview → full ParsedRecipe via the
 * proven single-call recipe.parseText engine, content-address cached + inflight
 * coalesced. Mirrors the recipeParser.test.ts clientFactory mock conventions and
 * the discoveryCache content-address cache.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateStructured, mockGetClientFor } = vi.hoisted(() => {
  const mockGenerateStructured = vi.fn();
  const mockGetClientFor = vi.fn(() => ({
    generateText: vi.fn(),
    generateStructured: mockGenerateStructured,
    analyzeImageStructured: vi.fn(),
  }));
  return { mockGenerateStructured, mockGetClientFor };
});

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

import {
  hydrateRecipePreview,
  __resetHydrationCache,
  HYDRATION_CACHE_TTL_MS,
} from '../recipeHydration.js';

function fullRecipeToolOutput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Lemon Garlic Chicken',
    description: 'Bright weeknight chicken.',
    ingredients: [
      { name: 'chicken breast', quantity: 1.5, unit: 'lb', notes: 'sliced' },
      { name: 'lemon', quantity: 2, unit: null, notes: 'juiced' },
    ],
    steps: ['Sear the chicken.', 'Add lemon and garlic.', 'Simmer 10 minutes.'],
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    total_time_minutes: 30,
    servings: 4,
    calories_per_serving: 420,
    protein_grams_per_serving: 38,
    ...overrides,
  };
}

const basePreview = {
  title: 'Lemon Garlic Chicken',
  description: 'Bright weeknight chicken.',
  difficulty: 'easy',
  total_time_minutes: 30,
  cuisine: 'American',
  ingredient_names: ['chicken breast', 'lemon', 'garlic'],
};

describe('hydrateRecipePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetHydrationCache();
  });

  it('exports a sane TTL', () => {
    expect(HYDRATION_CACHE_TTL_MS).toBe(30 * 60 * 1000);
  });

  it('returns a full recipe with non-empty ingredients + steps via one recipe.parseText call', async () => {
    mockGenerateStructured.mockResolvedValue(fullRecipeToolOutput());

    const recipe = await hydrateRecipePreview(basePreview);

    expect(recipe.ingredients.length).toBeGreaterThan(0);
    expect(recipe.steps.length).toBeGreaterThan(0);
    expect(recipe.calories_per_serving).toBe(420);
    expect(recipe.protein_grams_per_serving).toBe(38);
    // routed via the recipe.parseText task
    expect(mockGetClientFor).toHaveBeenCalledWith('recipe.parseText');
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
    // the prompt seeds the model with the preview title + known ingredients
    const callArg = mockGenerateStructured.mock.calls[0][0];
    expect(callArg.user).toContain('Lemon Garlic Chicken');
    expect(callArg.user).toContain('chicken breast');
  });

  it('returns the cached result on a second identical call (no second AI call)', async () => {
    mockGenerateStructured.mockResolvedValue(fullRecipeToolOutput());

    const first = await hydrateRecipePreview(basePreview);
    const second = await hydrateRecipePreview({ ...basePreview });

    expect(first.steps).toEqual(second.steps);
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent identical calls into one AI call', async () => {
    mockGenerateStructured.mockResolvedValue(fullRecipeToolOutput());

    const [a, b] = await Promise.all([
      hydrateRecipePreview(basePreview),
      hydrateRecipePreview({ ...basePreview }),
    ]);

    expect(a.steps).toEqual(b.steps);
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
  });

  it('makes a separate AI call for a different preview (key differs)', async () => {
    mockGenerateStructured
      .mockResolvedValueOnce(fullRecipeToolOutput({ title: 'Lemon Garlic Chicken' }))
      .mockResolvedValueOnce(fullRecipeToolOutput({ title: 'Spicy Tofu Stir-Fry' }));

    await hydrateRecipePreview(basePreview);
    await hydrateRecipePreview({
      ...basePreview,
      title: 'Spicy Tofu Stir-Fry',
      ingredient_names: ['tofu', 'soy sauce', 'chili'],
    });

    expect(mockGenerateStructured).toHaveBeenCalledTimes(2);
  });
});
