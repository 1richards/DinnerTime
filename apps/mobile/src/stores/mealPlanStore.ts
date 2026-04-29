import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { offlineQueue, registerExecutor } from '../lib/offlineQueue';
import { useNetworkStore } from './networkStore';
import type { MealPlan, MealPlanEntry } from '../types/mealPlan';
import type { ParsedRecipe } from '../types/recipe';

interface MealPlanState {
  currentPlan: MealPlan | null;
  loading: boolean;
  error: string | null;
  swappingDay: number | null;
  cookingDay: number | null;

  /**
   * Phase 22-03: Map of ISO-date → MealPlanEntry covering the currently
   * rendered Month view window (5 weeks by default). Populated by
   * `fetchRange`. Keyed by the entry's actual calendar date (computed as
   * `plan.week_start` + `entry.day_of_week` days) rather than week_start,
   * so the MonthGrid can look cells up directly by ISO.
   */
  monthPlans: Map<string, MealPlanEntry>;
  monthLoading: boolean;
  monthError: string | null;

  fetchCurrent: () => Promise<void>;
  generate: (weekStart: string) => Promise<void>;
  swapDay: (day: number) => Promise<void>;
  /**
   * Replace a specific day's entry with a user-chosen ParsedRecipe
   * (typically picked from a SwapSheet candidate list). Uses
   * /entries/assign which upserts on (plan, date), so this overwrites
   * whatever's currently on that day.
   */
  applySwap: (day: number, recipe: ParsedRecipe) => Promise<void>;
  markCooked: (day: number) => Promise<void>;
  /**
   * Phase 22-02: Shift the current week by ±7 days. Generates a new plan at
   * the target `week_start` and replaces `currentPlan`. No-op when
   * `currentPlan` is null. Errors surface via `state.error`.
   */
  shiftWeek: (deltaDays: number) => Promise<void>;
  /**
   * Phase 22-02: Read last week's entries via GET /meal-plans?from=&to=,
   * then POST /meal-plans/entries/assign for each non-skipped entry onto
   * the current week's matching day. Skipped entries are dropped.
   * No-op when `currentPlan` is null.
   */
  duplicateLastWeek: () => Promise<void>;
  /**
   * Phase 22-03: Fetch meal plans in the range [fromWeekStart, toWeekStart]
   * via GET /meal-plans?from=&to=&projection=month. Flattens the result
   * into a single `monthPlans` Map keyed by ISO date. Dedupes concurrent
   * calls via `monthLoading`. Errors surface via `monthError`.
   *
   * Bounds cap is server-enforced (|to-from| ≤ 70 days via migration 22-00).
   */
  fetchRange: (fromWeekStart: string, toWeekStart: string) => Promise<void>;
  /**
   * Phase 22-05: Set (or clear) the weekly skill-focus theme for the
   * current plan. Fires PATCH /meal-plans/{currentPlan.id} with body
   * `{ focus_theme }` and updates `currentPlan.focus_theme` in state.
   * No-op when `currentPlan` is null. Errors surface via `state.error`.
   */
  setFocusTheme: (theme: string | null) => Promise<void>;
  /**
   * Phase 22-06: Mark a day as skipped (user swiped → Skip). POSTs to
   * `/meal-plans/{plan.id}/entries/{day}/skip` with body `{ reason }`.
   * Optimistic: flips the entry to `status='skipped'` + `skip_reason`
   * before the network round-trip, rolls back to the snapshot if the
   * server returns a non-2xx. No-op when `currentPlan` is null.
   *
   * `reason` is free-form text (e.g. "travel", "ate out") or null.
   */
  skipDay: (day: number, reason?: string | null) => Promise<void>;
}

/**
 * Add N days (may be negative) to a 'YYYY-MM-DD' date in UTC. Returns the
 * same 'YYYY-MM-DD' format. Used by shiftWeek / duplicateLastWeek to
 * compute target week_start dates without timezone drift.
 */
const addDaysIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

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
  monthPlans: new Map<string, MealPlanEntry>(),
  monthLoading: false,
  monthError: null,

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

  applySwap: async (day: number, recipe: ParsedRecipe) => {
    const plan = get().currentPlan;
    if (!plan) return;
    set({ swappingDay: day, error: null });
    try {
      const targetIso = addDaysIso(plan.week_start, day);
      const res = await authedFetch('/meal-plans/entries/assign', {
        method: 'POST',
        body: JSON.stringify({
          date: targetIso,
          title: recipe.title,
          description: recipe.description ?? null,
          ingredients: (recipe.ingredients ?? []).map((i) => ({
            name: i.name,
            ...(i.quantity != null ? { quantity: i.quantity } : {}),
            ...(i.unit ? { unit: i.unit } : {}),
          })),
          estimated_time_minutes: recipe.total_time_minutes ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        set({
          swappingDay: null,
          error: err.error ?? 'Failed to apply swap',
        });
        return;
      }
      // Refetch the plan so the new entry's server-derived fields
      // (id, status, pantry_ready) populate without a round-trip dance.
      await get().fetchCurrent();
      set({ swappingDay: null, error: null });
    } catch (err) {
      set({
        swappingDay: null,
        error: err instanceof Error ? err.message : 'Failed to apply swap',
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

  shiftWeek: async (deltaDays: number) => {
    const plan = get().currentPlan;
    if (!plan) return;
    await get().generate(addDaysIso(plan.week_start, deltaDays));
  },

  duplicateLastWeek: async () => {
    const plan = get().currentPlan;
    if (!plan) return;
    const prevStart = addDaysIso(plan.week_start, -7);
    set({ loading: true, error: null });
    try {
      const res = await authedFetch(
        `/meal-plans?from=${prevStart}&to=${prevStart}`,
        { method: 'GET' }
      );
      if (!res.ok) {
        set({ error: 'Could not load last week', loading: false });
        return;
      }
      const body = await res.json();
      const prev = Array.isArray(body?.data) ? body.data[0] : null;
      if (!prev) {
        // Soft error: no previous-week plan exists. Not an app error — the
        // user just hasn't cooked long enough for a previous week to exist.
        set({ loading: false, error: null });
        return;
      }
      const entries = (prev.entries ?? []) as Array<{
        day_of_week: number;
        status: string;
        title: string;
        description?: string | null;
        ingredients?: unknown;
        estimated_time_minutes?: number | null;
        difficulty?: string | null;
        kid_friendly?: boolean;
        why_suggested?: string | null;
        recipe_id?: string | null;
      }>;
      // Skip 'skipped' entries per 22-RESEARCH Open Q3 — rationale: the user
      // chose not to cook those, duplicating would restore work they rejected.
      const toAssign = entries.filter((e) => e.status !== 'skipped');
      for (const e of toAssign) {
        const targetIso = addDaysIso(plan.week_start, e.day_of_week);
        await authedFetch('/meal-plans/entries/assign', {
          method: 'POST',
          body: JSON.stringify({
            date: targetIso,
            title: e.title,
            description: e.description ?? null,
            ingredients: e.ingredients ?? [],
            estimated_time_minutes: e.estimated_time_minutes ?? null,
            difficulty: e.difficulty ?? null,
            kid_friendly: e.kid_friendly ?? false,
            why_suggested: e.why_suggested ?? null,
            recipe_id: e.recipe_id ?? null,
          }),
        });
      }
      await get().fetchCurrent();
      set({ loading: false, error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Duplicate failed',
        loading: false,
      });
    }
  },

  setFocusTheme: async (theme: string | null) => {
    const plan = get().currentPlan;
    if (!plan) return;
    try {
      const res = await authedFetch(`/meal-plans/${plan.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ focus_theme: theme }),
      });
      if (!res.ok) {
        set({ error: 'Failed to set focus theme' });
        return;
      }
      const body = await res.json();
      // Merge the server-returned row onto the existing plan. The server
      // only returns the meal_plans row (no nested entries), so we preserve
      // `entries` from state and layer the update on top.
      set({
        currentPlan: {
          ...plan,
          ...(body.data as Partial<MealPlan>),
          entries: plan.entries,
        },
        error: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to set focus theme',
      });
    }
  },

  skipDay: async (day: number, reason: string | null = null) => {
    const plan = get().currentPlan;
    if (!plan) return;
    const snapshot = plan.entries;

    // Optimistic: flip the target entry to status='skipped' + skip_reason
    // immediately so the DayRow reflects intent before the network trip.
    set({
      currentPlan: {
        ...plan,
        entries: plan.entries.map((e) =>
          e.day_of_week === day
            ? { ...e, status: 'skipped' as const, skip_reason: reason }
            : e
        ),
      },
      error: null,
    });

    try {
      const response = await authedFetch(
        `/meal-plans/${plan.id}/entries/${day}/skip`,
        {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }
      );

      if (!response.ok) {
        // Drain the body so we don't leak a dangling response, but use a
        // consistent user-facing message ("Failed to skip day") regardless
        // of the upstream error text — the user's mental model is about
        // the skip action, not the transport-layer wording.
        await response.json().catch(() => ({}));
        set({
          currentPlan: { ...plan, entries: snapshot },
          error: 'Failed to skip day',
        });
        return;
      }

      const body = await response.json();
      const updatedEntry: MealPlanEntry | undefined = body?.data;
      if (
        !updatedEntry ||
        typeof (updatedEntry as MealPlanEntry).day_of_week !== 'number'
      ) {
        // Server returned OK but no usable entry — keep optimistic state.
        set({ error: null });
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
        error: null,
      }));
    } catch (err) {
      // Network error — rollback.
      set({
        currentPlan: { ...plan, entries: snapshot },
        error: err instanceof Error ? err.message : 'Failed to skip day',
      });
    }
  },

  fetchRange: async (fromWeekStart: string, toWeekStart: string) => {
    // Dedupe: if already loading, bail out. Caller is responsible for
    // awaiting the prior fetchRange (or can fire-and-forget — this just
    // prevents double-POSTs when e.g. the month toggle fires useEffect
    // twice during StrictMode renders).
    if (get().monthLoading) return;
    set({ monthLoading: true, monthError: null });
    try {
      const res = await authedFetch(
        `/meal-plans?from=${fromWeekStart}&to=${toWeekStart}&projection=month`,
        { method: 'GET' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { error?: string });
        set({
          monthError: body.error ?? 'Failed to load month',
          monthLoading: false,
        });
        return;
      }
      const body = await res.json();
      const m = new Map<string, MealPlanEntry>();
      for (const plan of (body.data ?? []) as Array<{
        week_start: string;
        entries?: Array<MealPlanEntry & { day_of_week: number }>;
      }>) {
        for (const e of plan.entries ?? []) {
          const iso = addDaysIso(plan.week_start, e.day_of_week);
          m.set(iso, e);
        }
      }
      set({ monthPlans: m, monthLoading: false, monthError: null });
    } catch (err) {
      set({
        monthError: err instanceof Error ? err.message : 'Failed to load month',
        monthLoading: false,
      });
    }
  },
    }),
    {
      name: 'dinnertime-meal-plan',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist currentPlan + monthPlans. Map can't be JSON-serialized
      // directly — coerce to a plain object on write, reconstruct on
      // rehydrate (onRehydrateStorage below).
      partialize: (state) => ({
        currentPlan: state.currentPlan,
        monthPlans: Object.fromEntries(state.monthPlans),
      }),
      version: 2,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const raw = state.monthPlans as unknown;
        if (raw instanceof Map) return; // already a Map (e.g., fresh start)
        if (raw && typeof raw === 'object') {
          state.monthPlans = new Map(
            Object.entries(raw as Record<string, MealPlanEntry>)
          );
        } else {
          state.monthPlans = new Map();
        }
      },
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
