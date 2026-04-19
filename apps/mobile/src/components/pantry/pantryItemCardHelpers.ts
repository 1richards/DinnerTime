/**
 * Pure helpers for PantryItemCard — extracted so Phase 21-04's stale-treatment
 * decision (dashed border + opacity-50 when confidence has decayed below 0.5)
 * is unit-testable under vitest's node env, without pulling React's renderer.
 *
 * Mirrors the pattern used for ItemRow (itemRowHelpers.ts) and
 * reviewItemRowHelpers (Phase 24-06): move the className logic into pure
 * functions, leave JSX composition in the component file.
 */

import type { EnrichedPantryItem } from '../../hooks/usePantryItems';

/**
 * Resolve the outer wrapper's NativeWind className for a PantryItemCard.
 *
 * Three states, mutually exclusive — earlier states win:
 *   1. stale (effectiveConfidence < 0.5): dashed border, opacity-50. Strict <
 *      keeps 0.5 exactly on the fresh side (matches Phase 14's threshold
 *      convention where the boundary value is non-degraded).
 *   2. isUncertain only: opacity-60 (legacy 7-day-decay signal from Phase 3).
 *   3. fresh: no mutation.
 *
 * Keeping stale + isUncertain separate lets the two signals evolve
 * independently — Phase 21 ROADMAP #2 is specifically about the sub-0.5
 * threshold; isUncertain retains its pre-21 semantics.
 */
export function resolvePantryItemCardWrapperClasses(
  item: Pick<EnrichedPantryItem, 'effectiveConfidence' | 'isUncertain'>,
): string {
  const isStale = item.effectiveConfidence < 0.5;
  const modifier = isStale
    ? 'opacity-50 border border-dashed border-warmGray-300 rounded-xl'
    : item.isUncertain
      ? 'opacity-60'
      : '';
  return modifier ? `mb-2 mx-4 ${modifier}` : 'mb-2 mx-4';
}
