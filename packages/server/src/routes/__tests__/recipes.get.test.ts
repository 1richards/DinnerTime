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
    // getRecipes now returns the timing-bearing { rows, queryMs, rowCount } shape.
    mockGetRecipes.mockResolvedValue({ rows: [], queryMs: 5, rowCount: 0 });
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

  it('returns { data } body and emits a recipes.list sub-stage log', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGetRecipes.mockResolvedValue({
      rows: [{ id: 'r1', title: 'Soup' }],
      queryMs: 7,
      rowCount: 1,
    });

    const app = makeApp();
    const res = await app.request('/recipes');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: [{ id: 'r1', title: 'Soup' }] });

    const logged = logSpy.mock.calls.map((args) => String(args[0]));
    expect(logged.some((line) => line.includes('recipes.list'))).toBe(true);
    const listLine = logged.find((line) => line.includes('recipes.list'))!;
    const parsed = JSON.parse(listLine);
    expect(parsed.db_query_ms).toBe(7);
    expect(parsed.row_count).toBe(1);
    expect(typeof parsed.payload_bytes).toBe('number');

    logSpy.mockRestore();
  });
});
