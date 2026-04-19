import type { SymbolViewProps } from 'expo-symbols';
import type { SourceLocation } from '../../types/pantry';

/**
 * SF Symbol glyph names per source_location.
 *
 * Phase 15 decision inherited here: 'snowflake' is used for BOTH fridge and
 * freezer because the 'refrigerator' SF Symbol is iOS 17+ only. 'archivebox'
 * covers pantry.
 *
 * Consumers: `LocationChip` (review-screen edit affordance) and
 * `PantryItemCard` (pantry tab display). Keep as a single source of truth —
 * do not duplicate.
 */
export const LOCATION_SYMBOLS: Record<SourceLocation, SymbolViewProps['name']> = {
  fridge: 'snowflake',
  pantry: 'archivebox',
  freezer: 'snowflake',
};

/** Fallback glyph used when a location is missing/unknown (defensive). */
export const FALLBACK_LOCATION_SYMBOL: SymbolViewProps['name'] = 'shippingbox';

/** Human-readable labels for each source_location. */
export const LOCATION_LABELS: Record<SourceLocation, string> = {
  fridge: 'Fridge',
  pantry: 'Pantry',
  freezer: 'Freezer',
};
