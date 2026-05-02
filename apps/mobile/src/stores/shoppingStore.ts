import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingOrder,
  VariationSuggestion,
} from '../types/shopping';

interface AddItemInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
}

interface EditItemPatch {
  name?: string;
  quantity?: number | null;
  unit?: string | null;
  checked?: boolean;
}

interface CreateOrderResult {
  url: string;
  order_id: string;
}

interface ReorderResult {
  list: ShoppingList;
  items: ShoppingListItem[];
}

interface ShoppingState {
  currentList: ShoppingList | null;
  items: ShoppingListItem[];
  orders: ShoppingOrder[];
  variations: VariationSuggestion[];
  loading: boolean;
  error: string | null;

  generateList: (mealPlanId: string) => Promise<void>;
  fetchCurrent: () => Promise<void>;
  toggleChecked: (itemId: string) => Promise<void>;
  addItem: (input: AddItemInput) => Promise<void>;
  editItem: (id: string, patch: EditItemPatch) => Promise<void>;
  removeItem: (id: string) => Promise<void>;

  createOrder: () => Promise<CreateOrderResult>;
  fetchOrders: () => Promise<void>;
  reorder: (orderId: string) => Promise<ReorderResult>;
  fetchVariations: (orderId: string) => Promise<VariationSuggestion[]>;
}

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

const getAuthToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
};

const authedFetch = async (
  path: string,
  init: RequestInit = {}
): Promise<Response> => {
  const token = await getAuthToken();
  return fetch(`${getApiBaseUrl()}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
};

const tempId = (): string => {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `tmp-${globalThis.crypto.randomUUID()}`;
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
  currentList: null,
  items: [],
  orders: [],
  variations: [],
  loading: false,
  error: null,

  generateList: async (mealPlanId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await authedFetch('/shopping/generate', {
        method: 'POST',
        body: JSON.stringify({ meal_plan_id: mealPlanId }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({
          error: err.error ?? 'Failed to generate shopping list',
          loading: false,
        });
        return;
      }

      const body = await response.json();
      const genData = body.data;
      if (!genData) {
        set({ currentList: null, items: [], loading: false, error: null });
        return;
      }
      const { items: generatedItems, ...listFields } = genData;
      set({
        currentList: listFields as ShoppingList,
        items: generatedItems ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error
            ? err.message
            : 'Failed to generate shopping list',
        loading: false,
      });
    }
  },

  fetchCurrent: async () => {
    set({ loading: true, error: null });
    try {
      const response = await authedFetch('/shopping/current', {
        method: 'GET',
      });

      if (response.status === 404) {
        set({ currentList: null, items: [], error: null, loading: false });
        return;
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({
          error: err.error ?? 'Failed to fetch shopping list',
          loading: false,
        });
        return;
      }

      const body = await response.json();
      const data = body.data;
      if (!data) {
        set({ currentList: null, items: [], loading: false, error: null });
        return;
      }
      const { items: fetchedItems, ...fetchedListFields } = data;
      set({
        currentList: fetchedListFields as ShoppingList,
        items: fetchedItems ?? [],
        loading: false,
        error: null,
      });
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : 'Failed to fetch shopping list',
        loading: false,
      });
    }
  },

  toggleChecked: async (itemId: string) => {
    const snapshot = get().items;
    const target = snapshot.find((i) => i.id === itemId);
    if (!target) return;
    const nextChecked = !target.checked;

    set({
      items: snapshot.map((i) =>
        i.id === itemId ? { ...i, checked: nextChecked } : i
      ),
      error: null,
    });

    try {
      const response = await authedFetch(`/shopping/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ checked: nextChecked }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({
          items: snapshot,
          error: err.error ?? 'Failed to update item',
        });
      }
    } catch (err) {
      set({
        items: snapshot,
        error: err instanceof Error ? err.message : 'Failed to update item',
      });
    }
  },

  addItem: async (input: AddItemInput) => {
    // Refresh-or-create when we don't yet have a list. Pulled into a
    // closure so we can re-run it after a 404 from POST /shopping/items —
    // the persisted currentList can be stale (test cleanup, account
    // switch, RLS-deleted row) and the server doesn't auto-recover.
    // Mirrors the meal-plan 404-refetch pattern from commit 1fe4fd0.
    const refreshOrCreateList = async (): Promise<ShoppingList> => {
      let list: ShoppingList | null = null;
      try {
        const refreshResponse = await authedFetch('/shopping/current', {
          method: 'GET',
        });
        if (refreshResponse.ok) {
          const refreshBody = await refreshResponse.json();
          const refreshed = refreshBody.data;
          if (refreshed) {
            const { items: refreshedItems, ...refreshedFields } = refreshed;
            set({
              currentList: refreshedFields as ShoppingList,
              items: refreshedItems ?? [],
            });
            list = refreshedFields as ShoppingList;
          }
        }
      } catch {
        // Fall through to create.
      }

      if (!list) {
        const createResponse = await authedFetch('/shopping/lists', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        if (!createResponse.ok) {
          const err = await createResponse.json().catch(() => ({}));
          const message = err.error ?? 'Failed to create shopping list';
          set({ error: message });
          throw new Error(message);
        }
        const createBody = await createResponse.json();
        const created = createBody.data;
        const { items: createdItems, ...createdFields } = created;
        list = createdFields as ShoppingList;
        set({
          currentList: list,
          items: createdItems ?? [],
          error: null,
        });
      }
      return list;
    };

    let list = get().currentList;
    if (!list) {
      list = await refreshOrCreateList();
    }
    const snapshot = get().items;

    const optimistic: ShoppingListItem = {
      id: tempId(),
      shopping_list_id: list.id,
      name: input.name,
      normalized_name: input.name.toLowerCase().trim(),
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      category: 'other',
      sources: [],
      checked: false,
      user_added: true,
      created_at: new Date().toISOString(),
    };

    set({ items: [...snapshot, optimistic], error: null });

    const postItem = async (listId: string): Promise<Response> =>
      authedFetch('/shopping/items', {
        method: 'POST',
        body: JSON.stringify({
          shopping_list_id: listId,
          name: input.name,
          quantity: input.quantity ?? null,
          unit: input.unit ?? null,
        }),
      });

    try {
      let response = await postItem(list.id);

      // Stale-list recovery: persisted currentList can point at a deleted
      // row. Drop it, refresh-or-create, and retry once before surfacing.
      // refreshOrCreateList resets `items` to the new list's contents, so
      // re-attach the optimistic row on top before retrying.
      if (response.status === 404) {
        set({ currentList: null });
        list = await refreshOrCreateList();
        const recovered = get().items;
        const optimisticForList = { ...optimistic, shopping_list_id: list.id };
        set({ items: [...recovered, optimisticForList], error: null });
        response = await postItem(list.id);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err.error ?? 'Failed to add item';
        set({ items: snapshot, error: message });
        throw new Error(message);
      }

      const body = await response.json();
      const serverItem: ShoppingListItem = body.data;
      set((state) => ({
        items: state.items.map((i) =>
          i.id === optimistic.id ? { ...serverItem, shopping_list_id: list.id } : i
        ),
        error: null,
      }));
    } catch (err) {
      // Rollback + surface. Throwing lets PantryItemCard's swipe handler
      // present an Alert to the user instead of silently swallowing.
      set({
        items: snapshot,
        error: err instanceof Error ? err.message : 'Failed to add item',
      });
      throw err;
    }
  },

  editItem: async (id: string, patch: EditItemPatch) => {
    const snapshot = get().items;
    const target = snapshot.find((i) => i.id === id);
    if (!target) return;

    set({
      items: snapshot.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      error: null,
    });

    try {
      const response = await authedFetch(`/shopping/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({ items: snapshot, error: err.error ?? 'Failed to edit item' });
        return;
      }

      const body = await response.json();
      const serverItem: ShoppingListItem = body.data;
      set((state) => ({
        items: state.items.map((i) => (i.id === id ? serverItem : i)),
        error: null,
      }));
    } catch (err) {
      set({
        items: snapshot,
        error: err instanceof Error ? err.message : 'Failed to edit item',
      });
    }
  },

  removeItem: async (id: string) => {
    const snapshot = get().items;

    set({
      items: snapshot.filter((i) => i.id !== id),
      error: null,
    });

    try {
      const response = await authedFetch(`/shopping/items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({ items: snapshot, error: err.error ?? 'Failed to remove item' });
      }
    } catch (err) {
      set({
        items: snapshot,
        error: err instanceof Error ? err.message : 'Failed to remove item',
      });
    }
  },

  createOrder: async () => {
    const list = get().currentList;
    if (!list) {
      throw new Error('No active shopping list');
    }

    const response = await authedFetch(`/shopping/${list.id}/order`, {
      method: 'POST',
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err.error ?? 'Failed to create order';
      set({ error: message });
      throw new Error(message);
    }

    const body = await response.json();
    const data: CreateOrderResult = body.data;
    set({ error: null });
    return data;
  },

  fetchOrders: async () => {
    try {
      const response = await authedFetch('/shopping/orders', {
        method: 'GET',
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({ error: err.error ?? 'Failed to fetch orders' });
        return;
      }

      const body = await response.json();
      set({ orders: body.data ?? [], error: null });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch orders',
      });
    }
  },

  reorder: async (orderId: string) => {
    const response = await authedFetch(
      `/shopping/orders/${orderId}/reorder`,
      { method: 'POST' }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message = err.error ?? 'Failed to reorder';
      set({ error: message });
      throw new Error(message);
    }

    const body = await response.json();
    const result: ReorderResult = body.data;
    set({
      currentList: result.list,
      items: result.items ?? [],
      error: null,
    });
    return result;
  },

  fetchVariations: async (orderId: string) => {
    try {
      const response = await authedFetch(
        `/shopping/orders/${orderId}/variations`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({ error: err.error ?? 'Failed to fetch variations' });
        return [];
      }

      const body = await response.json();
      const variations: VariationSuggestion[] = body.data ?? [];
      set({ variations, error: null });
      return variations;
    } catch (err) {
      set({
        error:
          err instanceof Error ? err.message : 'Failed to fetch variations',
      });
      return [];
    }
  },
    }),
    {
      name: 'dinnertime-shopping',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        currentList: state.currentList,
        items: state.items,
        orders: state.orders,
      }),
      version: 1,
    }
  )
);
