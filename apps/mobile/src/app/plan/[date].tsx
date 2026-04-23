/**
 * Phase 22-04 — Day drill-down route: `/plan/[date]`.
 *
 * Full-screen detail for a single planned day. Entry points:
 *   - Month grid (22-03) — tap cell with entry → router.push(`/plan/${iso}`)
 *   - Future: DayRow long-press / dedicated CTA (deferred)
 *
 * Data source priority:
 *   1. `useMealPlanStore.monthPlans.get(iso)` — hot cache (Month view
 *      populated this via `fetchRange`).
 *   2. Single-day fallback fetch via `fetchRange(iso, iso)` — the server
 *      endpoint accepts equal from/to.
 *
 * Renders:
 *   - Navigation header with the formatted date as title
 *   - Meal header (title + description + estimated time)
 *   - IngredientChecklist (local toggle state, per PLAN 22-04)
 *   - TimerShortcuts (10/20/30 — discoverability nudge; real timer is
 *     the Phase 16 voice cooking surface)
 *   - Start Cooking CTA:
 *     - Entry with recipe_id → router.push(`/recipes/${recipe_id}/cook`)
 *     - Ad-hoc entry (recipe_id null) → disabled + helper caption
 *
 * Telemetry: `plan.day_drill_opened` fires once per (date, entry) mount.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { IngredientChecklist } from '../../components/plan/IngredientChecklist';
import { TimerShortcuts } from '../../components/plan/TimerShortcuts';
import { Button } from '../../components/ui/Button';
import { logPlanEvent, sanitizePayload } from '../../plan/telemetry';
import { colors } from '../../design/tokens';

/**
 * Format an ISO date (YYYY-MM-DD) as a human-readable header title —
 * e.g. "Wednesday, May 13". UTC anchor avoids timezone drift where a
 * client just past midnight would render the previous day.
 */
function formatIsoHuman(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function PlanDay() {
  const params = useLocalSearchParams<{ date: string }>();
  const iso = typeof params.date === 'string' ? params.date : '';

  // Reactive selectors so the screen re-renders when fetchRange populates.
  const monthPlans = useMealPlanStore((s) => s.monthPlans);
  const fetchRange = useMealPlanStore((s) => s.fetchRange);
  const currentPlan = useMealPlanStore((s) => s.currentPlan);

  // Stable per-mount session id for telemetry correlation.
  const [sessionId] = useState(() =>
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `pd-${Date.now()}`,
  );

  const entry = useMemo(() => monthPlans.get(iso) ?? null, [monthPlans, iso]);

  // Fallback fetch: if the entry isn't in the month cache (user deep-linked
  // or did not toggle to Month view this session), request a single-day
  // window. The server enforces from === to as a valid zero-day range.
  useEffect(() => {
    if (!entry && iso) {
      void fetchRange(iso, iso);
    }
  }, [entry, iso, fetchRange]);

  // Fire telemetry once per (date, entry?.id) combination. We include
  // entry?.id in deps so if the fallback fetch lands after mount, we
  // re-log with the newly-resolved meal_plan_entry_id rather than a
  // stale null.
  useEffect(() => {
    if (!iso) return;
    logPlanEvent({
      name: 'plan.day_drill_opened',
      session_id: sessionId,
      meal_plan_id: currentPlan?.id ?? null,
      meal_plan_entry_id: entry?.id ?? null,
      payload: sanitizePayload({
        date: iso,
        meal_plan_entry_id: entry?.id ?? null,
      }),
    });
  }, [entry?.id, iso, sessionId, currentPlan?.id]);

  const headerTitle = formatIsoHuman(iso);
  const mealTitle = entry?.title ?? 'No meal planned';
  const time = entry?.estimated_time_minutes ?? null;
  const ingredients = entry?.ingredients ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen options={{ title: headerTitle }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{mealTitle}</Text>
          {entry?.description ? (
            <Text style={styles.description}>{entry.description}</Text>
          ) : null}
          {time ? <Text style={styles.meta}>{time} minutes</Text> : null}
        </View>

        <IngredientChecklist ingredients={ingredients} />

        <Text style={styles.sectionLabel}>QUICK TIMERS</Text>
        <TimerShortcuts />

        <View style={styles.ctaWrap}>
          {entry?.recipe_id ? (
            <Button
              title="Start Cooking"
              onPress={() => router.push(`/recipes/${entry.recipe_id}/cook`)}
            />
          ) : (
            <>
              <Button title="Start Cooking" disabled onPress={() => {}} />
              <Text style={styles.helper}>
                Save this meal to your Recipe Box first to cook with voice.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 22,
  },
  meta: {
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 8,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    marginTop: 12,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.5,
  },
  ctaWrap: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  helper: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
