import { describe, it, expect } from 'vitest';
import { resolvePantryItemCardWrapperClasses } from '../pantryItemCardHelpers';

/**
 * Phase 21-04 stale treatment — 21-CONTEXT ROADMAP #2.
 *
 * Tests live on the pure helper (resolvePantryItemCardWrapperClasses) rather
 * than the component itself so they can run under vitest's node env without
 * pulling React's renderer / hooks machinery. The component delegates to this
 * helper 1:1 so class-contract coverage here matches on-screen output.
 */

describe('PantryItemCard — stale treatment (Phase 21 CONTEXT ROADMAP #2)', () => {
  it('applies dashed border + opacity-50 when effectiveConfidence < 0.5', () => {
    const cls = resolvePantryItemCardWrapperClasses({
      effectiveConfidence: 0.3,
      isUncertain: false,
    });
    expect(cls).toContain('border-dashed');
    expect(cls).toContain('opacity-50');
    expect(cls).toContain('rounded-xl');
    // Base layout wrapper classes preserved
    expect(cls).toContain('mb-2');
    expect(cls).toContain('mx-4');
  });

  it('does NOT apply dashed border when effectiveConfidence is high (0.9)', () => {
    const cls = resolvePantryItemCardWrapperClasses({
      effectiveConfidence: 0.9,
      isUncertain: false,
    });
    expect(cls).not.toContain('border-dashed');
    expect(cls).not.toContain('opacity-50');
  });

  it('boundary: effectiveConfidence === 0.5 exactly is NOT stale (strict <)', () => {
    const cls = resolvePantryItemCardWrapperClasses({
      effectiveConfidence: 0.5,
      isUncertain: false,
    });
    expect(cls).not.toContain('border-dashed');
  });

  it('stale (<0.5) takes precedence over isUncertain', () => {
    const cls = resolvePantryItemCardWrapperClasses({
      effectiveConfidence: 0.3,
      isUncertain: true,
    });
    expect(cls).toContain('border-dashed');
    expect(cls).toContain('opacity-50');
    // Should NOT ALSO get the legacy opacity-60 class
    expect(cls).not.toContain('opacity-60');
  });

  it('isUncertain without low confidence still renders opacity-60 (legacy 7-day signal)', () => {
    const cls = resolvePantryItemCardWrapperClasses({
      effectiveConfidence: 0.9,
      isUncertain: true,
    });
    expect(cls).toContain('opacity-60');
    expect(cls).not.toContain('border-dashed');
  });

  it('fresh item (high confidence, not uncertain) has no opacity or border modifier', () => {
    const cls = resolvePantryItemCardWrapperClasses({
      effectiveConfidence: 0.9,
      isUncertain: false,
    });
    // Only base wrapper classes, nothing else
    expect(cls.trim()).toBe('mb-2 mx-4');
  });
});
