import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import {
  identifyFoodItems,
  identifyFoodItemsBatch,
  identifyReceiptItems,
  type ScanResult,
} from '../services/vision.js';
import { reconcileItems } from '../services/pantry.js';
import { SOURCE_LOCATIONS, type SourceLocation } from '../services/sourceLocation.js';

const pantry = new Hono();

pantry.use('*', authMiddleware);

const VALID_LOCATIONS = new Set<string>(SOURCE_LOCATIONS);

/**
 * Phase 24-05 scan_events writer.
 *
 * Called after each of the 4 scan flows returns a ScanResult[]. Writes a
 * single immutable row to `scan_events` capturing:
 *   - scan_variant: which flow produced this scan
 *   - raw_ai_output: the items as returned from vision.ts (vision doesn't
 *     expose pre-normalize raw tool output; final_items serves as both the
 *     audit artifact and the pre-reconcile snapshot. Documented in plan.)
 *   - final_items: the post-normalize, PRE-canonical ScanResult[] (no
 *     canonical_ingredient_id resolved yet — that happens at /confirm).
 *   - field_confidence: flattened per-item confidence scores for quick JSONB
 *     indexing and future ML training signal.
 *
 * Fire-and-forget: a scan_events write failure MUST NOT break the scan.
 * Auth/vision errors are still surfaced to the user; telemetry is best-effort.
 */
type ScanVariant = 'camera' | 'batch' | 'receipt' | 'instacart';

async function writeScanEvent(
  supabase: any,
  userId: string,
  variant: ScanVariant,
  items: ScanResult[],
): Promise<void> {
  const fieldConfidence = items.map((it, idx) => ({
    item_index: idx,
    name: it.fieldConfidence?.name ?? 0,
    quantity: it.fieldConfidence?.quantity ?? 0,
    unit: it.fieldConfidence?.unit ?? 0,
    category: it.fieldConfidence?.category ?? 0,
  }));

  try {
    await supabase.from('scan_events').insert({
      user_id: userId,
      scan_variant: variant,
      raw_ai_output: items, // vision.ts does not expose pre-normalize raw; items IS the audit snapshot
      final_items: items,
      field_confidence: fieldConfidence,
    });
  } catch (err) {
    console.warn('[scan_events] write failed — continuing', err);
  }
}

/**
 * GET / - List pantry items for authenticated user.
 * Query params:
 *   ?location=fridge|pantry|freezer  - filter by source location
 *   ?include_used=true               - include used/depleted items (default: available only)
 *
 * Phase 24-05 (REQ-23): returns rows regardless of canonical_ingredient_id
 * NULL-ness. Legacy (pre-Phase-24) rows with canonical_ingredient_id=NULL
 * stay readable alongside new canonical FK rows. Forward-only — no backfill.
 */
pantry.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const location = c.req.query('location');
  const includeUsed = c.req.query('include_used') === 'true';

  let query = supabase
    .from('pantry_items')
    .select()
    .eq('profile_id', user.id)
    .order('category', { ascending: true });

  if (!includeUsed) {
    query = query.eq('status', 'available');
  }

  if (location) {
    query = query.eq('source_location', location);
  }

  const { data, error } = await query;

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
});

/**
 * POST /scan - Send a base64 image for Claude Vision food identification.
 * Body: { image: string (base64) }
 *
 * Phase 18: source_location no longer in body — AI infers per item and
 * STATIC_MAP post-corrects known entries.
 * Phase 24-05: writes one scan_events row with scan_variant='camera'.
 */
pantry.post('/scan', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ image?: string }>();

  if (!body.image) {
    return c.json({ error: 'Missing required field: image' }, 400);
  }

  try {
    const items = await identifyFoodItems(body.image);
    await writeScanEvent(supabase, user.id, 'camera', items);
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/scan] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /scan-batch - Send multiple base64 images for batch food identification.
 * Body: { images: string[] (1-5 base64 images) }
 *
 * Phase 18: source_location no longer in body. AI fans items out across
 * fridge/pantry/freezer per item. Existing-item dedup fetches across ALL
 * locations (single-user namespace is name-based per Phase 18 data model).
 * Phase 24-05: writes one scan_events row with scan_variant='batch'.
 */
pantry.post('/scan-batch', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ images?: string[] }>();

  if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
    return c.json({ error: 'Missing or empty images array' }, 400);
  }

  if (body.images.length > 5) {
    return c.json({ error: 'images array must contain 1-5 elements' }, 400);
  }

  try {
    // Cross-location existing-item dedup: shelf-stable items appear in every
    // scan regardless of where the AI just classified them. Fetching by user
    // only keeps the review screen focused on what's actually new.
    const { data: existingItems } = await supabase
      .from('pantry_items')
      .select('name')
      .eq('profile_id', user.id)
      .eq('status', 'available');
    const existingNames = (existingItems ?? []).map((row: { name: string }) => row.name);

    const items = await identifyFoodItemsBatch(body.images, existingNames);
    await writeScanEvent(supabase, user.id, 'batch', items);
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/scan-batch] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /scan-receipt - Extract pantry items from a single receipt photo.
 * Body: { image: string (base64) }
 *
 * Phase 18: receipts fan out per-item (dairy→fridge, frozen→freezer,
 * shelf-stable→pantry). No more hardcoded source_location='pantry'.
 * Phase 24-05: writes one scan_events row with scan_variant='receipt'.
 */
pantry.post('/scan-receipt', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ image?: string }>();

  if (!body.image) {
    return c.json({ error: 'Missing required field: image' }, 400);
  }

  try {
    const { data: existingItems } = await supabase
      .from('pantry_items')
      .select('name')
      .eq('profile_id', user.id)
      .eq('status', 'available');
    const existingNames = (existingItems ?? []).map((row: { name: string }) => row.name);

    const items = await identifyReceiptItems(body.image, existingNames, 'receipt');
    await writeScanEvent(supabase, user.id, 'receipt', items);
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/scan-receipt] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /import-instacart - Extract pantry items from an Instacart order-summary
 * screenshot. Body: { image: string (base64) }
 *
 * Phase 18: no longer hardcodes source_location='pantry'. AI fans out per item
 * based on ingredient context.
 * Phase 24-05: writes one scan_events row with scan_variant='instacart'.
 */
pantry.post('/import-instacart', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ image?: string }>();

  if (!body.image) {
    return c.json({ error: 'Missing required field: image' }, 400);
  }

  try {
    const { data: existingItems } = await supabase
      .from('pantry_items')
      .select('name')
      .eq('profile_id', user.id)
      .eq('status', 'available');
    const existingNames = (existingItems ?? []).map((row: { name: string }) => row.name);

    const items = await identifyReceiptItems(body.image, existingNames, 'instacart_screenshot');
    await writeScanEvent(supabase, user.id, 'instacart', items);
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/import-instacart] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /confirm - Confirm scan results and reconcile with pantry inventory.
 * Body: { items: ScanResult[], profile_id?: string }
 *
 * Phase 18: each item carries its own source_location enum. Route validates
 * every item has a valid enum value before invoking reconcileItems.
 * Phase 24-05: reconcileItems is the rewritten canonical-identity dedup +
 * quantity-aggregation service. It accepts ScanResult[] (nested Quantity +
 * fieldConfidence per 24-04) and returns { inserted, updated, incompatibleUnits }.
 * The response exposes that shape directly so mobile can surface it.
 */
pantry.post('/confirm', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    items?: ScanResult[];
    profile_id?: string;
  }>();

  if (!body.items || !Array.isArray(body.items)) {
    return c.json({ error: 'Missing required field: items' }, 400);
  }

  for (const item of body.items) {
    if (!item || typeof item.source_location !== 'string' || !VALID_LOCATIONS.has(item.source_location)) {
      return c.json(
        { error: 'Each item requires a valid source_location (fridge, pantry, or freezer)' },
        400
      );
    }
  }

  try {
    const data = await reconcileItems(supabase, user.id, body.items as ScanResult[]);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reconciliation failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /override-events - Log user corrections of AI-classified source_locations.
 *
 * Body: { events: Array<{ item_name: string; ai_location: SourceLocation; user_location: SourceLocation }> }
 *
 * RLS-gated via the user-authenticated supabase client (c.get('supabase')).
 * Never uses service role — event rows are user-scoped and inserted with
 * user_id = auth.uid() enforced by Postgres RLS.
 *
 * Filters:
 *   - Drop entries where either location is not in the enum (silent).
 *   - Drop no-op events (ai_location === user_location).
 *   - If all entries filtered out, returns 200 with inserted:0.
 *
 * Phase 21 consumes this table for per-user rule derivation.
 */
pantry.post('/override-events', async (c) => {
  const supabase = c.get('supabase');
  const body = await c.req.json<{
    events?: Array<{ item_name?: string; ai_location?: string; user_location?: string }>;
  }>();

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return c.json({ error: 'Missing or empty events array' }, 400);
  }

  const rows = body.events
    .filter((e) => {
      if (!e || typeof e.item_name !== 'string' || !e.item_name.trim()) return false;
      if (!e.ai_location || !VALID_LOCATIONS.has(e.ai_location)) return false;
      if (!e.user_location || !VALID_LOCATIONS.has(e.user_location)) return false;
      if (e.ai_location === e.user_location) return false;
      return true;
    })
    .map((e) => ({
      item_name: (e.item_name as string).trim().toLowerCase(),
      ai_location: e.ai_location as SourceLocation,
      user_location: e.user_location as SourceLocation,
    }));

  if (rows.length === 0) {
    return c.json({ data: { inserted: 0 } });
  }

  const { error } = await supabase.from('item_override_events').insert(rows);

  if (error) {
    console.error('[pantry/override-events] insert error:', error);
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data: { inserted: rows.length } });
});

/**
 * PATCH /:id - Update a pantry item (status, quantity, name).
 * Body: { status?, quantity?, name? }
 */
pantry.patch('/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  const body = await c.req.json<{ status?: string; quantity?: number; name?: string }>();

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.quantity !== undefined) updates.quantity = body.quantity;
  if (body.name !== undefined) {
    updates.name = body.name.trim();
    updates.normalized_name = body.name.trim().toLowerCase();
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  // Use maybeSingle so a 0-row match returns data=null (→ 404) instead of PGRST116 (→ 500).
  const { data, error } = await supabase
    .from('pantry_items')
    .update(updates)
    .eq('id', id)
    .eq('profile_id', user.id)
    .select()
    .maybeSingle();

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  if (!data) {
    return c.json({ error: 'Item not found' }, 404);
  }

  return c.json({ data });
});

export default pantry;
