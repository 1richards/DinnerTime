import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  promoteCandidateCanonicals,
  incrementScanCounts,
} from '../canonicalPromoter.js';

afterEach(() => vi.restoreAllMocks());

/**
 * Thenable-chain mock for incrementScanCounts — models
 *   from('canonical_scan_counts').select('scan_count').eq(...).maybeSingle()
 *   from('canonical_scan_counts').upsert(...)
 */
function makeCountsMock(opts: {
  existingCounts?: Record<string, number>;
  upsertError?: { message: string } | null;
  selectError?: { message: string } | null;
}) {
  const upserts: Array<{
    row: Record<string, unknown>;
    opts: { onConflict?: string } | undefined;
  }> = [];
  const calls = { select: 0, upsert: 0 };

  const from = vi.fn((table: string) => {
    if (table !== 'canonical_scan_counts') {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select: vi.fn(() => ({
        eq: vi.fn((_col: string, val: string) => ({
          maybeSingle: vi.fn(async () => {
            calls.select++;
            if (opts.selectError) {
              return { data: null, error: opts.selectError };
            }
            const existing = opts.existingCounts?.[val];
            return {
              data: existing !== undefined ? { scan_count: existing } : null,
              error: null,
            };
          }),
        })),
      })),
      upsert: vi.fn(
        async (
          row: Record<string, unknown>,
          upsertOpts: { onConflict?: string },
        ) => {
          calls.upsert++;
          upserts.push({ row, opts: upsertOpts });
          if (opts.upsertError) {
            return { data: null, error: opts.upsertError };
          }
          return { data: row, error: null };
        },
      ),
    };
  });

  return {
    supabase: { from } as unknown as Parameters<
      typeof incrementScanCounts
    >[0],
    upserts,
    calls,
  };
}

describe('promoteCandidateCanonicals — RPC wrapper', () => {
  it('returns the numeric count the RPC emits on success', async () => {
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    const supabase = { rpc } as unknown as Parameters<
      typeof promoteCandidateCanonicals
    >[0];

    const n = await promoteCandidateCanonicals(supabase);

    expect(rpc).toHaveBeenCalledWith('promote_candidate_canonicals', {
      threshold: 5,
    });
    expect(n).toBe(2);
  });

  it('returns 0 when the RPC surfaces an error (fire-and-forget, no throw)', async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: 'pg exploded' },
    }));
    const supabase = { rpc } as unknown as Parameters<
      typeof promoteCandidateCanonicals
    >[0];

    const n = await promoteCandidateCanonicals(supabase);
    expect(n).toBe(0);
  });

  it('returns 0 when the RPC throws synchronously (fire-and-forget, no throw)', async () => {
    const rpc = vi.fn(async () => {
      throw new Error('network boom');
    });
    const supabase = { rpc } as unknown as Parameters<
      typeof promoteCandidateCanonicals
    >[0];

    const n = await promoteCandidateCanonicals(supabase);
    expect(n).toBe(0);
  });

  it('accepts a custom threshold override forwarded to the RPC', async () => {
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    const supabase = { rpc } as unknown as Parameters<
      typeof promoteCandidateCanonicals
    >[0];

    await promoteCandidateCanonicals(supabase, 3);
    expect(rpc).toHaveBeenCalledWith('promote_candidate_canonicals', {
      threshold: 3,
    });
  });
});

describe('incrementScanCounts — batch UPSERT with read-modify-write', () => {
  it('no-ops when the id array is empty (zero supabase calls)', async () => {
    const { supabase, calls } = makeCountsMock({});
    await incrementScanCounts(supabase, []);
    expect(calls.select).toBe(0);
    expect(calls.upsert).toBe(0);
  });

  it('upserts scan_count = existing + 1 for each id (multi-id batch)', async () => {
    const { supabase, upserts, calls } = makeCountsMock({
      existingCounts: { 'id1': 4, 'id2': 0 }, // id2 existed but counter is 0
    });

    await incrementScanCounts(supabase, ['id1', 'id2']);

    expect(calls.upsert).toBe(2);
    const byId = new Map(
      upserts.map((u) => [
        (u.row as { canonical_ingredient_id: string }).canonical_ingredient_id,
        u.row,
      ]),
    );
    expect((byId.get('id1') as { scan_count: number }).scan_count).toBe(5);
    expect((byId.get('id2') as { scan_count: number }).scan_count).toBe(1);
    // Each upsert uses the composite onConflict key so the counter is the
    // single source of truth per canonical.
    for (const u of upserts) {
      expect(u.opts).toEqual({ onConflict: 'canonical_ingredient_id' });
    }
  });

  it('inserts scan_count = 1 for canonicals that have no prior counter row', async () => {
    const { supabase, upserts } = makeCountsMock({
      existingCounts: {}, // nothing prior
    });

    await incrementScanCounts(supabase, ['fresh-uuid']);

    expect(upserts).toHaveLength(1);
    expect((upserts[0].row as { scan_count: number }).scan_count).toBe(1);
  });

  it('swallows errors (does not throw) when upsert returns an error', async () => {
    const { supabase } = makeCountsMock({
      existingCounts: { 'id1': 4 },
      upsertError: { message: 'pg boom' },
    });

    await expect(
      incrementScanCounts(supabase, ['id1']),
    ).resolves.toBeUndefined();
  });

  it('swallows errors (does not throw) when the select read throws', async () => {
    const from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => {
            throw new Error('network exploded');
          }),
        })),
      })),
      upsert: vi.fn(async () => ({ data: null, error: null })),
    }));
    const supabase = { from } as unknown as Parameters<
      typeof incrementScanCounts
    >[0];

    await expect(
      incrementScanCounts(supabase, ['id1']),
    ).resolves.toBeUndefined();
  });
});
