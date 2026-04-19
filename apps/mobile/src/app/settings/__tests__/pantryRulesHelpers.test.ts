import { describe, it, expect } from 'vitest';
import { reorderByIds, type LocationRule } from '../pantryRulesHelpers';

const R = (id: string, prec: number): LocationRule => ({
  id,
  canonical_ingredient_id: `can-${id}`,
  source_location: 'fridge',
  precedence: prec,
});

describe('reorderByIds', () => {
  it('reorders rules in the supplied id order and rewrites precedence [0..N-1]', () => {
    const rules = [R('a', 0), R('b', 1), R('c', 2)];
    const out = reorderByIds(rules, ['c', 'a', 'b']);
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(out.map((r) => r.precedence)).toEqual([0, 1, 2]);
  });

  it('filters ids not present in the source list (missing-id robustness)', () => {
    const rules = [R('a', 0), R('b', 1)];
    const out = reorderByIds(rules, ['b', 'ghost', 'a']);
    expect(out.map((r) => r.id)).toEqual(['b', 'a']);
    expect(out.map((r) => r.precedence)).toEqual([0, 1]);
  });
});
