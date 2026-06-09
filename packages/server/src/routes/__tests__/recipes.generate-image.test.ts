/**
 * Phase 27 Plan 01 (Decision 1, Image P0): POST /recipes/generate-image
 * write-back coverage.
 *
 * The handler now accepts an optional `recipeId`. On a resolved (non-null)
 * url it must persist `recipes.image_url` scoped to the authed user via
 * supabaseAdmin (service role) with a `.eq('profile_id', user.id)` ownership
 * guard — so a saved recipe never re-requests generation on a later cold
 * start. With no recipeId, or with a null url, it must NOT write to the DB.
 *
 * Mock shape mirrors recipes.patch.test.ts / recipes.search.test.ts:
 *   - authMiddleware injects c.set('user', { id: 'user-1' })
 *   - supabaseAdmin is a chain-capturing mock so we can assert
 *     .from('recipes').update({ image_url }).eq('id', ...).eq('profile_id', ...)
 *   - generateRecipeImage is stubbed to a controllable url (null overridable)
 *
 * @see .planning/phases/27-.../27-01-PLAN.md
 * @see supabase/migrations/00004_recipes.sql ("Users can update own recipes")
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGenerateRecipeImage,
  mockAuthMiddleware,
  fromMock,
  updateMock,
  eqIdMock,
  eqProfileMock,
  resetSupabaseSpies,
} = vi.hoisted(() => {
  // Terminal awaitable resolving to a typical PostgREST update result.
  const eqProfileMock = vi.fn(async () => ({ data: null, error: null }));
  const eqIdMock = vi.fn(() => ({ eq: eqProfileMock }));
  const updateMock = vi.fn(() => ({ eq: eqIdMock }));
  const fromMock = vi.fn(() => ({ update: updateMock }));

  const resetSupabaseSpies = () => {
    fromMock.mockClear();
    updateMock.mockClear();
    eqIdMock.mockClear();
    eqProfileMock.mockClear();
    eqProfileMock.mockResolvedValue({ data: null, error: null });
  };

  return {
    mockGenerateRecipeImage: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      c.set('user', { id: 'user-1' });
      c.set('supabase', {});
      await next();
    }),
    fromMock,
    updateMock,
    eqIdMock,
    eqProfileMock,
    resetSupabaseSpies,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin: { from: fromMock },
  createUserClient: vi.fn(),
}));

vi.mock('../../services/recipeImageGen.js', () => ({
  generateRecipeImage: mockGenerateRecipeImage,
}));

// Unused-by-these-tests service deps still imported by the route module.
vi.mock('../../services/recipeStore.js', () => ({
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  getRecipes: vi.fn(async () => []),
  getRecipeById: vi.fn(),
  findRecipeBySourceUrl: vi.fn(),
  findRecipeByNormalizedTitle: vi.fn(),
  saveRecipe: vi.fn(),
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

const RESOLVED_URL = 'https://img/x.jpg';

async function postGenerateImage(body: Record<string, unknown>) {
  const app = makeApp();
  return app.request('/recipes/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /recipes/generate-image (Phase 27 — Image P0 write-back)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseSpies();
    mockGenerateRecipeImage.mockResolvedValue(RESOLVED_URL);
  });

  it('with recipeId + resolved url: UPDATEs recipes.image_url scoped to the authed user', async () => {
    const res = await postGenerateImage({
      title: 'Pesto Orzo',
      recipeId: 'recipe-123',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: RESOLVED_URL });

    // Write-back chain: .from('recipes').update({ image_url }).eq('id').eq('profile_id')
    expect(fromMock).toHaveBeenCalledWith('recipes');
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ image_url: RESOLVED_URL });
    expect(eqIdMock).toHaveBeenCalledWith('id', 'recipe-123');
    expect(eqProfileMock).toHaveBeenCalledWith('profile_id', 'user-1');
  });

  it('without recipeId: returns { url } and performs NO db write', async () => {
    const res = await postGenerateImage({ title: 'Pesto Orzo' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: RESOLVED_URL });

    expect(updateMock).not.toHaveBeenCalled();
    expect(eqProfileMock).not.toHaveBeenCalled();
  });

  it('null url with recipeId present: NO db write (does not clobber existing image)', async () => {
    mockGenerateRecipeImage.mockResolvedValue(null);

    const res = await postGenerateImage({
      title: 'Pesto Orzo',
      recipeId: 'recipe-123',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: null });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('ownership: cross-profile recipeId still scopes update to the AUTHED user, never the body', async () => {
    // Even if a caller tries to smuggle a profile_id in the body, the handler
    // ignores it and uses c.get('user').id — a different owner simply matches
    // zero rows. The .eq('profile_id', ...) arg must be the authed uid.
    const res = await postGenerateImage({
      title: 'Pesto Orzo',
      recipeId: 'someone-elses-recipe',
      profile_id: 'attacker-user',
    });

    expect(res.status).toBe(200);
    expect(eqIdMock).toHaveBeenCalledWith('id', 'someone-elses-recipe');
    expect(eqProfileMock).toHaveBeenCalledWith('profile_id', 'user-1');
    // The body's forged profile_id is never used as the guard value.
    expect(eqProfileMock).not.toHaveBeenCalledWith('profile_id', 'attacker-user');
  });

  it('missing/empty title still 400 (unchanged); no image gen, no db write', async () => {
    const res = await postGenerateImage({ recipeId: 'recipe-123' });

    expect(res.status).toBe(400);
    expect(mockGenerateRecipeImage).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
