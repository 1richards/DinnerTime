/**
 * Phase 29 Plan 02 (D3): Integration tests for POST /recipes/hydrate.
 *
 * Modeled on recipes.search.test.ts — same authMiddleware injection + service
 * stub pattern. The route takes a light preview and returns the full-content
 * fields ({ ingredients, steps, nutrition, servings }) the client patches onto
 * the preview after the card renders.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHydrateRecipePreview, mockAuthMiddleware } = vi.hoisted(() => {
  const supabase = {
    from: vi.fn().mockImplementation(() => ({})),
  };
  return {
    mockHydrateRecipePreview: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../services/recipeHydration.js', () => ({
  hydrateRecipePreview: mockHydrateRecipePreview,
}));

// Stub the rest of the recipes route's heavy service deps so the module imports
// cleanly under the test env (mirrors recipes.search.test.ts).
vi.mock('../../services/recipeStore.js', () => ({
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  getRecipes: vi.fn(async () => ({ rows: [], queryMs: 0, rowCount: 0 })),
  getRecipeById: vi.fn(),
  saveRecipe: vi.fn(),
  findRecipeBySourceUrl: vi.fn(),
  findRecipeByNormalizedTitle: vi.fn(),
  RECIPE_LIST_LIMIT: 100,
}));

vi.mock('../../services/recipeParser.js', () => ({
  parseRecipeFromUrl: vi.fn(),
  parseRecipeFromPhoto: vi.fn(),
  parseRecipeFromText: vi.fn(),
  applyRemixVariation: vi.fn(),
}));

vi.mock('../../services/recipeDiscovery.js', () => ({
  discoverRecipes: vi.fn(),
}));

const { default: recipes } = await import('../recipes.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/recipes', recipes);
  return app;
}

const fullRecipe = {
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
  source_url: null,
  source_type: 'ai',
  image_url: null,
  calories_per_serving: 420,
  protein_grams_per_serving: 38,
  fat_grams_per_serving: 18,
};

const validPreview = {
  title: 'Lemon Garlic Chicken',
  description: 'Bright weeknight chicken.',
  difficulty: 'easy',
  total_time_minutes: 30,
  cuisine: 'American',
  ingredient_names: ['chicken breast', 'lemon', 'garlic'],
};

describe('POST /recipes/hydrate (Phase 29 Plan 02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valid preview -> 200 with full ingredients + steps + nutrition', async () => {
    mockHydrateRecipePreview.mockResolvedValue(fullRecipe);

    const app = makeApp();
    const res = await app.request('/recipes/hydrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPreview),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ingredients.length).toBeGreaterThan(0);
    expect(body.data.steps.length).toBeGreaterThan(0);
    expect(body.data.calories_per_serving).toBe(420);
    expect(body.data.protein_grams_per_serving).toBe(38);
    expect(body.data.servings).toBe(4);

    expect(mockHydrateRecipePreview).toHaveBeenCalledOnce();
    expect(mockHydrateRecipePreview.mock.calls[0][0].title).toBe('Lemon Garlic Chicken');
  });

  it('missing title -> 400', async () => {
    const app = makeApp();
    const res = await app.request('/recipes/hydrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'no title here' }),
    });

    expect(res.status).toBe(400);
    expect(mockHydrateRecipePreview).not.toHaveBeenCalled();
  });

  it('empty/whitespace title -> 400', async () => {
    const app = makeApp();
    const res = await app.request('/recipes/hydrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });

    expect(res.status).toBe(400);
  });

  it('bad JSON -> 400', async () => {
    const app = makeApp();
    const res = await app.request('/recipes/hydrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });

    expect(res.status).toBe(400);
  });

  it('service failure -> 500 with error', async () => {
    mockHydrateRecipePreview.mockRejectedValue(new Error('gemini boom'));

    const app = makeApp();
    const res = await app.request('/recipes/hydrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPreview),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
