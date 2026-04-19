import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { offlineQueue, registerExecutor } from '../lib/offlineQueue';
import { useNetworkStore } from './networkStore';
import { logOverrideEvents } from '../lib/logOverrideEvent';
import { deriveOverrideEvents } from '../app/scan/reviewHelpers';
import type {
  FieldConfidence,
  PantryItem,
  Quantity,
  ReviewItem,
  SourceLocation,
} from '../types/pantry';

interface PantryState {
  items: PantryItem[];
  scanResults: ReviewItem[];
  isScanning: boolean;
  isLoading: boolean;

  loadItems: (profileId: string) => Promise<void>;
  /** Phase 18-03: AI infers per-item source_location; no session-level lock. */
  startScan: (base64Image: string) => Promise<void>;
  startBatchScan: (base64Images: string[]) => Promise<void>;
  startReceiptScan: (base64Image: string) => Promise<void>;
  startInstacartImport: (base64Image: string) => Promise<void>;
  updateReviewItem: (id: string, updates: Partial<ReviewItem>) => void;
  addReviewItem: (item: ReviewItem) => void;
  removeReviewItem: (id: string) => void;
  /** Each scanResult carries its own source_location; /confirm fans out per-item. */
  confirmScan: (profileId: string) => Promise<void>;
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

/**
 * Nullable variant used by logOverrideEvents (fire-and-forget). Returns null
 * on any auth failure rather than throwing, so telemetry never surfaces
 * mid-session sign-outs as an error.
 */
const getAuthTokenOrNull = async (): Promise<string | null> => {
  try {
    return await getAuthToken();
  } catch {
    return null;
  }
};

const DEFAULT_QUANTITY: Quantity = { value: 1, unit: 'piece', system: 'count' };

/**
 * Phase 24a defensive coercion for raw scan `quantity` payloads. Server emits
 * a nested Quantity ({value, unit, system}) post-24-04; this wrapper accepts
 * legacy flat numbers (old shape) and malformed objects without crashing.
 * Mirrors units.sanitize on the server.
 */
function coerceQuantity(raw: unknown): Quantity {
  if (raw && typeof raw === 'object' && 'value' in raw) {
    const q = raw as Partial<Quantity>;
    const value =
      typeof q.value === 'number' && Number.isFinite(q.value) ? q.value : 1;
    const unit = typeof q.unit === 'string' && q.unit.trim() ? q.unit : 'piece';
    const system =
      q.system === 'count' ||
      q.system === 'imperial-weight' ||
      q.system === 'imperial-volume' ||
      q.system === 'metric-weight' ||
      q.system === 'metric-volume' ||
      q.system === 'custom'
        ? q.system
        : 'custom';
    return { value, unit, system };
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { value: raw, unit: 'piece', system: 'count' };
  }
  return { ...DEFAULT_QUANTITY };
}

/**
 * Phase 24a: coerce field confidence. Server default-fills missing per-field
 * values to 0.5, but older responses may ship without the field entirely. We
 * return `undefined` for truly missing — ReviewItemRow treats that as
 * high-confidence (no dashed underline) for legacy backward compat.
 */
function coerceFieldConfidence(raw: unknown): FieldConfidence | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const pick = (k: string): number => {
    const v = r[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0.5;
  };
  return {
    name: pick('name'),
    quantity: pick('quantity'),
    unit: pick('unit'),
    category: pick('category'),
  };
}

/**
 * Build a ReviewItem[] from raw scan results, flagging any item whose
 * normalized name already exists in the user's pantry as a probable duplicate.
 * Probable dupes default to accepted=false so the user must opt-in to re-adding
 * them. Confidence-based accept rule still applies for non-dupes.
 */
function mapScanResultsToReview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawItems: any[],
  existingItems: PantryItem[],
  confidenceThreshold = 0.7,
): ReviewItem[] {
  const existingNames = new Set(
    existingItems.map((p) => p.name.trim().toLowerCase()),
  );
  return rawItems.map((item, index) => {
    const normalized = String(item.name ?? '').trim().toLowerCase();
    const probableDupe = existingNames.has(normalized);
    const confidence =
      typeof item.confidence === 'number' && Number.isFinite(item.confidence)
        ? item.confidence
        : 0.5;
    // Dupes default OFF; otherwise use confidence threshold.
    const accepted = probableDupe ? false : confidence >= confidenceThreshold;
    // Server (Phase 18-02) returns per-item source_location. Default to
    // 'pantry' defensively if a legacy/malformed response omits it.
    const source_location: SourceLocation =
      item.source_location === 'fridge' ||
      item.source_location === 'freezer' ||
      item.source_location === 'pantry'
        ? item.source_location
        : 'pantry';
    // Phase 24a: quantity is now a nested object; fieldConfidence is per-field.
    // Pass through unchanged from server (post-24-04) with defensive coercion
    // for malformed / legacy shapes.
    const quantity = coerceQuantity(item.quantity);
    const fieldConfidence = coerceFieldConfidence(item.fieldConfidence);
    return {
      id: `scan-${Date.now()}-${index}`,
      name: item.name,
      quantity,
      confidence,
      fieldConfidence: fieldConfidence ?? {
        // Fall back to per-field values derived from overall confidence so the
        // UI renders deterministically even on pre-24a server responses.
        name: confidence,
        quantity: confidence,
        unit: confidence,
        category: confidence,
      },
      category: item.category,
      source_location,
      // Preserve the original AI prediction so later user edits can be
      // detected as overrides (deriveOverrideEvents in Task 2 + 3).
      aiLocation: source_location,
      accepted,
      userEdited: false,
      probableDupe,
    };
  });
}

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

  startScan: async (base64Image: string) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Scan failed');
      }

      const data = await response.json();
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items);

      set({ scanResults: reviewItems, isScanning: false });
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  startBatchScan: async (base64Images: string[]) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ images: base64Images }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Batch scan failed');
      }

      const data = await response.json();
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items);

      set({ scanResults: reviewItems, isScanning: false });
    } catch (err) {
      set({ isScanning: false });
      throw err;
    }
  },

  startReceiptScan: async (base64Image: string) => {
    set({ isScanning: true });
    try {
      const token = await getAuthToken();
      const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error ?? 'Receipt scan failed');
      }

      const data = await response.json();
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items);

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
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items);

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

  confirmScan: async (profileId: string) => {
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
      // Phase 18-03: no top-level source_location; each item carries its own.
      // Strip review-only fields (id, accepted, userEdited, aiLocation,
      // probableDupe) — they're local-only bookkeeping.
      body: JSON.stringify({
        profile_id: profileId,
        items: acceptedItems.map(
          ({
            id: _id,
            accepted: _accepted,
            userEdited: _userEdited,
            aiLocation: _aiLocation,
            probableDupe: _probableDupe,
            ...rest
          }) => rest,
        ),
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? 'Confirm failed');
    }

    // Phase 24-05: /confirm now returns { data: { inserted, updated,
    // incompatibleUnits } } instead of the legacy PantryItem[] shape.
    // Consume the response body to surface any error but we don't use the
    // counts directly here — a fresh pantry reload gives us the canonical
    // row state including any quantity-aggregated or multi-row merges.
    await response.json();

    // Fire-and-forget override telemetry for edited items (user moved
    // something away from the AI's prediction). Only items that were
    // accepted AND edited AND have an aiLocation mismatch are logged.
    // Never await — the user sees the "Pantry Updated" confirmation
    // without waiting on a telemetry POST.
    const overrideEvents = deriveOverrideEvents(acceptedItems);
    void logOverrideEvents(
      overrideEvents,
      getAuthTokenOrNull,
      getApiBaseUrl,
    );

    // Clear review results immediately for responsive UI; refresh pantry in
    // background so newly-inserted / updated / multi-row rows materialize.
    set({ scanResults: [] });
    try {
      await get().loadItems(profileId);
    } catch {
      // loadItems already swallows errors and resets isLoading. Nothing to do.
    }
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
