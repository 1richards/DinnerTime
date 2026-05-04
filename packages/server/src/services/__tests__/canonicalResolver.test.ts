import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// canonicalResolver dynamically imports `supabaseAdmin` from
// ../config/supabase.js for the candidate-create write path
// (canonical_ingredients has RLS service-role-only writes). Without this
// stub, tests that exercise `candidate_created` hit the real Supabase
// and crash with FK/unique-constraint errors. Stub via a hoisted holder
// so each test's `makeMockSupabase(...)` instance also services the
// admin write — same `from()` chain, same insert mock.
const adminHolder = vi.hoisted(() => ({
  supa: null as unknown as { from: (...args: unknown[]) => unknown },
}));

vi.mock('../../config/supabase.js', () => ({
  // Getter so the value is read at call time (after makeMockSupabase has
  // populated the holder). Default-exported fields would resolve once at
  // module load and stay null.
  get supabaseAdmin() {
    return adminHolder.supa;
  },
}));

import {
  _clearCache,
  resolveCanonical,
  resolveCanonicalBatch,
} from '../canonicalResolver.js';

/**
 * Thenable-chain supabase mock (Phase 13 pattern).
 * chain.then(resolve => resolve({ data: seeded })) lets tests seed rows while
 * keeping `.from(...).select(...).eq(...).limit(...)` chaining intact.
 *
 * Covers three shapes used by canonicalResolver:
 *   1. SELECT id, canonical_name, status FROM canonical_ingredients
 *   2. SELECT canonical_ingredient_id, confidence FROM ingredient_aliases
 *        WHERE alias_name = $1 ORDER BY confidence DESC LIMIT 1
 *   3. INSERT INTO canonical_ingredients (...) RETURNING id
 */
function makeMockSupabase(opts: {
  canonicals?: Array<{ id: string; canonical_name: string; status?: string }>;
  aliases?: Array<{
    canonical_ingredient_id: string;
    alias_name: string;
    confidence: number;
  }>;
  onInsertCandidate?: (row: { canonical_name: string }) => { id: string };
}) {
  const canonicalsByName = new Map(
    (opts.canonicals ?? []).map((r) => [
      r.canonical_name,
      { ...r, status: r.status ?? 'active' },
    ]),
  );
  const aliasesByName = new Map<
    string,
    { canonical_ingredient_id: string; confidence: number }
  >(
    (opts.aliases ?? []).map((r) => [
      r.alias_name,
      {
        canonical_ingredient_id: r.canonical_ingredient_id,
        confidence: r.confidence,
      },
    ]),
  );
  const calls = { selectCanonicalAll: 0, selectAlias: 0, insert: 0 };

  const from = vi.fn((table: string) => {
    if (table === 'canonical_ingredients') {
      return {
        select: vi.fn((_cols: string) => {
          calls.selectCanonicalAll++;
          const allRows = [...canonicalsByName.values()];
          const chain: unknown = {
            then: (resolve: (r: { data: unknown; error: null }) => unknown) =>
              resolve({ data: allRows, error: null }),
          };
          return chain;
        }),
        insert: vi.fn((row: { canonical_name: string }) => {
          calls.insert++;
          const newId =
            opts.onInsertCandidate?.(row).id ?? 'new-candidate-uuid';
          const inserted = {
            id: newId,
            canonical_name: row.canonical_name,
            status: 'candidate',
          };
          canonicalsByName.set(row.canonical_name, inserted);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: inserted, error: null })),
            })),
          };
        }),
      };
    }
    if (table === 'ingredient_aliases') {
      return {
        select: vi.fn((_cols: string) => ({
          eq: vi.fn((_col: string, val: string) => {
            calls.selectAlias++;
            const alias = aliasesByName.get(val);
            return {
              order: vi.fn(() => ({
                limit: vi.fn(() => ({
                  then: (
                    resolve: (r: { data: unknown; error: null }) => unknown,
                  ) =>
                    resolve({
                      data: alias ? [alias] : [],
                      error: null,
                    }),
                })),
              })),
            };
          }),
        })),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  const supa = { from, calls };
  // Wire this mock as the admin client so the dynamic supabaseAdmin
  // import inside resolveCanonical resolves to the same chain — keeping
  // the candidate_created write path covered by the same per-test mock.
  adminHolder.supa = supa as unknown as typeof adminHolder.supa;
  return supa;
}

beforeEach(() => _clearCache());
afterEach(() => vi.restoreAllMocks());

describe('resolveCanonical — exact canonical', () => {
  it('matches exact canonical_name case-insensitive', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'cb-uuid', canonical_name: 'chicken breast' }],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'CHICKEN BREAST',
    );
    expect(r).toEqual({
      canonicalId: 'cb-uuid',
      matchType: 'exact_canonical',
      confidence: 1.0,
    });
  });

  it('matches exact canonical_name after whitespace trim', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'oo-uuid', canonical_name: 'olive oil' }],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      '  olive oil  ',
    );
    expect(r.matchType).toBe('exact_canonical');
    expect(r.canonicalId).toBe('oo-uuid');
  });

  it('includes candidate-status rows in exact canonical match', async () => {
    const supa = makeMockSupabase({
      canonicals: [
        { id: 'xy-uuid', canonical_name: 'xylophone meat', status: 'candidate' },
      ],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'xylophone meat',
    );
    expect(r.matchType).toBe('exact_canonical');
    expect(r.canonicalId).toBe('xy-uuid');
  });

  it('excludes merged and deprecated statuses from exact match', async () => {
    const supa = makeMockSupabase({
      canonicals: [
        { id: 'm-uuid', canonical_name: 'old milk', status: 'merged' },
        { id: 'd-uuid', canonical_name: 'stale bread', status: 'deprecated' },
      ],
      onInsertCandidate: () => ({ id: 'fresh-uuid' }),
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'old milk',
    );
    // Merged/deprecated must not match — resolver falls through to candidate-create.
    expect(r.matchType).toBe('candidate_created');
    expect(r.canonicalId).toBe('fresh-uuid');
  });
});

describe('resolveCanonical — exact alias', () => {
  it('matches alias when canonical does not match', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'cb-uuid', canonical_name: 'chicken breast' }],
      aliases: [
        {
          canonical_ingredient_id: 'cb-uuid',
          alias_name: 'chkn brst',
          confidence: 0.95,
        },
      ],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'chkn brst',
    );
    expect(r.matchType).toBe('exact_alias');
    expect(r.canonicalId).toBe('cb-uuid');
    expect(r.confidence).toBeCloseTo(0.95, 2);
  });

  it('alias match is case-insensitive and whitespace-trimmed', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'cb-uuid', canonical_name: 'chicken breast' }],
      aliases: [
        {
          canonical_ingredient_id: 'cb-uuid',
          alias_name: 'chkn brst',
          confidence: 0.95,
        },
      ],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      '  CHKN BRST  ',
    );
    expect(r.matchType).toBe('exact_alias');
    expect(r.canonicalId).toBe('cb-uuid');
  });
});

describe('resolveCanonical — fuzzy fallback', () => {
  it('matches fuzzy within Levenshtein 2 after alias miss', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'cb-uuid', canonical_name: 'chicken breast' }],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'chickn brest', // 2 edits: "chickn brest" → "chicken breast"
    );
    expect(r.matchType).toBe('fuzzy');
    expect(r.canonicalId).toBe('cb-uuid');
    expect(r.confidence).toBeCloseTo(0.6, 2);
  });

  it('does NOT fuzzy-match when exact alias already hit (REQ-14)', async () => {
    const supa = makeMockSupabase({
      canonicals: [
        { id: 'cb-uuid', canonical_name: 'chicken breast' },
        { id: 'ct-uuid', canonical_name: 'chicken thigh' },
      ],
      aliases: [
        {
          canonical_ingredient_id: 'cb-uuid',
          alias_name: 'chkn brst',
          confidence: 0.95,
        },
      ],
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'chkn brst',
    );
    expect(r.matchType).toBe('exact_alias');
    expect(r.canonicalId).toBe('cb-uuid');
  });

  it('skips fuzzy for very short inputs (min length gate)', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'b-uuid', canonical_name: 'banana' }],
      onInsertCandidate: () => ({ id: 'ab-uuid' }),
    });
    // "abc" is length 3 — below FUZZY_MIN_LEN=4. Should go straight to candidate-create.
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'abc',
    );
    expect(r.matchType).toBe('candidate_created');
  });
});

describe('resolveCanonical — candidate auto-create', () => {
  it('inserts status=candidate when all lookups miss', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'cb-uuid', canonical_name: 'chicken breast' }],
      onInsertCandidate: () => ({ id: 'new-xuuid' }),
    });
    const r = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'xylophone meat',
    );
    expect(r.matchType).toBe('candidate_created');
    expect(r.canonicalId).toBe('new-xuuid');
    expect(r.confidence).toBeCloseTo(0.3, 2);
    expect(supa.calls.insert).toBe(1);
  });

  it('normalizes candidate canonical_name to lowercase+trimmed', async () => {
    let insertedName: string | null = null;
    const supa = makeMockSupabase({
      canonicals: [],
      onInsertCandidate: (row) => {
        insertedName = row.canonical_name;
        return { id: 'norm-uuid' };
      },
    });
    await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      '  Xylophone Meat  ',
    );
    expect(insertedName).toBe('xylophone meat');
  });
});

describe('resolveCanonicalBatch — dedup + cache', () => {
  it('dedups input and bulk-fetches canonical list once', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'b-uuid', canonical_name: 'banana' }],
      aliases: [
        {
          canonical_ingredient_id: 'b-uuid',
          alias_name: 'bananas',
          confidence: 1.0,
        },
      ],
    });
    const m = await resolveCanonicalBatch(
      supa as unknown as Parameters<typeof resolveCanonicalBatch>[0],
      ['banana', 'banana', 'bananas'],
    );
    expect(m.size).toBe(2); // raw input keys dedupped
    expect(m.get('banana')!.canonicalId).toBe('b-uuid');
    expect(m.get('bananas')!.canonicalId).toBe('b-uuid');
    expect(supa.calls.selectCanonicalAll).toBe(1); // single canonical fetch across batch
  });

  it('reuses cache across calls within TTL window', async () => {
    const supa = makeMockSupabase({
      canonicals: [{ id: 'b-uuid', canonical_name: 'banana' }],
    });
    await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'banana',
    );
    await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'banana',
    );
    expect(supa.calls.selectCanonicalAll).toBe(1);
  });

  it('cache is invalidated on candidate INSERT so subsequent same-name lookups see the new row', async () => {
    const supa = makeMockSupabase({
      canonicals: [],
      onInsertCandidate: () => ({ id: 'newly-uuid' }),
    });
    const first = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'xyz foodstuff',
    );
    expect(first.matchType).toBe('candidate_created');
    // Second call for the same name: should NOT insert again — should hit the newly-added cache row.
    const second = await resolveCanonical(
      supa as unknown as Parameters<typeof resolveCanonical>[0],
      'xyz foodstuff',
    );
    expect(second.matchType).toBe('exact_canonical');
    expect(second.canonicalId).toBe('newly-uuid');
    expect(supa.calls.insert).toBe(1); // exactly one insert across two calls
  });
});
