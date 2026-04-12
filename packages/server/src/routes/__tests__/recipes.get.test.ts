import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetRecipes, mockAuthMiddleware } = vi.hoisted(() => ({
  mockGetRecipes: vi.fn(),
  mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set('user', { id: 'user-1' });
    c.set('supabase', {});
    await next();
  }),
}));

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../services/recipeStore.js', () => ({
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  getRecipes: mockGetRecipes,
  getRecipeById: vi.fn(),
  saveRecipe: vi.fn(),
  findRecipeBySourceUrl: vi.fn(),
}));

vi.mock('../../services/recipeParser.js', () => ({
  parseRecipeFromUrl: vi.fn(),
  parseRecipeFromPhoto: vi.fn(),
  parseRecipeFromText: vi.fn(),
}));

const { default: recipes } = await import('../recipes.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/recipes', recipes);
  return app;
}

describe('GET /recipes with query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRecipes.mockResolvedValue([]);
  });

  it('passes no options when no query params', async () => {
    const app = makeApp();
    const res = await app.request('/recipes');

    expect(res.status).toBe(200);
    expect(mockGetRecipes).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      expect.objectContaining({})
    );
    const call = mockGetRecipes.mock.calls[0][2];
    expect(call.q).toBeUndefined();
    expect(call.favoritesOnly).toBe(false);
  });

  it('passes q when ?q=pasta', async () => {
    const app = makeApp();
    await app.request('/recipes?q=pasta');

    const call = mockGetRecipes.mock.calls[0][2];
    expect(call.q).toBe('pasta');
    expect(call.favoritesOnly).toBe(false);
  });

  it('passes favoritesOnly when ?favorites=true', async () => {
    const app = makeApp();
    await app.request('/recipes?favorites=true');

    const call = mockGetRecipes.mock.calls[0][2];
    expect(call.favoritesOnly).toBe(true);
    expect(call.q).toBeUndefined();
  });

  it('passes both when ?q=pasta&favorites=true', async () => {
    const app = makeApp();
    await app.request('/recipes?q=pasta&favorites=true');

    const call = mockGetRecipes.mock.calls[0][2];
    expect(call.q).toBe('pasta');
    expect(call.favoritesOnly).toBe(true);
  });
});
