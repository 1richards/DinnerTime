import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGenerateMealPlan,
  mockRegenerateDay,
  mockMarkCooked,
  mockAuthMiddleware,
  mockSupabase,
  state,
} = vi.hoisted(() => {
  const state: { currentPlan: any } = { currentPlan: null };
  const supabase = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'meal_plans') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => ({ data: state.currentPlan, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'meal_plan_entries') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ data: [], error: null }),
            }),
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
