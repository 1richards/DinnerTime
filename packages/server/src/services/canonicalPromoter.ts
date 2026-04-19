/**
 * Canonical promoter (Phase 21-02).
 *
 * Two small helpers that together drive the candidate → active promotion
 * pipeline for canonical ingredients (Phase 21 ROADMAP criterion #3):
 *
 *   1. `incrementScanCounts(ids)` — tallies one scan per canonical in the
 *      `canonical_scan_counts` counter table (Phase 21-01 migration 00019).
 *   2. `promoteCandidateCanonicals(threshold=5)` — invokes the SQL-side
 *      `promote_candidate_canonicals(threshold)` RPC which flips
 *      `status='candidate' → 'active'` for any counter ≥ threshold.
 *
 * Both are fire-and-forget safe — callers (scan-confirm route) `await`
 * them but neither throws. Errors are logged via console.warn and the
 * scan proceeds normally. Telemetry-grade robustness; the scan path is
 * never blocked by promotion bookkeeping.
 *
 * Concurrency note: `incrementScanCounts` uses a sequential read → upsert
 * loop (one round-trip per canonical). For Phase 21 private beta this is
 * acceptable — single-digit canonicals per scan and no concurrent-scan
 * contention. If we observe lost increments in production (two scans
 * racing on the same canonical), swap in a dedicated atomic RPC
 * (`increment_canonical_scan_counts(ids uuid[])`). Documented here so
 * the follow-up is discoverable.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_PROMOTION_THRESHOLD = 5;

/**
 * Invoke the `promote_candidate_canonicals(threshold)` RPC shipped in
 * Phase 21-01 migration 00019. Returns the count of canonicals promoted
 * from `status='candidate'` to `status='active'` in this invocation, or
 * 0 on any error. Never throws — safe to invoke fire-and-forget from
 * scan-confirm under `void promoteCandidateCanonicals(...)`.
 */
export async function promoteCandidateCanonicals(
  supabase: SupabaseClient,
  threshold: number = DEFAULT_PROMOTION_THRESHOLD,
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc(
      'promote_candidate_canonicals',
      { threshold },
    );
    if (error) {
      console.warn('[canonicalPromoter] RPC returned error:', error);
      return 0;
    }
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    console.warn('[canonicalPromoter] RPC threw:', err);
    return 0;
  }
}

/**
 * Increment the scan_count for a batch of canonical_ingredient_ids in the
 * `canonical_scan_counts` counter table (Phase 21-01 migration 00019).
 *
 * Strategy: sequential read-modify-write (one SELECT + one UPSERT per id).
 * The UPSERT uses `onConflict: 'canonical_ingredient_id'` matching the
 * PK on the counter table, so the second and subsequent scans of a given
 * canonical update the existing row rather than inserting a duplicate.
 *
 * No-op on empty array. Swallows all errors so scan-confirm is never
 * blocked by counter bookkeeping.
 */
export async function incrementScanCounts(
  supabase: SupabaseClient,
  canonicalIds: string[],
): Promise<void> {
  if (canonicalIds.length === 0) return;
  try {
    for (const id of canonicalIds) {
      const { data } = await supabase
        .from('canonical_scan_counts')
        .select('scan_count')
        .eq('canonical_ingredient_id', id)
        .maybeSingle();

      const next = ((data?.scan_count as number | undefined) ?? 0) + 1;

      await supabase.from('canonical_scan_counts').upsert(
        {
          canonical_ingredient_id: id,
          scan_count: next,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'canonical_ingredient_id' },
      );
    }
  } catch (err) {
    console.warn('[canonicalPromoter] incrementScanCounts failed:', err);
  }
}
