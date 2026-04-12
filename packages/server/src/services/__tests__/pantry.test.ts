import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileItems, normalizeName } from '../pantry.js';

describe('normalizeName', () => {
  it('handles various inputs correctly', () => {
    expect(normalizeName('Cheddar Cheese ')).toBe('cheddar cheese');
    expect(normalizeName('  MILK  ')).toBe('milk');
    expect(normalizeName('Eggs')).toBe('eggs');
    expect(normalizeName(' whole wheat Bread')).toBe('whole wheat bread');
  });
});

describe('reconcileItems', () => {
  let mockSupabase: any;
  let mockFrom: any;
  let mockSelect: any;
  let mockInsert: any;
  let mockUpdate: any;
  let mockEq: any;

  beforeEach(() => {
    // Build chainable mock for Supabase
    mockEq = vi.fn();
    mockSelect = vi.fn();
    mockInsert = vi.fn();
    mockUpdate = vi.fn();

    mockFrom = vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    }));

    mockSupabase = { from: mockFrom };
  });

  it('inserts new items with normalized name (lowercase, trimmed)', async () => {
    // select returns empty - no existing items
    const selectEq3 = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectEq2 = vi.fn().mockReturnValue({ eq: selectEq3 });
    const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
    mockSelect.mockReturnValue({ eq: selectEq1 });

    // insert returns the inserted row
    const insertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'new-id-1',
          profile_id: 'user-1',
          name: 'Cheddar Cheese',
          normalized_name: 'cheddar cheese',
          quantity: 1,
          unit: 'block',
          category: 'dairy',
          source_location: 'fridge',
          confidence: 0.9,
          status: 'available',
          last_seen_at: '2026-04-12T00:00:00Z',
        },
        error: null,
      }),
    });
    mockInsert.mockReturnValue({ select: insertSelect });

    const result = await reconcileItems(
      mockSupabase,
      'user-1',
      [
        {
          name: 'Cheddar Cheese ',
          quantity: 1,
          unit: 'block',
          category: 'dairy',
          confidence: 0.9,
        },
      ],
      'fridge'
    );

    // Should have queried with normalized name
    expect(selectEq1).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(selectEq2).toHaveBeenCalledWith('normalized_name', 'cheddar cheese');
    expect(selectEq3).toHaveBeenCalledWith('source_location', 'fridge');

    // Should have inserted with normalized name
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_name: 'cheddar cheese',
        name: 'Cheddar Cheese',
        profile_id: 'user-1',
        source_location: 'fridge',
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0].normalized_name).toBe('cheddar cheese');
  });

  it('updates existing items (quantity, confidence, last_seen_at) without deleting missing ones', async () => {
    // select returns existing item
    const selectEq3 = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'existing-id',
          profile_id: 'user-1',
          name: 'milk',
          normalized_name: 'milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          source_location: 'fridge',
          confidence: 0.8,
          status: 'available',
          last_seen_at: '2026-04-10T00:00:00Z',
        },
      ],
      error: null,
    });
    const selectEq2 = vi.fn().mockReturnValue({ eq: selectEq3 });
    const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
    mockSelect.mockReturnValue({ eq: selectEq1 });

    // update returns the updated row
    const updateEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'existing-id',
            profile_id: 'user-1',
            name: 'milk',
            normalized_name: 'milk',
            quantity: 2,
            unit: 'gallon',
            category: 'dairy',
            source_location: 'fridge',
            confidence: 0.95,
            status: 'available',
            last_seen_at: '2026-04-12T00:00:00Z',
          },
          error: null,
        }),
      }),
    });
    mockUpdate.mockReturnValue({ eq: updateEq });

    const result = await reconcileItems(
      mockSupabase,
      'user-1',
      [
        {
          name: 'milk',
          quantity: 2,
          unit: 'gallon',
          category: 'dairy',
          confidence: 0.95,
        },
      ],
      'fridge'
    );

    // Should have called update with new quantity and confidence
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        confidence: 0.95,
        status: 'available',
      })
    );

    // update should target the existing item's id
    expect(updateEq).toHaveBeenCalledWith('id', 'existing-id');

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it('does not touch items not present in the confirmed scan', async () => {
    // This test verifies that reconcileItems only processes items in the confirmed list
    // and never issues delete calls or modifies items not in the scan

    // select returns empty for the single queried item
    const selectEq3 = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectEq2 = vi.fn().mockReturnValue({ eq: selectEq3 });
    const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
    mockSelect.mockReturnValue({ eq: selectEq1 });

    const insertSelect = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'new-id',
          profile_id: 'user-1',
          name: 'apples',
          normalized_name: 'apples',
          quantity: 3,
          unit: 'piece',
          category: 'produce',
          source_location: 'fridge',
          confidence: 0.85,
          status: 'available',
        },
        error: null,
      }),
    });
    mockInsert.mockReturnValue({ select: insertSelect });

    // Only confirm one item -- existing "milk" and "cheese" in DB should be untouched
    await reconcileItems(
      mockSupabase,
      'user-1',
      [
        {
          name: 'apples',
          quantity: 3,
          unit: 'piece',
          category: 'produce',
          confidence: 0.85,
        },
      ],
      'fridge'
    );

    // from() should only be called for the one item we're reconciling (select + insert)
    // Never called with 'delete' or for items not in our list
    const fromCalls = mockFrom.mock.calls;
    expect(fromCalls.every((call: string[]) => call[0] === 'pantry_items')).toBe(true);

    // Only one select call (for checking if 'apples' exists)
    expect(mockSelect).toHaveBeenCalledTimes(1);

    // No update calls (item doesn't exist, so insert is used)
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
