import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PantryItem, ReviewItem } from '../../types/pantry';

// Mock supabase using vi.hoisted() for variable hoisting with vi.mock
const mockSupabase = vi.hoisted(() => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    return chain;
  };

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: vi.fn((_table?: string): any => chainable()),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { access_token: 'test-token' } },
          error: null,
        })
      ),
    },
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mock setup
import { usePantryStore } from '../pantryStore';

const mockItem: PantryItem = {
  id: 'item-1',
  profile_id: 'profile-1',
  name: 'Milk',
  normalized_name: 'milk',
  quantity: 1,
  unit: 'gallon',
  category: 'dairy',
  source_location: 'fridge',
  confidence: 0.95,
  status: 'available',
  last_seen_at: '2026-04-10T00:00:00Z',
  created_at: '2026-04-10T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
};

const mockItem2: PantryItem = {
  id: 'item-2',
  profile_id: 'profile-1',
  name: 'Eggs',
  normalized_name: 'eggs',
  quantity: 12,
  unit: 'count',
  category: 'protein',
  source_location: 'fridge',
  confidence: 0.9,
  status: 'available',
  last_seen_at: '2026-04-10T00:00:00Z',
  created_at: '2026-04-10T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
};

const mockReviewItem: ReviewItem = {
  id: 'review-1',
  name: 'Butter',
  quantity: { value: 1, unit: 'stick', system: 'count' },
  confidence: 0.85,
  fieldConfidence: { name: 0.85, quantity: 0.85, unit: 0.85, category: 0.85 },
  category: 'dairy',
  source_location: 'fridge',
  accepted: true,
  userEdited: false,
};

describe('pantryStore', () => {
  beforeEach(() => {
    usePantryStore.setState({
      items: [],
      scanResults: [],
      isScanning: false,
      isLoading: false,
    });
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('loadItems', () => {
    it('fetches from Supabase and sets items array', async () => {
      const chain: Record<string, unknown> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.order = vi.fn(() =>
        Promise.resolve({ data: [mockItem, mockItem2], error: null })
      );

      mockSupabase.from.mockReturnValue(chain);

      await usePantryStore.getState().loadItems('profile-1');

      const state = usePantryStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.items[0].name).toBe('Milk');
      expect(state.items[1].name).toBe('Eggs');
      expect(state.isLoading).toBe(false);
      expect(mockSupabase.from).toHaveBeenCalledWith('pantry_items');
    });
  });

  describe('updateReviewItem', () => {
    it('modifies a specific ReviewItem in scanResults', () => {
      usePantryStore.setState({
        scanResults: [
          mockReviewItem,
          { ...mockReviewItem, id: 'review-2', name: 'Cheese' },
        ],
      });

      usePantryStore.getState().updateReviewItem('review-1', {
        name: 'Unsalted Butter',
        quantity: { value: 2, unit: 'stick', system: 'count' },
      });

      const state = usePantryStore.getState();
      expect(state.scanResults[0].name).toBe('Unsalted Butter');
      expect(state.scanResults[0].quantity).toEqual({
        value: 2,
        unit: 'stick',
        system: 'count',
      });
      // Other item unchanged
      expect(state.scanResults[1].name).toBe('Cheese');
    });
  });

  describe('addReviewItem', () => {
    it('appends a new ReviewItem to scanResults', () => {
      usePantryStore.setState({ scanResults: [mockReviewItem] });

      const newItem: ReviewItem = {
        id: 'review-new',
        name: 'Yogurt',
        quantity: { value: 2, unit: 'cup', system: 'imperial-volume' },
        confidence: 1.0,
        fieldConfidence: { name: 1.0, quantity: 1.0, unit: 1.0, category: 1.0 },
        category: 'dairy',
        source_location: 'fridge',
        accepted: true,
        userEdited: true,
      };

      usePantryStore.getState().addReviewItem(newItem);

      const state = usePantryStore.getState();
      expect(state.scanResults).toHaveLength(2);
      expect(state.scanResults[1].name).toBe('Yogurt');
      expect(state.scanResults[1].userEdited).toBe(true);
    });
  });

  describe('removeReviewItem', () => {
    it('removes item from scanResults by id', () => {
      usePantryStore.setState({
        scanResults: [
          mockReviewItem,
          { ...mockReviewItem, id: 'review-2', name: 'Cheese' },
        ],
      });

      usePantryStore.getState().removeReviewItem('review-1');

      const state = usePantryStore.getState();
      expect(state.scanResults).toHaveLength(1);
      expect(state.scanResults[0].name).toBe('Cheese');
    });
  });

  describe('markItemUsed', () => {
    it('optimistically sets status to used and rolls back on error', async () => {
      usePantryStore.setState({ items: [mockItem] });

      // Mock successful PATCH
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockItem, status: 'used' }),
      });

      await usePantryStore.getState().markItemUsed('item-1');

      let state = usePantryStore.getState();
      expect(state.items[0].status).toBe('used');

      // Now test rollback on error
      usePantryStore.setState({ items: [{ ...mockItem, status: 'available' }] });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      await expect(
        usePantryStore.getState().markItemUsed('item-1')
      ).rejects.toThrow();

      state = usePantryStore.getState();
      expect(state.items[0].status).toBe('available');
    });
  });

  describe('markItemDepleted', () => {
    it('optimistically sets status to depleted', async () => {
      usePantryStore.setState({ items: [mockItem] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockItem, status: 'depleted' }),
      });

      await usePantryStore.getState().markItemDepleted('item-1');

      const state = usePantryStore.getState();
      expect(state.items[0].status).toBe('depleted');
    });
  });

  describe('startReceiptScan', () => {
    it('POSTs to /api/v1/pantry/scan-receipt with auth and NO top-level source_location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                name: 'chicken',
                quantity: 1,
                unit: 'lb',
                confidence: 0.9,
                category: 'protein',
                source_location: 'fridge',
              },
            ],
          }),
      });
      await usePantryStore.getState().startReceiptScan('b64');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/pantry/scan-receipt');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer test-token');
      const body = JSON.parse(init.body);
      expect(body.image).toBe('b64');
      // Post-18-02: /scan-receipt no longer accepts a top-level source_location.
      expect(body.source_location).toBeUndefined();
    });

    it('maps per-item source_location into review items and seeds aiLocation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                name: 'chicken',
                quantity: 1,
                unit: 'lb',
                confidence: 0.9,
                category: 'protein',
                source_location: 'fridge',
              },
              {
                name: 'rice',
                quantity: 1,
                unit: 'bag',
                confidence: 0.9,
                category: 'grain',
                source_location: 'pantry',
              },
              {
                name: 'ice cream',
                quantity: 1,
                unit: 'pint',
                confidence: 0.9,
                category: 'frozen',
                source_location: 'freezer',
              },
            ],
          }),
      });
      await usePantryStore.getState().startReceiptScan('b64');

      const { scanResults, isScanning } = usePantryStore.getState();
      expect(scanResults).toHaveLength(3);
      expect(scanResults[0].source_location).toBe('fridge');
      expect(scanResults[0].aiLocation).toBe('fridge');
      expect(scanResults[1].source_location).toBe('pantry');
      expect(scanResults[1].aiLocation).toBe('pantry');
      expect(scanResults[2].source_location).toBe('freezer');
      expect(scanResults[2].aiLocation).toBe('freezer');
      expect(isScanning).toBe(false);
    });

    it('applies confidence threshold: 0.5 rejected, 0.7 accepted', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              { name: 'low', quantity: 1, unit: 'ea', confidence: 0.5, category: 'other', source_location: 'pantry' },
              { name: 'edge', quantity: 1, unit: 'ea', confidence: 0.7, category: 'other', source_location: 'pantry' },
            ],
          }),
      });
      await usePantryStore.getState().startReceiptScan('b64');

      const { scanResults } = usePantryStore.getState();
      expect(scanResults[0].accepted).toBe(false);
      expect(scanResults[1].accepted).toBe(true);
    });

    it('throws upstream error and resets isScanning on !ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'upstream error' }),
      });

      await expect(
        usePantryStore.getState().startReceiptScan('b64')
      ).rejects.toThrow('upstream error');
      expect(usePantryStore.getState().isScanning).toBe(false);
    });
  });

  describe('startInstacartImport', () => {
    it('POSTs to /api/v1/pantry/import-instacart with auth + no source_location', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                name: 'oat milk',
                quantity: 1,
                unit: 'carton',
                confidence: 0.88,
                category: 'beverage',
                source_location: 'fridge',
              },
            ],
          }),
      });
      await usePantryStore.getState().startInstacartImport('b64');

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/v1/pantry/import-instacart');
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Bearer test-token');
      const body = JSON.parse(init.body);
      expect(body.image).toBe('b64');
      expect(body.source_location).toBeUndefined();
    });

    it('maps response data into scanResults and seeds aiLocation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                name: 'oat milk',
                quantity: 1,
                unit: 'carton',
                confidence: 0.88,
                category: 'beverage',
                source_location: 'fridge',
              },
            ],
          }),
      });
      await usePantryStore.getState().startInstacartImport('b64');

      const { scanResults } = usePantryStore.getState();
      expect(scanResults).toHaveLength(1);
      expect(scanResults[0].id).toMatch(/^scan-\d+-0$/);
      expect(scanResults[0].accepted).toBe(true);
      expect(scanResults[0].userEdited).toBe(false);
      expect(scanResults[0].source_location).toBe('fridge');
      expect(scanResults[0].aiLocation).toBe('fridge');
    });

    it('throws upstream error and resets isScanning on !ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'instacart upstream error' }),
      });

      await expect(
        usePantryStore.getState().startInstacartImport('b64')
      ).rejects.toThrow('instacart upstream error');
      expect(usePantryStore.getState().isScanning).toBe(false);
    });
  });

  describe('confirmScan', () => {
    it('sends only accepted items (no top-level source_location) and merges results', async () => {
      const acceptedItem = { ...mockReviewItem, accepted: true };
      const rejectedItem = {
        ...mockReviewItem,
        id: 'review-2',
        name: 'Cheese',
        accepted: false,
      };

      usePantryStore.setState({
        scanResults: [acceptedItem, rejectedItem],
        items: [mockItem],
      });

      const confirmedPantryItem: PantryItem = {
        id: 'new-item-1',
        profile_id: 'profile-1',
        name: 'Butter',
        normalized_name: 'butter',
        quantity: { value: 1, unit: 'stick', system: 'count' },
        category: 'dairy',
        source_location: 'fridge',
        confidence: 0.85,
        status: 'available',
        last_seen_at: '2026-04-10T00:00:00Z',
        created_at: '2026-04-10T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
      };

      // Phase 24-05: /confirm now returns ReconcileResult counts. Mobile
      // reloads the pantry from Supabase after a successful confirm to pick
      // up aggregated / multi-row changes.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { inserted: 1, updated: 0, incompatibleUnits: 0 },
          }),
      });
      // Mock supabase chain for subsequent loadItems() call.
      const loadChain: Record<string, unknown> = {};
      loadChain.select = vi.fn(() => loadChain);
      loadChain.eq = vi.fn(() => loadChain);
      loadChain.order = vi.fn(() =>
        Promise.resolve({ data: [mockItem, confirmedPantryItem], error: null }),
      );
      mockSupabase.from.mockReturnValue(loadChain);

      await usePantryStore.getState().confirmScan('profile-1');

      const state = usePantryStore.getState();
      // After 24-05: items come from the supabase reload, not from merging
      // the /confirm response body.
      expect(state.items).toHaveLength(2);
      expect(state.items.find((i) => i.name === 'Butter')).toBeDefined();
      // scanResults cleared
      expect(state.scanResults).toHaveLength(0);

      // Verify only accepted items were sent and NO top-level source_location.
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe('Butter');
      // Per-item source_location survives the strip of id/accepted/userEdited.
      expect(body.items[0].source_location).toBe('fridge');
      expect(body.source_location).toBeUndefined();
    });

    it('fires override-events fire-and-forget for items where source_location !== aiLocation', async () => {
      // Accepted + edited: AI said pantry, user moved to fridge.
      const editedItem: ReviewItem = {
        ...mockReviewItem,
        id: 'r-edit',
        name: 'Butter',
        accepted: true,
        userEdited: true,
        source_location: 'fridge',
        aiLocation: 'pantry',
      };
      // Accepted + not edited (AI said fridge, no override).
      const unchangedItem: ReviewItem = {
        ...mockReviewItem,
        id: 'r-keep',
        name: 'Milk',
        accepted: true,
        userEdited: false,
        source_location: 'fridge',
        aiLocation: 'fridge',
      };

      usePantryStore.setState({
        scanResults: [editedItem, unchangedItem],
        items: [],
      });

      // /confirm happy path (24-05 returns ReconcileResult counts).
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { inserted: 1, updated: 0, incompatibleUnits: 0 },
          }),
      });
      // /override-events happy path (fire-and-forget).
      mockFetch.mockResolvedValueOnce({ ok: true });
      // Supabase reload (loadItems fires after confirm).
      const loadChain: Record<string, unknown> = {};
      loadChain.select = vi.fn(() => loadChain);
      loadChain.eq = vi.fn(() => loadChain);
      loadChain.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
      mockSupabase.from.mockReturnValue(loadChain);

      await usePantryStore.getState().confirmScan('profile-1');
      // Let the fire-and-forget microtask flush.
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Two calls: /confirm and /override-events.
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const overrideCall = mockFetch.mock.calls.find((call) =>
        String(call[0]).includes('/override-events'),
      );
      expect(overrideCall).toBeDefined();
      const overrideBody = JSON.parse(overrideCall![1].body);
      expect(overrideBody.events).toHaveLength(1);
      expect(overrideBody.events[0]).toEqual({
        item_name: 'butter',
        ai_location: 'pantry',
        user_location: 'fridge',
      });
    });

    it('does not POST to /override-events when no items were edited', async () => {
      const unchangedItem: ReviewItem = {
        ...mockReviewItem,
        id: 'r-keep',
        accepted: true,
        userEdited: false,
        source_location: 'fridge',
        aiLocation: 'fridge',
      };

      usePantryStore.setState({ scanResults: [unchangedItem], items: [] });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { inserted: 0, updated: 1, incompatibleUnits: 0 },
          }),
      });
      // Supabase reload after confirm.
      const loadChain: Record<string, unknown> = {};
      loadChain.select = vi.fn(() => loadChain);
      loadChain.eq = vi.fn(() => loadChain);
      loadChain.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
      mockSupabase.from.mockReturnValue(loadChain);

      await usePantryStore.getState().confirmScan('profile-1');
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Only /confirm — no /override-events POST because there was nothing to log.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(String(mockFetch.mock.calls[0][0])).toContain('/confirm');
    });

    it('/confirm failures still bubble up but do not throw from fire-and-forget override telemetry', async () => {
      const editedItem: ReviewItem = {
        ...mockReviewItem,
        id: 'r-edit',
        name: 'Butter',
        accepted: true,
        userEdited: true,
        source_location: 'fridge',
        aiLocation: 'pantry',
      };
      usePantryStore.setState({ scanResults: [editedItem], items: [] });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'confirm failed' }),
      });

      await expect(
        usePantryStore.getState().confirmScan('profile-1'),
      ).rejects.toThrow('confirm failed');
    });
  });
});
