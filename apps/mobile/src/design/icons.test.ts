/**
 * Asserts `iconPropsForText(scale)` returns `{ size, weight }` consistent with
 * the adjacent typography token. The source of truth for `weight` is
 * typography[scale].fontWeight — drift between the icon helper and the type
 * scale will fail this suite.
 */

import { describe, it, expect } from 'vitest';
import { iconPropsForText, iconSize, type IconSize } from './icons';
import { typography } from './tokens';

describe('iconPropsForText', () => {
  const scales: readonly IconSize[] = ['caption', 'body', 'title', 'display'] as const;

  for (const s of scales) {
    it(`returns { size, weight } matching typography.${s}`, () => {
      const p = iconPropsForText(s);
      expect(p.size).toBe(iconSize[s]);
      expect(p.weight).toBe(typography[s].fontWeight);
    });
  }
});

describe('iconSize map', () => {
  it('has all 4 scale keys', () => {
    expect(Object.keys(iconSize).sort()).toEqual(['body', 'caption', 'display', 'title']);
  });

  it('every entry is a positive integer', () => {
    for (const v of Object.values(iconSize)) {
      expect(v).toBeGreaterThan(0);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});
