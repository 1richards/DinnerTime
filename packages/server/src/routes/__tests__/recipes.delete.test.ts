import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDeleteRecipe, mockAuthMiddleware } = vi.hoisted(() => ({
  mockDeleteRecipe: vi.fn(),
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
  deleteRecipe: mockDeleteRecipe,
  getRecipes: vi.fn().mockResolvedValue([]),
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

describe('DELETE /recipes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 204 with empty body on success', async () => {
    mockDeleteRecipe.mockResolvedValue(undefined);

    const app = makeApp();
    const res = await app.request('/recipes/r1', { method: 'DELETE' });

    expect(res.status).toBe(204);
    const text = await res.text();
    expect(text).toBe('');
    expect(mockDeleteRecipe).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'r1'
    );
  });

  it('returns 500 on supabase failure', async () => {
    mockDeleteRecipe.mockRejectedValue(new Error('db failure'));

    const app = makeApp();
    const res = await app.request('/recipes/r1', { method: 'DELETE' });

    expect(res.status).toBe(500);
  });
});
