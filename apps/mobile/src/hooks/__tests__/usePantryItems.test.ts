import { describe, it, expect, vi } from 'vitest';
import type { PantryItem } from '../../types/pantry';

// Mock the supabase module to avoid React Native imports
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import { getEffectiveConfidence } from '../usePantryItems';

/**
 * Helper to create a PantryItem with a specific last_seen_at date.
 * All other fields use sensible defaults.
 */
function makeItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'item-1',
    profile_id: 'profile-1',
    name: 'Milk',
    normalized_name: 'milk',
    quantity: 1,
    unit: 'gallon',
    category: 'dairy',
    source_location: 'fridge',
    confidence: 0.9,
    status: 'available',
    last_seen_at: new Date().toISOString(),
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe('getEffectiveConfidence', () => {
  it('returns original confidence for items seen today', () => {
    const item = makeItem({ confidence: 0.9, last_seen_at: daysAgo(0) });
    expect(getEffectiveConfidence(item)).toBeCloseTo(0.9, 2);
  });

  it('returns original confidence for items seen exactly 7 days ago (boundary)', () => {
    const item = makeItem({ confidence: 0.9, last_seen_at: daysAgo(7) });
    expect(getEffectiveConfidence(item)).toBeCloseTo(0.9, 2);
  });

  it('decays linearly after 7 days', () => {
    // 8 days: decayFactor = 1 - (8-7)*0.05 = 0.95 -> 0.9 * 0.95 = 0.855
    const item8 = makeItem({ confidence: 0.9, last_seen_at: daysAgo(8) });
    expect(getEffectiveConfidence(item8)).toBeCloseTo(0.855, 2);

    // 14 days: decayFactor = 1 - (14-7)*0.05 = 0.65 -> 0.9 * 0.65 = 0.585
    const item14 = makeItem({ confidence: 0.9, last_seen_at: daysAgo(14) });
    expect(getEffectiveConfidence(item14)).toBeCloseTo(0.585, 2);
  });

  it('floors at 0.1 (never goes below)', () => {
    // 30 days: decayFactor = max(0.1, 1 - (30-7)*0.05) = max(0.1, 1-1.15) = max(0.1, -0.15) = 0.1
    // effective = 0.9 * 0.1 = 0.09, but floor is 0.1
    const item = makeItem({ confidence: 0.9, last_seen_at: daysAgo(30) });
    const result = getEffectiveConfidence(item);
    expect(result).toBeGreaterThanOrEqual(0.1);
    expect(result).toBeCloseTo(0.1, 2);
  });

  it('flags items with effectiveConfidence < 0.5 as uncertain', () => {
    // Need enough days for confidence to drop below 0.5
    // With confidence 0.9: decayFactor = (1 - (days-7)*0.05)
    // 0.9 * decayFactor < 0.5 -> decayFactor < 0.556 -> (days-7)*0.05 > 0.444 -> days > 15.88
    // At 16 days: decayFactor = 1 - 9*0.05 = 0.55 -> 0.9 * 0.55 = 0.495 < 0.5 -> uncertain
    const item = makeItem({ confidence: 0.9, last_seen_at: daysAgo(16) });
    const effective = getEffectiveConfidence(item);
    expect(effective).toBeLessThan(0.5);

    // At 15 days: decayFactor = 1 - 8*0.05 = 0.60 -> 0.9 * 0.60 = 0.54 >= 0.5 -> NOT uncertain
    const recentItem = makeItem({ confidence: 0.9, last_seen_at: daysAgo(15) });
    const recentEffective = getEffectiveConfidence(recentItem);
    expect(recentEffective).toBeGreaterThanOrEqual(0.5);
  });
});
