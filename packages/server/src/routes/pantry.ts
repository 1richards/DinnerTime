import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { identifyFoodItems, identifyFoodItemsBatch, identifyReceiptItems } from '../services/vision.js';
import { reconcileItems, type ConfirmedItem } from '../services/pantry.js';
import { SOURCE_LOCATIONS, type SourceLocation } from '../services/sourceLocation.js';

const pantry = new Hono();

pantry.use('*', authMiddleware);

const VALID_LOCATIONS = new Set<string>(SOURCE_LOCATIONS);

/**
 * GET / - List pantry items for authenticated user.
 * Query params:
 *   ?location=fridge|pantry|freezer  - filter by source location
 *   ?include_used=true               - include used/depleted items (default: available only)
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
 */
pantry.post('/scan', async (c) => {
  const body = await c.req.json<{ image?: string }>();

  if (!body.image) {
    return c.json({ error: 'Missing required field: image' }, 400);
  }

  try {
    const items = await identifyFoodItems(body.image);
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
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/import-instacart] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /confirm - Confirm scan results and reconcile with pantry inventory.
 * Body: { items: ConfirmedItem[], profile_id: string }
 *
 * Phase 18: each item carries its own source_location enum. Route validates
 * every item has a valid enum value before invoking reconcileItems.
 */
pantry.post('/confirm', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    items?: ConfirmedItem[];
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
    const data = await reconcileItems(supabase, user.id, body.items as ConfirmedItem[]);
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
