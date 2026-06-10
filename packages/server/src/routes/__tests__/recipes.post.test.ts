/**
 * Phase 28 Plan 02 (O2): POST /recipes generate-on-save coverage.
 *
 * When a recipe is SAVED, the handler kicks off image generation + image_url
 * persist FIRE-AND-FORGET, AFTER returning 201, so the save UX is never
 * blocked by the Gemini round-trip. The list then never cold-generates for a
 * newly-saved recipe (image_url is populated before the list loads).
 *
 * Contract under test:
 *   1. POST a recipe WITHOUT image_url → 201 returns immediately; the
 *      synchronous body's data.image_url is still null (gen hasn't completed).
 *   2. After flushing microtasks, supabaseAdmin.update({ image_url }) is called
 *      with the saved row's id, scoped to the authed profile_id.
 *   3. POST a recipe that hits the dedup early-return (existing title) →
 *      generateRecipeImageWithMeta is NOT called (no generate-on-save).
 *
 * Mock shape mirrors recipes.generate-image.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGenerateRecipeImageWithMeta,
  mockRecordAiCall,
  mockSaveRecipe,
  mockFindByNormalizedTitle,
  mockAuthMiddleware,
  fromMock,
  updateMock,
  eqIdMock,
  eqProfileMock,
  resetSupabaseSpies,
} = vi.hoisted(() => {
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
    mockGenerateRecipeImageWithMeta: vi.fn(),
    mockRecordAiCall: vi.fn(async () => {}),
    mockSaveRecipe: vi.fn(),
    mockFindByNormalizedTitle: vi.fn(),
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
  generateRecipeImage: vi.fn(),
  generateRecipeImageWithMeta: mockGenerateRecipeImageWithMeta,
  RECIPE_IMAGE_MODEL: 'gemini-2.5-flash-image',
}));

vi.mock('../../ai/aiTelemetry.js', () => ({
  recordAiCall: mockRecordAiCall,
}));

vi.mock('../../services/recipeStore.js', () => ({
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
  getRecipes: vi.fn(async () => ({ rows: [], queryMs: 0, rowCount: 0 })),
  getRecipeById: vi.fn(),
  findRecipeBySourceUrl: vi.fn(),
  findRecipeByNormalizedTitle: mockFindByNormalizedTitle,
  saveRecipe: mockSaveRecipe,
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

const GENERATED_URL = 'https://img/generated.jpg';

const VALID_BODY = {
  title: 'Lemon Garlic Salmon',
  ingredients: [{ name: 'salmon' }, { name: 'lemon' }],
  steps: ['season', 'bake'],
};

async function postRecipe(body: Record<string, unknown>) {
  const app = makeApp();
  return app.request('/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Flush the fire-and-forget microtask queued via Promise.resolve().then().
const flushMicrotasks = () =>
  new Promise((r) => setImmediate(r as () => void));

describe('POST /recipes — generate-on-save (Phase 28 O2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseSpies();
    mockFindByNormalizedTitle.mockResolvedValue(null); // no dedup hit
    mockSaveRecipe.mockResolvedValue({
      id: 'recipe-77',
      title: 'Lemon Garlic Salmon',
      description: 'bright + buttery',
      ingredients: [{ name: 'salmon' }, { name: 'lemon' }],
      image_url: null,
    });
    mockGenerateRecipeImageWithMeta.mockResolvedValue({
      url: GENERATED_URL,
      cacheHit: false,
      genMs: 800,
    });
    mockRecordAiCall.mockResolvedValue(undefined);
  });

  it('returns 201 immediately; response body carries the saved row (image_url null)', async () => {
    const res = await postRecipe(VALID_BODY);

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { image_url: unknown } };
    // The 201 body is the saveRecipe row as-saved — image_url is null because
    // generation is fire-and-forget and does not mutate the response. The
    // handler returns without awaiting generateRecipeImageWithMeta (the persist
    // happens on a later microtask, asserted in the next test).
    expect(json.data.image_url).toBeNull();
  });

  it('after microtask flush: persists generated image_url scoped to id + profile_id', async () => {
    await postRecipe(VALID_BODY);
    await flushMicrotasks();

    expect(mockGenerateRecipeImageWithMeta).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith('recipes');
    expect(updateMock).toHaveBeenCalledWith({ image_url: GENERATED_URL });
    expect(eqIdMock).toHaveBeenCalledWith('id', 'recipe-77');
    expect(eqProfileMock).toHaveBeenCalledWith('profile_id', 'user-1');

    // onSave telemetry recorded.
    expect(mockRecordAiCall).toHaveBeenCalledTimes(1);
    expect(mockRecordAiCall.mock.calls[0][0].task).toBe(
      'recipe.generateImage.onSave.miss',
    );
  });

  it('null url from generation: NO persist (does not clobber)', async () => {
    mockGenerateRecipeImageWithMeta.mockResolvedValue({
      url: null,
      cacheHit: false,
      genMs: 40,
    });

    await postRecipe(VALID_BODY);
    await flushMicrotasks();

    expect(mockGenerateRecipeImageWithMeta).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('dedup early-return (existing title): does NOT generate-on-save', async () => {
    mockFindByNormalizedTitle.mockResolvedValue({
      id: 'recipe-existing',
      title: 'Lemon Garlic Salmon',
      image_url: 'https://img/already-there.jpg',
    });

    const res = await postRecipe(VALID_BODY);
    await flushMicrotasks();

    const json = (await res.json()) as { duplicate?: boolean };
    expect(json.duplicate).toBe(true);
    expect(mockSaveRecipe).not.toHaveBeenCalled();
    expect(mockGenerateRecipeImageWithMeta).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('saved row that already has an image_url: does NOT generate-on-save', async () => {
    mockSaveRecipe.mockResolvedValue({
      id: 'recipe-88',
      title: 'Lemon Garlic Salmon',
      description: null,
      ingredients: [],
      image_url: 'https://img/preset.jpg',
    });

    await postRecipe(VALID_BODY);
    await flushMicrotasks();

    expect(mockGenerateRecipeImageWithMeta).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
