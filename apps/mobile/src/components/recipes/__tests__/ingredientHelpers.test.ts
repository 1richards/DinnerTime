/**
 * Phase 01-01 — `isIngredientInPantry` pure helper unit tests.
 *
 * Mirrors the bidirectional-substring matcher in
 * `pantryItemCardHelpers.ts > isItemInShoppingCart`, but inverts the
 * relationship (recipe ingredient ↔ pantry rows) and skips
 * `PANTRY_STAPLES` so always-have ingredients (salt, oil, water, butter,
 * sugar, flour, garlic powder, onion powder, pepper, olive oil, vegetable oil)
 * never render the missing indicator.
 *
 * Coverage matrix (7 cases — one per behavior bullet in 01-PLAN.md):
 *   1. empty / whitespace-only ingredient name → false
 *   2. PANTRY_STAPLES member → true (even with empty pantry)
 *   3. case-insensitive match — pantry 'Chicken' matches 'chicken breast'
 *   4. bidirectional substring — pantry 'chicken' matches 'chicken breast'
 *      AND pantry 'brown rice' matches 'rice'
 *   5. no overlap → false
 *   6. empty/whitespace pantry rows do NOT match every ingredient
 *   7. trims + lowercases both sides before comparing
 */

import { describe, it, expect } from 'vitest';
import { isIngredientInPantry } from '../ingredientHelpers';

describe('isIngredientInPantry', () => {
  it('returns false for an empty ingredient name (no false positives on bad data)', () => {
    expect(isIngredientInPantry('', ['chicken'])).toBe(false);
  });

  it('returns false for a whitespace-only ingredient name', () => {
    expect(isIngredientInPantry('   ', ['chicken'])).toBe(false);
  });

  it('returns true when ingredient is a PANTRY_STAPLES member, even with empty pantry', () => {
    // Salt is the canonical example — staples are "always-have" per D-MATCH.
    expect(isIngredientInPantry('Salt', [])).toBe(true);
    expect(isIngredientInPantry('olive oil', [])).toBe(true);
    expect(isIngredientInPantry('GARLIC POWDER', [])).toBe(true);
  });

  it('matches case-insensitively — pantry "Chicken" matches "chicken breast"', () => {
    expect(isIngredientInPantry('chicken breast', ['Chicken'])).toBe(true);
  });

  it('matches bidirectional substring — pantry "chicken" matches "chicken breast"', () => {
    expect(isIngredientInPantry('chicken breast', ['chicken'])).toBe(true);
  });

  it('matches bidirectional substring — pantry "brown rice" matches "rice"', () => {
    expect(isIngredientInPantry('rice', ['brown rice'])).toBe(true);
  });

  it('returns false when no pantry name overlaps a non-staple ingredient', () => {
    expect(isIngredientInPantry('salmon fillet', ['chicken', 'beef'])).toBe(false);
  });

  it('ignores empty/whitespace pantry rows (does NOT match every ingredient)', () => {
    expect(isIngredientInPantry('salmon', ['', '   '])).toBe(false);
  });

  it('trims + lowercases both sides before comparing', () => {
    expect(isIngredientInPantry('  CHICKEN  ', ['  chicken  '])).toBe(true);
  });
});
