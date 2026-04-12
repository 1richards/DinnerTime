import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase using vi.hoisted() for variable hoisting with vi.mock
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(() =>
      Promise.resolve({
        data: { session: { access_token: 'test-token' } },
        error: null as Error | null,
      })
    ),
  },
}));

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mock setup
import { useShoppingStore } from '../shoppingStore';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingOrder,
} from '../../types/shopping';

const makeItem = (
  id: string,
  overrides: Partial<ShoppingListItem> = {}
): ShoppingListItem => ({
  id,
  shopping_list_id: 'list-1',
  name: `item-${id}`,
  normalized_name: `item-${id}`,
  quantity: 1,
  unit: null,
  category: 'other',
  sources: [],
  checked: false,
  user_added: false,
  created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const makeList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  id: 'list-1',
  profile_id: 'user-1',
  meal_plan_id: 'plan-1',
  title: 'Week of Apr 13',
  generated_at: '2026-04-10T00:00:00Z',
  created_at: '2026-04-10T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const makeOrder = (
  id: string,
  overrides: Partial<ShoppingOrder> = {}
): ShoppingOrder => ({
  id,
  profile_id: 'user-1',
  shopping_list_id: 'list-1',
  instacart_url: `https://instacart.com/order/${id}`,
  expires_at: null,
  placed_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const resetState = () => {
  useShoppingStore.setState({
    currentList: null,
    items: [],
    orders: [],
    variations: [],
    loading: false,
    error: null,
  });
};

describe('shoppingStore', () => {
  beforeEach(() => {
    resetState();
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
      error: null as Error | null,
    });
  });

  describe('generateList', () => {
    it('POSTs meal_plan_id and populates currentList + items', async () => {
      const list = makeList();
      const items = [makeItem('i1'), makeItem('i2')];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { list, items } }),
      });

      await useShoppingStore.getState().generateList('plan-1');

      const state = useShoppingStore.getState();
      expect(state.currentList).toEqual(list);
      expect(state.items).toEqual(items);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/shopping/generate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ meal_plan_id: 'plan-1' }),
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('surfaces error on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'boom' }),
      });

      await useShoppingStore.getState().generateList('plan-1');

      const state = useShoppingStore.getState();
      expect(state.error).toBe('boom');
      expect(state.currentList).toBeNull();
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchCurrent', () => {
    it('handles 404 as no list (null, no error)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'not found' }),
      });

      await useShoppingStore.getState().fetchCurrent();

      const state = useShoppingStore.getState();
      expect(state.currentList).toBeNull();
      expect(state.items).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.loading).toBe(false);
    });

    it('populates list + items on 200', async () => {
      const list = makeList();
      const items = [makeItem('a'), makeItem('b')];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { list, items } }),
      });

      await useShoppingStore.getState().fetchCurrent();

      const state = useShoppingStore.getState();
      expect(state.currentList).toEqual(list);
      expect(state.items).toEqual(items);
    });
  });

  describe('toggleChecked', () => {
    it('flips checked optimistically and persists on success', async () => {
      const items = [makeItem('i1', { checked: false })];
      useShoppingStore.setState({ currentList: makeList(), items });

      let resolveFetch!: (v: unknown) => void;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const promise = useShoppingStore.getState().toggleChecked('i1');
      await Promise.resolve();
      await Promise.resolve();

      // Optimistic mid-state
      expect(useShoppingStore.getState().items[0].checked).toBe(true);

      resolveFetch({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ data: { ...items[0], checked: true } }),
      });
      await promise;

      expect(useShoppingStore.getState().items[0].checked).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/shopping/items/i1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ checked: true }),
        })
      );
    });

    it('rolls back on fetch failure', async () => {
      const items = [makeItem('i1', { checked: false })];
      useShoppingStore.setState({ currentList: makeList(), items });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'fail' }),
      });

      await useShoppingStore.getState().toggleChecked('i1');

      const state = useShoppingStore.getState();
      expect(state.items[0].checked).toBe(false);
      expect(state.error).toBe('fail');
    });

    it('rolls back on network error', async () => {
      const items = [makeItem('i1', { checked: true })];
      useShoppingStore.setState({ currentList: makeList(), items });

      mockFetch.mockRejectedValueOnce(new Error('network down'));

      await useShoppingStore.getState().toggleChecked('i1');

      const state = useShoppingStore.getState();
      expect(state.items[0].checked).toBe(true);
      expect(state.error).toBe('network down');
    });
  });

  describe('addItem', () => {
    it('appends optimistically and replaces with server item on success', async () => {
      useShoppingStore.setState({ currentList: makeList(), items: [] });

      const serverItem = makeItem('server-1', { name: 'butter' });
      let resolveFetch!: (v: unknown) => void;
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
      );

      const promise = useShoppingStore
        .getState()
        .addItem({ name: 'butter', quantity: 1, unit: 'stick' });
      await Promise.resolve();
      await Promise.resolve();

      // Optimistic state has 1 item
      expect(useShoppingStore.getState().items).toHaveLength(1);
      expect(useShoppingStore.getState().items[0].name).toBe('butter');

      resolveFetch({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: serverItem }),
      });
      await promise;

      const final = useShoppingStore.getState().items;
      expect(final).toHaveLength(1);
      expect(final[0].id).toBe('server-1');
    });

    it('rolls back on failure', async () => {
      useShoppingStore.setState({
        currentList: makeList(),
        items: [makeItem('existing')],
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'nope' }),
      });

      await useShoppingStore
        .getState()
        .addItem({ name: 'butter', quantity: 1, unit: null });

      const state = useShoppingStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('existing');
      expect(state.error).toBe('nope');
    });
  });

  describe('editItem', () => {
    it('applies patch optimistically and confirms on success', async () => {
      const items = [makeItem('i1', { name: 'old', quantity: 1 })];
      useShoppingStore.setState({ currentList: makeList(), items });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: { ...items[0], name: 'new', quantity: 2 },
          }),
      });

      await useShoppingStore
        .getState()
        .editItem('i1', { name: 'new', quantity: 2 });

      const state = useShoppingStore.getState();
      expect(state.items[0].name).toBe('new');
      expect(state.items[0].quantity).toBe(2);
    });

    it('rolls back on failure', async () => {
      const items = [makeItem('i1', { name: 'old' })];
      useShoppingStore.setState({ currentList: makeList(), items });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'edit fail' }),
      });

      await useShoppingStore.getState().editItem('i1', { name: 'new' });

      const state = useShoppingStore.getState();
      expect(state.items[0].name).toBe('old');
      expect(state.error).toBe('edit fail');
    });
  });

  describe('removeItem', () => {
    it('filters optimistically and confirms on success', async () => {
      const items = [makeItem('i1'), makeItem('i2')];
      useShoppingStore.setState({ currentList: makeList(), items });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { deleted: true } }),
      });

      await useShoppingStore.getState().removeItem('i1');

      const state = useShoppingStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('i2');
    });

    it('rolls back on failure', async () => {
      const items = [makeItem('i1'), makeItem('i2')];
      useShoppingStore.setState({ currentList: makeList(), items });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'del fail' }),
      });

      await useShoppingStore.getState().removeItem('i1');

      const state = useShoppingStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.error).toBe('del fail');
    });
  });

  describe('createOrder', () => {
    it('throws when no currentList', async () => {
      useShoppingStore.setState({ currentList: null });

      await expect(
        useShoppingStore.getState().createOrder()
      ).rejects.toThrow('No active shopping list');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('POSTs to /:id/order and returns {url, order_id}', async () => {
      useShoppingStore.setState({ currentList: makeList() });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            data: {
              url: 'https://instacart.com/order/abc',
              order_id: 'ord-abc',
            },
          }),
      });

      const result = await useShoppingStore.getState().createOrder();

      expect(result.url).toBe('https://instacart.com/order/abc');
      expect(result.order_id).toBe('ord-abc');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/shopping/list-1/order'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('surfaces error on server failure', async () => {
      useShoppingStore.setState({ currentList: makeList() });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.resolve({ error: 'INSTACART_ERROR' }),
      });

      await expect(
        useShoppingStore.getState().createOrder()
      ).rejects.toThrow();

      const state = useShoppingStore.getState();
      expect(state.error).toBe('INSTACART_ERROR');
    });
  });

  describe('fetchOrders', () => {
    it('populates orders from GET /orders', async () => {
      const orders = [makeOrder('o1'), makeOrder('o2')];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: orders }),
      });

      await useShoppingStore.getState().fetchOrders();

      expect(useShoppingStore.getState().orders).toEqual(orders);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/shopping/orders'),
        expect.objectContaining({ method: 'GET' })
      );
    });
  });

  describe('reorder', () => {
    it('sets returned list as currentList + items', async () => {
      const newList = makeList({ id: 'list-new' });
      const newItems = [makeItem('x1'), makeItem('x2')];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ data: { list: newList, items: newItems } }),
      });

      const result = await useShoppingStore.getState().reorder('ord-1');

      const state = useShoppingStore.getState();
      expect(state.currentList).toEqual(newList);
      expect(state.items).toEqual(newItems);
      expect(result.list).toEqual(newList);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/shopping/orders/ord-1/reorder'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('fetchVariations', () => {
    it('stores and returns variations array', async () => {
      const variations = [
        {
          instead_of: 'chicken',
          swap: 'tofu',
          rationale: 'vegetarian option',
        },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: variations }),
      });

      const result = await useShoppingStore
        .getState()
        .fetchVariations('ord-1');

      expect(result).toEqual(variations);
      expect(useShoppingStore.getState().variations).toEqual(variations);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/shopping/orders/ord-1/variations'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('surfaces error on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'variations fail' }),
      });

      const result = await useShoppingStore
        .getState()
        .fetchVariations('ord-1');

      expect(result).toEqual([]);
      expect(useShoppingStore.getState().error).toBe('variations fail');
    });
  });
});
