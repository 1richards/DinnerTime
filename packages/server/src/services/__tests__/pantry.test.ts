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

  beforeEach(() => {
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

  /**
   * Wire a select chain that ends in `.eq().eq()` returning `data` (Phase 18:
   * fetch cross-location — no third `.eq('source_location', ...)` filter).
   */
  function wireSelect(data: any[]) {
    const selectEq2 = vi.fn().mockResolvedValue({ data, error: null });
    const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
    mockSelect.mockReturnValue({ eq: selectEq1 });
    return { selectEq1, selectEq2 };
  }

  function wireInsert(returnedRow: any) {
    const singleFn = vi.fn().mockResolvedValue({ data: returnedRow, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    mockInsert.mockReturnValue({ select: selectFn });
    return { singleFn, selectFn };
  }

  function wireUpdate(returnedRow: any) {
    const singleFn = vi.fn().mockResolvedValue({ data: returnedRow, error: null });
    const selectFn = vi.fn().mockReturnValue({ single: singleFn });
    const updateEq = vi.fn().mockReturnValue({ select: selectFn });
    mockUpdate.mockReturnValue({ eq: updateEq });
    return { updateEq, singleFn };
  }

  it('inserts new items with normalized name (lowercase, trimmed)', async () => {
    const { selectEq1, selectEq2 } = wireSelect([]);

    wireInsert({
      id: 'new-id-1',
      profile_id: 'user-1',
      name: 'Cheddar Cheese',
      normalized_name: 'cheddar cheese',
      quantity: 1,
      unit: 'block',
      category: 'dairy',
      source_location: 'fridge',
      item_attributes: { source_location: 'fridge' },
      confidence: 0.9,
      status: 'available',
      last_seen_at: '2026-04-12T00:00:00Z',
    });

    const result = await reconcileItems(mockSupabase, 'user-1', [
      {
        name: 'Cheddar Cheese ',
        quantity: 1,
        unit: 'block',
        category: 'dairy',
        confidence: 0.9,
        source_location: 'fridge',
      },
    ]);

    expect(selectEq1).toHaveBeenCalledWith('profile_id', 'user-1');
    expect(selectEq2).toHaveBeenCalledWith('normalized_name', 'cheddar cheese');

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        normalized_name: 'cheddar cheese',
        name: 'Cheddar Cheese',
        profile_id: 'user-1',
        source_location: 'fridge',
        item_attributes: { source_location: 'fridge' },
      })
    );

    expect(result).toHaveLength(1);
    expect(result[0].normalized_name).toBe('cheddar cheese');
  });

  it('updates existing items (quantity, confidence, last_seen_at) without deleting missing ones', async () => {
    wireSelect([
      {
        id: 'existing-id',
        profile_id: 'user-1',
        name: 'milk',
        normalized_name: 'milk',
        quantity: 1,
        unit: 'gallon',
        category: 'dairy',
        source_location: 'fridge',
        item_attributes: {},
        confidence: 0.8,
        status: 'available',
        last_seen_at: '2026-04-10T00:00:00Z',
      },
    ]);

    const { updateEq } = wireUpdate({
      id: 'existing-id',
      profile_id: 'user-1',
      name: 'milk',
      normalized_name: 'milk',
      quantity: 2,
      unit: 'gallon',
      category: 'dairy',
      source_location: 'fridge',
      item_attributes: { source_location: 'fridge' },
      confidence: 0.95,
      status: 'available',
      last_seen_at: '2026-04-12T00:00:00Z',
    });

    const result = await reconcileItems(mockSupabase, 'user-1', [
      {
        name: 'milk',
        quantity: 2,
        unit: 'gallon',
        category: 'dairy',
        confidence: 0.95,
        source_location: 'fridge',
      },
    ]);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 2,
        confidence: 0.95,
        status: 'available',
        item_attributes: { source_location: 'fridge' },
      })
    );

    expect(updateEq).toHaveBeenCalledWith('id', 'existing-id');

    expect(result).toHaveLength(1);
    expect(result[0].quantity).toBe(2);
  });

  it('does not touch items not present in the confirmed scan', async () => {
    wireSelect([]);
    wireInsert({
      id: 'new-id',
      profile_id: 'user-1',
      name: 'apples',
      normalized_name: 'apples',
      quantity: 3,
      unit: 'piece',
      category: 'produce',
      source_location: 'fridge',
      item_attributes: { source_location: 'fridge' },
      confidence: 0.85,
      status: 'available',
    });

    await reconcileItems(mockSupabase, 'user-1', [
      {
        name: 'apples',
        quantity: 3,
        unit: 'piece',
        category: 'produce',
        confidence: 0.85,
        source_location: 'fridge',
      },
    ]);

    const fromCalls = mockFrom.mock.calls;
    expect(fromCalls.every((call: string[]) => call[0] === 'pantry_items')).toBe(true);

    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  describe('dual-write invariant (Phase 18)', () => {
    it('INSERT writes both source_location column AND item_attributes.source_location', async () => {
      wireSelect([]);
      wireInsert({
        id: 'new-id-2',
        profile_id: 'user-1',
        name: 'milk',
        normalized_name: 'milk',
        quantity: 1,
        unit: 'gallon',
        category: 'dairy',
        source_location: 'fridge',
        item_attributes: { source_location: 'fridge' },
        confidence: 0.9,
        status: 'available',
        last_seen_at: '2026-04-12T00:00:00Z',
      });

      const result = await reconcileItems(mockSupabase, 'user-1', [
        {
          name: 'milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          confidence: 0.9,
          source_location: 'fridge',
        },
      ]);

      const insertArg = mockInsert.mock.calls[0][0];
      expect(insertArg.source_location).toBe('fridge');
      expect(insertArg.item_attributes).toEqual({ source_location: 'fridge' });
      // Invariant: both paths must equal.
      expect(insertArg.source_location).toBe(insertArg.item_attributes.source_location);

      // Round-trip: returned row preserves equality.
      expect(result[0].source_location).toBe(result[0].item_attributes.source_location);
    });

    it('UPDATE merges item_attributes: preserves prior extra keys AND sets source_location', async () => {
      wireSelect([
        {
          id: 'existing-id',
          profile_id: 'user-1',
          name: 'milk',
          normalized_name: 'milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          source_location: 'fridge',
          item_attributes: { source_location: 'fridge', some_future_key: 'x' },
          confidence: 0.8,
          status: 'available',
          last_seen_at: '2026-04-10T00:00:00Z',
        },
      ]);

      wireUpdate({
        id: 'existing-id',
        profile_id: 'user-1',
        name: 'milk',
        normalized_name: 'milk',
        quantity: 2,
        unit: 'gallon',
        category: 'dairy',
        source_location: 'fridge',
        item_attributes: { source_location: 'fridge', some_future_key: 'x' },
        confidence: 0.95,
        status: 'available',
        last_seen_at: '2026-04-12T00:00:00Z',
      });

      await reconcileItems(mockSupabase, 'user-1', [
        {
          name: 'milk',
          quantity: 2,
          unit: 'gallon',
          category: 'dairy',
          confidence: 0.95,
          source_location: 'fridge',
        },
      ]);

      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.item_attributes).toEqual({ source_location: 'fridge', some_future_key: 'x' });
    });

    it('UPDATE handles null/missing prior item_attributes gracefully', async () => {
      wireSelect([
        {
          id: 'existing-id',
          profile_id: 'user-1',
          name: 'milk',
          normalized_name: 'milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          source_location: 'fridge',
          item_attributes: null, // pre-Phase-18 row
          confidence: 0.8,
          status: 'available',
          last_seen_at: '2026-04-10T00:00:00Z',
        },
      ]);

      wireUpdate({
        id: 'existing-id',
        profile_id: 'user-1',
        name: 'milk',
        normalized_name: 'milk',
        quantity: 2,
        unit: 'gallon',
        category: 'dairy',
        source_location: 'fridge',
        item_attributes: { source_location: 'fridge' },
        confidence: 0.95,
        status: 'available',
        last_seen_at: '2026-04-12T00:00:00Z',
      });

      await reconcileItems(mockSupabase, 'user-1', [
        {
          name: 'milk',
          quantity: 2,
          unit: 'gallon',
          category: 'dairy',
          confidence: 0.95,
          source_location: 'fridge',
        },
      ]);

      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.item_attributes).toEqual({ source_location: 'fridge' });
    });

    it('mixed-location reconcile: milk fridge + rice pantry + ice cream freezer all land with distinct locations', async () => {
      // Each item gets its own select→insert cycle; all three miss (new items).
      // Supabase mock must respond independently per call. Use mockReturnValue
      // re-wired per iteration via mockImplementation.
      let callIdx = 0;
      const selectResults = [
        { data: [], error: null }, // milk
        { data: [], error: null }, // rice
        { data: [], error: null }, // ice cream
      ];
      mockSelect.mockImplementation(() => {
        const result = selectResults[callIdx++];
        const selectEq2 = vi.fn().mockResolvedValue(result);
        const selectEq1 = vi.fn().mockReturnValue({ eq: selectEq2 });
        return { eq: selectEq1 };
      });

      const inserted: any[] = [];
      mockInsert.mockImplementation((row: any) => {
        inserted.push(row);
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: `id-${inserted.length}`, ...row },
              error: null,
            }),
          }),
        };
      });

      const result = await reconcileItems(mockSupabase, 'user-1', [
        {
          name: 'milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          confidence: 0.9,
          source_location: 'fridge',
        },
        {
          name: 'rice',
          quantity: 1,
          unit: 'bag',
          category: 'grain',
          confidence: 0.9,
          source_location: 'pantry',
        },
        {
          name: 'ice cream',
          quantity: 1,
          unit: 'pint',
          category: 'frozen',
          confidence: 0.9,
          source_location: 'freezer',
        },
      ]);

      expect(result).toHaveLength(3);
      const locs = new Set(inserted.map((r) => r.source_location));
      expect(locs).toEqual(new Set(['fridge', 'pantry', 'freezer']));

      for (const row of inserted) {
        expect(row.source_location).toBe(row.item_attributes.source_location);
      }
    });

    it('cross-location dedup: existing milk in fridge matched regardless of scan source_location', async () => {
      // Phase 18: dedup by name only (no source_location filter on select).
      // A re-scan returning the same name, even with a different inferred
      // location, hits the existing row.
      wireSelect([
        {
          id: 'existing-milk',
          profile_id: 'user-1',
          name: 'milk',
          normalized_name: 'milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          source_location: 'fridge',
          item_attributes: { source_location: 'fridge' },
          confidence: 0.8,
          status: 'available',
        },
      ]);
      wireUpdate({
        id: 'existing-milk',
        profile_id: 'user-1',
        name: 'milk',
        normalized_name: 'milk',
        quantity: 2,
        unit: 'gallon',
        category: 'dairy',
        source_location: 'fridge',
        item_attributes: { source_location: 'fridge' },
        confidence: 0.9,
        status: 'available',
      });

      await reconcileItems(mockSupabase, 'user-1', [
        {
          name: 'milk',
          quantity: 2,
          unit: 'gallon',
          category: 'dairy',
          confidence: 0.9,
          source_location: 'fridge',
        },
      ]);

      // Update path hit (existing row matched), not insert.
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
