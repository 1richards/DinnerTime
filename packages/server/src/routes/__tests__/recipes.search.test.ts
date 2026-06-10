/**
 * Phase 17 Wave 0 (plan 17-00): Integration tests for POST /recipes/search.
 *
 * The route does NOT exist yet — Plan 17-01 adds it. These cases are
 * red-by-design and will fail with 404 until that plan ships.
 *
 * Shape modeled after `recipes.discover.test.ts` (Phase 13) — same supabase
 * chainable-builder mock pattern, same authMiddleware injection, same
 * `vi.mock('../../services/recipeDiscovery.js', ...)` service stub.
 *
 * Why a NEW route instead of extending /discover:
 *   CONTEXT D-07 locks /discover's byte-exact shape + prompt + test suite.
 *   Phase 17 needs a two-argument call site (query + pantryOnly) without
 *   risking regression on the one-argument discover flow. The two routes
 *   share `buildDiscoveryPrompt` but have independent external contracts.
 *
 * @see .planning/phases/17-.../17-CONTEXT.md D-04, D-07
 * @see .planning/phases/17-.../17-RESEARCH.md § Validation Architecture
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDiscoverRecipes,
  mockAuthMiddleware,
  pantryRowsGetter,
  setPantryRows,
} = vi.hoisted(() => {
  let pantryRows: Array<{ name: string; confidence?: number }> = [];
  const setPantryRows = (rows: Array<{ name: string; confidence?: number }>) => {
    pantryRows = rows;
  };
  const pantryRowsGetter = () => pantryRows;

  const household = [
    {
      id: 'm1',
      profile_id: 'user-1',
      name: 'Alice',
      member_type: 'adult',
      age_range: null,
      dietary_restrictions: ['Vegetarian'],
      dietary_allergies: ['Peanut'],
      disliked_ingredients: ['mushrooms'],
    },
  ];
  const profile = {
    cuisine_preferences: ['Italian'],
    skill_level: 'intermediate',
  };

  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'household_members') {
        return {
          select: () => ({
            eq: () => ({ data: household, error: null }),
          }),
        };
      }
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({ data: profile, error: null }),
            }),
          }),
        };
      }
      if (table === 'pantry_items') {
        // Plan 17-01 is expected to select from pantry_items ordered by
        // confidence desc, capped at 50 (CONTEXT D-04 + Pitfall 3).
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: (n: number) => ({
                  data: pantryRowsGetter().slice(0, n),
                  error: null,
                }),
                // Also support the chainable pattern where limit isn't used
                data: pantryRowsGetter(),
                error: null,
              }),
              // Fallback if no order() is applied
              data: pantryRowsGetter(),
              error: null,
            }),
          }),
        };
      }
      if (table === 'recipes') {
        // Library-titles query (same pattern as /discover AVOID list)
        return {
          select: () => ({
            eq: () => ({ data: [], error: null }),
          }),
        };
      }
      return {};
    }),
  };

  return {
    mockDiscoverRecipes: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    pantryRowsGetter,
    setPantryRows,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../services/recipeStore.js', () => ({
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  getRecipes: vi.fn(async () => ({ rows: [], queryMs: 0, rowCount: 0 })),
  getRecipeById: vi.fn(),
  saveRecipe: vi.fn(),
  findRecipeBySourceUrl: vi.fn(),
}));

vi.mock('../../services/recipeParser.js', () => ({
  parseRecipeFromUrl: vi.fn(),
  parseRecipeFromPhoto: vi.fn(),
  parseRecipeFromText: vi.fn(),
  applyRemixVariation: vi.fn(),
}));

vi.mock('../../services/recipeDiscovery.js', () => ({
  discoverRecipes: mockDiscoverRecipes,
}));

const { default: recipes } = await import('../recipes.js');
const { __resetDiscoveryCache } = await import('../../services/discoveryCache.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/recipes', recipes);
  return app;
}

const sampleRecipes = [
  {
    title: 'Pesto Orzo',
    description: 'Weeknight quick.',
    ingredients: [{ name: 'orzo', quantity: 1, unit: 'cup', notes: null }],
    steps: ['Boil.', 'Mix.'],
    prep_time_minutes: 5,
    cook_time_minutes: 15,
    total_time_minutes: 20,
    servings: 2,
    source_url: null,
    source_type: 'ai',
    image_url: null,
  },
];

describe('POST /recipes/search (Phase 17 Wave 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPantryRows([]);
    // Routes now share a module-scoped discovery cache; reset between tests so
    // a cached result from a prior test doesn't suppress the discoverRecipes call.
    __resetDiscoveryCache();
  });

  it('P17-04: returns 400 when query is missing or empty', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleRecipes);

    const app = makeApp();

    // No query
    const res1 = await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pantryOnly: false }),
    });
    expect(res1.status).toBe(400);

    // Empty string query
    const res2 = await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', pantryOnly: false }),
    });
    expect(res2.status).toBe(400);

    // Whitespace-only query
    const res3 = await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '   ', pantryOnly: false }),
    });
    expect(res3.status).toBe(400);
  });

  it('P17-04: with valid query calls discoverRecipes with prompt === body.query', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleRecipes);

    const app = makeApp();
    const res = await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'quick weeknight pasta', pantryOnly: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: sampleRecipes });

    expect(mockDiscoverRecipes).toHaveBeenCalledOnce();
    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(opts.prompt).toBe('quick weeknight pasta');
  });

  it('P17-04: with pantryOnly:true threads pantry names into discoverRecipes as pantryManifest', async () => {
    setPantryRows([
      { name: 'eggs', confidence: 0.9 },
      { name: 'spinach', confidence: 0.85 },
      { name: 'feta', confidence: 0.8 },
    ]);
    mockDiscoverRecipes.mockResolvedValue(sampleRecipes);

    const app = makeApp();
    await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'breakfast', pantryOnly: true }),
    });

    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(opts.pantryManifest).toEqual(['eggs', 'spinach', 'feta']);
  });

  it('P17-04 Pitfall 3: caps pantryManifest at 50 items when pantry has 100', async () => {
    // Populate 100 rows; pantry_items mock returns slice(0, limit)
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      name: `ingredient-${i}`,
      confidence: 1 - i * 0.001,
    }));
    setPantryRows(hundred);
    mockDiscoverRecipes.mockResolvedValue(sampleRecipes);

    const app = makeApp();
    await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'x', pantryOnly: true }),
    });

    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(Array.isArray(opts.pantryManifest)).toBe(true);
    expect(opts.pantryManifest.length).toBe(50);
    // Ordered by confidence desc → first entry is ingredient-0
    expect(opts.pantryManifest[0]).toBe('ingredient-0');
  });

  it('P17-04: with pantryOnly:false does NOT pass a pantryManifest', async () => {
    setPantryRows([{ name: 'eggs', confidence: 0.9 }]);
    mockDiscoverRecipes.mockResolvedValue(sampleRecipes);

    const app = makeApp();
    await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'x', pantryOnly: false }),
    });

    const opts = mockDiscoverRecipes.mock.calls[0][0];
    // pantryManifest is either omitted (undefined) or empty; both indicate
    // no constraint.
    const manifest = opts.pantryManifest;
    expect(manifest === undefined || manifest.length === 0).toBe(true);
  });

  it('P17-04: returns 500 on service error', async () => {
    mockDiscoverRecipes.mockRejectedValue(new Error('AI upstream exploded'));

    const app = makeApp();
    const res = await app.request('/recipes/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'pasta', pantryOnly: false }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('AI upstream exploded');
  });
});
