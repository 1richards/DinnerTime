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
});
