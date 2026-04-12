import type { PantryItem } from './pantry.js';
import type { MealPlanIngredient } from '../types/mealPlan.js';

export interface IngredientMatch {
  pantryItemId: string;
  ingredientName: string;
  deductQuantity: number;
  willDeplete: boolean;
}

export interface MatchResult {
  matches: IngredientMatch[];
  unmatched: string[];
}

/**
 * Normalize an ingredient or pantry item name so two forms can be compared.
 *
 * Strategy:
 *   1. Trim whitespace.
 *   2. Lowercase.
 *   3. Strip trailing 'es' or 's' (naive singular/plural collapse).
 *
 * Applied IDENTICALLY to both sides of a match, so "Tomatoes" → "tomato"
 * and "tomato" → "tomato" collapse to the same form and match.
 * The existing `normalizeName` in pantry.ts (trim + lowercase) is a strict
 * subset of this function; this module defines the richer form because
 * pantry.ts's normalized_name is indexed on DB writes and changing it would
 * require a migration. Future work: backfill pantry.normalized_name to this
 * richer form and reuse a single helper.
 */
export function normalizeIngredientName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (trimmed.length > 2 && trimmed.endsWith('es')) {
    return trimmed.slice(0, -2);
  }
  if (trimmed.length > 1 && trimmed.endsWith('s')) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

/**
 * Match recipe ingredients against pantry inventory.
 *
 * For each ingredient:
 *   - Find first pantry item whose normalized name matches (via normalizeIngredientName)
 *   - Compute deductQuantity = min(pantry.quantity, needed) where needed defaults to 1
 *   - willDeplete = pantry.quantity <= needed
 *
 * Returns matches + unmatched list of original ingredient names that had no pantry entry.
 */
export function matchIngredientsToPantry(
  entryIngredients: MealPlanIngredient[],
  pantryItems: PantryItem[],
): MatchResult {
  const matches: IngredientMatch[] = [];
  const unmatched: string[] = [];

  // Pre-normalize pantry names for lookup. Keep the FIRST occurrence (order preserved).
  const pantryByNorm = new Map<string, PantryItem>();
  for (const item of pantryItems) {
    const norm = normalizeIngredientName(item.name);
    if (!pantryByNorm.has(norm)) {
      pantryByNorm.set(norm, item);
    }
  }

  for (const ingredient of entryIngredients) {
    const norm = normalizeIngredientName(ingredient.name);
    const pantryItem = pantryByNorm.get(norm);

    if (!pantryItem) {
      unmatched.push(ingredient.name);
      continue;
    }

    const needed = ingredient.quantity ?? 1;
    const deductQuantity = Math.min(pantryItem.quantity, needed);
    const willDeplete = pantryItem.quantity <= needed;

    matches.push({
      pantryItemId: pantryItem.id,
      ingredientName: ingredient.name,
      deductQuantity,
      willDeplete,
    });
  }

  return { matches, unmatched };
}
