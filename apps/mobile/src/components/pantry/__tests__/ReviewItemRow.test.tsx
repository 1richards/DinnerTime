import { describe, it, expect } from 'vitest';
import {
  resolveFieldClass,
  resolveFieldAccessibilityHint,
  LOW_CONFIDENCE_THRESHOLD,
} from '../reviewItemRowHelpers';

/**
 * Phase 24-06: unit coverage for the pure helper that maps a FieldConfidence
 * object to a low-confidence className. Mirrors the Phase 19-03 pattern of
 * extracting className logic into a pure function so tests can assert
 * contracts without a React renderer.
 *
 * Threshold is strict < 0.7 (exactly 0.7 is NOT low-confidence).
 */
describe('ReviewItemRow — resolveFieldClass (24a inline low-confidence)', () => {
  it('returns the dashed amber low-confidence class when field confidence < 0.7', () => {
    const cls = resolveFieldClass(
      { name: 0.5, quantity: 0.9, unit: 0.9, category: 0.9 },
      'name',
    );
    expect(cls).toContain('border-dashed');
    expect(cls).toContain('amber');
  });

  it('returns an empty class when field confidence >= 0.7', () => {
    const cls = resolveFieldClass(
      { name: 0.95, quantity: 0.9, unit: 0.9, category: 0.9 },
      'name',
    );
    expect(cls).toBe('');
  });

  it('returns an empty class when fieldConfidence is undefined (legacy rows)', () => {
    expect(resolveFieldClass(undefined, 'name')).toBe('');
  });

  it('boundary exactly 0.7 is NOT low confidence (strict <)', () => {
    expect(
      resolveFieldClass(
        { name: 0.7, quantity: 0.9, unit: 0.9, category: 0.9 },
        'name',
      ),
    ).toBe('');
  });

  it('boundary just below 0.7 IS low confidence', () => {
    expect(
      resolveFieldClass(
        { name: 0.6999, quantity: 0.9, unit: 0.9, category: 0.9 },
        'name',
      ),
    ).toContain('border-dashed');
  });

  it('handles each field independently (quantity low, name high)', () => {
    const fc = { name: 0.95, quantity: 0.4, unit: 0.9, category: 0.9 };
    expect(resolveFieldClass(fc, 'name')).toBe('');
    expect(resolveFieldClass(fc, 'quantity')).toContain('border-dashed');
    expect(resolveFieldClass(fc, 'unit')).toBe('');
    expect(resolveFieldClass(fc, 'category')).toBe('');
  });

  it('returns empty class when the requested field value is not a number (defensive)', () => {
    // Defensive: if a malformed shape slips through, treat as high-confidence
    // rather than painting a dashed underline on every render.
    const bad = { name: 'oops' as unknown as number, quantity: 0.9, unit: 0.9, category: 0.9 };
    expect(resolveFieldClass(bad, 'name')).toBe('');
  });

  it('exports a documented 0.7 threshold constant', () => {
    expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.7);
  });
});

describe('ReviewItemRow — resolveFieldAccessibilityHint', () => {
  it('returns "Low confidence — tap to edit" for low-confidence fields', () => {
    expect(
      resolveFieldAccessibilityHint(
        { name: 0.5, quantity: 0.9, unit: 0.9, category: 0.9 },
        'name',
      ),
    ).toBe('Low confidence — tap to edit');
  });

  it('returns undefined for high-confidence fields so VoiceOver stays quiet', () => {
    expect(
      resolveFieldAccessibilityHint(
        { name: 0.95, quantity: 0.9, unit: 0.9, category: 0.9 },
        'name',
      ),
    ).toBeUndefined();
  });

  it('returns undefined when fieldConfidence is missing (legacy rows)', () => {
    expect(resolveFieldAccessibilityHint(undefined, 'name')).toBeUndefined();
  });
});
