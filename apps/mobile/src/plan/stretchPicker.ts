/**
 * Phase 22 Wave 0: stretch-meal picker.
 *
 * Pure helper that identifies ONE "stretch" entry per week — the most
 * ambitious meal above the user's median cooked complexity. Downstream plan
 * 22-05 consumes this to set `MealPlanEntry.is_stretch = true` on render,
 * and plan 22-06's `deriveStatusChips` flips the chip on for that entry.
 *
 * Design:
 * - Derived CLIENT-SIDE per render (not persisted). 22-RESEARCH.md Pitfall 5:
 *   persisting a stretch flag survives through swap/regenerate and creates
 *   "where did my stretch go?" confusion. Deriving each render guarantees
 *   exactly one entry is flagged given the current entries + cooked median.
 * - "Stretch" = complexity > cookedMedian + 2 (a narrow gate; the vast
 *   majority of meals fall under cookedMedian and are not stretches). The
 *   +2 is the confidence band — small cross-meal variance shouldn't trigger.
 * - Ties broken by LOWEST day_of_week (Monday first) — deterministic and
 *   nudges the stretch early in the week when motivation is highest.
 * - Returns NULL when no entry qualifies (flat week). Consumers render
 *   nothing special in that case.
 *
 * Complexity estimator: difficulty band (easy=1, medium=6, hard=12) + minutes/10.
 * Values chosen so difficulty dominates and time is a tie-breaker:
 *   easy 20min   = 1 + 2  =  3
 *   medium 30min = 6 + 3  =  9
 *   hard 60min   = 12 + 6 = 18
 */

import type { MealPlanEntry, Difficulty } from '../types/mealPlan';

const DIFF_SCORE: Record<Difficulty, number> = {
  easy: 1,
  medium: 6,
  hard: 12,
};
const DEFAULT_DIFFICULTY_SCORE = 3; // when difficulty is null/unknown
const DEFAULT_MINUTES = 30;

/**
 * Estimate a complexity score for an entry. Higher = more ambitious.
 * Pure, stateless, safe to call on partial entries (uses defaults).
 */
export function estimateComplexity(
  e: Pick<MealPlanEntry, 'difficulty' | 'estimated_time_minutes'>,
): number {
  const d = e.difficulty ? DIFF_SCORE[e.difficulty] : DEFAULT_DIFFICULTY_SCORE;
  const t = (e.estimated_time_minutes ?? DEFAULT_MINUTES) / 10;
  return d + t;
}

/**
 * Pick the day_of_week (0..6) of the ONE stretch entry for a week, or NULL
 * when none qualifies. Highest-complexity entry above cookedMedian + 2.
 * Already-cooked entries are excluded (stretch nudges FUTURE motivation).
 * Ties broken by lowest day_of_week (Monday first).
 */
export function pickStretchDay(
  entries: MealPlanEntry[],
  cookedMedianComplexity: number,
): number | null {
  const floor = cookedMedianComplexity + 2;
  const ranked = entries
    .filter((e) => e.status !== 'cooked')
    .map((e) => ({ day: e.day_of_week, c: estimateComplexity(e) }))
    .filter((x) => x.c > floor)
    .sort((a, b) => b.c - a.c || a.day - b.day);
  return ranked[0]?.day ?? null;
}
