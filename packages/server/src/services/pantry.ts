import type { SupabaseClient } from '@supabase/supabase-js';
import { coerceCategory } from './vision.js';

export interface ConfirmedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  confidence: number;
}

const VALID_SOURCE_LOCATIONS = new Set(['fridge', 'pantry', 'freezer']);

export interface PantryItem {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: string;
  source_location: string;
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
 * Upserts items by normalized_name + source_location. Never auto-deletes.
 */
export async function reconcileItems(
  supabase: SupabaseClient,
  profileId: string,
  items: ConfirmedItem[],
  sourceLocation: string
): Promise<PantryItem[]> {
  // Coerce source_location — the schema CHECK only allows fridge/pantry/freezer.
  const location = VALID_SOURCE_LOCATIONS.has(sourceLocation)
    ? sourceLocation
    : 'pantry';

  const results: PantryItem[] = [];

  for (const rawItem of items) {
    // Sanitize each item so a bad category or out-of-range confidence
    // doesn't crash the whole batch with a cryptic PG error.
    const item: ConfirmedItem = {
      name: String(rawItem.name ?? '').trim(),
      quantity: Number.isFinite(rawItem.quantity) ? Number(rawItem.quantity) : 1,
      unit: String(rawItem.unit ?? 'piece').trim() || 'piece',
      category: coerceCategory(rawItem.category),
      confidence: Math.max(0, Math.min(1, Number(rawItem.confidence) || 1)),
    };
    if (!item.name) continue;
    const normalized = normalizeName(item.name);

    // Check if item already exists for this user + name + location
    const { data: existing, error: selectError } = await supabase
      .from('pantry_items')
      .select()
      .eq('profile_id', profileId)
      .eq('normalized_name', normalized)
      .eq('source_location', location);

    if (selectError) {
      throw new Error(`Failed to query pantry items: ${selectError.message}`);
    }

    if (existing && existing.length > 0) {
      // Update existing item
      const { data: updated, error: updateError } = await supabase
        .from('pantry_items')
        .update({
          quantity: item.quantity,
          confidence: item.confidence,
          status: 'available',
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing[0].id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update pantry item: ${updateError.message}`);
      }

      results.push(updated as PantryItem);
    } else {
      // Insert new item
      const { data: inserted, error: insertError } = await supabase
        .from('pantry_items')
        .insert({
          profile_id: profileId,
          name: item.name.trim(),
          normalized_name: normalized,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          source_location: location,
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
