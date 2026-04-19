/**
 * Pure helpers for pantry-rules reorder UX.
 *
 * Phase 21-05. The rules list is drag-to-reorder (first-match-wins) and we
 * want to keep all the reordering logic in a plain module so it's testable
 * under vitest node env without pulling RN/Reanimated.
 */

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
