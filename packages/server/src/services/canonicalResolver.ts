/**
 * Canonical ingredient resolver (Phase 24a).
 *
 * Maps raw AI-extracted names ("CHKN BRST", "organic banana", "whl milk") to
 * canonical ingredient UUIDs. This is the identity engine that replaces
 * Phase 21's planned fuzzy dedup (per 24-CONTEXT lockdown).
 *
 * 4-stage lookup (REQ-07, REQ-14):
 *   1. Exact canonical_name match (status ∈ {active, candidate}) — confidence 1.0
 *   2. Exact alias_name match (sorted by alias.confidence DESC)     — confidence = alias.confidence
 *   3. Fuzzy match via Levenshtein ≤ 2 over cached canonical names  — confidence 0.6
 *   4. Auto-create status='candidate' canonical                     — confidence 0.3
 *
 * The resolver NEVER fails a scan (REQ-09): unknown names are materialized as
 * candidate canonicals so identity dedup works on subsequent scans.
 *
 * Batch entry point dedups input + caches canonical-name list (60s TTL) to
 * keep Levenshtein cost bounded even with ~300 canonicals × ~20 items/scan.
 *
 * Template: `packages/server/src/services/itemLocation.ts` Phase 18 hybrid
 * STATIC_MAP + AI-fallback pattern. The shape (static-first, cache, batch
 * dedup) maps 1:1; the substrate is the DB instead of an in-memory map.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type MatchType =
  | 'exact_canonical'
  | 'exact_alias'
  | 'fuzzy'
  | 'candidate_created';

export interface CanonicalMatch {
  canonicalId: string; // uuid
  matchType: MatchType;
  confidence: number; // 1.0 exact; alias.confidence (typ 0.9-1.0); 0.6 fuzzy; 0.3 candidate
}

// ----- Tunables ---------------------------------------------------------------

const CACHE_TTL_MS = 60_000;
const FUZZY_MAX_DISTANCE = 2;
/** Skip fuzzy for very short inputs — 1-2 edits against a 3-letter string is
 * almost anything. Protects against "abc" fuzzy-matching "oil". */
const FUZZY_MIN_LEN = 4;
const CONFIDENCE_FUZZY = 0.6;
const CONFIDENCE_CANDIDATE = 0.3;
const CANDIDATE_DEFAULT_CATEGORY = 'other';
const CANDIDATE_DEFAULT_SOURCE_LOCATION = 'pantry';

// ----- Cache ------------------------------------------------------------------

interface CacheRow {
  id: string;
  canonical_name: string;
  status: string;
}

interface Cache {
  rows: CacheRow[];
  fetchedAt: number;
}

let cache: Cache | null = null;

/** Test hook — clears the in-process cache so tests see deterministic SELECTs. */
export function _clearCache(): void {
  cache = null;
}

async function getCanonicalRows(supabase: SupabaseClient): Promise<CacheRow[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  const { data, error } = await supabase
    .from('canonical_ingredients')
    .select('id, canonical_name, status');
  if (error) throw error;
  const rows = (data ?? []).filter(
    (r: CacheRow) => r.status === 'active' || r.status === 'candidate',
  );
  cache = { rows, fetchedAt: Date.now() };
  return cache.rows;
}

// ----- Normalization + Levenshtein -------------------------------------------

function normalize(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Classic iterative Levenshtein edit distance with early-exit on length delta
 * and row-level bail when the minimum in-progress cost already exceeds maxDistance.
 *
 * Returns a value <= maxDistance when the edit distance fits; otherwise returns
 * maxDistance + 1 (caller treats that as "no match").
 */
function levenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > maxDistance) return maxDistance + 1;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Two-row DP. prev[j] = distance(a[0..i-1], b[0..j-1]) from previous iteration.
  let prev = new Array<number>(bLen + 1);
  let curr = new Array<number>(bLen + 1);
  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bLen; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    // Early exit: no cell in this row is <= maxDistance, so the final answer
    // cannot be <= maxDistance either.
    if (rowMin > maxDistance) return maxDistance + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[bLen];
}

// ----- Single-name resolver ---------------------------------------------------

/**
 * Resolve a single raw name to a canonical ingredient match. 4-stage lookup
 * with strict ordering — fuzzy only fires after exact canonical AND exact
 * alias both miss (REQ-14). Never returns null: unknown names auto-create
 * a status='candidate' row and return match_type='candidate_created' (REQ-09).
 */
export async function resolveCanonical(
  supabase: SupabaseClient,
  rawName: string,
): Promise<CanonicalMatch> {
  const norm = normalize(rawName);
  const rows = await getCanonicalRows(supabase);

  // 1) Exact canonical_name (status ∈ {active, candidate} already filtered in cache).
  const exact = rows.find((r) => r.canonical_name === norm);
  if (exact) {
    return {
      canonicalId: exact.id,
      matchType: 'exact_canonical',
      confidence: 1.0,
    };
  }

  // 2) Exact alias match. Single SELECT + LIMIT 1 on alias_name (indexed).
  const { data: aliasRows, error: aliasErr } = await supabase
    .from('ingredient_aliases')
    .select('canonical_ingredient_id, confidence')
    .eq('alias_name', norm)
    .order('confidence', { ascending: false })
    .limit(1);
  if (aliasErr) throw aliasErr;
  if (aliasRows && aliasRows.length > 0) {
    const a = aliasRows[0] as {
      canonical_ingredient_id: string;
      confidence: number;
    };
    return {
      canonicalId: a.canonical_ingredient_id,
      matchType: 'exact_alias',
      confidence: a.confidence,
    };
  }

  // 3) Fuzzy — only for inputs long enough that 2 edits is meaningful.
  if (norm.length >= FUZZY_MIN_LEN) {
    let best: { id: string; distance: number } | null = null;
    for (const r of rows) {
      if (r.canonical_name.length < FUZZY_MIN_LEN) continue;
      const d = levenshtein(norm, r.canonical_name, FUZZY_MAX_DISTANCE);
      if (d <= FUZZY_MAX_DISTANCE && (!best || d < best.distance)) {
        best = { id: r.id, distance: d };
        if (d === 0) break; // cannot beat 0
      }
    }
    if (best) {
      return {
        canonicalId: best.id,
        matchType: 'fuzzy',
        confidence: CONFIDENCE_FUZZY,
      };
    }
  }

  // 4) Auto-create candidate. Never fails a scan.
  const { data: inserted, error: insertErr } = await supabase
    .from('canonical_ingredients')
    .insert({
      canonical_name: norm,
      category: CANDIDATE_DEFAULT_CATEGORY,
      default_source_location: CANDIDATE_DEFAULT_SOURCE_LOCATION,
      status: 'candidate',
    })
    .select('id')
    .single();
  if (insertErr || !inserted) {
    throw insertErr ?? new Error('canonicalResolver: candidate insert failed');
  }

  const newRow: CacheRow = {
    id: (inserted as { id: string }).id,
    canonical_name: norm,
    status: 'candidate',
  };
  // Append to live cache so subsequent same-name lookups hit exact_canonical
  // without re-fetching. (Equivalent to invalidating; cheaper.)
  if (cache) cache.rows.push(newRow);

  return {
    canonicalId: newRow.id,
    matchType: 'candidate_created',
    confidence: CONFIDENCE_CANDIDATE,
  };
}

// ----- Batch resolver ---------------------------------------------------------

/**
 * Batch entry point — dedups input keys, pre-warms the canonical cache once,
 * then delegates to resolveCanonical per unique input.
 *
 * Returns Map<raw_input, CanonicalMatch> keyed by the ORIGINAL input strings
 * (not normalized). Callers (e.g. reconcileItems) typically need to zip back
 * to ScanResult[] using the exact string the AI produced.
 */
export async function resolveCanonicalBatch(
  supabase: SupabaseClient,
  rawNames: string[],
): Promise<Map<string, CanonicalMatch>> {
  const out = new Map<string, CanonicalMatch>();
  // Preserve raw-input keys (case-sensitive) — callers may submit "Banana" and
  // "banana" as two review rows; each gets its own map entry, both resolving
  // to the same canonicalId via normalization inside resolveCanonical.
  const unique = [...new Set(rawNames)];

  // Pre-warm cache so per-item resolveCanonical reuses it and we make a single
  // canonical-name SELECT across the batch.
  await getCanonicalRows(supabase);

  for (const name of unique) {
    out.set(name, await resolveCanonical(supabase, name));
  }
  return out;
}
