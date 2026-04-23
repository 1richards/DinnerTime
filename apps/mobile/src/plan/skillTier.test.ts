import { describe, it, expect } from 'vitest';

import { deriveSkillTier } from './skillTier';
import type { RecipeCookStats } from '../types/progression';

function mkStats(counts: number[]): RecipeCookStats[] {
  return counts.map((cook_count, i) => ({
    recipe_id: `r-${i}`,
    title: `Recipe ${i}`,
    cook_count,
    last_cooked_at: '2026-01-01T00:00:00Z',
  }));
}

describe('deriveSkillTier', () => {
  it('empty history → tier 1', () => {
    expect(deriveSkillTier([])).toBe(1);
  });

  it('total 4 cooks → tier 1 (below tier-2 floor)', () => {
    expect(deriveSkillTier(mkStats([1, 1, 1, 1]))).toBe(1);
  });

  it('total 5 cooks → tier 2 (on the tier-2 floor)', () => {
    expect(deriveSkillTier(mkStats([5]))).toBe(2);
  });

  it('total 19 cooks → tier 2 (below tier-3 floor)', () => {
    expect(deriveSkillTier(mkStats([10, 9]))).toBe(2);
  });

  it('total 20 cooks → tier 3 (on the tier-3 floor)', () => {
    expect(deriveSkillTier(mkStats([20]))).toBe(3);
  });

  it('total 50 cooks → tier 3', () => {
    expect(deriveSkillTier(mkStats([10, 10, 10, 10, 10]))).toBe(3);
  });

  it('is monotone non-decreasing as history grows', () => {
    // Simulate a user cooking one recipe at a time; tier should only ever
    // move up, never down.
    let prev: number = 1;
    for (let cooksSoFar = 0; cooksSoFar <= 30; cooksSoFar++) {
      const tier = deriveSkillTier(mkStats([cooksSoFar]));
      expect(tier).toBeGreaterThanOrEqual(prev);
      prev = tier;
    }
  });

  it('sums cook_count across all recipes (not just first row)', () => {
    expect(deriveSkillTier(mkStats([2, 2, 2]))).toBe(2); // total=6
    expect(deriveSkillTier(mkStats([1, 1, 1, 1]))).toBe(1); // total=4
  });
});
