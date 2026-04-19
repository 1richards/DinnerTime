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

export interface PantryItem {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: FoodCategory;
  source_location: SourceLocation;
  confidence: number;
  status: PantryItemStatus;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

/** AI scan output before user review */
export interface ScanResult {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
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
