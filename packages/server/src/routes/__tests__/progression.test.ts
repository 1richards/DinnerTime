import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGetCookStats,
  mockRankAmbition,
  mockGetRecipeVariations,
  mockAuthMiddleware,
  state,
} = vi.hoisted(() => {
  const state: {
    cookStats: unknown[];
    recipes: Array<{ id: string; title: string; steps?: unknown[]; ingredients?: unknown[]; total_time_minutes?: number | null }>;
  } = {
    cookStats: [],
    recipes: [],
  };

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'recipes') {
        return {
          select: () => ({
            eq: () => ({ limit: () => Promise.resolve({ data: state.recipes, error: null }) }),
          }),
        };
      }
      return {};
    }),
  };

  return {
    mockGetCookStats: vi.fn(),
    mockRankAmbition: vi.fn(),
    mockGetRecipeVariations: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) {
        return c.json({ error: 'Missing auth' }, 401);
      }
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    state,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../config/anthropic.js', () => ({
  anthropic: { messages: { create: vi.fn() } },
}));

vi.mock('../../services/progression.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/progression.js')>(
    '../../services/progression.js',
  );
  return {
    ...actual,
    getCookStats: mockGetCookStats,
    rankAmbition: mockRankAmbition,
    getRecipeVariations: mockGetRecipeVariations,
  };
});

const { default: progressionRoutes } = await import('../progression.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/progression', progressionRoutes);
  return app;
}

describe('progression routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.cookStats = [];
    state.recipes = [];
  });

  it('Test 1: GET /cook-stats unauthenticated → 401', async () => {
    const app = makeApp();
    const res = await app.request('/progression/cook-stats', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('Test 2: GET /cook-stats returns aggregated stats', async () => {
    const stats = [
      { recipe_id: 'r1', title: 'Tacos', cook_count: 3, last_cooked_at: '2026-04-08T00:00:00Z' },
    ];
    mockGetCookStats.mockResolvedValue(stats);
    const app = makeApp();
    const res = await app.request('/progression/cook-stats', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(stats);
    expect(mockGetCookStats).toHaveBeenCalledWith(expect.anything(), 'user-1');
  });

  it('Test 3: GET /suggestions returns 3 ambition picks from rankAmbition', async () => {
    state.cookStats = [];
    state.recipes = [
      { id: 'c1', title: 'A', steps: [], ingredients: [], total_time_minutes: 30 },
      { id: 'c2', title: 'B', steps: [], ingredients: [], total_time_minutes: 30 },
      { id: 'c3', title: 'C', steps: [], ingredients: [], total_time_minutes: 30 },
    ];
    mockGetCookStats.mockResolvedValue([]);
    mockRankAmbition.mockResolvedValue([
      { recipe_id: 'c1', title: 'A', rationale: 'try this' },
      { recipe_id: 'c2', title: 'B', rationale: 'good next step' },
      { recipe_id: 'c3', title: 'C', rationale: 'stretch' },
    ]);
    const app = makeApp();
    const res = await app.request('/progression/suggestions', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(mockRankAmbition).toHaveBeenCalled();
  });

  it('Test 4: GET /variations/:id passes remix mode through to the service', async () => {
    mockGetRecipeVariations.mockResolvedValue([
      { title: 'Swap A', description: 'desc a' },
      { title: 'Swap B', description: 'desc b' },
      { title: 'Swap C', description: 'desc c' },
    ]);
    const app = makeApp();
    const res = await app.request('/progression/variations/r1?mode=protein', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.data[0]).toMatchObject({ title: expect.any(String), description: expect.any(String) });
    expect(body.mode).toBe('protein');
    expect(mockGetRecipeVariations).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'r1',
      'protein',
      // customInstructions is the optional 5th arg added when free-form
      // remix steering shipped; defaults to undefined when absent.
      undefined,
    );
  });

  it('Test 5: GET /variations/:id 200 with variations (default mode)', async () => {
    mockGetRecipeVariations.mockResolvedValue([
      { title: 'Swap Rice', description: 'Use jasmine rice instead for fragrance.' },
      { title: 'Add Chili', description: 'Finish with a chili crisp drizzle.' },
      { title: 'Try Saffron', description: 'Bloom saffron in warm stock.' },
    ]);
    const app = makeApp();
    const res = await app.request('/progression/variations/r1', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(3);
    expect(body.mode).toBe('surprise');
  });

  it('Test 6: GET /variations/:id 404 when recipe not owned', async () => {
    const err = new Error('Recipe not found') as Error & { code?: string };
    err.code = 'NOT_FOUND';
    mockGetRecipeVariations.mockRejectedValue(err);
    const app = makeApp();
    const res = await app.request('/progression/variations/r1', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(404);
  });
});
