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
import { reorderByIds, type LocationRule } from '../app/settings/pantryRulesHelpers';
import type { GroupingMode } from '../hooks/usePantryItemsGrouped';

// ── Phase 21-04: staple-aware auto-accept thresholds ────────────────────

/**
 * Default acceptance threshold from Phase 14 — items with AI confidence at or
 * above this auto-accept during scan review. Items below require explicit user
 * opt-in.
 */
export const DEFAULT_THRESHOLD = 0.7;

/**
 * Phase 21-04 aggressive staples threshold (21-CONTEXT ROADMAP #5). User
 * explicitly picked 0.3 (not 0.5). Signal: the user trusts the canonical-
 * resolution layer more than raw AI confidence for known-recurring items.
 * Only canonical ingredients the user has explicitly marked as staples get
 * this reprieve.
 */
export const STAPLE_THRESHOLD = 0.3;

/**
 * Pure acceptance resolver for scan items. Exported for unit testing so the
 * threshold arithmetic is covered without a full startBatchScan fixture.
 *
 * Rules (in order):
 *   1. probable duplicate → always rejected (user must opt-in to re-add)
 *   2. item's canonical is in the user's staples Set AND confidence ≥ 0.3
 *      → accepted (aggressive staples threshold)
 *   3. confidence ≥ 0.7 → accepted (default threshold)
 *   4. otherwise → rejected
 */
export function resolveScanAcceptance(args: {
  confidence: number;
  canonicalId: string | null | undefined;
  staples: Set<string>;
  probableDupe: boolean;
}): boolean {
  if (args.probableDupe) return false;
  const isStaple = !!args.canonicalId && args.staples.has(args.canonicalId);
  const threshold = isStaple ? STAPLE_THRESHOLD : DEFAULT_THRESHOLD;
  return args.confidence >= threshold;
}

// ── Phase 21-05: rules + suggestions types ──────────────────────────────

/**
 * Wire shape from GET /pantry/rules — name_mapping rows.
 * Note: canonical_ingredients join is optional; we tolerate its absence.
 */
export interface NameMappingRule {
  id: string;
  alias_name: string;
  canonical_ingredient_id: string;
  canonical_ingredients?: { canonical_name: string };
}

export interface RulesState {
  name_mapping: NameMappingRule[];
  location_mapping: LocationRule[];
}

export interface SuggestedRule {
  id: string;
  rule_type: 'name_mapping' | 'location_mapping';
  payload: Record<string, unknown>;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
}

/**
 * Staple wire shape. GET /pantry/staples returns each row as
 * `{canonical_ingredient_id, created_at, canonical_ingredients: {canonical_name}}`
 * via the supabase join. We store the flattened {id, name} shape in
 * `stapleRows` for the Settings → Staples list view (21-05).
 *
 * Phase 21-04 also maintains a parallel `staples: Set<string>` of the
 * canonical_ingredient_ids for O(1) membership checks during scan-accept
 * threshold resolution and the Pantry-tab 'Staples' filter chip. Both are
 * updated atomically by mark/unmark/load actions.
 */
export interface StapleRow {
  canonical_ingredient_id: string;
  canonical_name: string;
}

export type CreateRuleInput =
  | {
      rule_type: 'name_mapping';
      alias_name: string;
      target_canonical_id: string;
    }
  | {
      rule_type: 'location_mapping';
      canonical_ingredient_id: string;
      source_location: 'fridge' | 'pantry' | 'freezer';
    };

interface PantryState {
  items: PantryItem[];
  scanResults: ReviewItem[];
  isScanning: boolean;
  isLoading: boolean;

  // Phase 21-04 — staples membership (Set for O(1) scan-accept lookup + filter
  // chip). Parallel `stapleRows` holds the display list used by Settings →
  // Staples (21-05). Persisted as an array; rehydrated into a Set on mount.
  staples: Set<string>;
  stapleRows: StapleRow[];

  // Phase 21-04 — grouping mode for the Pantry tab (persisted user preference).
  groupingMode: GroupingMode;

  // Phase 21-05 extensions
  rules: RulesState;
  suggestions: SuggestedRule[];

  loadItems: (profileId: string) => Promise<void>;

  // Phase 21-04 grouping setter (persisted)
  setGroupingMode: (mode: GroupingMode) => void;

  // Phase 21-05 actions
  loadRules: () => Promise<void>;
  createRule: (input: CreateRuleInput) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  reorderRules: (newIdOrder: string[]) => Promise<void>;
  loadSuggestions: () => Promise<void>;
  acceptSuggestion: (id: string) => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;

  loadStaples: () => Promise<void>;
  markStaple: (canonicalId: string, canonicalName?: string) => Promise<void>;
  unmarkStaple: (canonicalId: string) => Promise<void>;
  isStaple: (canonicalId: string | null | undefined) => boolean;
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
 *
 * Phase 21-04: acceptance resolution is delegated to `resolveScanAcceptance`
 * so the aggressive staples threshold (0.3 for items whose canonical is in
 * `staples`) is applied uniformly across every scan-flow action.
 */
function mapScanResultsToReview(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawItems: any[],
  existingItems: PantryItem[],
  staples: Set<string> = new Set(),
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
    const canonicalId =
      typeof item.canonical_ingredient_id === 'string'
        ? item.canonical_ingredient_id
        : null;
    const accepted = resolveScanAcceptance({
      confidence,
      canonicalId,
      staples,
      probableDupe,
    });
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

// ── Phase 21-04: Zustand persist migration (Pitfall 8) ────────────────────

/**
 * Shape of the pantryStore's persisted slice. Set<string> is not JSON-
 * serializable so `staples` is stored as `string[]` and rehydrated to a Set
 * by `onRehydrateStorage`.
 */
export interface PantryPersistedShape {
  items?: PantryItem[];
  staples?: string[];
  groupingMode?: GroupingMode;
}

/**
 * Migrate a persisted pantryStore snapshot from any earlier version to the
 * current (v2) shape. Pre-21 snapshots (v0/v1) only had `items`; Phase 21-04
 * adds `staples` (as array on disk) + `groupingMode`. Missing fields receive
 * sensible defaults. Exported for unit test coverage.
 */
export function migratePantryPersistState(
  persisted: PantryPersistedShape,
  _fromVersion: number,
): PantryPersistedShape {
  return {
    items: persisted.items ?? [],
    staples: Array.isArray(persisted.staples) ? persisted.staples : [],
    groupingMode: persisted.groupingMode ?? 'location',
  };
}

/**
 * Phase 21-05 authedFetch helper — thin wrapper that attaches the bearer token
 * and resolves the /api/v1 prefix. Mirrors mealPlanStore / shoppingStore
 * conventions (STATE.md notes this is the canonical pattern for all stores).
 */
async function authedFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...((init.headers as Record<string, string>) ?? {}),
  };
  return fetch(`${getApiBaseUrl()}/api/v1${path}`, {
    ...init,
    method: init.method ?? 'GET',
    headers,
  });
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
  items: [],
  scanResults: [],
  isScanning: false,
  isLoading: false,

  // Phase 21-04 — staples membership + display rows
  staples: new Set<string>(),
  stapleRows: [],

  // Phase 21-04 — default grouping mode (overridable by user; persisted)
  groupingMode: 'location',

  // Phase 21-05 extensions — rules/suggestions state
  rules: { name_mapping: [], location_mapping: [] },
  suggestions: [],

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
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items, get().staples);

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
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items, get().staples);

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
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items, get().staples);

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
      const reviewItems = mapScanResultsToReview(data.data ?? [], get().items, get().staples);

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

  // ── Phase 21-05: rules + suggestions actions ────────────────────────────

  loadRules: async () => {
    const response = await authedFetch('/pantry/rules', { method: 'GET' });
    if (!response.ok) {
      throw new Error('Failed to load rules');
    }
    const data = (await response.json()) as RulesState;
    set({
      rules: {
        name_mapping: data.name_mapping ?? [],
        location_mapping: (data.location_mapping ?? []).map((r) => ({
          ...r,
          canonical_name:
            (r as LocationRule & {
              canonical_ingredients?: { canonical_name: string };
            }).canonical_ingredients?.canonical_name ?? r.canonical_name,
        })),
      },
    });
  },

  createRule: async (input: CreateRuleInput) => {
    const response = await authedFetch('/pantry/rules', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Create rule failed' }));
      throw new Error((err as { error?: string }).error ?? 'Create rule failed');
    }
    // Reload so the new rule (with server-assigned id + precedence) appears.
    await get().loadRules();
  },

  deleteRule: async (id: string) => {
    // Optimistic remove from both tables (we don't know which owns the id).
    const prev = get().rules;
    set({
      rules: {
        name_mapping: prev.name_mapping.filter((r) => r.id !== id),
        location_mapping: prev.location_mapping.filter((r) => r.id !== id),
      },
    });
    try {
      const response = await authedFetch(`/pantry/rules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Delete rule failed');
      }
    } catch (err) {
      // Rollback
      set({ rules: prev });
      throw err;
    }
  },

  reorderRules: async (newIdOrder: string[]) => {
    const prev = get().rules;
    const reordered = reorderByIds(prev.location_mapping, newIdOrder);
    // Optimistic local reorder
    set({
      rules: { ...prev, location_mapping: reordered },
    });
    try {
      const response = await authedFetch('/pantry/rules/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ rule_ids: newIdOrder }),
      });
      if (!response.ok) {
        throw new Error('Reorder rules failed');
      }
    } catch (err) {
      set({ rules: prev });
      throw err;
    }
  },

  loadSuggestions: async () => {
    const response = await authedFetch('/pantry/suggestions', { method: 'GET' });
    if (!response.ok) {
      throw new Error('Failed to load suggestions');
    }
    const body = (await response.json()) as { data?: SuggestedRule[] };
    set({ suggestions: body.data ?? [] });
  },

  acceptSuggestion: async (id: string) => {
    const prev = get().suggestions;
    // Optimistic remove
    set({ suggestions: prev.filter((s) => s.id !== id) });
    try {
      const response = await authedFetch(`/pantry/suggestions/${id}/accept`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Accept suggestion failed');
      }
      // Successful accept writes a new rule — reload rules to surface it.
      await get().loadRules();
    } catch (err) {
      set({ suggestions: prev });
      throw err;
    }
  },

  dismissSuggestion: async (id: string) => {
    const prev = get().suggestions;
    set({ suggestions: prev.filter((s) => s.id !== id) });
    try {
      const response = await authedFetch(`/pantry/suggestions/${id}/dismiss`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Dismiss suggestion failed');
      }
    } catch (err) {
      set({ suggestions: prev });
      throw err;
    }
  },

  // ── Phase 21-04: staples actions (primary data path) ────────────────────
  // Maintains two parallel projections:
  //   - staples: Set<string>  — O(1) membership for scan-accept threshold +
  //                              pantry-tab filter chip
  //   - stapleRows: StapleRow[] — display list for Settings → Staples (21-05)
  // Both update atomically. Load/mark/unmark are optimistic with rollback.

  setGroupingMode: (mode) => {
    set({ groupingMode: mode });
  },

  loadStaples: async () => {
    const response = await authedFetch('/pantry/staples', { method: 'GET' });
    if (!response.ok) {
      throw new Error('Failed to load staples');
    }
    const body = (await response.json()) as {
      data?: Array<{
        canonical_ingredient_id: string;
        canonical_ingredients?: { canonical_name?: string };
      }>;
    };
    const rows: StapleRow[] = (body.data ?? []).map((row) => ({
      canonical_ingredient_id: row.canonical_ingredient_id,
      canonical_name: row.canonical_ingredients?.canonical_name ?? '',
    }));
    set({
      stapleRows: rows,
      staples: new Set(rows.map((r) => r.canonical_ingredient_id)),
    });
  },

  markStaple: async (canonicalId: string, canonicalName?: string) => {
    const prevRows = get().stapleRows;
    const prevSet = get().staples;
    // Optimistic append (dedup on canonical_ingredient_id).
    if (!prevSet.has(canonicalId)) {
      const nextRows = [
        ...prevRows,
        {
          canonical_ingredient_id: canonicalId,
          canonical_name: canonicalName ?? '',
        },
      ];
      const nextSet = new Set(prevSet);
      nextSet.add(canonicalId);
      set({ stapleRows: nextRows, staples: nextSet });
    }
    try {
      const response = await authedFetch('/pantry/staples', {
        method: 'POST',
        body: JSON.stringify({ canonical_ingredient_id: canonicalId }),
      });
      if (!response.ok) {
        throw new Error('Mark staple failed');
      }
    } catch (err) {
      set({ stapleRows: prevRows, staples: prevSet });
      throw err;
    }
  },

  unmarkStaple: async (canonicalId: string) => {
    const prevRows = get().stapleRows;
    const prevSet = get().staples;
    const nextSet = new Set(prevSet);
    nextSet.delete(canonicalId);
    set({
      stapleRows: prevRows.filter(
        (s) => s.canonical_ingredient_id !== canonicalId,
      ),
      staples: nextSet,
    });
    try {
      const response = await authedFetch(`/pantry/staples/${canonicalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Unmark staple failed');
      }
    } catch (err) {
      set({ stapleRows: prevRows, staples: prevSet });
      throw err;
    }
  },

  isStaple: (canonicalId: string | null | undefined) => {
    if (!canonicalId) return false;
    return get().staples.has(canonicalId);
  },
    }),
    {
      name: 'dinnertime-pantry',
      storage: createJSONStorage(() => AsyncStorage),
      // Phase 21-04: staples (as array for JSON safety) + groupingMode are
      // persisted alongside items. Set<string> rehydrated by onRehydrateStorage.
      partialize: (state) => ({
        items: state.items,
        staples: Array.from(state.staples),
        groupingMode: state.groupingMode,
      }),
      // Pitfall 8 — bump to v2 so pre-21 v1 state hydrates through migrate.
      version: 2,
      migrate: (persisted, fromVersion) =>
        migratePantryPersistState(
          (persisted ?? {}) as PantryPersistedShape,
          fromVersion,
        ) as unknown as PantryState,
      onRehydrateStorage: () => (state) => {
        // Convert persisted `staples: string[]` back into Set<string> so the
        // runtime membership check (isStaple / resolveScanAcceptance) works.
        if (state) {
          const raw = state.staples as unknown;
          if (Array.isArray(raw)) {
            state.staples = new Set<string>(raw as string[]);
          } else if (!(raw instanceof Set)) {
            state.staples = new Set<string>();
          }
        }
      },
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
