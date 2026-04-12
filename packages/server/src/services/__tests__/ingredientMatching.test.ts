import { describe, it, expect } from 'vitest';
import {
  matchIngredientsToPantry,
  normalizeIngredientName,
} from '../ingredientMatching.js';
import type { PantryItem } from '../pantry.js';
import type { MealPlanIngredient } from '../../types/mealPlan.js';

// ---------- helpers ----------

const makePantryItem = (overrides: Partial<PantryItem>): PantryItem => ({
  id: 'p-default',
  profile_id: 'profile-1',
  name: 'Item',
  normalized_name: 'item',
  quantity: 1,
  unit: 'unit',
  category: 'other',
  source_location: 'pantry',
  confidence: 0.9,
  status: 'available',
  last_seen_at: new Date().toISOString(),
  ...overrides,
});

// ---------- normalizeIngredientName ----------

describe('normalizeIngredientName', () => {
  it('Test 8a: trims whitespace', () => {
    expect(normalizeIngredientName('  Tomato  ')).toBe('tomato');
  });

  it('Test 8b: lowercases', () => {
    expect(normalizeIngredientName('TOMATO')).toBe('tomato');
  });

  it('Test 8c: strips trailing es/s for plural', () => {
    expect(normalizeIngredientName('Tomatoes')).toBe('tomato');
    expect(normalizeIngredientName('carrots')).toBe('carrot');
  });
});

// ---------- matchIngredientsToPantry ----------

describe('matchIngredientsToPantry', () => {
  it('Test 1: Exact name match deducts full quantity', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'Tomato', normalized_name: 'tomato', quantity: 5 }),
    ];
    const ingredients: MealPlanIngredient[] = [{ name: 'Tomato', quantity: 2 }];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].pantryItemId).toBe('p1');
    expect(result.matches[0].deductQuantity).toBe(2);
    expect(result.matches[0].willDeplete).toBe(false);
    expect(result.unmatched).toEqual([]);
  });

  it('Test 2: Normalized name match (case + whitespace + plural) still matches', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'tomato', normalized_name: 'tomato', quantity: 5 }),
    ];
    const ingredients: MealPlanIngredient[] = [{ name: '  Tomatoes  ', quantity: 1 }];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].pantryItemId).toBe('p1');
    expect(result.unmatched).toEqual([]);
  });

  it('Test 3: Quantity deduction — pantry 4, needed 2 → deduct 2, willDeplete=false', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'Rice', normalized_name: 'rice', quantity: 4 }),
    ];
    const ingredients: MealPlanIngredient[] = [{ name: 'Rice', quantity: 2 }];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches[0].deductQuantity).toBe(2);
    expect(result.matches[0].willDeplete).toBe(false);
  });

  it('Test 4: Pantry quantity <= needed → willDeplete=true', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'Garlic', normalized_name: 'garlic', quantity: 2 }),
    ];
    const ingredients: MealPlanIngredient[] = [{ name: 'Garlic', quantity: 3 }];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches[0].deductQuantity).toBe(2);
    expect(result.matches[0].willDeplete).toBe(true);
  });

  it('Test 5: Unmatched ingredients listed in unmatched and not in matches', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'Rice', normalized_name: 'rice', quantity: 4 }),
    ];
    const ingredients: MealPlanIngredient[] = [
      { name: 'Rice', quantity: 1 },
      { name: 'Saffron', quantity: 1 },
    ];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].ingredientName).toBe('Rice');
    expect(result.unmatched).toEqual(['Saffron']);
  });

  it('Test 6: Ingredient with undefined quantity → deduct 1 unit by default', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'Onion', normalized_name: 'onion', quantity: 5 }),
    ];
    const ingredients: MealPlanIngredient[] = [{ name: 'Onion' }];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches[0].deductQuantity).toBe(1);
    expect(result.matches[0].willDeplete).toBe(false);
  });

  it('Test 7: Multiple pantry items with same normalized name → match against first', () => {
    const pantry: PantryItem[] = [
      makePantryItem({ id: 'p1', name: 'Garlic', normalized_name: 'garlic', quantity: 3 }),
      makePantryItem({ id: 'p2', name: 'Garlic', normalized_name: 'garlic', quantity: 10 }),
    ];
    const ingredients: MealPlanIngredient[] = [{ name: 'Garlic', quantity: 1 }];
    const result = matchIngredientsToPantry(ingredients, pantry);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].pantryItemId).toBe('p1');
  });

  it('Test 8: normalizeIngredientName trims, lowercases, and strips trailing s', () => {
    // Verify both sides use the same normalization so "Tomatoes" matches "tomato"
    // via equal normalized forms ("tomatoe" === "tomatoe" after stripping one trailing 's').
    expect(normalizeIngredientName('Tomatoes')).toBe(normalizeIngredientName('tomatoes'));
    expect(normalizeIngredientName('  RICE  ')).toBe('rice');
    // Stripping trailing 's' (naive) — "carrots" → "carrot"
    expect(normalizeIngredientName('carrots')).toBe('carrot');
  });
});
