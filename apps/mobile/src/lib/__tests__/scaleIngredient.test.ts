import { describe, it, expect } from 'vitest';
import { scaleIngredient, formatQuantity } from '../scaleIngredient';
import type { ParsedIngredient } from '../../types/recipe';

const base: ParsedIngredient = {
  name: 'flour',
  quantity: 1,
  unit: 'cup',
  notes: null,
};

describe('scaleIngredient', () => {
  it('doubles a whole quantity', () => {
    const result = scaleIngredient({ ...base, quantity: 1 }, 2);
    expect(result.quantity).toBe(2);
    expect(result.name).toBe('flour');
    expect(result.unit).toBe('cup');
  });

  it('doubles a fractional quantity (0.75 -> 1.5)', () => {
    const result = scaleIngredient({ ...base, quantity: 0.75 }, 2);
    expect(result.quantity).toBe(1.5);
  });

  it('returns ingredient unchanged when quantity is null', () => {
    const ing: ParsedIngredient = { ...base, quantity: null };
    const result = scaleIngredient(ing, 2);
    expect(result.quantity).toBeNull();
    expect(result).toEqual(ing);
  });

  it('halves a quantity (1 * 0.5 = 0.5)', () => {
    const result = scaleIngredient({ ...base, quantity: 1 }, 0.5);
    expect(result.quantity).toBe(0.5);
  });

  it('preserves name, unit, notes', () => {
    const ing: ParsedIngredient = {
      name: 'sugar',
      quantity: 2,
      unit: 'tbsp',
      notes: 'packed',
    };
    const result = scaleIngredient(ing, 3);
    expect(result).toEqual({
      name: 'sugar',
      quantity: 6,
      unit: 'tbsp',
      notes: 'packed',
    });
  });
});

describe('formatQuantity', () => {
  it('formats 1.5 as mixed fraction "1 1/2"', () => {
    expect(formatQuantity(1.5)).toBe('1 1/2');
  });

  it('formats 0.75 as "3/4"', () => {
    expect(formatQuantity(0.75)).toBe('3/4');
  });

  it('formats integer 2 as "2"', () => {
    expect(formatQuantity(2)).toBe('2');
  });

  it('formats 0 as "0"', () => {
    expect(formatQuantity(0)).toBe('0');
  });

  it('formats 0.25 as "1/4"', () => {
    expect(formatQuantity(0.25)).toBe('1/4');
  });
});
