import { describe, it, expect } from 'vitest';
import { searchIngredients } from '../../data/ingredients';

describe('searchIngredients', () => {
  it('returns empty array for empty query', () => {
    expect(searchIngredients('')).toEqual([]);
    expect(searchIngredients('   ')).toEqual([]);
  });

  it('returns items containing the query string (e.g., "chick")', () => {
    const results = searchIngredients('chick');
    expect(results.length).toBeGreaterThan(0);
    // Should include Chicken and Chickpeas
    expect(results).toContain('Chicken');
    expect(results).toContain('Chickpeas');
  });

  it('search is case-insensitive', () => {
    const upper = searchIngredients('BROCCOLI');
    const lower = searchIngredients('broccoli');
    expect(upper).toEqual(lower);
    expect(upper).toContain('Broccoli');
  });

  it('returns at most 10 results', () => {
    // "a" should match many ingredients
    const results = searchIngredients('a');
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('excludes items already in the excluded list', () => {
    const results = searchIngredients('chick', ['Chicken']);
    expect(results).not.toContain('Chicken');
    // But Chickpeas should still be there since it matches "chick"
    expect(results).toContain('Chickpeas');
  });

  it('returns empty array when no matches found', () => {
    const results = searchIngredients('xyznonexistent');
    expect(results).toEqual([]);
  });

  it('exclusion filter is case-insensitive', () => {
    const results = searchIngredients('chicken', ['chicken']);
    expect(results).not.toContain('Chicken');
  });
});
