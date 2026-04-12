import { describe, it, expect } from 'vitest';

import { STATIC_MAP, classifyStatic } from '../ingredientCategories.js';
import type { GroceryCategory } from '../../types/shopping.js';

describe('STATIC_MAP', () => {
  it('has at least 150 entries', () => {
    expect(Object.keys(STATIC_MAP).length).toBeGreaterThanOrEqual(150);
  });

  it('covers at least 9 grocery categories (all except other)', () => {
    const categories = new Set<GroceryCategory>(Object.values(STATIC_MAP));
    const expected: GroceryCategory[] = [
      'produce',
      'dairy',
      'protein',
      'pantry',
      'bakery',
      'frozen',
      'beverages',
      'condiments',
      'spices',
    ];
    for (const cat of expected) {
      expect(categories.has(cat)).toBe(true);
    }
  });
});

describe('classifyStatic', () => {
  it('returns produce for tomato', () => {
    expect(classifyStatic('tomato')).toBe('produce');
  });

  it('returns dairy for milk', () => {
    expect(classifyStatic('milk')).toBe('dairy');
  });

  it('returns protein for chicken', () => {
    expect(classifyStatic('chicken')).toBe('protein');
  });

  it('returns protein for ground beef via token fallback on beef', () => {
    expect(classifyStatic('ground beef')).toBe('protein');
  });

  it('returns null for unknown items', () => {
    expect(classifyStatic('unicorn meat')).toBeNull();
  });

  it('handles multi-token fallback: "organic baby spinach" → produce', () => {
    expect(classifyStatic('organic baby spinach')).toBe('produce');
  });
});
