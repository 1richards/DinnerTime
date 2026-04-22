/**
 * Phase 22-06 — `computePantryReady` pure helper.
 *
 * Decides whether a meal plan entry's ingredient list is "pantry ready" — i.e.,
 * the user can cook it today without an Instacart trip. DayRow wraps the
 * resulting boolean into the Phase 19 `Pantry ready` chip via the existing
 * `deriveStatusChips` matrix.
 *
 * Heuristic (mirrors `matchesPantryOnly` in `apps/mobile/src/app/(tabs)/kitchen.tsx`
 * lines 89-106 — same staple list, same bidirectional substring strategy):
 *
 *   1. No ingredients → `false` (nothing to cook means nothing to gauge).
 *   2. Every ingredient is in `PANTRY_STAPLES` → `true` (nothing to source).
 *   3. Otherwise: non-staple ingredients must hit ≥80% match against the
 *      user's pantry. A match is any case-insensitive substring relation in
 *      either direction — pantry name contains ingredient name OR vice versa.
 *
 * The 80% threshold is deliberate slack so a single missing minor aromatic
 * (e.g., one fresh herb) doesn't flip the chip off. The bidirectional
 * substring match handles both the "pantry: chicken, ingredient: chicken
 * breast" and "pantry: brown rice, ingredient: rice" cases.
 *
 * PII note: this helper runs entirely on-device — ingredient names and
 * pantry rows never leave the phone. No telemetry fires from here.
 */

import type { MealPlanIngredient } from '../../types/mealPlan';
import type { PantryItem } from '../../types/pantry';

/**
 * Ingredients that everyone has — the heuristic skips these when computing
 * the match ratio so a recipe that's 90% bought-out but uses salt + oil
 * isn't punished for the two staples.
 *
 * Kept in lockstep with `PANTRY_STAPLES` in
 * `apps/mobile/src/app/(tabs)/kitchen.tsx` (duplicated because the kitchen
 * module doesn't export it and breaking that import surface is out of
 * scope for this plan). The 11-entry parity test in `pantryReady.test.ts`
 * guards against drift.
 */
export const PANTRY_STAPLES: ReadonlySet<string> = new Set([
  'salt',
  'pepper',
  'water',
  'oil',
  'olive oil',
  'vegetable oil',
  'butter',
  'sugar',
  'flour',
  'garlic powder',
  'onion powder',
]);

const norm = (s: string): string => s.trim().toLowerCase();

/**
 * True iff the meal's non-staple ingredients are ≥80% matched by the
 * user's pantry items (case-insensitive bidirectional substring match).
 *
 * @param ingredients — the entry's full ingredient list.
 * @param pantryItems — the user's current pantry inventory.
 */
export function computePantryReady(
  ingredients: MealPlanIngredient[],
  pantryItems: PantryItem[],
): boolean {
  if (ingredients.length === 0) return false;

  const pantryNames = new Set(
    pantryItems.map((p) => norm(p.name)).filter((n) => n.length > 0),
  );

  const nonStaple = ingredients
    .map((i) => norm(i.name ?? ''))
    .filter((n) => n.length > 0 && !PANTRY_STAPLES.has(n));

  // Every ingredient is a staple → nothing to shop. Treat as ready.
  if (nonStaple.length === 0) return true;

  let matched = 0;
  for (const name of nonStaple) {
    for (const p of pantryNames) {
      if (p.includes(name) || name.includes(p)) {
        matched++;
        break;
      }
    }
  }
  return matched / nonStaple.length >= 0.8;
}
