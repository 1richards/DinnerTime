import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockDiscoverRecipes,
  mockGetRecipes,
  mockAuthMiddleware,
  mockSupabaseClient,
} = vi.hoisted(() => {
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
      return {};
    }),
  };

  return {
    mockDiscoverRecipes: vi.fn(),
    mockGetRecipes: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    mockSupabaseClient: supabase,
  };
});

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

const sampleDiscovered = [
  {
    title: 'Eggplant Parmesan',
    description: 'Classic Italian.',
    ingredients: [{ name: 'eggplant', quantity: 2, unit: null, notes: null }],
    steps: ['Slice.', 'Bake.'],
    prep_time_minutes: 15,
    cook_time_minutes: 35,
    total_time_minutes: 50,
    servings: 4,
    source_url: null,
    source_type: 'ai',
    image_url: null,
  },
];

describe('POST /recipes/discover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Routes now share a module-scoped discovery cache; reset between tests so
    // an identical-key cached result doesn't suppress the discoverRecipes call.
    __resetDiscoveryCache();
    mockGetRecipes.mockResolvedValue({
      rows: [
        { id: 'r1', title: 'Grandma Spaghetti' },
        { id: 'r2', title: 'Chicken Tikka' },
      ],
      queryMs: 0,
      rowCount: 2,
    });
  });

  it('returns { data: ParsedRecipe[] } on success', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleDiscovered);

    const app = makeApp();
    const res = await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ data: sampleDiscovered });
  });

  it('passes preferences assembled from household_members + profile', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleDiscovered);

    const app = makeApp();
    await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(mockDiscoverRecipes).toHaveBeenCalledOnce();
    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(opts.preferences.allergies).toEqual(['Peanut']);
    expect(opts.preferences.dietary_restrictions).toEqual(['Vegetarian']);
    expect(opts.preferences.disliked_ingredients).toEqual(['mushrooms']);
    expect(opts.preferences.cuisine_preferences).toEqual(['Italian']);
  });

  it('passes library titles as existingTitles (AVOID list)', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleDiscovered);

    const app = makeApp();
    await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(opts.existingTitles).toEqual(['Grandma Spaghetti', 'Chicken Tikka']);
  });

  it('forwards optional body.prompt to the service', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleDiscovered);

    const app = makeApp();
    await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: '3 cozy soups please' }),
    });

    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(opts.prompt).toBe('3 cozy soups please');
  });

  it('handles empty request body (no prompt) without erroring', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleDiscovered);

    const app = makeApp();
    const res = await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // no body
    });

    expect(res.status).toBe(200);
    const opts = mockDiscoverRecipes.mock.calls[0][0];
    expect(opts.prompt).toBeUndefined();
  });

  it('returns 500 on service error', async () => {
    mockDiscoverRecipes.mockRejectedValue(new Error('claude exploded'));

    const app = makeApp();
    const res = await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('claude exploded');
  });

  it('does not persist any recipes (saveRecipe not called)', async () => {
    mockDiscoverRecipes.mockResolvedValue(sampleDiscovered);

    const recipeStore = await import('../../services/recipeStore.js');
    const app = makeApp();
    await app.request('/recipes/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect((recipeStore.saveRecipe as any)).not.toHaveBeenCalled();
  });
});
