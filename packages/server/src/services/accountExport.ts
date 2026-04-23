/**
 * Phase 23-02: Account data export (NFR-03).
 *
 * buildExportDump aggregates a user's rows across 5 tables into a single
 * JSON payload. The GET /account/export handler writes this directly to the
 * HTTP response body; mobile writes it to disk via expo-file-system and opens
 * the iOS share sheet via expo-sharing.
 *
 * Every row query passes `.eq('profile_id', userId)` explicitly even though
 * RLS already enforces `auth.uid() = profile_id` on SELECT for all 5 tables.
 * The redundant filter is belt-and-suspenders: if this service is ever called
 * through a service-role client (which bypasses RLS), the filter still
 * prevents cross-profile leaks.
 *
 * The 5 queries run in parallel via Promise.all — their error returns are
 * swallowed (null → []) so a single-table miss doesn't blow up the whole
 * export. The auth middleware already rejected the request if the user
 * isn't valid; a table-level error here is a server-side bug, not a user
 * permission issue.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExportDump {
  profile: unknown;
  pantry: unknown[];
  recipes: unknown[];
  meal_plans: unknown[];
  cook_history: unknown[];
  exported_at: string;
}

export async function buildExportDump(
  supabase: SupabaseClient,
  userId: string,
): Promise<ExportDump> {
  const [profileRes, pantryRes, recipesRes, plansRes, cooksRes] =
    await Promise.all([
      // maybeSingle (not single) so a missing profile row returns data:null
      // instead of surfacing Supabase's "PGRST116 no rows returned" error.
      // The export must still succeed — a user with no profile row should
      // still get a valid JSON with profile: null.
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('pantry_items').select('*').eq('profile_id', userId),
      supabase.from('recipes').select('*').eq('profile_id', userId),
      // meal_plans entries live in a separate table; pull them together so
      // the export is self-contained (user can reconstruct week history).
      supabase
        .from('meal_plans')
        .select('*, entries:meal_plan_entries(*)')
        .eq('profile_id', userId),
      supabase.from('recipe_cooks').select('*').eq('profile_id', userId),
    ]);

  return {
    profile: profileRes.data ?? null,
    pantry: (pantryRes.data as unknown[] | null) ?? [],
    recipes: (recipesRes.data as unknown[] | null) ?? [],
    meal_plans: (plansRes.data as unknown[] | null) ?? [],
    cook_history: (cooksRes.data as unknown[] | null) ?? [],
    exported_at: new Date().toISOString(),
  };
}
