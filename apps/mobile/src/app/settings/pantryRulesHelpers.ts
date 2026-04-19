/**
 * Pure helpers for the pantry-rules UX (reorder + summary rendering).
 *
 * Phase 21-05. All logic that doesn't require a renderer lives here so vitest
 * node env can cover it without pulling RN/Reanimated. The screen component
 * (pantry-rules.tsx) delegates to these 1:1, so helper-level coverage maps
 * directly to on-screen output.
 */

export interface SuggestionPayload {
  item_name?: string;
  user_location?: string;
  alias_name?: string;
  target_canonical_id?: string;
  canonical_ingredient_id?: string;
}

export interface SuggestionForSummary {
  rule_type: 'name_mapping' | 'location_mapping';
  payload: SuggestionPayload | Record<string, unknown> | null | undefined;
}

/**
 * User-facing summary of a SuggestedRule row. Works off loosely-typed payload
 * to survive malformed aggregator output without crashing the UI.
 */
export function renderSuggestionSummary(s: SuggestionForSummary): string {
  const payload = (s.payload ?? {}) as SuggestionPayload;
  if (s.rule_type === 'location_mapping') {
    const name = payload.item_name ?? 'item';
    const loc = payload.user_location ?? '?';
    return `Always put "${name}" in ${loc}`;
  }
  const alias = payload.alias_name ?? 'alias';
  return `Treat "${alias}" as a known ingredient`;
}

export interface LocationRule {
  id: string;
  canonical_ingredient_id: string;
  source_location: 'fridge' | 'pantry' | 'freezer';
  precedence: number;
  /** Convenience field joined client-side for display (optional). */
  canonical_name?: string;
}

/**
 * Reorder a list of location rules by a new id order.
 *
 * - Missing ids (in `newIdOrder` but not in `rules`) are filtered out.
 * - Extra ids in `rules` not present in `newIdOrder` are dropped.
 * - Precedence is rewritten to the new index [0..N-1].
 *
 * The array returned is a shallow-copy of each surviving rule with
 * `precedence` set to its new index, in the order supplied by `newIdOrder`.
 */
export function reorderByIds(
  rules: LocationRule[],
  newIdOrder: string[],
): LocationRule[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  const out: LocationRule[] = [];
  for (const id of newIdOrder) {
    const r = byId.get(id);
    if (!r) continue;
    out.push({ ...r, precedence: out.length });
  }
  return out;
}
