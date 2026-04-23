/**
 * Phase 22 Wave 0: skill-tier derivation.
 *
 * Tier is a display-only signal computed from lifetime cook history. We
 * intentionally avoid a new `skill_level` column or a persisted unlocked-
 * techniques taxonomy — those are aspirational and Phase 10 never shipped
 * them (see 22-RESEARCH.md §Phase Requirements PLAN-X-13).
 *
 * Thresholds (5 cooks, 20 cooks) are per 22-RESEARCH.md Pattern 4. Derived
 * from lifetime totals (`cook_count` summed across all recipe rows) so the
 * result is monotonic non-decreasing over time. Pitfall 6 in the research
 * doc warns against per-window tier flaps; summing lifetime stats avoids it
 * by construction.
 *
 * Consumers (all downstream of plan 22-05):
 *   - generator prompt (server-side tier-gate: tier >= 2 unlocks complexity
 *     >= 12 recipes)
 *   - week-view skill-progression banner ("You're tier 2 — try a stretch")
 *   - settings profile chip
 */

import type { RecipeCookStats } from '../types/progression';

export type SkillTier = 1 | 2 | 3;

const TIER_2_FLOOR = 5;
const TIER_3_FLOOR = 20;

/**
 * Derive a skill tier from a user's cooking history. Monotone non-decreasing
 * over time: sums `cook_count` across all rows and bands the total.
 *
 *   total <  5 → tier 1 (novice)
 *   total < 20 → tier 2 (comfortable)
 *   else       → tier 3 (confident)
 *
 * Empty history returns tier 1 — the novice default.
 */
export function deriveSkillTier(cookStats: RecipeCookStats[]): SkillTier {
  let total = 0;
  for (const row of cookStats) {
    total += row.cook_count;
  }
  if (total < TIER_2_FLOOR) return 1;
  if (total < TIER_3_FLOOR) return 2;
  return 3;
}
