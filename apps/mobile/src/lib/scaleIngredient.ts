import Fraction from 'fraction.js';
import type { ParsedIngredient } from '../types/recipe';

/**
 * Scale a parsed ingredient by a multiplier.
 * Uses fraction.js to preserve fractional precision (e.g. 0.75 * 2 = 1.5).
 * If the ingredient has no quantity, returns it unchanged.
 */
export function scaleIngredient(
  ing: ParsedIngredient,
  multiplier: number
): ParsedIngredient {
  if (ing.quantity == null) return ing;
  const scaled = new Fraction(ing.quantity).mul(multiplier);
  return { ...ing, quantity: Number(scaled.valueOf()) };
}

/**
 * Format a numeric quantity as a human-readable fraction string.
 * - Integers render without a fraction part (e.g. 2 -> "2").
 * - Zero renders as "0".
 * - Proper fractions render as "3/4".
 * - Improper fractions render as mixed form, e.g. 1.5 -> "1 1/2".
 */
export function formatQuantity(n: number): string {
  if (n === 0) return '0';
  if (Number.isInteger(n)) return String(n);
  return new Fraction(n).toFraction(true);
}
