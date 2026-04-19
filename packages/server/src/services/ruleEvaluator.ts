/**
 * User rule evaluator (Phase 21-02).
 *
 * Applies user-authored location-mapping rules to a canonical-resolved ScanResult.
 * First-match-wins by `precedence` ASC. Rule evaluation fires AFTER canonical
 * resolution (canonicalResolver, Phase 24-03) and BEFORE reconcileItems commit
 * (pantry.ts, Phase 24-05) — the insertion point is described in RESEARCH §
 * "Pattern 1: Rule evaluator slot".
 *
 * NOTE: Name-mapping rules do NOT live here. Per Phase 21 CONTEXT.md §
 * "Rules UI", name-mapping rules are persisted as `ingredient_aliases` rows
 * with `source='user_rule'` and are applied transparently by canonicalResolver's
 * Stage 2 (exact alias match). ruleEvaluator owns location rules only — keeping
 * the two planes separate avoids conflating user-scoped rules with the
 * global canonical resolution stage.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScanResult } from './vision.js';
import type { CanonicalMatch } from './canonicalResolver.js';

export interface UserLocationRule {
  canonical_ingredient_id: string;
  source_location: 'fridge' | 'pantry' | 'freezer';
  precedence: number;
}

export interface UserRules {
  /**
   * Expected to be sorted ASC by precedence (loadUserLocationRules does this).
   * applyLocationRules defensively re-sorts to avoid silent regressions if
   * callers construct UserRules ad-hoc (e.g. unit tests or in-memory caches).
   */
  locationRules: UserLocationRule[];
}

/**
 * Pure function. Returns the original scanItem (by reference) when no rule
 * matches — callers can safely `===` compare to detect a no-op. Returns a
 * new object with `source_location` overridden on match.
 */
export function applyLocationRules(
  match: CanonicalMatch,
  scanItem: ScanResult,
  rules: UserRules,
): ScanResult {
  if (rules.locationRules.length === 0) return scanItem;
  // Defensive sort — loadUserLocationRules orders by precedence ASC, but
  // callers may construct UserRules ad-hoc. Cheap for N ≤ 20 typical rule count.
  const sorted = [...rules.locationRules].sort(
    (a, b) => a.precedence - b.precedence,
  );
  const hit = sorted.find(
    (r) => r.canonical_ingredient_id === match.canonicalId,
  );
  if (!hit) return scanItem;
  return { ...scanItem, source_location: hit.source_location };
}

/**
 * Load the user's location rules from `user_location_rules` ordered by
 * precedence ASC so applyLocationRules sees first-match-wins without further
 * sorting. On query error, returns an empty UserRules — never throws into the
 * scan path. Table ships via Phase 21-01 migration 00017.
 */
export async function loadUserLocationRules(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRules> {
  const { data, error } = await supabase
    .from('user_location_rules')
    .select('canonical_ingredient_id, source_location, precedence')
    .eq('user_id', userId)
    .order('precedence', { ascending: true });
  if (error || !data) return { locationRules: [] };
  return { locationRules: data as UserLocationRule[] };
}
