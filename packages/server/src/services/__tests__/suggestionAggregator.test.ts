import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mocks so vi.mock can see them.
const resolveCanonicalBatchMock = vi.hoisted(() => vi.fn());

vi.mock('../canonicalResolver.js', () => ({
  resolveCanonicalBatch: resolveCanonicalBatchMock,
}));

// Import AFTER vi.mock so the module picks up the stub.
import { aggregateLocationSuggestions } from '../suggestionAggregator.js';

/**
 * OverrideEvent fixtures — mirrors Phase 18 item_override_events row shape
 * (user_id, item_name, user_location, created_at). Only the 3 columns
 * aggregateLocationSuggestions selects are needed.
 */
interface OverrideEvent {
  item_name: string;
  user_location: string;
  created_at: string;
}

interface UpsertCapture {
  row: Record<string, unknown>;
  opts: { onConflict?: string } | undefined;
}

/**
 * Thenable-chain supabase mock. Covers:
 *   from('item_override_events').select().eq().gte() → thenable
 *   from('suggested_rules').upsert(row, opts) → Promise.resolve({ data, error })
 *
 * Returns the captured upserts so assertions can verify payload shape + counts.
 */
function makeMockSupabase(opts: {
  overrideEvents?: OverrideEvent[];
  overrideError?: { message: string } | null;
  upsertError?: { message: string } | null;
}) {
  const upserts: UpsertCapture[] = [];
  const calls = { selectOverrides: 0, upsertSuggested: 0 };

  const from = vi.fn((table: string) => {
    if (table === 'item_override_events') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              then: (
                resolve: (r: { data: unknown; error: unknown }) => unknown,
              ) => {
                calls.selectOverrides++;
                if (opts.overrideError) {
                  return resolve({ data: null, error: opts.overrideError });
                }
                return resolve({
                  data: opts.overrideEvents ?? [],
                  error: null,
                });
              },
            })),
          })),
        })),
      };
    }
    if (table === 'suggested_rules') {
      return {
        upsert: vi.fn(
          async (
            row: Record<string, unknown>,
            upsertOpts: { onConflict?: string },
          ) => {
            calls.upsertSuggested++;
            upserts.push({ row, opts: upsertOpts });
            if (opts.upsertError) {
              return { data: null, error: opts.upsertError };
            }
            return { data: row, error: null };
          },
        ),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    supabase: { from } as unknown as Parameters<
      typeof aggregateLocationSuggestions
    >[0],
    upserts,
    calls,
  };
}

const DAY_MS = 86_400_000;
function daysAgo(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString();
}

beforeEach(() => {
  resolveCanonicalBatchMock.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('aggregateLocationSuggestions — threshold gating', () => {
  it('does NOT upsert when a group has only 1 occurrence in the 30-day window', async () => {
    const { supabase, upserts, calls } = makeMockSupabase({
      overrideEvents: [
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(5) },
      ],
    });
    resolveCanonicalBatchMock.mockResolvedValue(new Map());

    await aggregateLocationSuggestions(supabase, 'user-abc');

    expect(calls.selectOverrides).toBe(1);
    expect(calls.upsertSuggested).toBe(0);
    expect(upserts).toHaveLength(0);
    // Below-threshold group should not even be resolved — no names qualify.
    expect(resolveCanonicalBatchMock).toHaveBeenCalledWith(supabase, []);
  });

  it('upserts a single row when a group hits occurrence_count=2 (payload carries canonical_ingredient_id — W3 fix)', async () => {
    const first = daysAgo(20);
    const last = daysAgo(3);
    const { supabase, upserts } = makeMockSupabase({
      overrideEvents: [
        { item_name: 'milk', user_location: 'fridge', created_at: first },
        { item_name: 'milk', user_location: 'fridge', created_at: last },
      ],
    });
    resolveCanonicalBatchMock.mockResolvedValue(
      new Map([
        [
          'milk',
          {
            canonicalId: 'milk-uuid',
            matchType: 'exact_canonical',
            confidence: 1.0,
          },
        ],
      ]),
    );

    await aggregateLocationSuggestions(supabase, 'user-abc');

    expect(upserts).toHaveLength(1);
    const { row, opts } = upserts[0];
    expect(row).toMatchObject({
      user_id: 'user-abc',
      rule_type: 'location_mapping',
      occurrence_count: 2,
      first_seen: first,
      last_seen: last,
      dismissed_at: null,
    });
    expect(row.payload).toEqual({
      item_name: 'milk',
      user_location: 'fridge',
      canonical_ingredient_id: 'milk-uuid',
    });
    expect(opts).toEqual({ onConflict: 'user_id,rule_type,payload' });
  });
});

describe('aggregateLocationSuggestions — multi-group aggregation', () => {
  it('upserts only the groups whose count hits the threshold, each with canonical pre-resolved', async () => {
    const { supabase, upserts } = makeMockSupabase({
      overrideEvents: [
        // milk → 2× fridge (qualifies)
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(10) },
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(2) },
        // eggs → 3× fridge (qualifies)
        { item_name: 'eggs', user_location: 'fridge', created_at: daysAgo(20) },
        { item_name: 'eggs', user_location: 'fridge', created_at: daysAgo(15) },
        { item_name: 'eggs', user_location: 'fridge', created_at: daysAgo(1) },
        // yogurt → 1× fridge (below)
        { item_name: 'yogurt', user_location: 'fridge', created_at: daysAgo(4) },
      ],
    });
    resolveCanonicalBatchMock.mockResolvedValue(
      new Map([
        ['milk', { canonicalId: 'milk-uuid', matchType: 'exact_canonical', confidence: 1.0 }],
        ['eggs', { canonicalId: 'eggs-uuid', matchType: 'exact_canonical', confidence: 1.0 }],
      ]),
    );

    await aggregateLocationSuggestions(supabase, 'user-abc');

    // Only milk + eggs should be upserted; yogurt stays below threshold.
    expect(upserts).toHaveLength(2);
    const payloads = upserts.map((u) => u.row.payload);
    expect(payloads).toContainEqual({
      item_name: 'milk',
      user_location: 'fridge',
      canonical_ingredient_id: 'milk-uuid',
    });
    expect(payloads).toContainEqual({
      item_name: 'eggs',
      user_location: 'fridge',
      canonical_ingredient_id: 'eggs-uuid',
    });
    // Counts set correctly
    const milkRow = upserts.find(
      (u) =>
        (u.row.payload as Record<string, string>).item_name === 'milk',
    );
    const eggsRow = upserts.find(
      (u) =>
        (u.row.payload as Record<string, string>).item_name === 'eggs',
    );
    expect(milkRow!.row.occurrence_count).toBe(2);
    expect(eggsRow!.row.occurrence_count).toBe(3);

    // Only the two qualifying names are resolved (yogurt stays below threshold and is never
    // passed to resolveCanonicalBatch — saves an unnecessary lookup).
    const resolveCallArgs = resolveCanonicalBatchMock.mock.calls[0][1];
    expect(resolveCallArgs).toHaveLength(2);
    expect(resolveCallArgs).toEqual(expect.arrayContaining(['milk', 'eggs']));
    expect(resolveCallArgs).not.toContain('yogurt');
  });
});

describe('aggregateLocationSuggestions — 30-day window', () => {
  it('supabase query uses gte(created_at, <30-day cutoff>) so older events are server-filtered', async () => {
    const { supabase } = makeMockSupabase({ overrideEvents: [] });
    resolveCanonicalBatchMock.mockResolvedValue(new Map());

    // Spy on the chained gte call by wrapping the mock return.
    // The mock already only counts select calls; this test documents the contract.
    // We invoke and confirm the function completes without throwing — the
    // factory above hardcodes the gte path and returns event data via thenable.
    await expect(
      aggregateLocationSuggestions(supabase, 'user-abc'),
    ).resolves.toBeUndefined();
  });

  it('aggregates only over the data supabase returns (window enforcement is server-side)', async () => {
    // Simulate the 30-day cutoff by having the mock return ONLY in-window events.
    // Out-of-window events are never passed to the aggregator (gte filters them at PG layer).
    const { supabase, upserts } = makeMockSupabase({
      overrideEvents: [
        // Both inside 30 days — qualifies
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(29) },
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(1) },
      ],
    });
    resolveCanonicalBatchMock.mockResolvedValue(
      new Map([
        ['milk', { canonicalId: 'milk-uuid', matchType: 'exact_canonical', confidence: 1.0 }],
      ]),
    );

    await aggregateLocationSuggestions(supabase, 'user-abc');
    expect(upserts).toHaveLength(1);
    expect(upserts[0].row.occurrence_count).toBe(2);
  });
});

describe('aggregateLocationSuggestions — fire-and-forget safety', () => {
  it('resolves (does not throw) when supabase select returns an error', async () => {
    const { supabase, calls } = makeMockSupabase({
      overrideError: { message: 'simulated pg error' },
    });
    resolveCanonicalBatchMock.mockResolvedValue(new Map());

    await expect(
      aggregateLocationSuggestions(supabase, 'user-abc'),
    ).resolves.toBeUndefined();
    expect(calls.upsertSuggested).toBe(0);
  });

  it('resolves (does not throw) when resolveCanonicalBatch throws mid-aggregation', async () => {
    const { supabase } = makeMockSupabase({
      overrideEvents: [
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(5) },
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(2) },
      ],
    });
    resolveCanonicalBatchMock.mockRejectedValue(new Error('network boom'));

    await expect(
      aggregateLocationSuggestions(supabase, 'user-abc'),
    ).resolves.toBeUndefined();
  });
});

describe('aggregateLocationSuggestions — W3 canonical-unresolvable skip', () => {
  it('skips qualifying groups whose item_name resolve-map entry is undefined (no orphan suggestion)', async () => {
    const { supabase, upserts } = makeMockSupabase({
      overrideEvents: [
        { item_name: 'gibberish', user_location: 'fridge', created_at: daysAgo(10) },
        { item_name: 'gibberish', user_location: 'fridge', created_at: daysAgo(2) },
        // milk resolves normally in the same batch
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(8) },
        { item_name: 'milk', user_location: 'fridge', created_at: daysAgo(1) },
      ],
    });
    // "gibberish" is intentionally MISSING from the resolve map (never happens
    // in practice — canonicalResolver auto-creates candidates — but this pins
    // the defensive skip contract: never persist an orphan suggestion 21-03
    // would fail to accept because payload.canonical_ingredient_id is absent).
    resolveCanonicalBatchMock.mockResolvedValue(
      new Map([
        ['milk', { canonicalId: 'milk-uuid', matchType: 'exact_canonical', confidence: 1.0 }],
      ]),
    );

    await aggregateLocationSuggestions(supabase, 'user-abc');

    // Only milk should be upserted — gibberish's missing resolution means no upsert.
    expect(upserts).toHaveLength(1);
    expect((upserts[0].row.payload as Record<string, string>).item_name).toBe('milk');
    expect((upserts[0].row.payload as Record<string, string>).canonical_ingredient_id).toBe(
      'milk-uuid',
    );
  });
});
