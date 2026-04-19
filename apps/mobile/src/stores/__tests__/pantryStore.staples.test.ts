import { describe, it, expect, vi } from 'vitest';

// Mock supabase (same shape as other store tests) — staples tests only touch
// the threshold arithmetic + the persist migrate hook, not real network I/O.
const mockSupabase = vi.hoisted(() => {
  const chainable = () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.insert = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.delete = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.order = vi.fn(() => chain);
    chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    return chain;
  };
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: vi.fn((): any => chainable()),
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { access_token: 'test-token' } },
          error: null,
        }),
      ),
    },
  };
});

vi.mock('../../lib/supabase', () => ({ supabase: mockSupabase }));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  resolveScanAcceptance,
  STAPLE_THRESHOLD,
  DEFAULT_THRESHOLD,
  migratePantryPersistState,
  type PantryPersistedShape,
} from '../pantryStore';

describe('pantryStore — staple-aware acceptance threshold', () => {
  it('DEFAULT_THRESHOLD is 0.7 (Phase 14 convention)', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.7);
  });

  it('STAPLE_THRESHOLD is aggressive 0.3 (CONTEXT ROADMAP #5)', () => {
    expect(STAPLE_THRESHOLD).toBe(0.3);
  });

  it('accepts staple at 0.3 confidence (auto-accept below default threshold)', () => {
    const staples = new Set(['canon-A']);
    const accepted = resolveScanAcceptance({
      confidence: 0.3,
      canonicalId: 'canon-A',
      staples,
      probableDupe: false,
    });
    expect(accepted).toBe(true);
  });

  it('rejects non-staple at 0.3 confidence (below default 0.7 threshold)', () => {
    const staples = new Set(['canon-A']);
    const accepted = resolveScanAcceptance({
      confidence: 0.3,
      canonicalId: 'canon-B',
      staples,
      probableDupe: false,
    });
    expect(accepted).toBe(false);
  });

  it('still accepts non-staple at 0.75 confidence (above default threshold)', () => {
    const accepted = resolveScanAcceptance({
      confidence: 0.75,
      canonicalId: null,
      staples: new Set(),
      probableDupe: false,
    });
    expect(accepted).toBe(true);
  });

  it('rejects probable dupe regardless of confidence or staple status', () => {
    const staples = new Set(['canon-A']);
    const accepted = resolveScanAcceptance({
      confidence: 0.95,
      canonicalId: 'canon-A',
      staples,
      probableDupe: true,
    });
    expect(accepted).toBe(false);
  });

  it('null canonicalId never benefits from staple threshold', () => {
    const staples = new Set(['canon-A']);
    const accepted = resolveScanAcceptance({
      confidence: 0.5,
      canonicalId: null,
      staples,
      probableDupe: false,
    });
    // 0.5 < DEFAULT_THRESHOLD (0.7), no staple reprieve → rejected
    expect(accepted).toBe(false);
  });
});

describe('pantryStore — persist migration (Pitfall 8)', () => {
  it('migrates pre-21 state (v1 shape) by adding defaults for new fields', () => {
    const legacy = {
      items: [{ id: 'item-1', name: 'Milk' }],
    } as unknown as PantryPersistedShape;
    const migrated = migratePantryPersistState(legacy, 1);
    expect(migrated.items).toEqual([{ id: 'item-1', name: 'Milk' }]);
    expect(Array.isArray(migrated.staples)).toBe(true);
    expect(migrated.staples).toEqual([]);
    expect(migrated.groupingMode).toBe('location');
  });

  it('preserves existing staples + groupingMode when already present', () => {
    const existing: PantryPersistedShape = {
      items: [],
      staples: ['canon-1', 'canon-2'],
      groupingMode: 'category',
    };
    const migrated = migratePantryPersistState(existing, 2);
    expect(migrated.staples).toEqual(['canon-1', 'canon-2']);
    expect(migrated.groupingMode).toBe('category');
  });

  it('tolerates completely empty prior state', () => {
    const migrated = migratePantryPersistState({} as PantryPersistedShape, 0);
    expect(migrated.items).toEqual([]);
    expect(migrated.staples).toEqual([]);
    expect(migrated.groupingMode).toBe('location');
  });
});
