import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { offlineQueue, registerExecutor } from '../lib/offlineQueue';
import { useNetworkStore } from './networkStore';
import type { PantryItem, ReviewItem, SourceLocation } from '../types/pantry';

interface PantryState {
  items: PantryItem[];
  scanResults: ReviewItem[];
  isScanning: boolean;
  isLoading: boolean;

  loadItems: (profileId: string) => Promise<void>;
  startScan: (base64Image: string, sourceLocation: SourceLocation) => Promise<void>;
  startBatchScan: (base64Images: string[], sourceLocation: SourceLocation) => Promise<void>;
  startReceiptScan: (base64Image: string, sourceLocation: SourceLocation) => Promise<void>;
  startInstacartImport: (base64Image: string) => Promise<void>;
  updateReviewItem: (id: string, updates: Partial<ReviewItem>) => void;
  addReviewItem: (item: ReviewItem) => void;
  removeReviewItem: (id: string) => void;
  confirmScan: (profileId: string, sourceLocation: SourceLocation) => Promise<void>;
  markItemUsed: (itemId: string) => Promise<void>;
  markItemDepleted: (itemId: string) => Promise<void>;
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

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
  items: [],
  scanResults: [],
  isScanning: false,
  isLoading: false,

  loadItems: async (profileId: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('profile_id', profileId)
        .eq('status', 'available')
        .order('category');

      if (error) throw error;

      set({ items: (data ?? []) as PantryItem[], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  startScan: async (base64Image: string, sourceLocation: SourceLocation) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64Image, source_location: sourceLocation }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Scan failed');
      }

      const data = await response.json();
      const reviewItems: ReviewItem[] = (data.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any, index: number) => ({
          id: `scan-${Date.now()}-${index}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          confidence: item.confidence,
          category: item.category,
          accepted: true,
          userEdited: false,
        })
      );

      set({ scanResults: reviewItems, isScanning: false });
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  startBatchScan: async (base64Images: string[], sourceLocation: SourceLocation) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ images: base64Images, source_location: sourceLocation }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Batch scan failed');
      }

      const data = await response.json();
      const reviewItems: ReviewItem[] = (data.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any, index: number) => ({
          id: `scan-${Date.now()}-${index}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          confidence: item.confidence,
          category: item.category,
          accepted: item.confidence >= 0.7,
          userEdited: false,
        })
      );

      set({ scanResults: reviewItems, isScanning: false });
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  startReceiptScan: async (base64Image: string, sourceLocation: SourceLocation) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64Image, source_location: sourceLocation }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Receipt scan failed');
      }

      const data = await response.json();
      const reviewItems: ReviewItem[] = (data.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any, index: number) => ({
          id: `scan-${Date.now()}-${index}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          confidence: item.confidence,
          category: item.category,
          accepted: item.confidence >= 0.7,
          userEdited: false,
        })
      );

      set({ scanResults: reviewItems, isScanning: false });
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  startInstacartImport: async (base64Image: string) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/import-instacart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Instacart import failed');
      }

      const data = await response.json();
      const reviewItems: ReviewItem[] = (data.data ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any, index: number) => ({
          id: `scan-${Date.now()}-${index}`,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          confidence: item.confidence,
          category: item.category,
          accepted: item.confidence >= 0.7,
          userEdited: false,
        })
      );

      set({ scanResults: reviewItems, isScanning: false });
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  updateReviewItem: (id: string, updates: Partial<ReviewItem>) => {
    set((state) => ({
      scanResults: state.scanResults.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  addReviewItem: (item: ReviewItem) => {
    set((state) => ({
      scanResults: [...state.scanResults, item],
    }));
  },

  removeReviewItem: (id: string) => {
    set((state) => ({
      scanResults: state.scanResults.filter((item) => item.id !== id),
    }));
  },

  confirmScan: async (profileId: string, sourceLocation: SourceLocation) => {
    const { scanResults } = get();
    const acceptedItems = scanResults.filter((item) => item.accepted);

    if (acceptedItems.length === 0) {
      set({ scanResults: [] });
      return;
    }

    const token = await getAuthToken();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        profile_id: profileId,
        source_location: sourceLocation,
        items: acceptedItems.map(({ id: _id, accepted: _accepted, userEdited: _userEdited, ...rest }) => rest),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? 'Confirm failed');
    }

    const data = await response.json();
    const confirmedItems = (data.data ?? []) as PantryItem[];

    set((state) => ({
      items: [...state.items, ...confirmedItems],
      scanResults: [],
    }));
  },

  markItemUsed: async (itemId: string) => {
    const previousItems = get().items;

    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, status: 'used' as const } : item
      ),
    }));

    if (!useNetworkStore.getState().isOnline) {
      await offlineQueue.enqueue({
        type: 'pantryEdit',
        itemId,
        patch: { status: 'used' },
      });
      return;
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'used' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark item as used');
      }
    } catch (err) {
      // Rollback on error
      set({ items: previousItems });
      throw err;
    }
  },

  markItemDepleted: async (itemId: string) => {
    const previousItems = get().items;

    // Optimistic update
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId ? { ...item, status: 'depleted' as const } : item
      ),
    }));

    if (!useNetworkStore.getState().isOnline) {
      await offlineQueue.enqueue({
        type: 'pantryEdit',
        itemId,
        patch: { status: 'depleted' },
      });
      return;
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: 'depleted' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark item as depleted');
      }
    } catch (err) {
      // Rollback on error
      set({ items: previousItems });
      throw err;
    }
  },
    }),
    {
      name: 'dinnertime-pantry',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
      version: 1,
    }
  )
);

// Register offline-queue executor for pantry edits replay on reconnect.
registerExecutor('pantryEdit', async (op) => {
  if (op.type !== 'pantryEdit') return;
  const status = (op.patch as { status?: string }).status;
  if (status === 'used') {
    await usePantryStore.getState().markItemUsed(op.itemId);
  } else if (status === 'depleted') {
    await usePantryStore.getState().markItemDepleted(op.itemId);
  }
});
