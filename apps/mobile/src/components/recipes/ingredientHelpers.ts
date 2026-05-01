/**
 * Phase 01-01 — `isIngredientInPantry` pure helper.
 *
 * True iff a recipe ingredient is "covered" by the user's pantry.
 *
 * Coverage rule (mirrors `computePantryReady`'s per-ingredient match —
 * extracted here so PreviewSheet + ScrollableRecipe can render a per-row
 * indicator without re-running the 80% threshold logic):
 *
 *   1. Empty / whitespace-only name → false (don't render indicator on
 *      bad data).
 *   2. Name (trimmed + lowercased) is in PANTRY_STAPLES → true (always-have
 *      per Phase 01 D-MATCH; staples are intentionally NOT punished).
 *   3. Otherwise: bidirectional substring match against any pantry name —
 *      pantry name contains ingredient OR ingredient contains pantry name.
 *      Case-insensitive, trimmed.
 *
 * Pantry list MUST already be filtered to status === 'available' by the
 * caller (Bug 3 contract — see 01-CONTEXT.md > Match Logic).
 *
 * Mirror of `isItemInShoppingCart` in
 * `apps/mobile/src/components/pantry/pantryItemCardHelpers.ts` (same
 * bidirectional matcher). Pure: no React, no stores; runs under
 * vitest-node without the RN renderer.
 *
 * Why a per-ingredient helper instead of reusing `computePantryReady`
 * directly: `computePantryReady` returns one boolean for the whole
 * recipe (with an 80% threshold). The indicator is per-row — every
 * individual non-staple ingredient that doesn't match should show the
 * icon. Same matcher, different aggregation.
 */

import { PANTRY_STAPLES } from '../plan/pantryReady';

export function isIngredientInPantry(
  ingredientName: string,
  pantryNames: readonly string[],
): boolean {
  const target = ingredientName.trim().toLowerCase();
  if (!target) return false;
  if (PANTRY_STAPLES.has(target)) return true;
  for (const raw of pantryNames) {
    const cand = raw.trim().toLowerCase();
    if (!cand) continue;
    if (cand === target || cand.includes(target) || target.includes(cand)) {
      return true;
    }
  }
  return false;
}
