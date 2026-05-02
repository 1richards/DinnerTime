/**
 * Shared helper for normalizing recipe servings counts.
 *
 * Lives outside recipeStore.ts / recipeParser.ts because both modules
 * need it and they already type-import each other — pulling the helper
 * in either direction would create an import cycle.
 */

/**
 * Lower bound for a recipe's `servings` count. DinnerTime is built
 * around households, so a 1- or 2-serving recipe is almost always
 * leftover bad AI output (or a single-serving site that scaled down).
 * Floor everything at 4 — the in-app serving stepper still lets the
 * user dial it down per-cook if they want less.
 */
export const MIN_SERVINGS = 4;

/**
 * Clamp a servings value (or null/undefined/NaN) to at least
 * MIN_SERVINGS. Rounds to an integer.
 */
export function normalizeServings(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < MIN_SERVINGS) {
    return MIN_SERVINGS;
  }
  return Math.round(value);
}
