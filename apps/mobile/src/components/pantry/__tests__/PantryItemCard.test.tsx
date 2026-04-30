import { describe, it, expect } from 'vitest';
import {
  resolvePantryItemCardWrapperClasses,
  deriveTrailingChip,
  isItemInShoppingCart,
} from '../pantryItemCardHelpers';
import type { EnrichedPantryItem } from '../../../hooks/usePantryItems';

// Minimal builder — only the fields deriveTrailingChip + the chip-priority
// matrix actually read. Everything else is set to safe defaults so the test
// stays focused on the chip-selection contract.
const makeItem = (
  overrides: Partial<EnrichedPantryItem> = {},
): EnrichedPantryItem =>
  ({
    id: 'p-1',
    name: 'Sriracha',
    last_seen_at: new Date().toISOString(),
    effectiveConfidence: 0.9,
    isUncertain: false,
    ...overrides,
  }) as unknown as EnrichedPantryItem;

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

/**
 * Bug 2 (pantry-trifecta) — "In cart" trailing chip + reactive shopping list
 * subscription.
 *
 * The chip selection matrix has three signals (uncertain, low, in-cart). We
 * only render one chip at a time, and the priority order is:
 *
 *   uncertain (destructive) > low confidence (warning) > in-cart (success)
 *
 * Higher-priority signals are *warnings* — they tell the user the row is
 * unreliable. "In cart" is reassurance and must not hide a warning.
 */
describe('deriveTrailingChip', () => {
  it('returns undefined for a fresh item not in cart', () => {
    expect(deriveTrailingChip(makeItem(), false)).toBeUndefined();
  });

  it('returns "In cart" success chip when isInCart and no warning signals', () => {
    const chip = deriveTrailingChip(makeItem(), true);
    expect(chip).toEqual({ label: 'In cart', tone: 'success' });
  });

  it('uncertain chip outranks "In cart" — destructive warning wins', () => {
    const stale = makeItem({
      isUncertain: true,
      last_seen_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const chip = deriveTrailingChip(stale, true);
    expect(chip?.tone).toBe('destructive');
    expect(chip?.label).toBe('10d');
  });

  it('low confidence chip outranks "In cart" — warning wins over success', () => {
    const lowConf = makeItem({ effectiveConfidence: 0.3, isUncertain: false });
    const chip = deriveTrailingChip(lowConf, true);
    expect(chip).toEqual({ label: 'Low', tone: 'warning' });
  });
});

describe('isItemInShoppingCart', () => {
  it('matches case-insensitively', () => {
    expect(isItemInShoppingCart('Sriracha', ['SRIRACHA'])).toBe(true);
    expect(isItemInShoppingCart('SRIRACHA', ['sriracha'])).toBe(true);
  });

  it('matches bidirectionally — cart item contains pantry name', () => {
    // Pantry has 'rice'; cart has 'Brown Rice' — should match.
    expect(isItemInShoppingCart('rice', ['Brown Rice'])).toBe(true);
  });

  it('matches bidirectionally — pantry name contains cart item', () => {
    // Pantry has 'Cheddar Cheese'; cart has 'cheese' — should match.
    expect(isItemInShoppingCart('Cheddar Cheese', ['cheese'])).toBe(true);
  });

  it('returns false when no overlap', () => {
    expect(isItemInShoppingCart('Sriracha', ['butter', 'eggs'])).toBe(false);
  });

  it('returns false for empty inputs', () => {
    expect(isItemInShoppingCart('', ['butter'])).toBe(false);
    expect(isItemInShoppingCart('   ', ['butter'])).toBe(false);
    expect(isItemInShoppingCart('butter', [])).toBe(false);
    expect(isItemInShoppingCart('butter', ['', '   '])).toBe(false);
  });
});
