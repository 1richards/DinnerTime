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
      set({
        currentList: body.data.list,
        items: body.data.items ?? [],
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
      set({
        currentList: body.data.list,
        items: body.data.items ?? [],
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
    const list = get().currentList;
    if (!list) {
      set({ error: 'No active shopping list' });
      return;
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

    try {
      const response = await authedFetch('/shopping/items', {
        method: 'POST',
        body: JSON.stringify({
          shopping_list_id: list.id,
          name: input.name,
          quantity: input.quantity ?? null,
          unit: input.unit ?? null,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        set({ items: snapshot, error: err.error ?? 'Failed to add item' });
        return;
      }

      const body = await response.json();
      const serverItem: ShoppingListItem = body.data;
      set((state) => ({
        items: state.items.map((i) =>
          i.id === optimistic.id ? serverItem : i
        ),
        error: null,
      }));
    } catch (err) {
      set({
        items: snapshot,
        error: err instanceof Error ? err.message : 'Failed to add item',
      });
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
