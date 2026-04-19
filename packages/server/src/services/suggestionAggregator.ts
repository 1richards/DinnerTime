/**
 * Suggestion aggregator (Phase 21-02).
 *
 * Reads `item_override_events` (Phase 18) and writes `suggested_rules` rows
 * (Phase 21-01 migration 00018) when a user has overridden the AI's location
 * inference for the same (item_name, user_location) pair N=2 times within a
 * 30-day rolling window. The user then browses Settings → Pantry Rules →
 * Suggestions to accept or dismiss (21-03 routes).
 *
 * Fire-and-forget contract: aggregation runs on scan-confirm as a
 * `void aggregateLocationSuggestions(...)` — errors never propagate into the
 * scan path. Mobile already sees the /confirm response; aggregation is
 * background telemetry.
 *
 * W3 fix (per 21-02 PLAN revision): resolve each qualifying group's
 * item_name to its canonical_ingredient_id AT AGGREGATION TIME via
 * canonicalResolver.resolveCanonicalBatch, and persist the canonical id
 * directly in the `payload` JSONB. This eliminates an entire class of bugs
 * in 21-03 /suggestions/:id/accept where re-resolving at accept time could
 * land on a different canonical (especially for candidate canonicals whose
 * identity shifts between aggregation and accept). 21-03 reads
 * `payload.canonical_ingredient_id` directly with a
 * `canonical.status === 'active'` guard.
 *
 * Un-resolvable names are skipped (not upserted) — prevents orphan
 * suggestions 21-03 cannot accept. In practice canonicalResolver
 * auto-creates `status='candidate'` canonicals for unknown names so
 * resolveMap.get(name) is almost never undefined, but the defensive skip
 * avoids silent corruption if the resolver contract ever weakens.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveCanonicalBatch } from './canonicalResolver.js';

const THRESHOLD = 2;
const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

interface OverrideEventRow {
  item_name: string;
  user_location: string;
  created_at: string;
}

interface Group {
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export async function aggregateLocationSuggestions(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();

    const { data, error } = await supabase
      .from('item_override_events')
      .select('item_name, user_location, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error || !data) return;

    // Group by composite key (item_name, user_location).
    const groups = new Map<string, Group>();
    for (const ev of data as OverrideEventRow[]) {
      const key = `${ev.item_name}::${ev.user_location}`;
      const prior = groups.get(key);
      if (!prior) {
        groups.set(key, {
          count: 1,
          firstSeen: ev.created_at,
          lastSeen: ev.created_at,
        });
        continue;
      }
      prior.count += 1;
      if (ev.created_at < prior.firstSeen) prior.firstSeen = ev.created_at;
      if (ev.created_at > prior.lastSeen) prior.lastSeen = ev.created_at;
    }

    // Filter to qualifying groups before resolution — avoids paying the
    // canonical-resolution cost for below-threshold names.
    const qualifying = [...groups.entries()].filter(
      ([, g]) => g.count >= THRESHOLD,
    );

    // W3 — resolve canonical IDs up front for qualifying groups only.
    const uniqueNames = [
      ...new Set(qualifying.map(([key]) => key.split('::')[0])),
    ];
    const resolveMap = await resolveCanonicalBatch(supabase, uniqueNames);

    // Upsert one row per qualifying group whose canonical resolves. Skip
    // un-resolvable names so 21-03 never sees an orphan payload.
    for (const [key, g] of qualifying) {
      const [item_name, user_location] = key.split('::');
      const match = resolveMap.get(item_name);
      if (!match) continue; // W3 defensive skip

      await supabase.from('suggested_rules').upsert(
        {
          user_id: userId,
          rule_type: 'location_mapping',
          payload: {
            item_name,
            user_location,
            canonical_ingredient_id: match.canonicalId,
          },
          occurrence_count: g.count,
          first_seen: g.firstSeen,
          last_seen: g.lastSeen,
          dismissed_at: null,
        },
        { onConflict: 'user_id,rule_type,payload' },
      );
    }
  } catch (err) {
    // Fire-and-forget safety. Swallow all errors (network, resolver, upsert) —
    // scan-confirm must never be blocked by aggregation telemetry.
    console.warn('[suggestionAggregator] aggregation failed:', err);
  }
}
