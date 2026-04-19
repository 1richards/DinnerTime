import type { FieldConfidence } from '../../types/pantry';

/**
 * Phase 24-06: any field whose AI confidence is strictly below this threshold
 * gets the inline dashed-amber "low confidence" treatment on the review row.
 * Chosen per 24a-RESEARCH § 12: mirrors the UI threshold used for ReviewItem
 * accepted default (< 0.7 defaults to un-checked).
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Phase 24-06 — pure helper used by ReviewItemRow to render a dashed amber
 * underline when the AI's per-field confidence is below 0.7.
 *
 * Returns the NativeWind utility string for the low-confidence treatment, or
 * an empty string when the field is high-confidence (or when fieldConfidence
 * is missing altogether — legacy pre-24a responses / manual-adds).
 *
 * Extracted into its own module (mirrors Phase 19-03 `itemRowHelpers`) so
 * tests can run under the vitest node env without pulling in ReviewItemRow's
 * React Native / expo-symbols imports.
 */
export function resolveFieldClass(
  fieldConfidence: FieldConfidence | undefined,
  field: keyof FieldConfidence,
): string {
  if (!fieldConfidence) return '';
  const value = fieldConfidence[field];
  // Defensive: if a malformed shape sneaks through (non-number), treat as
  // high-confidence rather than paint dashed-underline on every row.
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (value >= LOW_CONFIDENCE_THRESHOLD) return '';
  return 'border-b border-dashed border-amber-400';
}

/**
 * Accessibility hint emitted when a field is flagged low-confidence. Keeps
 * VoiceOver silent on high-confidence rows (returning undefined so the prop
 * is omitted entirely).
 */
export function resolveFieldAccessibilityHint(
  fieldConfidence: FieldConfidence | undefined,
  field: keyof FieldConfidence,
): string | undefined {
  if (!fieldConfidence) return undefined;
  const value = fieldConfidence[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value >= LOW_CONFIDENCE_THRESHOLD) return undefined;
  return 'Low confidence — tap to edit';
}
