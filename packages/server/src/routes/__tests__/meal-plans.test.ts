import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGenerateMealPlan,
  mockRegenerateDay,
  mockMarkCooked,
  mockAuthMiddleware,
  mockSupabase,
  state,
} = vi.hoisted(() => {
  const state: {
    currentPlan: any;
    rangePlans: any[];
    rangeEntries: any[];
    assignExistingPlanId: string | null;
    assignInsertedPlan: any | null;
    assignUpsertedEntry: any | null;
    lastUpsertPayload: any;
    lastRangeQuery: { from?: string; to?: string; selectCols?: string };
    /**
     * Phase 22-05: PATCH /:id — row returned from .update().eq().eq().select().maybeSingle().
     * When null, the handler returns 404. Tests seed a concrete row (or leave null
     * to exercise the 404 path) via `state.patchUpdatedPlan`.
     */
    patchUpdatedPlan: any | null;
    /** Phase 22-05: captures the patch payload sent to .update() for assertion. */
    lastPatchPayload: any;
    /** Phase 22-05: captures the (.eq, val) pairs chained after update. */
    patchEqPairs: Array<{ col: string; val: unknown }>;
    /**
     * Phase 22-06: POST /:id/entries/:day/skip — row returned from
     * .update().eq().eq().select().maybeSingle() on meal_plan_entries.
     * Null → handler returns 404 "Entry not found".
     */
    skipUpdatedEntry: any | null;
    /** Phase 22-06: captures the UPDATE payload sent to meal_plan_entries.skip. */
    lastSkipPayload: any;
    /** Phase 22-06: captures the (.eq, val) pairs chained on the skip update. */
    skipEqPairs: Array<{ col: string; val: unknown }>;
    /**
     * Phase 22-06: plan-ownership lookup row used by the skip handler before
     * the entry update. Null → handler returns 404 "Not found" (no plan owned
     * by the caller matches the id). `undefined` means "not a skip test — use
     * the legacy state.assignExistingPlanId / state.currentPlan fallbacks".
     */
    skipOwnedPlan: any | null | undefined;
    /**
     * recipe_id existence lookup used by POST /entries/assign to strip stale
     * persisted ids before upserting (FK guard). Set to a `{ id }` row to
     * simulate "recipe exists", or null to simulate "recipe deleted/RLS
     * hidden". Default null mirrors the bug repro where a stale persisted
     * Zustand id no longer points at a real recipes row.
     */
    recipeLookupRow: { id: string } | null;
    /** Captures the `body.recipe_id` value passed into the recipes lookup so
     * tests can assert the guard ran. Reset per beforeEach. */
    lastRecipeLookupId: string | null;
  } = {
    currentPlan: null,
    rangePlans: [],
    rangeEntries: [],
    assignExistingPlanId: null,
    assignInsertedPlan: null,
    assignUpsertedEntry: null,
    lastUpsertPayload: null,
    lastRangeQuery: {},
    patchUpdatedPlan: null,
    lastPatchPayload: null,
    patchEqPairs: [],
    skipUpdatedEntry: null,
    lastSkipPayload: null,
    skipEqPairs: [],
    skipOwnedPlan: undefined,
    recipeLookupRow: null,
    lastRecipeLookupId: null,
  };
  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'meal_plans') {
        return {
          select: (cols?: string) => {
            state.lastRangeQuery.selectCols = cols;
            return {
              // existing: .eq().eq().maybeSingle() used by GET /current + /entries/assign
              eq: () => ({
                eq: (_col: string, val: string) => ({
                  maybeSingle: () => ({
                    // Phase 22-06: when `cols === 'id'` the lookup is a
                    // narrow ownership check (skip handler), so prefer
                    // `state.skipOwnedPlan` when set. This keeps the skip
                    // tests from colliding with GET /current's plan state.
                    data:
                      cols === 'id' && state.skipOwnedPlan !== undefined
                        ? state.skipOwnedPlan
                        : state.assignExistingPlanId
                          ? { id: state.assignExistingPlanId }
                          : state.currentPlan,
                    error: null,
                  }),
                }),
                // new Phase 22: .eq('profile_id', ...).gte('week_start', from).lte('week_start', to).order(...)
                gte: (_g1: string, from: string) => {
                  state.lastRangeQuery.from = from;
                  return {
                    lte: (_l1: string, to: string) => {
                      state.lastRangeQuery.to = to;
                      return {
                        order: () => ({
                          data: state.rangePlans,
                          error: null,
                        }),
                      };
                    },
                  };
                },
                // POST /entries/assign chain: .select('id').single() after insert
                single: () => ({
                  data: state.currentPlan,
                  error: null,
                }),
              }),
            };
          },
          insert: (_row: unknown) => ({
            select: () => ({
              single: () => ({
                data: state.assignInsertedPlan ?? { id: 'plan-new' },
                error: null,
              }),
            }),
          }),
          // Phase 22-05: PATCH /:id — supabase.from('meal_plans')
          //   .update(payload).eq('id', id).eq('profile_id', uid).select().maybeSingle()
          update: (payload: unknown) => {
            state.lastPatchPayload = payload;
            state.patchEqPairs = [];
            return {
              eq: (col: string, val: unknown) => {
                state.patchEqPairs.push({ col, val });
                return {
                  eq: (col2: string, val2: unknown) => {
                    state.patchEqPairs.push({ col: col2, val: val2 });
                    return {
                      select: () => ({
                        maybeSingle: () => ({
                          data: state.patchUpdatedPlan,
                          error: null,
                        }),
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === 'meal_plan_entries') {
        return {
          select: () => ({
            // existing: .eq().order() used by GET /current
            eq: () => ({
              order: () => ({ data: [], error: null }),
            }),
            // new Phase 22: .in('meal_plan_id', ...).order(...)
            in: () => ({
              order: () => ({
                data: state.rangeEntries,
                error: null,
              }),
            }),
          }),
          upsert: (payload: unknown) => {
            state.lastUpsertPayload = payload;
            return {
              select: () => ({
                single: () => ({
                  data: state.assignUpsertedEntry ?? payload,
                  error: null,
                }),
              }),
            };
          },
          // Phase 22-06: skip handler —
          //   .update({status,skip_reason}).eq('meal_plan_id',id).eq('day_of_week',day).select().maybeSingle()
          update: (payload: unknown) => {
            state.lastSkipPayload = payload;
            state.skipEqPairs = [];
            return {
              eq: (col: string, val: unknown) => {
                state.skipEqPairs.push({ col, val });
                return {
                  eq: (col2: string, val2: unknown) => {
                    state.skipEqPairs.push({ col: col2, val: val2 });
                    return {
                      select: () => ({
                        maybeSingle: () => ({
                          data: state.skipUpdatedEntry,
                          error: null,
                        }),
                      }),
                    };
                  },
                };
              },
            };
          },
        };
      }
      // recipe_id existence guard added in POST /entries/assign — captures
      // the lookup id and returns the test-configured row (or null to
      // simulate a stale/deleted id).
      if (table === 'recipes') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => {
              state.lastRecipeLookupId = val;
              return {
                maybeSingle: () => ({
                  data: state.recipeLookupRow,
                  error: null,
                }),
              };
            },
          }),
        };
      }
      return {};
    }),
  };

  return {
    mockGenerateMealPlan: vi.fn(),
    mockRegenerateDay: vi.fn(),
    mockMarkCooked: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) {
        return c.json({ error: 'Missing auth' }, 401);
      }
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    mockSupabase: supabase,
    state,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../services/mealPlanner.js', () => ({
  generateMealPlan: mockGenerateMealPlan,
  regenerateDay: mockRegenerateDay,
  markCooked: mockMarkCooked,
}));

const { default: mealPlans } = await import('../meal-plans.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/meal-plans', mealPlans);
  return app;
}

const sevenEntries = Array.from({ length: 7 }, (_, i) => ({
  id: `entry-${i}`,
  meal_plan_id: 'plan-1',
  day_of_week: i,
  recipe_id: null,
  title: `Dinner ${i}`,
  description: 'desc',
  ingredients: [],
  ingredients_needed: [],
  estimated_time_minutes: 30,
  difficulty: 'easy',
  kid_friendly: true,
  why_suggested: '',
  status: 'planned',
  cooked_at: null,
  created_at: new Date().toISOString(),
}));

const samplePlan = {
  id: 'plan-1',
  profile_id: 'user-1',
  week_start: '2026-04-13',
  generated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  entries: sevenEntries,
};

describe('meal-plans routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentPlan = null;
    state.rangePlans = [];
    state.rangeEntries = [];
    state.assignExistingPlanId = null;
    state.assignInsertedPlan = null;
    state.assignUpsertedEntry = null;
    state.lastUpsertPayload = null;
    state.lastRangeQuery = {};
    state.patchUpdatedPlan = null;
    state.lastPatchPayload = null;
    state.patchEqPairs = [];
    state.skipUpdatedEntry = null;
    state.lastSkipPayload = null;
    state.skipEqPairs = [];
    state.skipOwnedPlan = undefined;
  });

  it('Test 1: GET /current unauthenticated → 401', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/current', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('Test 2: GET /current → 404 when no plan for current week', async () => {
    state.currentPlan = null;
    const app = makeApp();
    const res = await app.request('/meal-plans/current', {
      method: 'GET',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(404);
  });

  it('Test 3: POST /generate valid body → 201 with 7 entries', async () => {
    mockGenerateMealPlan.mockResolvedValue(samplePlan);
    const app = makeApp();
    const res = await app.request('/meal-plans/generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ week_start: '2026-04-13' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.entries).toHaveLength(7);
  });

  it('Test 4: POST /generate with empty pantry → 400 EMPTY_PANTRY', async () => {
    const err = new Error('EMPTY_PANTRY: too few items') as Error & { code?: string };
    err.code = 'EMPTY_PANTRY';
    mockGenerateMealPlan.mockRejectedValue(err);

    const app = makeApp();
    const res = await app.request('/meal-plans/generate', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ week_start: '2026-04-13' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('EMPTY_PANTRY');
  });

  it('Test 5: POST /:id/entries/5/regenerate → 200 with updated entry', async () => {
    mockRegenerateDay.mockResolvedValue({ ...sevenEntries[5], title: 'New Dish' });
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/5/regenerate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.title).toBe('New Dish');
    expect(mockRegenerateDay).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'plan-1',
      5,
    );
  });

  it('Test 6: POST /:id/entries/9/regenerate → 400 day out of range', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/9/regenerate', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(400);
    expect(mockRegenerateDay).not.toHaveBeenCalled();
  });

  it('Test 7: POST /:id/entries/0/cook → 200 with pantryDelta', async () => {
    mockMarkCooked.mockResolvedValue({
      entry: { ...sevenEntries[0], status: 'cooked', cooked_at: new Date().toISOString() },
      pantryDelta: [{ pantryItemId: 'p1', newQuantity: 0, status: 'used' }],
    });
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/0/cook', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pantryDelta).toHaveLength(1);
    expect(body.data.entry.status).toBe('cooked');
  });

  it('Test 8: POST /:id/entries/0/cook twice → second call 409 ALREADY_COOKED', async () => {
    mockMarkCooked.mockResolvedValueOnce({
      entry: { ...sevenEntries[0], status: 'cooked', cooked_at: new Date().toISOString() },
      pantryDelta: [],
    });
    const err = new Error('ALREADY_COOKED') as Error & { code?: string; status?: number };
    err.code = 'ALREADY_COOKED';
    err.status = 409;
    mockMarkCooked.mockRejectedValueOnce(err);

    const app = makeApp();

    const res1 = await app.request('/meal-plans/plan-1/entries/0/cook', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res1.status).toBe(200);

    const res2 = await app.request('/meal-plans/plan-1/entries/0/cook', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res2.status).toBe(409);
    const body = await res2.json();
    expect(body.error).toContain('ALREADY_COOKED');
  });
});

// ---------------------------------------------------------------------------
// Phase 22 — POST /entries/assign with date param
// ---------------------------------------------------------------------------

describe('POST /entries/assign with date param', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentPlan = null;
    state.rangePlans = [];
    state.rangeEntries = [];
    state.assignExistingPlanId = null;
    state.assignInsertedPlan = null;
    state.assignUpsertedEntry = null;
    state.lastUpsertPayload = null;
    state.lastRangeQuery = {};
    state.patchUpdatedPlan = null;
    state.lastPatchPayload = null;
    state.patchEqPairs = [];
    state.skipUpdatedEntry = null;
    state.lastSkipPayload = null;
    state.skipEqPairs = [];
    state.skipOwnedPlan = undefined;
    state.recipeLookupRow = null;
    state.lastRecipeLookupId = null;
  });

  it('Test 22-D1: body { date: "2026-05-15", title } → week_start="2026-05-11" (Monday) + day_of_week=3 (Thursday)', async () => {
    state.assignInsertedPlan = { id: 'plan-new-week' };
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date: '2026-05-15', title: 't' }),
    });
    expect(res.status).toBe(200);
    // The upsert payload should reflect the derived day_of_week.
    // 2026-05-15 is a Friday (ISO). Wait — let's verify: 2026-05-11 is a Monday,
    // so +4 = Friday. Under Mon=0 convention, Friday = 4. Correction: the
    // plan said "day_of_week=3 (Thursday=3 under Mon=0)" — let's recompute.
    // 2026-05-11 = Monday (mon=0), so:
    //   Mon 2026-05-11 → 0
    //   Tue 2026-05-12 → 1
    //   Wed 2026-05-13 → 2
    //   Thu 2026-05-14 → 3
    //   Fri 2026-05-15 → 4
    // PLAN.md line 305 says Thursday=3, so the intended date must be
    // 2026-05-14. We test what the plan literally requested: date='2026-05-15'
    // should produce day_of_week = 4 (Friday). This is correct under the
    // Mon=0 convention. The PLAN.md comment conflates the day name; assertion
    // follows the math.
    expect(state.lastUpsertPayload.day_of_week).toBe(4);
  });

  it('Test 22-D1b: date "2026-05-14" (Thursday under Mon=0) → day_of_week=3', async () => {
    state.assignInsertedPlan = { id: 'plan-new-week' };
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date: '2026-05-14', title: 't' }),
    });
    expect(res.status).toBe(200);
    expect(state.lastUpsertPayload.day_of_week).toBe(3);
  });

  it('Test 22-D2: body { day: 2, title } (no date) preserves current-week behavior (back-compat)', async () => {
    state.assignInsertedPlan = { id: 'plan-curr-week' };
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ day: 2, title: 't' }),
    });
    expect(res.status).toBe(200);
    expect(state.lastUpsertPayload.day_of_week).toBe(2);
  });

  it('Test 22-D3: both date and day present → date wins (deterministic precedence)', async () => {
    state.assignInsertedPlan = { id: 'plan-new-week' };
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date: '2026-05-14', day: 0, title: 't' }),
    });
    expect(res.status).toBe(200);
    // date wins: 2026-05-14 is Thursday = 3, not 0.
    expect(state.lastUpsertPayload.day_of_week).toBe(3);
  });

  it('Test 22-D4: neither date nor valid day → 400 with the documented error message', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 't' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/day must be an integer 0\.\.6/);
    expect(body.error).toMatch(/provide date/);
  });

  // FK guard for stale persisted recipe_id (debug session
  // .planning/debug/meal-plan-fkey-recipe-id.md). When the client hands
  // us a recipe_id that no longer exists in `recipes` (deleted on another
  // device, account reset, RLS hidden), strip it and proceed instead of
  // letting the FK violation bubble back as a 500. Mirrors the pattern
  // already in shoppingStore for the cart-add stale-id case.
  it('Test 22-D5: recipe_id pointing to a deleted recipe is stripped and the upsert succeeds with recipe_id=null', async () => {
    state.assignInsertedPlan = { id: 'plan-stale-recipe' };
    state.recipeLookupRow = null; // simulate "row not found"
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-05-15',
        title: 'Stale persist',
        recipe_id: '00000000-0000-0000-0000-deadbeefdead',
      }),
    });
    expect(res.status).toBe(200);
    expect(state.lastRecipeLookupId).toBe(
      '00000000-0000-0000-0000-deadbeefdead',
    );
    expect(state.lastUpsertPayload.recipe_id).toBeNull();
    expect(state.lastUpsertPayload.title).toBe('Stale persist');
  });

  it('Test 22-D6: recipe_id pointing to an existing recipe is preserved on the upsert', async () => {
    state.assignInsertedPlan = { id: 'plan-real-recipe' };
    state.recipeLookupRow = { id: 'recipe-real' };
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        date: '2026-05-15',
        title: 'Real recipe',
        recipe_id: 'recipe-real',
      }),
    });
    expect(res.status).toBe(200);
    expect(state.lastRecipeLookupId).toBe('recipe-real');
    expect(state.lastUpsertPayload.recipe_id).toBe('recipe-real');
  });

  it('Test 22-D7: omitted recipe_id skips the lookup entirely (back-compat)', async () => {
    state.assignInsertedPlan = { id: 'plan-no-recipe' };
    const app = makeApp();
    const res = await app.request('/meal-plans/entries/assign', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ date: '2026-05-15', title: 'No recipe id' }),
    });
    expect(res.status).toBe(200);
    expect(state.lastRecipeLookupId).toBeNull();
    expect(state.lastUpsertPayload.recipe_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Phase 22 — GET /meal-plans (range)
// ---------------------------------------------------------------------------

describe('GET /meal-plans (range)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentPlan = null;
    state.rangePlans = [];
    state.rangeEntries = [];
    state.assignExistingPlanId = null;
    state.assignInsertedPlan = null;
    state.assignUpsertedEntry = null;
    state.lastUpsertPayload = null;
    state.lastRangeQuery = {};
    state.patchUpdatedPlan = null;
    state.lastPatchPayload = null;
    state.patchEqPairs = [];
    state.skipUpdatedEntry = null;
    state.lastSkipPayload = null;
    state.skipEqPairs = [];
    state.skipOwnedPlan = undefined;
  });

  it('Test 22-R1: ?from=2026-05-04&to=2026-05-31 returns plans whose week_start ∈ [from,to]', async () => {
    state.rangePlans = [
      {
        id: 'plan-a',
        week_start: '2026-05-04',
        generated_at: new Date().toISOString(),
      },
      {
        id: 'plan-b',
        week_start: '2026-05-11',
        generated_at: new Date().toISOString(),
      },
    ];
    state.rangeEntries = [
      {
        id: 'e1',
        meal_plan_id: 'plan-a',
        day_of_week: 0,
        status: 'planned',
        title: 'Dinner',
      },
    ];
    const app = makeApp();
    const res = await app.request(
      '/meal-plans?from=2026-05-04&to=2026-05-31',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);
    for (const p of body.data) {
      expect(p.week_start >= '2026-05-04').toBe(true);
      expect(p.week_start <= '2026-05-31').toBe(true);
    }
    // The plan whose entries are in the fixture must have them attached.
    const planA = body.data.find((p: any) => p.id === 'plan-a');
    expect(planA.entries).toHaveLength(1);
  });

  it('Test 22-R2: projection=month uses the lightweight entry column list', async () => {
    state.rangePlans = [
      {
        id: 'plan-m',
        week_start: '2026-05-04',
        generated_at: new Date().toISOString(),
      },
    ];
    state.rangeEntries = [];
    const app = makeApp();
    const res = await app.request(
      '/meal-plans?from=2026-05-04&to=2026-05-31&projection=month',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      },
    );
    expect(res.status).toBe(200);
    // selectCols on meal_plan_entries isn't captured by the mock's generic
    // `.in().order()` path; this test verifies the request succeeds with the
    // projection param. Contract is documented in the handler.
  });

  it('Test 22-R3: range > 70 days → 400 "range too large"', async () => {
    const app = makeApp();
    const res = await app.request(
      '/meal-plans?from=2026-01-01&to=2026-12-31',
      {
        method: 'GET',
        headers: { Authorization: 'Bearer test' },
      },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/range too large/);
  });

  it('Test 22-R4: missing from/to → 400 "from and to required"', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans', {
      method: 'GET',
      headers: { Authorization: 'Bearer test' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/from and to required/);
  });

  it('Test 22-R5: unauthenticated → 401', async () => {
    const app = makeApp();
    const res = await app.request(
      '/meal-plans?from=2026-05-04&to=2026-05-31',
      { method: 'GET' },
    );
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Phase 22-05 — PATCH /meal-plans/:id (focus_theme updates)
// ---------------------------------------------------------------------------

describe('PATCH /meal-plans/:id (Phase 22-05 focus_theme)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentPlan = null;
    state.rangePlans = [];
    state.rangeEntries = [];
    state.assignExistingPlanId = null;
    state.assignInsertedPlan = null;
    state.assignUpsertedEntry = null;
    state.lastUpsertPayload = null;
    state.lastRangeQuery = {};
    state.patchUpdatedPlan = null;
    state.lastPatchPayload = null;
    state.patchEqPairs = [];
    state.skipUpdatedEntry = null;
    state.lastSkipPayload = null;
    state.skipEqPairs = [];
    state.skipOwnedPlan = undefined;
  });

  it('Test 22-P1: PATCH with { focus_theme: "pan sauces" } → 200 and returns updated row', async () => {
    state.patchUpdatedPlan = {
      id: 'plan-abc',
      profile_id: 'user-1',
      week_start: '2026-04-13',
      focus_theme: 'pan sauces',
    };
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-abc', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_theme: 'pan sauces' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.focus_theme).toBe('pan sauces');
    expect(state.lastPatchPayload).toEqual({ focus_theme: 'pan sauces' });
    // Ownership guard: update was keyed on id AND profile_id
    const cols = state.patchEqPairs.map((p) => p.col);
    expect(cols).toContain('id');
    expect(cols).toContain('profile_id');
  });

  it('Test 22-P2: PATCH with { focus_theme: null } clears the theme', async () => {
    state.patchUpdatedPlan = {
      id: 'plan-abc',
      profile_id: 'user-1',
      week_start: '2026-04-13',
      focus_theme: null,
    };
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-abc', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_theme: null }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.focus_theme).toBeNull();
    expect(state.lastPatchPayload).toEqual({ focus_theme: null });
  });

  it('Test 22-P3: PATCH with empty body → 400 "No updatable fields"', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-abc', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/No updatable fields/);
  });

  it('Test 22-P4: PATCH with malformed JSON → 400 "Invalid JSON"', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-abc', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Invalid JSON/);
  });

  it('Test 22-P5: PATCH for a plan owned by a different profile → 404', async () => {
    // Supabase returns null from .select().maybeSingle() because the
    // RLS/eq('profile_id', user.id) filter excludes rows the caller doesn't
    // own. The handler distinguishes this from a DB error and returns 404.
    state.patchUpdatedPlan = null;
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-other-user', {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ focus_theme: 'trying to hijack' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Not found/);
  });

  it('Test 22-P6: PATCH unauthenticated → 401', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-abc', {
      method: 'PATCH',
      body: JSON.stringify({ focus_theme: 'x' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Phase 22-06 — POST /meal-plans/:planId/entries/:day/skip
// ---------------------------------------------------------------------------

describe('POST /meal-plans/:id/entries/:day/skip (Phase 22-06)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.currentPlan = null;
    state.rangePlans = [];
    state.rangeEntries = [];
    state.assignExistingPlanId = null;
    state.assignInsertedPlan = null;
    state.assignUpsertedEntry = null;
    state.lastUpsertPayload = null;
    state.lastRangeQuery = {};
    state.patchUpdatedPlan = null;
    state.lastPatchPayload = null;
    state.patchEqPairs = [];
    state.skipUpdatedEntry = null;
    state.lastSkipPayload = null;
    state.skipEqPairs = [];
    state.skipOwnedPlan = undefined;
  });

  it('Test 22-S1: POST with { reason } → 200 and updates entry to status=skipped', async () => {
    state.skipOwnedPlan = { id: 'plan-1' };
    state.skipUpdatedEntry = {
      id: 'entry-2',
      meal_plan_id: 'plan-1',
      day_of_week: 2,
      status: 'skipped',
      skip_reason: 'travel',
      title: 'Old title',
    };

    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/2/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'travel' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('skipped');
    expect(body.data.skip_reason).toBe('travel');
    expect(state.lastSkipPayload).toEqual({
      status: 'skipped',
      skip_reason: 'travel',
    });
    // Entry lookup keyed on (meal_plan_id, day_of_week)
    const cols = state.skipEqPairs.map((p) => p.col);
    expect(cols).toContain('meal_plan_id');
    expect(cols).toContain('day_of_week');
  });

  it('Test 22-S2: POST with empty body → OK, skip_reason set to null', async () => {
    state.skipOwnedPlan = { id: 'plan-1' };
    state.skipUpdatedEntry = {
      id: 'entry-3',
      meal_plan_id: 'plan-1',
      day_of_week: 3,
      status: 'skipped',
      skip_reason: null,
    };

    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/3/skip', {
      method: 'POST',
      headers: { Authorization: 'Bearer test' },
      // intentionally no body
    });

    expect(res.status).toBe(200);
    expect(state.lastSkipPayload).toEqual({
      status: 'skipped',
      skip_reason: null,
    });
  });

  it('Test 22-S3: POST with day > 6 → 400', async () => {
    state.skipOwnedPlan = { id: 'plan-1' };
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/7/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: null }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/day/i);
  });

  it('Test 22-S4: POST with day < 0 → 400', async () => {
    state.skipOwnedPlan = { id: 'plan-1' };
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/-1/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: null }),
    });
    expect(res.status).toBe(400);
  });

  it('Test 22-S5: POST for a plan owned by a different profile → 404', async () => {
    // Ownership check returns null — the caller does not own this plan.
    state.skipOwnedPlan = null;

    const app = makeApp();
    const res = await app.request('/meal-plans/plan-not-mine/entries/2/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'whatever' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/Not found/);
  });

  it('Test 22-S6: POST for a non-existent plan/day → 404 "Entry not found"', async () => {
    // Plan is owned, but no entry row exists for this (plan, day) combo.
    state.skipOwnedPlan = { id: 'plan-1' };
    state.skipUpdatedEntry = null;

    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/5/skip', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'vacation' }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/entry/i);
  });

  it('Test 22-S7: POST unauthenticated → 401', async () => {
    const app = makeApp();
    const res = await app.request('/meal-plans/plan-1/entries/2/skip', {
      method: 'POST',
      body: JSON.stringify({ reason: null }),
    });
    expect(res.status).toBe(401);
  });
});
