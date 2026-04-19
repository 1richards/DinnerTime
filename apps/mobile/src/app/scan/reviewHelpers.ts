import type { ReviewItem } from '../../types/pantry';
import type { OverrideEventPayload } from '../../lib/logOverrideEvent';

/**
 * Extract override-event payloads from the current review items.
 *
 * A review item is considered an override when ALL of the following hold:
 *   - userEdited === true (user actively touched this item),
 *   - aiLocation is set (AI classified it originally — excludes manual-adds),
 *   - source_location !== aiLocation (the edit actually changed location).
 *
 * item_name is normalized to lowercase + trimmed to match the server's
 * canonical key (Phase 21 aggregates by normalized name).
 */
export function deriveOverrideEvents(items: ReviewItem[]): OverrideEventPayload[] {
  return items
    .filter(
      (i) =>
        i.userEdited &&
        i.aiLocation !== undefined &&
        i.source_location !== i.aiLocation,
    )
    .map((i) => ({
      item_name: i.name.trim().toLowerCase(),
      ai_location: i.aiLocation!,
      user_location: i.source_location,
    }));
}
