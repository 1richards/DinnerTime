import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase using vi.hoisted() for variable hoisting with vi.mock
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token' } },
        error: null as Error | null,
      })
    ),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mock setup
import { useMealPlanStore } from '../mealPlanStore';
import type { MealPlan, MealPlanEntry } from '../../types/mealPlan';

const makeEntry = (
  day: number,
  overrides: Partial<MealPlanEntry> = {}
): MealPlanEntry => ({
  id: `entry-${day}`,
  meal_plan_id: 'plan-1',
  day_of_week: day,
  recipe_id: null,
  title: `Dinner ${day}`,
  description: null,
  ingredients: [],
  ingredients_needed: [],
  estimated_time_minutes: 30,
  difficulty: 'easy',
  kid_friendly: true,
  why_suggested: null,
  status: 'planned',
  cooked_at: null,
  created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const makePlan = (overrides: Partial<MealPlan> = {}): MealPlan => ({
  id: 'plan-1',
  profile_id: 'user-1',
  week_start: '2026-04-13',
  generated_at: '2026-04-10T12:00:00Z',
  created_at: '2026-04-10T12:00:00Z',
  updated_at: '2026-04-10T12:00:00Z',
  entries: [0, 1, 2, 3, 4, 5, 6].map((d) => makeEntry(d)),
  ...overrides,
});

const resetState = () => {
  useMealPlanStore.setState({
    currentPlan: null,
    loading: false,
    error: null,
    swappingDay: null,
    cookingDay: null,
  });
};

describe('mealPlanStore', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null as Error | null,
    });
  });

  describe('fetchCurrent', () => {
    it('handles 404 as no plan (null currentPlan, no error)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'not found' }),
      });

      await useMealPlanStore.getState().fetchCurrent();

      const state = useMealPlanStore.getState();
      expect(state.currentPlan).toBeNull();
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/meal-plans/current'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('populates currentPlan on 200', async () => {
      const plan = makePlan();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: plan }),
      });

      await useMealPlanStore.getState().fetchCurrent();

      const state = useMealPlanStore.getState();
      expect(state.currentPlan).toEqual(plan);
      expect(state.currentPlan?.entries).toHaveLength(7);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('sets error on 401 and leaves currentPlan unchanged', async () => {
      const existing = makePlan({ id: 'old-plan' });
      useMealPlanStore.setState({ currentPlan: existing });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      await useMealPlanStore.getState().fetchCurrent();

      const state = useMealPlanStore.getState();
      expect(state.currentPlan).toEqual(existing);
      expect(state.error).toBe('Unauthorized');
      expect(state.loading).toBe(false);
    });
  });

  describe('generate', () => {
    it('POSTs week_start and populates currentPlan on success', async () => {
      const plan = makePlan();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: plan }),
      });

      await useMealPlanStore.getState().generate('2026-04-13');

      const state = useMealPlanStore.getState();
      expect(state.currentPlan).toEqual(plan);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/meal-plans/generate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ week_start: '2026-04-13' }),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('maps 400 EMPTY_PANTRY to friendly error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: 'EMPTY_PANTRY',
            code: 'EMPTY_PANTRY',
          }),
      });

      await useMealPlanStore.getState().generate('2026-04-13');

      const state = useMealPlanStore.getState();
      expect(state.error).toBe('Add at least 3 pantry items first');
      expect(state.currentPlan).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('clears loading even when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network down'));

      await useMealPlanStore.getState().generate('2026-04-13');

      const state = useMealPlanStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('network down');
    });
  });

  describe('swapDay', () => {
    it('replaces entry at day and clears swappingDay on success', async () => {
      const plan = makePlan();
      useMealPlanStore.setState({ currentPlan: plan });

      const replacement = makeEntry(3, {
        id: 'entry-3-new',
        title: 'New Dinner 3',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: replacement }),
      });

      await useMealPlanStore.getState().swapDay(3);

      const state = useMealPlanStore.getState();
      expect(state.swappingDay).toBeNull();
      const entryForDay3 = state.currentPlan?.entries.find(
        (e) => e.day_of_week === 3
      );
      expect(entryForDay3?.title).toBe('New Dinner 3');
      // Other days unchanged
      const entryForDay0 = state.currentPlan?.entries.find(
        (e) => e.day_of_week === 0
      );
      expect(entryForDay0?.title).toBe('Dinner 0');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/meal-plans/plan-1/entries/3/regenerate'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('leaves entry unchanged on server error and sets error', async () => {
      const plan = makePlan();
      useMealPlanStore.setState({ currentPlan: plan });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Upstream failure' }),
      });

      await useMealPlanStore.getState().swapDay(3);

      const state = useMealPlanStore.getState();
      expect(state.swappingDay).toBeNull();
      expect(state.error).toBe('Upstream failure');
      const entryForDay3 = state.currentPlan?.entries.find(
        (e) => e.day_of_week === 3
      );
      expect(entryForDay3?.title).toBe('Dinner 3');
    });
  });

  describe('markCooked', () => {
    it('optimistically sets status=cooked before awaiting server', async () => {
      const plan = makePlan();
      useMealPlanStore.setState({ currentPlan: plan });

      let resolveFetch!: (v: unknown) => void;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const promise = useMealPlanStore.getState().markCooked(2);
      // Allow microtasks for auth + set() to flush
      await Promise.resolve();
      await Promise.resolve();

      const midState = useMealPlanStore.getState();
      const entryDay2 = midState.currentPlan?.entries.find(
        (e) => e.day_of_week === 2
      );
      expect(entryDay2?.status).toBe('cooked');
      expect(midState.cookingDay).toBe(2);

      // Resolve with server truth
      resolveFetch({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: makeEntry(2, {
              status: 'cooked',
              cooked_at: '2026-04-10T13:00:00Z',
            }),
          }),
      });
      await promise;

      const finalState = useMealPlanStore.getState();
      const finalEntry = finalState.currentPlan?.entries.find(
        (e) => e.day_of_week === 2
      );
      expect(finalEntry?.cooked_at).toBe('2026-04-10T13:00:00Z');
      expect(finalState.cookingDay).toBeNull();
    });

    it('rolls back on 500', async () => {
      const plan = makePlan();
      useMealPlanStore.setState({ currentPlan: plan });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      await useMealPlanStore.getState().markCooked(2);

      const state = useMealPlanStore.getState();
      const entry = state.currentPlan?.entries.find(
        (e) => e.day_of_week === 2
      );
      expect(entry?.status).toBe('planned');
      expect(state.cookingDay).toBeNull();
      expect(state.error).toBe('Server error');
    });

    it('does not rollback on 409 ALREADY_COOKED', async () => {
      const plan = makePlan();
      useMealPlanStore.setState({ currentPlan: plan });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({ error: 'already cooked', code: 'ALREADY_COOKED' }),
      });

      await useMealPlanStore.getState().markCooked(2);

      const state = useMealPlanStore.getState();
      const entry = state.currentPlan?.entries.find(
        (e) => e.day_of_week === 2
      );
      // Optimistic state retained (server confirms cooked)
      expect(entry?.status).toBe('cooked');
      expect(state.cookingDay).toBeNull();
      expect(state.error).toBe('already_cooked');
    });

    it('replaces entry with server response on success (cooked_at populated)', async () => {
      const plan = makePlan();
      useMealPlanStore.setState({ currentPlan: plan });

      const serverEntry = makeEntry(4, {
        status: 'cooked',
        cooked_at: '2026-04-10T14:30:00Z',
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: serverEntry }),
      });

      await useMealPlanStore.getState().markCooked(4);

      const state = useMealPlanStore.getState();
      const entry = state.currentPlan?.entries.find(
        (e) => e.day_of_week === 4
      );
      expect(entry?.cooked_at).toBe('2026-04-10T14:30:00Z');
      expect(entry?.status).toBe('cooked');
      expect(state.cookingDay).toBeNull();
      expect(state.error).toBeNull();
    });
  });
});
