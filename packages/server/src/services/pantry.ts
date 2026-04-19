import type { SupabaseClient } from '@supabase/supabase-js';
import type { ScanResult, SourceLocation } from './vision.js';
import { resolveCanonicalBatch } from './canonicalResolver.js';
import { add as addQuantities, sanitize as sanitizeQuantity, type Quantity } from './units.js';
import { SOURCE_LOCATIONS } from './sourceLocation.js';

/**
 * Phase 24-05: reconcileItems consumes ScanResult[] directly (post Phase 24-04
 * vision tool schema rewrite). Each ScanResult carries a nested Quantity and
 * per-field confidence; canonical resolution happens inside reconcile via
 * resolveCanonicalBatch so the scan routes can remain canonical-agnostic.
 *
 * For legacy callers still shaping items as the flat ConfirmedItem, the type
 * remains exported but reconcileItems accepts ScanResult[] only.
 */
export interface ConfirmedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  confidence: number;
  source_location: SourceLocation;
}

/**
 * Database row shape for pantry_items. Consumed by downstream services
 * (shoppingList, ingredientMatching, mealPlanner).
 *
 * NOTE on `quantity`: DB migration 00015 (24-01) changed this column to JSONB
 * `{value, unit, system}`. Legacy pre-24a services still read it as a flat
 * number. The type signature stays `number` for consumer compatibility; a
 * future plan (Phase 21 or beyond) migrates those consumers to use units.ts
 * sanitize() at the JSONB boundary. Phase 24-05 (this plan) only rewrote the
 * pantry-write path (reconcileItems); read-side refactors are deferred.
 */
export interface PantryItem {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: string;
  source_location: string;
  /** Phase 18: forward-compatible JSONB metadata. */
  item_attributes?: Record<string, unknown> | null;
  /** Phase 24-01 nullable FK. Legacy pre-24a rows have NULL (REQ-23). */
  canonical_ingredient_id?: string | null;
  confidence: number;
  status: string;
  last_seen_at: string;
  created_at?: string;
  updated_at?: string;
}

const VALID_SOURCE_LOCATIONS = new Set<string>(SOURCE_LOCATIONS);

export interface ReconcileResult {
  inserted: number;
  updated: number;
  /** Rows that created a second pantry_items entry because the scan's unit
   * system was incompatible with the existing row (units.add returned null). */
  incompatibleUnits: number;
}

/**
 * Normalize item name: lowercase and trim whitespace.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function resolveSourceLocation(raw: unknown): SourceLocation {
  return typeof raw === 'string' && VALID_SOURCE_LOCATIONS.has(raw)
    ? (raw as SourceLocation)
    : 'pantry';
}

/**
 * Phase 24-05 reconcileItems — canonical-identity dedup.
 *
 * Algorithm:
 *   1. Batch-resolve canonical IDs for every scan name (single DB fan-out).
 *   2. Fetch user's canonical_category_override (one query).
 *   3. Fetch canonical.category for all resolved IDs (one query).
 *   4. Per item: match existing on (profile_id, canonical_ingredient_id,
 *      source_location). If match + units compatible → UPDATE quantity via
 *      units.add. If match + incompatible → INSERT a SECOND row with
 *      item_attributes.reconcile_hint='incompatible_units'. If no match →
 *      INSERT new row with canonical FK + JSONB quantity.
 *
 * Category precedence: canonical_category_override → canonical.category →
 * 'other' fallback. `ScanResult.category` is ignored at insert time (REQ-10).
 *
 * Legacy rows with canonical_ingredient_id=NULL are never merged into new
 * canonical rows (the select filters on canonical_ingredient_id = resolved-id,
 * so NULL rows don't match). Forward-only per REQ-23.
 */
export async function reconcileItems(
  supabase: SupabaseClient,
  profileId: string,
  items: ScanResult[],
): Promise<ReconcileResult> {
  if (!items || items.length === 0) {
    return { inserted: 0, updated: 0, incompatibleUnits: 0 };
  }

  // 1. Batch-resolve canonical IDs for every name.
  const resolveMap = await resolveCanonicalBatch(
    supabase,
    items.map((it) => it.name),
  );

  // 2. User category overrides (one query).
  const overrideMap = new Map<string, string>();
  {
    const { data } = await supabase
      .from('canonical_category_override')
      .select('canonical_ingredient_id, category')
      .eq('user_id', profileId);
    for (const row of (data ?? []) as Array<{
      canonical_ingredient_id: string;
      category: string;
    }>) {
      overrideMap.set(row.canonical_ingredient_id, row.category);
    }
  }

  // 3. Canonical category lookup (one query over the set of resolved IDs).
  const canonicalIds = [
    ...new Set(
      [...resolveMap.values()].map((m) => m.canonicalId),
    ),
  ];
  const canonicalCategoryMap = new Map<string, string>();
  if (canonicalIds.length > 0) {
    const { data } = await supabase
      .from('canonical_ingredients')
      .select('id, category')
      .in('id', canonicalIds);
    for (const row of (data ?? []) as Array<{ id: string; category: string }>) {
      canonicalCategoryMap.set(row.id, row.category);
    }
  }

  let inserted = 0;
  let updated = 0;
  let incompatibleUnits = 0;

  for (const raw of items) {
    const name = String(raw.name ?? '').trim();
    if (!name) continue;

    const match = resolveMap.get(raw.name);
    if (!match) continue; // defensive — every name should be in the map
    const canonicalId = match.canonicalId;

    const source_location = resolveSourceLocation(raw.source_location);
    const quantity: Quantity = sanitizeQuantity(raw.quantity);
    const resolvedCategory =
      overrideMap.get(canonicalId) ??
      canonicalCategoryMap.get(canonicalId) ??
      'other';
    const confidence = Math.max(
      0,
      Math.min(1, Number(raw.confidence ?? 1) || 1),
    );
    const normalized = normalizeName(name);

    // Identity lookup: (profile_id, canonical_ingredient_id, source_location)
    const { data: existingRows } = await supabase
      .from('pantry_items')
      .select()
      .eq('profile_id', profileId)
      .eq('canonical_ingredient_id', canonicalId)
      .eq('source_location', source_location);

    const existing =
      existingRows && existingRows.length > 0
        ? (existingRows[0] as Record<string, unknown>)
        : null;

    if (existing) {
      const existingQty: Quantity = sanitizeQuantity(existing.quantity);
      const merged = addQuantities(existingQty, quantity);

      if (merged) {
        const priorAttrs =
          existing.item_attributes && typeof existing.item_attributes === 'object'
            ? (existing.item_attributes as Record<string, unknown>)
            : {};

        await supabase
          .from('pantry_items')
          .update({
            quantity: merged,
            confidence,
            status: 'available',
            last_seen_at: new Date().toISOString(),
            item_attributes: {
              ...priorAttrs,
              source_location,
              canonical_ingredient_id: canonicalId,
            },
          })
          .eq('id', existing.id as string);
        updated++;
      } else {
        // Incompatible units — INSERT a second row, flag for UX reconciliation.
        await supabase.from('pantry_items').insert({
          profile_id: profileId,
          canonical_ingredient_id: canonicalId,
          name,
          normalized_name: normalized,
          quantity,
          category: resolvedCategory,
          source_location,
          confidence,
          status: 'available',
          item_attributes: {
            source_location,
            canonical_ingredient_id: canonicalId,
            reconcile_hint: 'incompatible_units',
          },
          last_seen_at: new Date().toISOString(),
        });
        incompatibleUnits++;
        inserted++;
      }
    } else {
      await supabase.from('pantry_items').insert({
        profile_id: profileId,
        canonical_ingredient_id: canonicalId,
        name,
        normalized_name: normalized,
        quantity,
        category: resolvedCategory,
        source_location,
        confidence,
        status: 'available',
        item_attributes: {
          source_location,
          canonical_ingredient_id: canonicalId,
        },
        last_seen_at: new Date().toISOString(),
      });
      inserted++;
    }
  }

  return { inserted, updated, incompatibleUnits };
}
