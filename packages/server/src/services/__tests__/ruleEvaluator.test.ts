import { describe, expect, it, vi } from 'vitest';
import {
  applyLocationRules,
  loadUserLocationRules,
  type UserRules,
  type UserLocationRule,
} from '../ruleEvaluator.js';
import type { CanonicalMatch } from '../canonicalResolver.js';
import type { ScanResult } from '../vision.js';

/**
 * Minimal ScanResult fixture — shape mirrors packages/server/src/services/vision.ts.
 * Phase 24-04 nested Quantity; we use any-cast on test-only fixtures because
 * ruleEvaluator.applyLocationRules never reads quantity/fieldConfidence — it only
 * spreads and overrides source_location.
 */
function makeScanItem(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    name: 'milk',
    quantity: { value: 1, unit: 'gallon', system: 'imperial-volume' },
    confidence: 0.9,
    fieldConfidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 },
    category: 'dairy',
    source_location: 'pantry',
    ...overrides,
  } as ScanResult;
}

function makeMatch(canonicalId: string): CanonicalMatch {
  return {
    canonicalId,
    matchType: 'exact_canonical',
    confidence: 1.0,
  };
}

describe('applyLocationRules — pass-through', () => {
  it('returns scanItem unchanged when rules.locationRules is empty', () => {
    const scanItem = makeScanItem({ source_location: 'pantry' });
    const match = makeMatch('milk-uuid');
    const rules: UserRules = { locationRules: [] };
    const result = applyLocationRules(match, scanItem, rules);
    expect(result).toBe(scanItem); // identity preserved — no spread on empty path
    expect(result.source_location).toBe('pantry');
  });

  it('returns scanItem unchanged when no rule targets the canonical id', () => {
    const scanItem = makeScanItem({ source_location: 'pantry' });
    const match = makeMatch('milk-uuid');
    const rules: UserRules = {
      locationRules: [
        { canonical_ingredient_id: 'eggs-uuid', source_location: 'fridge', precedence: 0 },
        { canonical_ingredient_id: 'rice-uuid', source_location: 'pantry', precedence: 1 },
      ],
    };
    const result = applyLocationRules(match, scanItem, rules);
    expect(result).toBe(scanItem);
    expect(result.source_location).toBe('pantry');
  });
});

describe('applyLocationRules — single match', () => {
  it('returns a new scanItem with source_location overridden when one rule matches', () => {
    const scanItem = makeScanItem({ source_location: 'pantry' });
    const match = makeMatch('milk-uuid');
    const rules: UserRules = {
      locationRules: [
        { canonical_ingredient_id: 'milk-uuid', source_location: 'fridge', precedence: 0 },
      ],
    };
    const result = applyLocationRules(match, scanItem, rules);
    expect(result).not.toBe(scanItem); // new object
    expect(result.source_location).toBe('fridge');
    expect(result.name).toBe(scanItem.name); // other fields untouched
    expect(result.quantity).toBe(scanItem.quantity);
  });
});

describe('applyLocationRules — precedence first-match-wins', () => {
  it('picks the rule with the lowest precedence when 3 rules target the same canonical and arrive in arbitrary order', () => {
    const scanItem = makeScanItem({ source_location: 'pantry' });
    const match = makeMatch('milk-uuid');
    // Arrive deliberately in a shuffled order — evaluator must sort ascending before Array.find.
    const rules: UserRules = {
      locationRules: [
        { canonical_ingredient_id: 'milk-uuid', source_location: 'freezer', precedence: 2 },
        { canonical_ingredient_id: 'milk-uuid', source_location: 'fridge', precedence: 0 },
        { canonical_ingredient_id: 'milk-uuid', source_location: 'pantry', precedence: 1 },
      ],
    };
    const result = applyLocationRules(match, scanItem, rules);
    expect(result.source_location).toBe('fridge'); // precedence=0 wins
  });
});

describe('loadUserLocationRules — supabase fetch', () => {
  it('selects precedence-ordered rows for the user and returns UserRules', async () => {
    const userId = 'user-abc';
    const seeded: UserLocationRule[] = [
      { canonical_ingredient_id: 'milk-uuid', source_location: 'fridge', precedence: 0 },
      { canonical_ingredient_id: 'eggs-uuid', source_location: 'fridge', precedence: 1 },
    ];

    const eqFn = vi.fn();
    const orderFn = vi.fn();
    const selectFn = vi.fn();

    const chain = {
      select: (cols: string) => {
        selectFn(cols);
        return {
          eq: (col: string, val: string) => {
            eqFn(col, val);
            return {
              order: (col2: string, opts: { ascending: boolean }) => {
                orderFn(col2, opts);
                return {
                  then: (
                    resolve: (r: { data: unknown; error: null }) => unknown,
                  ) => resolve({ data: seeded, error: null }),
                };
              },
            };
          },
        };
      },
    };

    const fromFn = vi.fn((table: string) => {
      expect(table).toBe('user_location_rules');
      return chain;
    });

    const supa = { from: fromFn } as unknown as Parameters<
      typeof loadUserLocationRules
    >[0];

    const result = await loadUserLocationRules(supa, userId);

    expect(fromFn).toHaveBeenCalledWith('user_location_rules');
    expect(selectFn).toHaveBeenCalledWith(
      'canonical_ingredient_id, source_location, precedence',
    );
    expect(eqFn).toHaveBeenCalledWith('user_id', userId);
    expect(orderFn).toHaveBeenCalledWith('precedence', { ascending: true });
    expect(result).toEqual({ locationRules: seeded });
  });

  it('returns empty rules on supabase error (no throw)', async () => {
    const chain = {
      select: () => ({
        eq: () => ({
          order: () => ({
            then: (
              resolve: (r: { data: unknown; error: unknown }) => unknown,
            ) =>
              resolve({ data: null, error: { message: 'boom' } }),
          }),
        }),
      }),
    };
    const supa = {
      from: vi.fn(() => chain),
    } as unknown as Parameters<typeof loadUserLocationRules>[0];

    const result = await loadUserLocationRules(supa, 'user-abc');
    expect(result).toEqual({ locationRules: [] });
  });
});
