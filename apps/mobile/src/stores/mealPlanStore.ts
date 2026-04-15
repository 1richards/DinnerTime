import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { offlineQueue, registerExecutor } from '../lib/offlineQueue';
import { useNetworkStore } from './networkStore';
import type { MealPlan, MealPlanEntry } from '../types/mealPlan';

interface MealPlanState {
  currentPlan: MealPlan | null;
  loading: boolean;
  error: string | null;
  swappingDay: number | null;
  cookingDay: number | null;

  fetchCurrent: () => Promise<void>;
  generate: (weekStart: string) => Promise<void>;
  swapDay: (day: number) => Promise<void>;
  markCooked: (day: number) => Promise<void>;
}

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

const getAuthToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
};

const authedFetch = async (
  path: string,
  init: RequestInit = {}
): Promise<Response> => {
  const token = await getAuthToken();
  return fetch(`${getApiBaseUrl()}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
};

const mapGenerateError = (body: { error?: string; code?: string }): string => {
  if (body.code === 'EMPTY_PANTRY' || body.error === 'EMPTY_PANTRY') {
    return 'Add at least 3 pantry items first';
  }
  return body.error ?? 'Failed to generate meal plan';
};

export const useMealPlanStore = create<MealPlanState>()(
  persist(
    (set, get) => ({
  currentPlan: null,
  loading: false,
  error: null,
  swappingDay: null,
  cookingDay: null,

  fetchCurrent: async () => {
    set({ loading: true, error: null });
    try {
      const response = await authedFetch('/meal-plans/current', {
        method: 'GET',
      });

      if (response.status === 404) {
        set({ currentPlan: null, error: null, loading: false });
        return;
      }

      if (!response.ok) {
        const err = await response.json();
        set({
          error: err.error ?? 'Failed to fetch meal plan',
          loading: false,
        });
        return;
      }

      const body = await response.json();
      set({ currentPlan: body.data, loading: false, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch meal plan',
        loading: false,
      });
    }
  },

  generate: async (weekStart: string) => {
    set({ loading: true, error: null });
    try {
      const response = await authedFetch('/meal-plans/generate', {
        method: 'POST',
        body: JSON.stringify({ week_start: weekStart }),
      });

      if (!response.ok) {
        const err = await response.json();
        set({ error: mapGenerateError(err), loading: false });
        return;
      }

      const body = await response.json();
      set({ currentPlan: body.data, loading: false, error: null });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : 'Failed to generate meal plan',
        loading: false,
      });
    }
  },

  swapDay: async (day: number) => {
    const plan = get().currentPlan;
    if (!plan) return;
    set({ swappingDay: day, error: null });
    try {
      const response = await authedFetch(
        `/meal-plans/${plan.id}/entries/${day}/regenerate`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const err = await response.json();
        set({
          swappingDay: null,
          error: err.error ?? 'Failed to swap day',
        });
        return;
      }

      const body = await response.json();
      const updatedEntry: MealPlanEntry = body.data;
      set((state) => ({
        currentPlan: state.currentPlan
          ? {
              ...state.currentPlan,
              entries: state.currentPlan.entries.map((e) =>
                e.day_of_week === day ? updatedEntry : e
              ),
            }
          : state.currentPlan,
        swappingDay: null,
        error: null,
      }));
    } catch (err) {
      set({
        swappingDay: null,
        error: err instanceof Error ? err.message : 'Failed to swap day',
      });
    }
  },

  markCooked: async (day: number) => {
    const plan = get().currentPlan;
    if (!plan) return;
    const snapshot = plan.entries;
    const targetEntry = plan.entries.find((e) => e.day_of_week === day);

    // Optimistic: mark cooked before await
    set({
      currentPlan: {
        ...plan,
        entries: plan.entries.map((e) =>
          e.day_of_week === day ? { ...e, status: 'cooked' } : e
        ),
      },
      cookingDay: day,
      error: null,
    });

    // Offline path: enqueue and stay optimistic
    if (!useNetworkStore.getState().isOnline && targetEntry) {
      await offlineQueue.enqueue({
        type: 'markCooked',
        entryId: String(day),
        recipeId: targetEntry.recipe_id ?? '',
      });
      set({ cookingDay: null, error: null });
      return;
    }

    try {
      const response = await authedFetch(
        `/meal-plans/${plan.id}/entries/${day}/cook`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}) as { error?: string; code?: string });
        if (response.status === 409 || err.code === 'ALREADY_COOKED') {
          // Server confirms state — do not roll back
          set({ cookingDay: null, error: 'already_cooked' });
          return;
        }
        // Rollback
        set({
          currentPlan: { ...plan, entries: snapshot },
          cookingDay: null,
          error: err.error ?? 'Failed to mark cooked',
        });
        return;
      }

      const body = await response.json();
      // Server returns { data: { entry, pantryDelta } } — NOT a bare entry.
      // Previously we assigned body.data to updatedEntry, which meant each
      // DayRow rendered a wrapper object with no title/status fields and
      // looked "blank", as if the meal had disappeared.
      const updatedEntry: MealPlanEntry | undefined = body?.data?.entry ?? body?.data;
      if (!updatedEntry || typeof (updatedEntry as MealPlanEntry).day_of_week !== 'number') {
        // Defensive: keep the optimistic cooked state we already applied above.
        set({ cookingDay: null, error: null });
        return;
      }
      set((state) => ({
        currentPlan: state.currentPlan
          ? {
              ...state.currentPlan,
              entries: state.currentPlan.entries.map((e) =>
                e.day_of_week === day ? updatedEntry : e
              ),
            }
          : state.currentPlan,
        cookingDay: null,
        error: null,
      }));
    } catch (err) {
      // Rollback on network error
      set({
        currentPlan: { ...plan, entries: snapshot },
        cookingDay: null,
        error: err instanceof Error ? err.message : 'Failed to mark cooked',
      });
    }
  },
    }),
    {
      name: 'dinnertime-meal-plan',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ currentPlan: state.currentPlan }),
      version: 1,
    }
  )
);

// Register offline-queue executor for markCooked replay on reconnect.
registerExecutor('markCooked', async (op) => {
  if (op.type !== 'markCooked') return;
  const day = Number(op.entryId);
  if (Number.isNaN(day)) return;
  await useMealPlanStore.getState().markCooked(day);
});
