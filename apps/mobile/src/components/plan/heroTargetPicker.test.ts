/**
 * Quick-task 7 — heroTargetPicker tests.
 *
 * Pure-function picker that resolves the day_of_week index (0..6, Monday=0)
 * the Plan tab should render as a HeroDayCard in detailed mode. Rules:
 *
 *   1. Compute todayIdx = days(weekStart → todayIso), clamped to [0,6].
 *      If today is OUTSIDE the week, fall back to 0 (clamp).
 *   2. If today's entry is NOT cooked/skipped → return todayIdx.
 *   3. Otherwise scan entries from todayIdx+1..6 for the first 'planned'
 *      → return its day_of_week.
 *   4. Fallback: return clamped todayIdx (so the hero NEVER disappears —
 *      even an all-cooked week gets a hero render).
 */
import { describe, it, expect } from 'vitest';
import { pickHeroTargetIndex } from './heroTargetPicker';
import type { MealPlanEntry } from '../../types/mealPlan';

const mkEntry = (
  d: number,
  status: 'planned' | 'cooked' | 'skipped' = 'planned',
): MealPlanEntry => ({
  id: `e-${d}`,
  meal_plan_id: 'p1',
  day_of_week: d,
  recipe_id: null,
  title: `Day ${d}`,
  description: null,
  ingredients: [],
  ingredients_needed: [],
  steps: [],
  prep_time_minutes: null,
  cook_time_minutes: null,
  servings: null,
  estimated_time_minutes: null,
  difficulty: null,
  kid_friendly: false,
  why_suggested: null,
  status,
  cooked_at: null,
  created_at: '2026-04-27T00:00:00Z',
});

const WEEK = '2026-04-27'; // Mon
const MON = '2026-04-27';
const WED = '2026-04-29';

describe('pickHeroTargetIndex', () => {
  it('today is Mon + Mon entry is planned → returns 0', () => {
    const entries = [0, 1, 2, 3, 4, 5, 6].map((d) => mkEntry(d, 'planned'));
    expect(pickHeroTargetIndex(entries, WEEK, MON)).toBe(0);
  });

  it('today is Wed + Wed entry is planned → returns 2', () => {
    const entries = [0, 1, 2, 3, 4, 5, 6].map((d) => mkEntry(d, 'planned'));
    expect(pickHeroTargetIndex(entries, WEEK, WED)).toBe(2);
  });

  it('today is Mon + Mon entry is cooked, Tue planned → returns 1', () => {
    const entries = [
      mkEntry(0, 'cooked'),
      mkEntry(1, 'planned'),
      mkEntry(2, 'planned'),
      mkEntry(3, 'planned'),
      mkEntry(4, 'planned'),
      mkEntry(5, 'planned'),
      mkEntry(6, 'planned'),
    ];
    expect(pickHeroTargetIndex(entries, WEEK, MON)).toBe(1);
  });

  it('today is Mon + Mon entry is skipped, Tue planned → returns 1', () => {
    const entries = [
      mkEntry(0, 'skipped'),
      mkEntry(1, 'planned'),
      mkEntry(2, 'planned'),
      mkEntry(3, 'planned'),
      mkEntry(4, 'planned'),
      mkEntry(5, 'planned'),
      mkEntry(6, 'planned'),
    ];
    expect(pickHeroTargetIndex(entries, WEEK, MON)).toBe(1);
  });

  it('today is Mon + Mon..Wed cooked + Thu planned → returns 3', () => {
    const entries = [
      mkEntry(0, 'cooked'),
      mkEntry(1, 'cooked'),
      mkEntry(2, 'cooked'),
      mkEntry(3, 'planned'),
      mkEntry(4, 'planned'),
      mkEntry(5, 'planned'),
      mkEntry(6, 'planned'),
    ];
    expect(pickHeroTargetIndex(entries, WEEK, MON)).toBe(3);
  });

  it('all 7 days cooked → returns todayIdx (fallback so hero never disappears)', () => {
    const entries = [0, 1, 2, 3, 4, 5, 6].map((d) => mkEntry(d, 'cooked'));
    expect(pickHeroTargetIndex(entries, WEEK, WED)).toBe(2);
  });

  it('today BEFORE weekStart (last week) → returns 0 (clamp + fallback)', () => {
    const entries = [0, 1, 2, 3, 4, 5, 6].map((d) => mkEntry(d, 'planned'));
    // 2026-04-20 is Monday of the previous week.
    expect(pickHeroTargetIndex(entries, WEEK, '2026-04-20')).toBe(0);
  });

  it('today AFTER weekStart+6 (next week) → returns 0 (clamp + fallback)', () => {
    const entries = [0, 1, 2, 3, 4, 5, 6].map((d) => mkEntry(d, 'planned'));
    // 2026-05-04 is Monday of the next week (8 days after WEEK start).
    expect(pickHeroTargetIndex(entries, WEEK, '2026-05-04')).toBe(0);
  });

  it('entries=[] (no entries) → returns clamped todayIdx (caller handles empty fall-through)', () => {
    expect(pickHeroTargetIndex([], WEEK, WED)).toBe(2);
  });

  it('missing entry at todayIdx (gap day) → returns todayIdx (treats gap as actionable)', () => {
    // No entry for day 2 (Wed).
    const entries = [
      mkEntry(0, 'planned'),
      mkEntry(1, 'planned'),
      mkEntry(3, 'planned'),
      mkEntry(4, 'planned'),
      mkEntry(5, 'planned'),
      mkEntry(6, 'planned'),
    ];
    expect(pickHeroTargetIndex(entries, WEEK, WED)).toBe(2);
  });
});
