import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mock functions so they are available before vi.mock hoisting
const { mockUpdateRecipe, mockAuthMiddleware } = vi.hoisted(() => ({
  mockUpdateRecipe: vi.fn(),
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
  updateRecipe: mockUpdateRecipe,
  deleteRecipe: vi.fn(),
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

// Import after mocks
const { default: recipes } = await import('../recipes.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/recipes', recipes);
  return app;
}

describe('PATCH /recipes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 and updated data for whitelisted fields', async () => {
    const updated = { id: 'r1', title: 'New', is_favorite: true };
    mockUpdateRecipe.mockResolvedValue(updated);

    const app = makeApp();
    const res = await app.request('/recipes/r1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New', is_favorite: true }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: updated });
    expect(mockUpdateRecipe).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'r1',
      { title: 'New', is_favorite: true }
    );
  });

  it('strips unknown fields from patch', async () => {
    const updated = { id: 'r1', title: 'Safe' };
    mockUpdateRecipe.mockResolvedValue(updated);

    const app = makeApp();
    const res = await app.request('/recipes/r1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Safe',
        hacker: 'drop tables',
        profile_id: 'other-user',
        id: 'other-id',
      }),
    });

    expect(res.status).toBe(200);
    // Only title is whitelisted out of these
    expect(mockUpdateRecipe).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'r1',
      { title: 'Safe' }
    );
  });

  it('returns 404 when recipe not found', async () => {
    mockUpdateRecipe.mockResolvedValue(null);

    const app = makeApp();
    const res = await app.request('/recipes/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 500 when updateRecipe throws', async () => {
    mockUpdateRecipe.mockRejectedValue(new Error('db blew up'));

    const app = makeApp();
    const res = await app.request('/recipes/r1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x' }),
    });

    expect(res.status).toBe(500);
  });
});
