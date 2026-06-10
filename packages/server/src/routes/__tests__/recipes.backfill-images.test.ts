/**
 * Phase 28 Plan 02 (O3): POST /recipes/backfill-images coverage.
 *
 * Manual, idempotent backfill of image_url for the authed user's recipes where
 * image_url IS NULL. It selects only null-image rows (the .is('image_url',
 * null) filter is the idempotency guard), generates an image per row, and
 * persists the resolved URL scoped to id + profile_id. Returns counts.
 *
 * The route reads c.get('supabase') (the per-user client). The mock exposes a
 * chainable select(...).eq(...).is(...) that resolves to two null-image rows,
 * and a separate update(...).eq(...).eq(...) chain to assert the write-back.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGenerateRecipeImageWithMeta,
  mockRecordAiCall,
  selectIsMock,
  selectLimitMock,
  countIsMock,
  updateMock,
  updateEqIdMock,
  updateEqProfileMock,
  userFromMock,
  mockAuthMiddleware,
  resetSpies,
} = vi.hoisted(() => {
  // Two recipes with null image_url for user-1.
  const ROWS = [
    { id: 'r-1', title: 'Row One', description: 'd1', ingredients: [], image_url: null },
    { id: 'r-2', title: 'Row Two', description: 'd2', ingredients: [], image_url: null },
  ];

  // WR-03 — the route now runs TWO select chains against from('recipes'):
  //
  //   1. BATCH:  select(cols).eq('profile_id').is('image_url', null)
  //                .order('created_at', ...).limit(BATCH)   → resolves to rows
  //   2. COUNT:  select('id', {count:'exact', head:true})
  //                .eq('profile_id').is('image_url', null)  → resolves to { count }
  //
  // A head/count select passes a second arg to .select(); the batch select does
  // not. We branch on that to return the right chain.
  const selectLimitMock = vi.fn(async () => ({ data: ROWS, error: null }));
  const selectOrderMock = vi.fn(() => ({ limit: selectLimitMock }));
  const batchIsMock = vi.fn(() => ({ order: selectOrderMock }));
  const batchEqMock = vi.fn(() => ({ is: batchIsMock }));

  // COUNT chain terminates at .is(...) (head:true), resolving to { count }.
  const countIsMock = vi.fn(async () => ({ count: 1, error: null }));
  const countEqMock = vi.fn(() => ({ is: countIsMock }));

  const selectMock = vi.fn((_cols: string, opts?: { head?: boolean }) =>
    opts?.head ? { eq: countEqMock } : { eq: batchEqMock }
  );

  // UPDATE chain: from('recipes').update({image_url}).eq('id').eq('profile_id')
  const updateEqProfileMock = vi.fn(async () => ({ data: null, error: null }));
  const updateEqIdMock = vi.fn(() => ({ eq: updateEqProfileMock }));
  const updateMock = vi.fn(() => ({ eq: updateEqIdMock }));

  // from('recipes') returns BOTH select and update entry points.
  const userFromMock = vi.fn(() => ({
    select: selectMock,
    update: updateMock,
  }));

  const resetSpies = () => {
    selectLimitMock.mockClear();
    selectLimitMock.mockResolvedValue({ data: ROWS, error: null });
    selectOrderMock.mockClear();
    batchIsMock.mockClear();
    batchEqMock.mockClear();
    countIsMock.mockClear();
    countIsMock.mockResolvedValue({ count: 1, error: null });
    countEqMock.mockClear();
    selectMock.mockClear();
    updateEqProfileMock.mockClear();
    updateEqProfileMock.mockResolvedValue({ data: null, error: null });
    updateEqIdMock.mockClear();
    updateMock.mockClear();
    userFromMock.mockClear();
  };

  return {
    mockGenerateRecipeImageWithMeta: vi.fn(),
    mockRecordAiCall: vi.fn(async () => {}),
    selectIsMock: batchIsMock,
    selectLimitMock,
    countIsMock,
    updateMock,
    updateEqIdMock,
    updateEqProfileMock,
    userFromMock,
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      c.set('user', { id: 'user-1' });
      c.set('supabase', { from: userFromMock });
      await next();
    }),
    resetSpies,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../config/supabase.js', () => ({
  supabaseAdmin: { from: vi.fn() },
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

async function postBackfill() {
  const app = makeApp();
  return app.request('/recipes/backfill-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
}

describe('POST /recipes/backfill-images (Phase 28 O3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSpies();
    // Row 1 generates a url; row 2 fails (null) → skipped.
    mockGenerateRecipeImageWithMeta
      .mockResolvedValueOnce({ url: 'https://img/r1.jpg', cacheHit: false, genMs: 100 })
      .mockResolvedValueOnce({ url: null, cacheHit: false, genMs: 30 });
    mockRecordAiCall.mockResolvedValue(undefined);
  });

  it('selects only null-image rows scoped to the authed user', async () => {
    await postBackfill();
    // .is('image_url', null) is the idempotency filter (batch chain).
    expect(selectIsMock).toHaveBeenCalledWith('image_url', null);
  });

  it('returns { examined, updated, skipped, remaining } and persists only the row that generated', async () => {
    const res = await postBackfill();

    expect(res.status).toBe(200);
    // remaining comes from the post-batch count query (mocked count: 1).
    expect(await res.json()).toEqual({ examined: 2, updated: 1, skipped: 1, remaining: 1 });

    // Row 1 persisted; row 2 (null url) NOT.
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ image_url: 'https://img/r1.jpg' });
    expect(updateEqIdMock).toHaveBeenCalledWith('id', 'r-1');
    expect(updateEqProfileMock).toHaveBeenCalledWith('profile_id', 'user-1');
  });

  it('WR-03: caps the batch select with a limit', async () => {
    await postBackfill();
    // The batch select is bounded so one request can't run unbounded.
    expect(selectLimitMock).toHaveBeenCalled();
  });

  it('idempotent: zero candidate rows → examined 0, no generation', async () => {
    selectLimitMock.mockResolvedValue({ data: [], error: null });
    countIsMock.mockResolvedValue({ count: 0, error: null });

    const res = await postBackfill();

    expect(await res.json()).toEqual({ examined: 0, updated: 0, skipped: 0, remaining: 0 });
    expect(mockGenerateRecipeImageWithMeta).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('select error → 500', async () => {
    selectLimitMock.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const res = await postBackfill();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'boom' });
  });
});
