export type FoodCategory =
  | 'produce'
  | 'dairy'
  | 'protein'
  | 'grain'
  | 'condiment'
  | 'beverage'
  | 'frozen'
  | 'snack'
  | 'other';

export type SourceLocation = 'fridge' | 'pantry' | 'freezer';

export type PantryItemStatus = 'available' | 'used' | 'depleted';

/**
 * Phase 24a — mirror of server QuantitySystem (packages/server/src/services/units.ts).
 * Kept as an independently-evolving mirror (same pattern established for
 * ScanResult in Phase 3 and progression types in Phase 10).
 */
export type QuantitySystem =
  | 'count'
  | 'imperial-weight'
  | 'imperial-volume'
  | 'metric-weight'
  | 'metric-volume'
  | 'custom';

/**
 * Phase 24a — mirror of server Quantity (units.ts).
 * Shape: { value, unit, system }.
 */
export interface Quantity {
  value: number;
  unit: string;
  system: QuantitySystem;
}

/**
 * Phase 24a — per-field AI confidence (mirror of server FieldConfidence in
 * vision.ts). Every field is a number in [0, 1]; missing per-field values are
 * defaulted to 0.5 by the server normalizer so `undefined` only appears when
 * the whole object is missing (legacy pre-24a shapes).
 */
export interface FieldConfidence {
  name: number;
  quantity: number;
  unit: number;
  category: number;
}

/**
 * Default Quantity used when a pantry row has null/missing quantity (e.g.
 * pre-Phase 24a legacy rows). Matches the migration 00015 column default so
 * display code never has to branch on null.
 */
export const DEFAULT_QUANTITY: Quantity = {
  value: 1,
  unit: 'piece',
  system: 'count',
};

/**
 * Render a Quantity as a short human-readable string: "2 cup", "1 piece".
 * Gracefully handles null/undefined/legacy-number inputs by falling back to
 * DEFAULT_QUANTITY shape. Trailing unit is omitted for bare 'piece' to keep
 * subtitle density tight on pantry cards ("1" instead of "1 piece").
 */
export function formatQuantity(
  q: Quantity | number | null | undefined,
  legacyUnit?: string,
): string {
  if (q == null) {
    return String(DEFAULT_QUANTITY.value);
  }
  if (typeof q === 'number') {
    // Legacy flat shape — used by pre-24a callers that still type quantity
    // as number. Honor a paired legacy `unit` string when provided.
    const trimmedUnit = legacyUnit?.trim();
    return trimmedUnit && trimmedUnit !== 'piece'
      ? `${q} ${trimmedUnit}`
      : String(q);
  }
  const value = typeof q.value === 'number' && Number.isFinite(q.value) ? q.value : 1;
  const unit = typeof q.unit === 'string' ? q.unit.trim() : '';
  if (!unit || unit === 'piece') return String(value);
  return `${value} ${unit}`;
}

export interface PantryItem {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  /**
   * Phase 24a — DB column is JSONB after migration 00015 ({value, unit, system}).
   * Mobile defensively accepts legacy flat numbers for pre-migration test data
   * that may still be on the device via Zustand persist. Use `formatQuantity`
   * to render.
   */
  quantity: Quantity | number;
  /**
   * Phase 24a — unit now nested inside Quantity. Kept as optional legacy field
   * for any row persisted under the Phase 3 shape. New scans never write this.
   */
  unit?: string;
  category: FoodCategory;
  source_location: SourceLocation;
  confidence: number;
  status: PantryItemStatus;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
  /** Phase 24-01 nullable FK. Legacy pre-24a rows have NULL (REQ-23). */
  canonical_ingredient_id?: string | null;
}

/**
 * Response body of POST /pantry/confirm after 24-05. Replaces the legacy
 * `{ data: PantryItem[] }` shape. Mobile reloads the pantry from Supabase
 * directly after a successful confirm to pick up the new rows.
 */
export interface ReconcileResult {
  inserted: number;
  updated: number;
  incompatibleUnits: number;
}

/** AI scan output before user review (24-04 shape). */
export interface ScanResult {
  name: string;
  /** Phase 24a — nested quantity replaces legacy flat quantity + unit. */
  quantity: Quantity;
  /** Overall/legacy confidence preserved as min(fieldConfidence.*) for
   *  Phase 14's 0.7 threshold gate. */
  confidence: number;
  /** Phase 24a — per-field AI confidence. Powers inline < 0.7 UI hints. */
  fieldConfidence: FieldConfidence;
  category: FoodCategory;
  /** Per-item location returned by the Phase 18 server vision pipeline. */
  source_location: SourceLocation;
}

/** ScanResult with user review state */
export interface ReviewItem extends ScanResult {
  id: string;
  accepted: boolean;
  userEdited: boolean;
  /** Flagged when item name matches something already in the user's pantry.
   * When true, defaults to accepted=false so the user must opt-in to re-adding. */
  probableDupe?: boolean;
  /**
   * Original AI-predicted source_location, preserved even after the user
   * overrides `source_location`. Used by deriveOverrideEvents to detect
   * corrections for /override-events telemetry.
   */
  aiLocation?: SourceLocation;
}
