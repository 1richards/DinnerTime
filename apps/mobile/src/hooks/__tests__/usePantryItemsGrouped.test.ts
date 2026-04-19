import { describe, it, expect, vi } from 'vitest';
import type { EnrichedPantryItem } from '../usePantryItems';

// Mock supabase to avoid RN imports when importing store-adjacent modules.
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn() },
  },
}));

import { groupPantryItems, type GroupingMode } from '../usePantryItemsGrouped';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function makeItem(overrides: Partial<EnrichedPantryItem> = {}): EnrichedPantryItem {
  return {
    id: 'item-1',
    profile_id: 'p',
    name: 'Milk',
    normalized_name: 'milk',
    quantity: 1,
    unit: 'gallon',
    category: 'dairy',
    source_location: 'fridge',
    confidence: 0.9,
    status: 'available',
    last_seen_at: daysAgoIso(0),
    created_at: daysAgoIso(0),
    updated_at: daysAgoIso(0),
    effectiveConfidence: 0.9,
    isUncertain: false,
    ...overrides,
  };
}

describe('groupPantryItems — 4-way grouping (Phase 21-04 ROADMAP #2)', () => {
  describe('mode=location', () => {
    it('partitions items by source_location into Fridge/Pantry/Freezer sections', () => {
      const items = [
        makeItem({ id: 'a', source_location: 'fridge' }),
        makeItem({ id: 'b', source_location: 'pantry' }),
        makeItem({ id: 'c', source_location: 'fridge' }),
        makeItem({ id: 'd', source_location: 'freezer' }),
      ];
      const sections = groupPantryItems(items, 'location', new Set());
      const titles = sections.map((s) => s.title);
      expect(titles).toEqual(['Fridge', 'Pantry', 'Freezer']);
      expect(sections[0].items.map((i) => i.id)).toEqual(['a', 'c']);
      expect(sections[1].items.map((i) => i.id)).toEqual(['b']);
      expect(sections[2].items.map((i) => i.id)).toEqual(['d']);
    });

    it('omits empty location sections', () => {
      const items = [makeItem({ id: 'a', source_location: 'pantry' })];
      const sections = groupPantryItems(items, 'location', new Set());
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe('Pantry');
    });
  });

  describe('mode=category', () => {
    it('groups by category and capitalizes titles', () => {
      const items = [
        makeItem({ id: 'a', category: 'dairy' }),
        makeItem({ id: 'b', category: 'produce' }),
        makeItem({ id: 'c', category: 'dairy' }),
      ];
      const sections = groupPantryItems(items, 'category', new Set());
      const titles = sections.map((s) => s.title).sort();
      expect(titles).toContain('Dairy');
      expect(titles).toContain('Produce');
      // Dairy should have 2 items
      const dairy = sections.find((s) => s.title === 'Dairy');
      expect(dairy?.items.length).toBe(2);
    });

    it('places items without a category under Other', () => {
      const items = [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeItem({ id: 'a', category: '' as any }),
        makeItem({ id: 'b', category: 'dairy' }),
      ];
      const sections = groupPantryItems(items, 'category', new Set());
      const other = sections.find((s) => s.title === 'Other');
      expect(other).toBeDefined();
      expect(other!.items.map((i) => i.id)).toContain('a');
    });
  });

  describe('mode=staples', () => {
    it('splits into Staples / Other based on canonical_ingredient_id membership', () => {
      const items = [
        makeItem({ id: 'a', canonical_ingredient_id: 'canon-1' }),
        makeItem({ id: 'b', canonical_ingredient_id: 'canon-2' }),
        makeItem({ id: 'c', canonical_ingredient_id: null }),
      ];
      const sections = groupPantryItems(items, 'staples', new Set(['canon-1']));
      const stapleSection = sections.find((s) => s.title === 'Staples');
      const otherSection = sections.find((s) => s.title === 'Other');
      expect(stapleSection?.items.map((i) => i.id)).toEqual(['a']);
      // Non-staples: b (not in set) + c (null canonical_id)
      expect(otherSection?.items.map((i) => i.id).sort()).toEqual(['b', 'c']);
    });

    it('omits empty Staples section when no items are staples', () => {
      const items = [makeItem({ id: 'a', canonical_ingredient_id: 'canon-other' })];
      const sections = groupPantryItems(items, 'staples', new Set(['canon-elsewhere']));
      const stapleSection = sections.find((s) => s.title === 'Staples');
      expect(stapleSection).toBeUndefined();
    });
  });

  describe('mode=recently-added', () => {
    it("partitions by last_seen_at cutoff 7 days into 'Last 7 days' / 'Older'", () => {
      const items = [
        makeItem({ id: 'a', last_seen_at: daysAgoIso(2) }),
        makeItem({ id: 'b', last_seen_at: daysAgoIso(10) }),
        makeItem({ id: 'c', last_seen_at: daysAgoIso(0) }),
      ];
      const sections = groupPantryItems(items, 'recently-added', new Set());
      const recent = sections.find((s) => s.title === 'Last 7 days');
      const older = sections.find((s) => s.title === 'Older');
      expect(recent?.items.map((i) => i.id).sort()).toEqual(['a', 'c']);
      expect(older?.items.map((i) => i.id)).toEqual(['b']);
    });

    it('omits Older section if all items are recent', () => {
      const items = [makeItem({ id: 'a', last_seen_at: daysAgoIso(1) })];
      const sections = groupPantryItems(items, 'recently-added', new Set());
      const older = sections.find((s) => s.title === 'Older');
      expect(older).toBeUndefined();
    });
  });

  describe('empty inputs', () => {
    it.each<GroupingMode>(['location', 'category', 'staples', 'recently-added'])(
      'returns empty array for mode=%s with no items',
      (mode) => {
        const sections = groupPantryItems([], mode, new Set());
        expect(sections).toEqual([]);
      },
    );
  });
});
