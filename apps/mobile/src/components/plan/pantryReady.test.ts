/**
 * Phase 22-06 — pantryReady helper unit tests.
 *
 * Coverage matrix (6 behavior cases + 1 idempotence guard):
 *   1. no ingredients → false  (nothing to cook means nothing to gauge)
 *   2. ingredients are all staples → true (nothing to source)
 *   3. staples + non-staples with 100% match → true
 *   4. <80% of non-staples matched → false
 *   5. case-insensitive + bidirectional substring match
 *   6. empty ingredient name strings are ignored
 *
 * Plus a small guard asserting PANTRY_STAPLES contains the exact 11-entry
 * list documented in the plan spec so a drift in that set is caught here
 * rather than as a downstream readiness regression.
 */

import { describe, it, expect } from 'vitest';
import { computePantryReady, PANTRY_STAPLES } from './pantryReady';
import type { MealPlanIngredient } from '../../types/mealPlan';
import type { PantryItem } from '../../types/pantry';

const ing = (name: string): MealPlanIngredient => ({ name });

// Only the fields computePantryReady reads — keeps tests noise-free.
const pantry = (names: string[]): PantryItem[] =>
  names.map(
    (n, i) =>
      ({
        id: `p-${i}`,
        name: n,
      }) as unknown as PantryItem,
  );

describe('PANTRY_STAPLES', () => {
  it('contains the canonical staples (parity with kitchen.tsx matchesPantryOnly)', () => {
    expect(PANTRY_STAPLES.has('salt')).toBe(true);
    expect(PANTRY_STAPLES.has('pepper')).toBe(true);
    expect(PANTRY_STAPLES.has('water')).toBe(true);
    expect(PANTRY_STAPLES.has('oil')).toBe(true);
    expect(PANTRY_STAPLES.has('olive oil')).toBe(true);
    expect(PANTRY_STAPLES.has('vegetable oil')).toBe(true);
    expect(PANTRY_STAPLES.has('butter')).toBe(true);
    expect(PANTRY_STAPLES.has('sugar')).toBe(true);
    expect(PANTRY_STAPLES.has('flour')).toBe(true);
    expect(PANTRY_STAPLES.has('garlic powder')).toBe(true);
    expect(PANTRY_STAPLES.has('onion powder')).toBe(true);
  });
});

describe('computePantryReady', () => {
  it('returns false when there are no ingredients', () => {
    expect(computePantryReady([], [])).toBe(false);
    expect(computePantryReady([], pantry(['chicken', 'rice']))).toBe(false);
  });

  it('returns true when every ingredient is a staple (nothing to source)', () => {
    const ingredients = [ing('salt'), ing('pepper'), ing('olive oil')];
    expect(computePantryReady(ingredients, [])).toBe(true);
  });

  it('returns true when all non-staples are matched in the pantry', () => {
    const ingredients = [
      ing('salt'), // staple
      ing('chicken breast'),
      ing('rice'),
    ];
    const items = pantry(['chicken', 'rice', 'onion']);
    expect(computePantryReady(ingredients, items)).toBe(true);
  });

  it('returns false when <80% of non-staples match (1 of 3 = 33%)', () => {
    const ingredients = [
      ing('chicken breast'),
      ing('fennel bulb'),
      ing('saffron'),
    ];
    const items = pantry(['chicken']); // only 1 of 3 non-staples matches
    expect(computePantryReady(ingredients, items)).toBe(false);
  });

  it('returns true at the 80% threshold (4 of 5 non-staples match)', () => {
    const ingredients = [
      ing('chicken'),
      ing('rice'),
      ing('onion'),
      ing('garlic'),
      ing('saffron'), // unmatched
    ];
    const items = pantry(['chicken', 'rice', 'onion', 'garlic']);
    // 4/5 = 80% — exactly at threshold, inclusive.
    expect(computePantryReady(ingredients, items)).toBe(true);
  });

  it('is case-insensitive with bidirectional substring matching', () => {
    // Ingredient name is longer than pantry name ('chicken breast' includes 'chicken').
    expect(
      computePantryReady([ing('CHICKEN BREAST')], pantry(['chicken'])),
    ).toBe(true);
    // Pantry name is longer than ingredient name ('brown rice' includes 'rice').
    expect(
      computePantryReady([ing('rice')], pantry(['Brown Rice'])),
    ).toBe(true);
  });

  it('ignores ingredient entries with an empty name string', () => {
    // Only one real ingredient ('chicken'); empties are skipped in numerator
    // and denominator so the 1/1 = 100% match holds.
    const ingredients = [ing(''), ing('chicken'), ing('   ')];
    expect(computePantryReady(ingredients, pantry(['chicken']))).toBe(true);
  });
});
