import React, { useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import type { Recipe } from '../../types/recipe';
import { DatePickerSheet } from '../plan/DatePickerSheet';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';

interface Props {
  visible: boolean;
  recipe: Recipe;
  onClose: () => void;
}

const getApiBaseUrl = (): string =>
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function getAuthToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error('Not authenticated');
  return data.session.access_token;
}

function formatIsoDate(iso: string): string {
  // 'YYYY-MM-DD' → 'Mon, May 14'. Keeps the UTC interpretation consistent
  // with DatePickerSheet (which emits UTC-midnight dates).
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(Date.UTC(y, m - 1, d));
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * Date-picker sheet for scheduling a saved recipe onto any date in
 * [today, today+60d]. Delegates UI to the `DatePickerSheet` primitive
 * (Phase 22 Wave 0) and POSTs to `/meal-plans/entries/assign` with the
 * new `body.date` param (server 22-00 derives week_start + day_of_week).
 *
 * Telemetry (plan 22-01 / PLAN-X-02):
 *   - `plan.recipe_pin_started`   — fires immediately before the POST.
 *   - `plan.recipe_pin_succeeded` — fires on 2xx.
 *   - `plan.recipe_pin_failed`    — fires on non-2xx with error_code.
 */
export function AddToPlanSheet({ visible, recipe, onClose }: Props) {
  const fetchCurrentPlan = useMealPlanStore((s) => s.fetchCurrent);
  const [sessionId] = useState<string>(() =>
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `ap-${Date.now()}`,
  );

  const handleConfirm = async (isoDate: string) => {
    // Emit started telemetry with the target date.
    logPlanEvent({
      name: 'plan.recipe_pin_started',
      session_id: sessionId,
      payload: sanitizePayload({ date: isoDate }),
    });

    try {
      const token = await getAuthToken();
      const body = {
        date: isoDate, // server 22-00 accepts date and derives week/day
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        estimated_time_minutes: recipe.total_time_minutes,
        recipe_id: recipe.id,
      };
      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/meal-plans/entries/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorCode =
          typeof err?.error === 'string' ? err.error : `http_${res.status}`;
        logPlanEvent({
          name: 'plan.recipe_pin_failed',
          session_id: sessionId,
          meal_plan_id: err?.data?.meal_plan_id ?? null,
          payload: sanitizePayload({
            error_code: errorCode,
            date: isoDate,
            meal_plan_id: err?.data?.meal_plan_id ?? null,
          }),
        });
        Alert.alert('Could not plan meal', err.error ?? 'Please try again.');
        return;
      }
      const resBody = await res.json().catch(() => ({}));
      const mealPlanId: string | null = resBody?.data?.meal_plan_id ?? null;
      logPlanEvent({
        name: 'plan.recipe_pin_succeeded',
        session_id: sessionId,
        meal_plan_id: mealPlanId,
        payload: sanitizePayload({
          date: isoDate,
          meal_plan_id: mealPlanId,
        }),
      });

      // Refresh the plan cache so the Plan tab reflects the new entry.
      fetchCurrentPlan().catch(() => {});

      // Success confirmation: brief Alert then close (DatePickerSheet has
      // no inline success state of its own — matches the shipped contract).
      Alert.alert('Added to plan', `Scheduled for ${formatIsoDate(isoDate)}.`);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logPlanEvent({
        name: 'plan.recipe_pin_failed',
        session_id: sessionId,
        payload: sanitizePayload({
          error_code: 'exception',
          date: isoDate,
        }),
      });
      Alert.alert('Could not plan meal', message);
    }
  };

  return (
    <DatePickerSheet
      visible={visible}
      title={`Add to Plan — ${recipe.title}`}
      confirmLabel="Add"
      onConfirm={handleConfirm}
      onDismiss={onClose}
    />
  );
}
