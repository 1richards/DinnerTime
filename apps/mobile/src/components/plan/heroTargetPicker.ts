/**
 * Quick-task 7 — heroTargetPicker.
 *
 * Pure function that resolves which day_of_week index (0..6, Monday=0)
 * the Plan tab should render as a HeroDayCard in detailed mode. Lives in
 * its own module so plan.tsx's renderItem can call it from a useMemo
 * without round-tripping through the Reanimated/expo-image graph the
 * HeroDayCard component itself drags in.
 *
 * Behavior contract (matches heroTargetPicker.test.ts):
 *   1. Compute todayIdx = days(weekStart → todayIso). Clamp to [0,6]. If
 *      today is OUTSIDE the week (negative or >6), the clamped value is
 *      always 0 — the helper treats out-of-week today as "first day of
 *      this week" which keeps the hero from vanishing on edge cases (e.g.
 *      user paging backward in week-shift mode).
 *   2. If today's entry is NOT cooked/skipped (or is missing entirely —
 *      gap days count as actionable so the hero becomes an "Add a meal"
 *      hero), return todayIdx.
 *   3. Otherwise scan entries from todayIdx+1..6 for the first 'planned'
 *      entry — return its day_of_week.
 *   4. Fallback: return clamped todayIdx so the hero NEVER disappears.
 *      An all-cooked week renders the cooked today-meal as the hero —
 *      better than no hero at all.
 *
 * Iteration deliberately reads the raw entries array (NOT a status-filtered
 * map) — the picker needs to see 'cooked' and 'skipped' to advance past
 * them. The plan.tsx-level entriesByDay map filters out skipped entries
 * for FlatList rendering, but the picker pre-dates that filter.
 */

import type { MealPlanEntry } from '../../types/mealPlan';

/** UTC-anchored day diff helper. */
function diffDaysUtc(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

const clamp = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : n;

export function pickHeroTargetIndex(
  entries: MealPlanEntry[],
  weekStart: string, // 'YYYY-MM-DD'
  todayIso: string, // 'YYYY-MM-DD'
): number {
  const rawTodayIdx = diffDaysUtc(weekStart, todayIso);
  const todayIdx = clamp(rawTodayIdx, 0, 6);
  // Out-of-week: clamp + fallback to 0 (the helper treats out-of-week today
  // as "first day of this week" so the hero never disappears).
  if (rawTodayIdx < 0 || rawTodayIdx > 6) return 0;

  // Index entries by day_of_week for O(1) lookup. Multiple entries on the
  // same day (shouldn't happen in production — uniqueness is enforced
  // server-side) collapse to the last one in source order.
  const byDay = new Map<number, MealPlanEntry>();
  for (const e of entries) byDay.set(e.day_of_week, e);

  const todayEntry = byDay.get(todayIdx);
  // Gap day (no entry) OR planned entry → today wins.
  if (!todayEntry || (todayEntry.status !== 'cooked' && todayEntry.status !== 'skipped')) {
    return todayIdx;
  }

  // Scan forward for the next planned entry.
  for (let d = todayIdx + 1; d <= 6; d += 1) {
    const e = byDay.get(d);
    if (e && e.status === 'planned') return d;
  }

  // Fallback — hero never disappears.
  return todayIdx;
}
