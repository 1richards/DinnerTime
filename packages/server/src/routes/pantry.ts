import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { identifyFoodItems, identifyFoodItemsBatch } from '../services/vision.js';
import { reconcileItems } from '../services/pantry.js';

const pantry = new Hono();

pantry.use('*', authMiddleware);

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
 * Body: { image: string (base64), source_location: 'fridge' | 'pantry' | 'freezer' }
 */
pantry.post('/scan', async (c) => {
  const body = await c.req.json<{ image: string; source_location: 'fridge' | 'pantry' | 'freezer' }>();

  if (!body.image || !body.source_location) {
    return c.json({ error: 'Missing required fields: image, source_location' }, 400);
  }

  const validLocations = ['fridge', 'pantry', 'freezer'];
  if (!validLocations.includes(body.source_location)) {
    return c.json({ error: 'Invalid source_location. Must be fridge, pantry, or freezer' }, 400);
  }

  try {
    const items = await identifyFoodItems(body.image, body.source_location);
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/scan] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /scan-batch - Send multiple base64 images for batch food identification.
 * Body: { images: string[] (1-5 base64 images), source_location: 'fridge' | 'pantry' | 'freezer' }
 */
pantry.post('/scan-batch', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ images: string[]; source_location: 'fridge' | 'pantry' | 'freezer' }>();

  const validLocations = ['fridge', 'pantry', 'freezer'];

  if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
    return c.json({ error: 'Missing or empty images array' }, 400);
  }

  if (body.images.length > 5) {
    return c.json({ error: 'images array must contain 1-5 elements' }, 400);
  }

  if (!body.source_location || !validLocations.includes(body.source_location)) {
    return c.json({ error: 'Invalid source_location. Must be fridge, pantry, or freezer' }, 400);
  }

  try {
    // Fetch existing items at this location so the AI can dedup against them.
    // Shelf-stable items (condiments, oils) appear in every scan — filtering
    // them out here keeps the review screen focused on what's actually new.
    const { data: existingItems } = await supabase
      .from('pantry_items')
      .select('name')
      .eq('profile_id', user.id)
      .eq('source_location', body.source_location)
      .eq('status', 'available');
    const existingNames = (existingItems ?? []).map((row: { name: string }) => row.name);

    const items = await identifyFoodItemsBatch(body.images, body.source_location, existingNames);
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/scan-batch] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /confirm - Confirm scan results and reconcile with pantry inventory.
 * Body: { items: ConfirmedItem[], source_location: string }
 */
pantry.post('/confirm', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    items: Array<{ name: string; quantity: number; unit: string; category: string; confidence: number }>;
    source_location: string;
  }>();

  if (!body.items || !body.source_location) {
    return c.json({ error: 'Missing required fields: items, source_location' }, 400);
  }

  try {
    const data = await reconcileItems(supabase, user.id, body.items, body.source_location);
    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Reconciliation failed';
    return c.json({ error: message }, 500);
  }
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
