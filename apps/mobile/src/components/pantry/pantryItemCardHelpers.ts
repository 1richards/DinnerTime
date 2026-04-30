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

// Local mirror of ItemRow's ChipTone union — duplicated (instead of imported
// from '../ui/ItemRow') so this helper module can run under vitest's node env
// without pulling the RN renderer chain. The compile-time check below catches
// drift if ItemRow's union changes.
type ChipTone = 'default' | 'success' | 'warning' | 'destructive';

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

/**
 * Bug 2 (pantry-trifecta) — trailing chip selection.
 *
 * Priority (high → low):
 *   1. Uncertain (item not seen for >7d) — "{n}d" tone='destructive'
 *   2. Low effective confidence — "Low" tone='warning'
 *   3. Item is in the user's current shopping list — "In cart" tone='success'
 *
 * Uncertain + Low are higher-priority signals because they tell the user the
 * pantry row is unreliable; "In cart" is reassurance and must not hide a
 * warning.  Only one chip shows at a time.
 */
export function deriveTrailingChip(
  item: Pick<
    EnrichedPantryItem,
    'isUncertain' | 'effectiveConfidence' | 'last_seen_at'
  >,
  isInCart: boolean,
): { label: string; tone: ChipTone } | undefined {
  if (item.isUncertain) {
    const days = Math.floor(
      (Date.now() - new Date(item.last_seen_at).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return { label: `${days}d`, tone: 'destructive' };
  }
  if (item.effectiveConfidence < 0.6) {
    return { label: 'Low', tone: 'warning' };
  }
  if (isInCart) {
    return { label: 'In cart', tone: 'success' };
  }
  return undefined;
}

/**
 * Bug 2 (pantry-trifecta) — true iff a pantry item's name matches an item in
 * the user's current shopping list.  Bidirectional substring + case-insensitive
 * trim, mirroring the heuristic style used by `computePantryReady` so a
 * "Sriracha" pantry row matches a "Sriracha Sauce" shopping item and vice-versa.
 */
export function isItemInShoppingCart(
  itemName: string,
  shoppingNames: readonly string[],
): boolean {
  const target = itemName.trim().toLowerCase();
  if (!target) return false;
  for (const raw of shoppingNames) {
    const cand = raw.trim().toLowerCase();
    if (!cand) continue;
    if (cand === target || cand.includes(target) || target.includes(cand)) {
      return true;
    }
  }
  return false;
}
