import type { SupabaseClient } from '@supabase/supabase-js';
import { coerceCategory, type SourceLocation } from './vision.js';
import { SOURCE_LOCATIONS } from './sourceLocation.js';

export interface ConfirmedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  confidence: number;
  /**
   * Phase 18: per-item inferred kitchen location. Every ScanResult flowing into
   * reconcileItems carries this (populated by vision.ts STATIC_MAP post-correction).
   */
  source_location: SourceLocation;
}

const VALID_SOURCE_LOCATIONS = new Set<string>(SOURCE_LOCATIONS);

export interface PantryItem {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: string;
  source_location: string;
  /** Phase 18: forward-compatible JSONB metadata. Dual-written with source_location column. */
  item_attributes: Record<string, unknown> | null;
  confidence: number;
  status: string;
  last_seen_at: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Normalize item name: lowercase and trim whitespace.
 */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Reconcile confirmed scan items with existing pantry inventory.
 *
 * Phase 18 changes:
 * - Each item carries its own source_location (no top-level parameter).
 * - Dedup fetches existing items by (profile_id, normalized_name) cross-location
 *   (milk-in-fridge and a re-scan that suggests milk-in-pantry are the same
 *   item; re-scan updates quantity on the original row and does NOT move it).
 * - Dual-write: INSERT writes both source_location column AND
 *   item_attributes.source_location. UPDATE merges item_attributes so future
 *   keys survive (see RESEARCH Q5 and Phase 24 canonical-ingredient plan).
 * - source_location column is NOT overwritten on update (reconcile keys off the
 *   original classification; a future phase may opt-in to re-location on scan).
 */
export async function reconcileItems(
  supabase: SupabaseClient,
  profileId: string,
  items: ConfirmedItem[]
): Promise<PantryItem[]> {
  const results: PantryItem[] = [];

  for (const rawItem of items) {
    const location: SourceLocation = VALID_SOURCE_LOCATIONS.has(rawItem.source_location)
      ? rawItem.source_location
      : 'pantry';

    const item: ConfirmedItem = {
      name: String(rawItem.name ?? '').trim(),
      quantity: Number.isFinite(rawItem.quantity) ? Number(rawItem.quantity) : 1,
      unit: String(rawItem.unit ?? 'piece').trim() || 'piece',
      category: coerceCategory(rawItem.category),
      confidence: Math.max(0, Math.min(1, Number(rawItem.confidence) || 1)),
      source_location: location,
    };
    if (!item.name) continue;
    const normalized = normalizeName(item.name);

    // Check existing cross-location. Phase 18: dedup by (profile_id + name).
    // A re-scan with a different inferred location still hits the original row;
    // quantity + last_seen_at update but source_location column stays pinned.
    const { data: existing, error: selectError } = await supabase
      .from('pantry_items')
      .select()
      .eq('profile_id', profileId)
      .eq('normalized_name', normalized);

    if (selectError) {
      throw new Error(`Failed to query pantry items: ${selectError.message}`);
    }

    if (existing && existing.length > 0) {
      const existingRow = existing[0];
      // Merge item_attributes: preserve all prior keys (forward-compat for
      // Phase 24 metadata), stamp current source_location.
      const priorAttrs =
        existingRow.item_attributes && typeof existingRow.item_attributes === 'object'
          ? (existingRow.item_attributes as Record<string, unknown>)
          : {};

      const { data: updated, error: updateError } = await supabase
        .from('pantry_items')
        .update({
          quantity: item.quantity,
          confidence: item.confidence,
          status: 'available',
          last_seen_at: new Date().toISOString(),
          item_attributes: { ...priorAttrs, source_location: item.source_location },
          // Intentionally NOT updating the source_location column — reconcile
          // keys off the original classification. See 18-RESEARCH.md Q5.
        })
        .eq('id', existingRow.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update pantry item: ${updateError.message}`);
      }

      results.push(updated as PantryItem);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('pantry_items')
        .insert({
          profile_id: profileId,
          name: item.name,
          normalized_name: normalized,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          source_location: item.source_location,
          item_attributes: { source_location: item.source_location },
          confidence: item.confidence,
          status: 'available',
          last_seen_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to insert pantry item: ${insertError.message}`);
      }

      results.push(inserted as PantryItem);
    }
  }

  return results;
}
