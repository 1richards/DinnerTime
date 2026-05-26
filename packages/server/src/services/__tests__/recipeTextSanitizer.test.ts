import { describe, it, expect } from 'vitest';
import {
  hasCjkContamination,
  sanitizeText,
  sanitizeRecipeTextFields,
} from '../recipeTextSanitizer.js';

describe('hasCjkContamination', () => {
  it('detects CJK tokens in English strings', () => {
    expect(hasCjkContamination('Red wine碎 — dry')).toBe(true);
    expect(hasCjkContamination('3 large调整 Carrots条')).toBe(true);
  });

  it('returns false for clean English text', () => {
    expect(hasCjkContamination('Yukon Gold potatoes — cut into chunks')).toBe(false);
    expect(hasCjkContamination('Crème brûlée')).toBe(false); // accented Latin stays
  });

  it('returns false for non-strings', () => {
    expect(hasCjkContamination(null)).toBe(false);
    expect(hasCjkContamination(42)).toBe(false);
    expect(hasCjkContamination(undefined)).toBe(false);
  });
});

describe('sanitizeText', () => {
  // The exact contaminated strings from the live Beef Chuck Roast stew.
  it('strips the reported degeneration tokens', () => {
    expect(sanitizeText('Red wine碎 — dry, like Cabernet or Merlot')).toBe(
      'Red wine — dry, like Cabernet or Merlot',
    );
    expect(sanitizeText('Yellow onion块 — chopped into large chunks')).toBe(
      'Yellow onion — chopped into large chunks',
    );
    expect(sanitizeText('3 large调整 Carrots条 — cut into 1-inch chunks')).toBe(
      '3 large Carrots — cut into 1-inch chunks',
    );
    expect(sanitizeText('1 tsp调整调整 Dried thyme条调整')).toBe('1 tsp Dried thyme');
    expect(sanitizeText('2 tbsp调整调整调整调整调整 Vegetable oil条调整调整')).toBe(
      '2 tbsp Vegetable oil',
    );
  });

  it('leaves clean strings byte-identical', () => {
    const clean = 'Yukon Gold potatoes — cut into 1-inch chunks';
    expect(sanitizeText(clean)).toBe(clean);
  });
});

describe('sanitizeRecipeTextFields', () => {
  it('cleans ingredient names/units/notes and steps, flags changed', () => {
    const { value, changed } = sanitizeRecipeTextFields({
      title: 'Beef Chuck Roast块',
      description: 'A hearty stew',
      ingredients: [
        { name: 'Red wine碎', quantity: 1, unit: 'cup', notes: 'dry' },
        { name: 'Carrots条', quantity: 3, unit: 'large调整', notes: null },
      ],
      steps: ['Brown the beef条.', 'Simmer until tender.'],
    });

    expect(changed).toBe(true);
    expect(value.title).toBe('Beef Chuck Roast');
    expect(value.ingredients?.[0].name).toBe('Red wine');
    expect(value.ingredients?.[0].quantity).toBe(1); // numbers untouched
    expect(value.ingredients?.[1].name).toBe('Carrots');
    expect(value.ingredients?.[1].unit).toBe('large');
    expect(value.steps?.[0]).toBe('Brown the beef.');
    expect(value.steps?.[1]).toBe('Simmer until tender.');
  });

  it('reports changed=false for clean recipes', () => {
    const { changed } = sanitizeRecipeTextFields({
      title: 'Chicken Stir-Fry',
      description: null,
      ingredients: [{ name: 'Chicken breast', quantity: 1, unit: 'lb', notes: 'diced' }],
      steps: ['Heat oil.', 'Add chicken.'],
    });
    expect(changed).toBe(false);
  });
});
