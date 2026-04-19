import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock canonicalResolver BEFORE importing pantry.ts — reconcileItems imports
// resolveCanonicalBatch at module load. Resolver is covered independently in 24-03.
vi.mock('../canonicalResolver.js', () => ({
  resolveCanonicalBatch: vi.fn(async (_supabase: unknown, names: string[]) => {
    // Deterministic canonical-id per normalized name so tests can reason about
    // identity tuples (canonical_id, source_location).
    const map = new Map();
    for (const name of names) {
      const norm = name.trim().toLowerCase();
      map.set(name, {
        canonicalId: `canon-${norm.replace(/\s+/g, '-')}`,
        matchType: 'exact_canonical',
        confidence: 1.0,
      });
    }
    return map;
  }),
}));

// Phase 21-03: reconcileItems integrates ruleEvaluator.loadUserLocationRules +
// applyLocationRules. Mock ruleEvaluator at module load so reconcile can pick it
// up without a real supabase-side user_location_rules fetch.
vi.mock('../ruleEvaluator.js', () => ({
  loadUserLocationRules: vi.fn(async () => ({ locationRules: [] })),
  applyLocationRules: vi.fn((_match, scanItem, _rules) => scanItem),
}));

import { reconcileItems, normalizeName } from '../pantry.js';
import type { ScanResult } from '../vision.js';
import type { Quantity } from '../units.js';

describe('normalizeName', () => {
  it('handles various inputs correctly', () => {
    expect(normalizeName('Cheddar Cheese ')).toBe('cheddar cheese');
    expect(normalizeName('  MILK  ')).toBe('milk');
    expect(normalizeName('Eggs')).toBe('eggs');
    expect(normalizeName(' whole wheat Bread')).toBe('whole wheat bread');
  });
});

/**
 * Thenable supabase chain mock (Phase 13 pattern). Each `from(table)` returns a
 * chain exposing select/insert/update/eq, all returning the chain so promises
 * can be awaited at any point. Internal state tracks per-table seeded rows +
 * captured insert/update payloads for assertions.
 */
interface TableFixtures {
  // rows already in the table, keyed by synthetic match predicate
  pantry_items: Array<Record<string, unknown>>;
  canonical_ingredients: Array<{ id: string; category: string }>;
  canonical_category_override: Array<{
    user_id: string;
    canonical_ingredient_id: string;
    category: string;
  }>;
}

interface Captured {
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
  updates: Array<{ table: string; payload: Record<string, unknown>; id: string }>;
}

function makeSupabase(fx: Partial<TableFixtures> = {}) {
  const state: TableFixtures = {
    pantry_items: fx.pantry_items ?? [],
    canonical_ingredients: fx.canonical_ingredients ?? [],
    canonical_category_override: fx.canonical_category_override ?? [],
  };
  const captured: Captured = { inserts: [], updates: [] };

  function fromBuilder(table: string) {
    // Per-select state: tracks pending filters (eq values) + IN filter.
    const filters: Record<string, unknown> = {};
    const inFilters: Record<string, unknown[]> = {};
    let mode: 'select' | 'insert' | 'update' = 'select';
    let updatePayload: Record<string, unknown> = {};

    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      }),
      in: vi.fn((col: string, vals: unknown[]) => {
        inFilters[col] = vals;
        return chain;
      }),
      insert: vi.fn((payload: Record<string, unknown>) => {
        mode = 'insert';
        captured.inserts.push({ table, payload });
        // pantry_items insert in reconcile does NOT call .select().single() in new
        // impl — just awaited. Still expose thenable + select chain.
        return chain;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        mode = 'update';
        updatePayload = payload;
        return chain;
      }),
      then: (resolve: (v: any) => void) => {
        if (mode === 'insert') {
          return resolve({ data: null, error: null });
        }
        if (mode === 'update') {
          // updates are finalized by a .eq('id', ...) before awaiting
          captured.updates.push({
            table,
            payload: updatePayload,
            id: filters.id as string,
          });
          return resolve({ data: null, error: null });
        }
        // SELECT: filter state → rows
        if (table === 'pantry_items') {
          const matches = state.pantry_items.filter((row) => {
            for (const [col, val] of Object.entries(filters)) {
              if (row[col] !== val) return false;
            }
            return true;
          });
          return resolve({ data: matches, error: null });
        }
        if (table === 'canonical_ingredients') {
          const ids = inFilters.id ?? [];
          const matches = state.canonical_ingredients.filter((r) =>
            ids.includes(r.id),
          );
          return resolve({ data: matches, error: null });
        }
        if (table === 'canonical_category_override') {
          const matches = state.canonical_category_override.filter((r) => {
            for (const [col, val] of Object.entries(filters)) {
              if ((r as Record<string, unknown>)[col] !== val) return false;
            }
            return true;
          });
          return resolve({ data: matches, error: null });
        }
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  }

  const supabase = {
    from: vi.fn((table: string) => fromBuilder(table)),
  };
  return { supabase, state, captured };
}

function scan(
  name: string,
  quantity: Quantity,
  source_location: 'fridge' | 'pantry' | 'freezer',
  overrides: Partial<ScanResult> = {},
): ScanResult {
  return {
    name,
    quantity,
    confidence: overrides.confidence ?? 0.9,
    fieldConfidence: overrides.fieldConfidence ?? {
      name: 0.9,
      quantity: 0.9,
      unit: 0.9,
      category: 0.9,
    },
    category: overrides.category ?? 'other',
    source_location,
    ...overrides,
  } as ScanResult;
}

describe('reconcileItems — canonical-identity dedup (24-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a new pantry row with canonical FK + quantity JSONB + category from canonical', async () => {
    const { supabase, captured } = makeSupabase({
      canonical_ingredients: [{ id: 'canon-olive-oil', category: 'condiment' }],
    });

    const result = await reconcileItems(supabase as any, 'user-1', [
      scan('olive oil', { value: 1, unit: 'cup', system: 'imperial-volume' }, 'pantry', {
        category: 'other',
      }),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.incompatibleUnits).toBe(0);

    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert).toBeTruthy();
    const payload = insert!.payload;
    expect(payload.profile_id).toBe('user-1');
    expect(payload.canonical_ingredient_id).toBe('canon-olive-oil');
    expect(payload.source_location).toBe('pantry');
    // REQ-10: uses canonical.category (condiment) even though scan said 'other'.
    expect(payload.category).toBe('condiment');
    // REQ-16: quantity is JSONB shape.
    expect(payload.quantity).toEqual({ value: 1, unit: 'cup', system: 'imperial-volume' });
    // Dual-write item_attributes.canonical_ingredient_id for legacy readers.
    const attrs = payload.item_attributes as Record<string, unknown>;
    expect(attrs.canonical_ingredient_id).toBe('canon-olive-oil');
    expect(attrs.source_location).toBe('pantry');
  });

  it('REQ-13: rescan same canonical + same location with compatible units SUMS quantity (UPDATE)', async () => {
    const { supabase, captured } = makeSupabase({
      pantry_items: [
        {
          id: 'row-1',
          profile_id: 'user-1',
          canonical_ingredient_id: 'canon-flour',
          source_location: 'pantry',
          quantity: { value: 1, unit: 'cup', system: 'imperial-volume' },
          item_attributes: { source_location: 'pantry', canonical_ingredient_id: 'canon-flour' },
          last_seen_at: '2026-04-10T00:00:00Z',
        },
      ],
      canonical_ingredients: [{ id: 'canon-flour', category: 'grain' }],
    });

    const result = await reconcileItems(supabase as any, 'user-1', [
      scan('flour', { value: 6, unit: 'tbsp', system: 'imperial-volume' }, 'pantry'),
    ]);

    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(0);
    expect(captured.inserts.filter((i) => i.table === 'pantry_items')).toHaveLength(0);

    const update = captured.updates.find((u) => u.table === 'pantry_items');
    expect(update).toBeTruthy();
    expect(update!.id).toBe('row-1');
    const merged = update!.payload.quantity as Quantity;
    // 1 cup + 6 tbsp = 1.375 cup (cup=48 tsp, tbsp=3 tsp; 48+18=66 tsp → 66/48 = 1.375 cup)
    expect(merged.unit).toBe('cup');
    expect(merged.system).toBe('imperial-volume');
    expect(merged.value).toBeCloseTo(1.375, 3);
    expect(update!.payload.last_seen_at).toBeTypeOf('string');
  });

  it('REQ-13: rescan same canonical + DIFFERENT location inserts a NEW row', async () => {
    const { supabase, captured } = makeSupabase({
      pantry_items: [
        {
          id: 'row-1',
          profile_id: 'user-1',
          canonical_ingredient_id: 'canon-salt',
          source_location: 'pantry',
          quantity: { value: 1, unit: 'piece', system: 'count' },
          item_attributes: {},
        },
      ],
      canonical_ingredients: [{ id: 'canon-salt', category: 'other' }],
    });

    const result = await reconcileItems(supabase as any, 'user-1', [
      scan('salt', { value: 1, unit: 'piece', system: 'count' }, 'fridge'),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert!.payload.source_location).toBe('fridge');
    expect(insert!.payload.canonical_ingredient_id).toBe('canon-salt');
  });

  it('REQ-13: rescan DIFFERENT canonical + same location inserts a NEW row', async () => {
    const { supabase, captured } = makeSupabase({
      pantry_items: [
        {
          id: 'row-1',
          profile_id: 'user-1',
          canonical_ingredient_id: 'canon-flour',
          source_location: 'pantry',
          quantity: { value: 1, unit: 'cup', system: 'imperial-volume' },
          item_attributes: {},
        },
      ],
      canonical_ingredients: [
        { id: 'canon-flour', category: 'grain' },
        { id: 'canon-sugar', category: 'other' },
      ],
    });

    const result = await reconcileItems(supabase as any, 'user-1', [
      scan('sugar', { value: 2, unit: 'cup', system: 'imperial-volume' }, 'pantry'),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert!.payload.canonical_ingredient_id).toBe('canon-sugar');
  });

  it('REQ-11: canonical_category_override takes precedence over canonical.category', async () => {
    const { supabase, captured } = makeSupabase({
      canonical_ingredients: [{ id: 'canon-olive-oil', category: 'condiment' }],
      canonical_category_override: [
        { user_id: 'user-1', canonical_ingredient_id: 'canon-olive-oil', category: 'pantry-staple' } as any,
      ],
    });

    await reconcileItems(supabase as any, 'user-1', [
      scan('olive oil', { value: 1, unit: 'bottle', system: 'custom' }, 'pantry'),
    ]);

    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert!.payload.category).toBe('pantry-staple');
  });

  it('REQ-18: compatible-unit aggregation (tbsp + tsp → tbsp unit preserved, summed in base)', async () => {
    const { supabase, captured } = makeSupabase({
      pantry_items: [
        {
          id: 'row-1',
          profile_id: 'user-1',
          canonical_ingredient_id: 'canon-vanilla',
          source_location: 'pantry',
          quantity: { value: 2, unit: 'tbsp', system: 'imperial-volume' },
          item_attributes: {},
        },
      ],
      canonical_ingredients: [{ id: 'canon-vanilla', category: 'condiment' }],
    });

    await reconcileItems(supabase as any, 'user-1', [
      scan('vanilla', { value: 3, unit: 'tsp', system: 'imperial-volume' }, 'pantry'),
    ]);

    const update = captured.updates.find((u) => u.table === 'pantry_items');
    expect(update).toBeTruthy();
    const merged = update!.payload.quantity as Quantity;
    // 2 tbsp = 6 tsp + 3 tsp = 9 tsp → expressed in tbsp (base of a) = 3 tbsp
    expect(merged.unit).toBe('tbsp');
    expect(merged.value).toBeCloseTo(3, 3);
  });

  it('Incompatible units inserts a SECOND row with item_attributes.reconcile_hint', async () => {
    const { supabase, captured } = makeSupabase({
      pantry_items: [
        {
          id: 'row-1',
          profile_id: 'user-1',
          canonical_ingredient_id: 'canon-sugar',
          source_location: 'pantry',
          quantity: { value: 1, unit: 'cup', system: 'imperial-volume' },
          item_attributes: {},
        },
      ],
      canonical_ingredients: [{ id: 'canon-sugar', category: 'other' }],
    });

    const result = await reconcileItems(supabase as any, 'user-1', [
      scan('sugar', { value: 1, unit: 'lb', system: 'imperial-weight' }, 'pantry'),
    ]);

    expect(result.incompatibleUnits).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);

    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert).toBeTruthy();
    const attrs = insert!.payload.item_attributes as Record<string, unknown>;
    expect(attrs.reconcile_hint).toBe('incompatible_units');
    expect(insert!.payload.canonical_ingredient_id).toBe('canon-sugar');
    expect(insert!.payload.source_location).toBe('pantry');
  });

  it('falls back to category="other" when neither override nor canonical row provides a category', async () => {
    const { supabase, captured } = makeSupabase({
      // canonical lookup returns nothing (unusual but defensive)
      canonical_ingredients: [],
    });

    await reconcileItems(supabase as any, 'user-1', [
      scan('mystery', { value: 1, unit: 'piece', system: 'count' }, 'pantry'),
    ]);

    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert!.payload.category).toBe('other');
  });

  it('returns counts on an empty input without querying', async () => {
    const { supabase, captured } = makeSupabase();
    const result = await reconcileItems(supabase as any, 'user-1', []);
    expect(result).toEqual({
      inserted: 0,
      updated: 0,
      incompatibleUnits: 0,
      canonicalIds: [],
    });
    expect(captured.inserts).toHaveLength(0);
    expect(captured.updates).toHaveLength(0);
  });

  it('Phase 21-03 W2: returns deduped canonicalIds from resolved items', async () => {
    const { supabase } = makeSupabase({
      canonical_ingredients: [
        { id: 'canon-milk', category: 'dairy' },
        { id: 'canon-eggs', category: 'protein' },
      ],
    });

    // 3 items; two resolve to canon-milk (duplicate), one to canon-eggs.
    const result = await reconcileItems(supabase as any, 'user-1', [
      scan('milk', { value: 1, unit: 'gallon', system: 'custom' }, 'fridge'),
      scan('eggs', { value: 12, unit: 'piece', system: 'count' }, 'fridge'),
      scan('milk', { value: 1, unit: 'gallon', system: 'custom' }, 'fridge'),
    ]);

    expect(result.canonicalIds).toBeDefined();
    // Deduped: 2 unique canonicals despite 3 items.
    expect(result.canonicalIds.length).toBe(2);
    expect(new Set(result.canonicalIds).size).toBe(2);
    expect(result.canonicalIds).toEqual(
      expect.arrayContaining(['canon-milk', 'canon-eggs']),
    );
  });

  it('uses normalized item name on INSERT (lowercase + trim)', async () => {
    const { supabase, captured } = makeSupabase({
      canonical_ingredients: [{ id: 'canon-cheddar-cheese', category: 'dairy' }],
    });

    await reconcileItems(supabase as any, 'user-1', [
      scan('  Cheddar Cheese  ', { value: 1, unit: 'piece', system: 'count' }, 'fridge'),
    ]);

    const insert = captured.inserts.find((i) => i.table === 'pantry_items');
    expect(insert!.payload.normalized_name).toBe('cheddar cheese');
    // Name preserved trimmed (not lowercased) for display.
    expect(insert!.payload.name).toBe('Cheddar Cheese');
  });
});
