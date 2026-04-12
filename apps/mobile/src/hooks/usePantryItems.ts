import { useMemo } from 'react';
import { usePantryStore } from '../stores/pantryStore';
import type { PantryItem, SourceLocation } from '../types/pantry';

/**
 * Calculate effective confidence with time-based decay.
 *
 * - Items seen within the last 7 days retain their original confidence.
 * - After 7 days, confidence decays linearly at 0.05 per day.
 * - Effective confidence never drops below 0.1.
 */
export function getEffectiveConfidence(item: PantryItem): number {
  const lastSeen = new Date(item.last_seen_at).getTime();
  const now = Date.now();
  const daysSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60 * 24);

  if (daysSinceLastSeen <= 7) {
    return item.confidence;
  }

  const decayFactor = Math.max(0.1, 1 - (daysSinceLastSeen - 7) * 0.05);
  const effective = item.confidence * decayFactor;

  // Floor at 0.1 regardless of calculation
  return Math.max(0.1, effective);
}

export interface EnrichedPantryItem extends PantryItem {
  effectiveConfidence: number;
  isUncertain: boolean;
}

interface UsePantryItemsOptions {
  location?: SourceLocation;
}

/**
 * Hook that returns pantry items enriched with confidence decay calculations.
 *
 * Items are sorted: available (by category) first, then uncertain items.
 * Optionally filters by source location.
 */
export function usePantryItems(
  options?: UsePantryItemsOptions
): EnrichedPantryItem[] {
  const items = usePantryStore((state) => state.items);

  return useMemo(() => {
    let filtered = items;

    // Filter by location if provided
    if (options?.location) {
      filtered = filtered.filter(
        (item) => item.source_location === options.location
      );
    }

    // Enrich with decay calculations
    const enriched: EnrichedPantryItem[] = filtered.map((item) => {
      const effectiveConfidence = getEffectiveConfidence(item);
      return {
        ...item,
        effectiveConfidence,
        isUncertain: effectiveConfidence < 0.5,
      };
    });

    // Sort: available (non-uncertain) first grouped by category, then uncertain
    return enriched.sort((a, b) => {
      // Uncertain items go to the end
      if (a.isUncertain !== b.isUncertain) {
        return a.isUncertain ? 1 : -1;
      }
      // Within same uncertainty group, sort by category
      return a.category.localeCompare(b.category);
    });
  }, [items, options?.location]);
}
