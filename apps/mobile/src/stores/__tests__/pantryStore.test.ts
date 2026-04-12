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
  quantity: 1,
  unit: 'stick',
  confidence: 0.85,
  category: 'dairy',
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

      usePantryStore
        .getState()
        .updateReviewItem('review-1', { name: 'Unsalted Butter', quantity: 2 });

      const state = usePantryStore.getState();
      expect(state.scanResults[0].name).toBe('Unsalted Butter');
      expect(state.scanResults[0].quantity).toBe(2);
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
        quantity: 2,
        unit: 'cup',
        confidence: 1.0,
        category: 'dairy',
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

  describe('confirmScan', () => {
    it('sends only accepted items and merges results into items', async () => {
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
        quantity: 1,
        unit: 'stick',
        category: 'dairy',
        source_location: 'fridge',
        confidence: 0.85,
        status: 'available',
        last_seen_at: '2026-04-10T00:00:00Z',
        created_at: '2026-04-10T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: [confirmedPantryItem] }),
      });

      await usePantryStore.getState().confirmScan('profile-1', 'fridge');

      const state = usePantryStore.getState();
      // Merged: original item + confirmed item
      expect(state.items).toHaveLength(2);
      expect(state.items.find((i) => i.name === 'Butter')).toBeDefined();
      // scanResults cleared
      expect(state.scanResults).toHaveLength(0);

      // Verify only accepted items were sent
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].name).toBe('Butter');
    });
  });
});
