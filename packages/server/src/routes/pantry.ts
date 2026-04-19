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
import { aggregateLocationSuggestions } from '../services/suggestionAggregator.js';
import {
  incrementScanCounts,
  promoteCandidateCanonicals,
} from '../services/canonicalPromoter.js';

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

    // Phase 21-03: learning-pipeline fire-and-forget. Each call is wrapped in
    // try/catch at the service layer so void-not-awaited is safe, but we
    // also .catch here to silence UnhandledPromiseRejection warnings during
    // test runs where mocks may reject. Scan commit MUST NOT be blocked on
    // any of these telemetry calls. Promise.resolve() wrapper guarantees a
    // .catch is available even if a mock returns undefined.
    const canonicalIds = Array.isArray((data as any)?.canonicalIds)
      ? ((data as any).canonicalIds as string[])
      : [];
    void Promise.resolve(incrementScanCounts(supabase, canonicalIds)).catch(() => {});
    void Promise.resolve(promoteCandidateCanonicals(supabase)).catch(() => {});
    void Promise.resolve(aggregateLocationSuggestions(supabase, user.id)).catch(() => {});

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

/* ──────────────────────────────────────────────────────────────────────
 * Phase 21-03 — 5 new route groups: staples, rules, suggestions, preview,
 * category-override. All user-scoped via RLS on the authed supabase client.
 * ──────────────────────────────────────────────────────────────────────── */

const VALID_CATEGORIES = new Set([
  'produce',
  'protein',
  'dairy',
  'grain',
  'condiment',
  'beverage',
  'frozen',
  'spice',
  'bakery',
  'other',
]);

// ── /staples ────────────────────────────────────────────────────────────
/**
 * POST /staples — mark a canonical as a user staple.
 * Body: { canonical_ingredient_id: string }
 * Guard (Pitfall 4): canonical MUST have status='active'. Marking a candidate
 * as a staple combined with the aggressive 0.3 auto-accept threshold would
 * poison the pantry with low-quality data.
 */
pantry.post('/staples', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ canonical_ingredient_id?: string }>();
  const canonicalId = body.canonical_ingredient_id;
  if (typeof canonicalId !== 'string' || !canonicalId.trim()) {
    return c.json({ error: 'Missing canonical_ingredient_id' }, 400);
  }

  const { data: canonical } = await supabase
    .from('canonical_ingredients')
    .select('status')
    .eq('id', canonicalId)
    .maybeSingle();

  if (!canonical || canonical.status !== 'active') {
    return c.json({ error: 'CANONICAL_NOT_ACTIVE' }, 400);
  }

  const { error } = await supabase.from('user_staples').insert({
    user_id: user.id,
    canonical_ingredient_id: canonicalId,
  });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: { canonical_ingredient_id: canonicalId } }, 201);
});

/**
 * GET /staples — list caller's staples joined to canonical_name.
 */
pantry.get('/staples', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const { data, error } = await supabase
    .from('user_staples')
    .select(
      'canonical_ingredient_id, created_at, canonical_ingredients(canonical_name)',
    )
    .eq('user_id', user.id);
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: data ?? [] });
});

/**
 * DELETE /staples/:canonical_id — remove a staple.
 */
pantry.delete('/staples/:canonical_id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const canonicalId = c.req.param('canonical_id');
  const { error } = await supabase
    .from('user_staples')
    .delete()
    .eq('user_id', user.id)
    .eq('canonical_ingredient_id', canonicalId);
  if (error) return c.json({ error: error.message }, 500);
  return c.body(null, 204);
});

// ── /rules ──────────────────────────────────────────────────────────────
/**
 * POST /rules — create a user rule (name_mapping or location_mapping).
 *
 * name_mapping: { rule_type, alias_name, target_canonical_id } →
 *   ingredient_aliases(source='user_rule', confidence=1.0).
 * location_mapping: { rule_type, canonical_ingredient_id, source_location } →
 *   user_location_rules with precedence = max(existing precedence) + 1.
 */
pantry.post('/rules', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    rule_type?: string;
    alias_name?: string;
    target_canonical_id?: string;
    canonical_ingredient_id?: string;
    source_location?: string;
  }>();

  if (body.rule_type === 'name_mapping') {
    if (!body.alias_name || !body.target_canonical_id) {
      return c.json({ error: 'name_mapping requires alias_name + target_canonical_id' }, 400);
    }
    const { error } = await supabase.from('ingredient_aliases').insert({
      alias_name: body.alias_name.trim().toLowerCase(),
      canonical_ingredient_id: body.target_canonical_id,
      source: 'user_rule',
      confidence: 1.0,
    });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data: { rule_type: 'name_mapping' } }, 201);
  }

  if (body.rule_type === 'location_mapping') {
    if (!body.canonical_ingredient_id || !body.source_location) {
      return c.json(
        { error: 'location_mapping requires canonical_ingredient_id + source_location' },
        400,
      );
    }
    if (!VALID_LOCATIONS.has(body.source_location)) {
      return c.json({ error: 'Invalid source_location' }, 400);
    }
    // Compute precedence = max(existing for user) + 1.
    const { data: existing } = await supabase
      .from('user_location_rules')
      .select('precedence')
      .eq('user_id', user.id);
    const maxPrec = (existing ?? []).reduce(
      (acc: number, row: { precedence: number }) =>
        row.precedence > acc ? row.precedence : acc,
      -1,
    );
    const { error } = await supabase.from('user_location_rules').insert({
      user_id: user.id,
      canonical_ingredient_id: body.canonical_ingredient_id,
      source_location: body.source_location,
      precedence: maxPrec + 1,
    });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ data: { rule_type: 'location_mapping' } }, 201);
  }

  return c.json({ error: 'Invalid rule_type (name_mapping | location_mapping)' }, 400);
});

/**
 * GET /rules — combined list of name-mapping aliases + location rules.
 */
pantry.get('/rules', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  const { data: aliases } = await supabase
    .from('ingredient_aliases')
    .select('id, alias_name, canonical_ingredient_id')
    .eq('source', 'user_rule');

  const { data: locationRules } = await supabase
    .from('user_location_rules')
    .select('id, canonical_ingredient_id, source_location, precedence')
    .eq('user_id', user.id)
    .order('precedence', { ascending: true });

  return c.json({
    name_mapping: aliases ?? [],
    location_mapping: locationRules ?? [],
  });
});

/**
 * PATCH /rules/reorder — rewrite precedence of location rules.
 * Body: { rule_ids: string[] } — new precedence = index.
 */
pantry.patch('/rules/reorder', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{ rule_ids?: unknown }>();
  if (!Array.isArray(body.rule_ids)) {
    return c.json({ error: 'rule_ids must be an array' }, 400);
  }
  const ids = body.rule_ids as string[];
  await Promise.all(
    ids.map((id, idx) =>
      supabase
        .from('user_location_rules')
        .update({ precedence: idx })
        .eq('id', id)
        .eq('user_id', user.id),
    ),
  );
  return c.json({ data: { reordered: ids.length } });
});

/**
 * DELETE /rules/:id — tries ingredient_aliases first, then user_location_rules.
 * Returns 204 regardless of which table owned the id (RLS guards visibility).
 */
pantry.delete('/rules/:id', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  // Delete from both — only the owning table's row will actually go.
  // ingredient_aliases has no user_id column (they're global with source='user_rule');
  // RLS policy on the table restricts who can DELETE to the creator.
  await supabase.from('ingredient_aliases').delete().eq('id', id);
  await supabase
    .from('user_location_rules')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  return c.body(null, 204);
});

// ── /suggestions ────────────────────────────────────────────────────────
/**
 * GET /suggestions — returns active (not-yet-dismissed) suggested_rules for
 * the caller.
 */
pantry.get('/suggestions', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const { data } = await supabase
    .from('suggested_rules')
    .select('id, rule_type, payload, occurrence_count, first_seen, last_seen')
    .eq('user_id', user.id)
    .eq('dismissed_at', null);
  return c.json({ data: data ?? [] });
});

/**
 * POST /suggestions/:id/accept — creates the rule + dismisses the suggestion.
 *
 * - name_mapping → ingredient_aliases insert (source='user_rule', confidence=1.0)
 * - location_mapping → user_location_rules insert. W3: reads
 *   canonical_ingredient_id from payload directly (pre-resolved by
 *   suggestionAggregator); guards against candidate canonicals at accept-time
 *   (returns 400 CANONICAL_NOT_ACTIVE so the user can retry after promotion).
 */
pantry.post('/suggestions/:id/accept', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');

  const { data: suggestion } = await supabase
    .from('suggested_rules')
    .select('rule_type, payload')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!suggestion) return c.json({ error: 'NOT_FOUND' }, 404);

  const payload = (suggestion.payload ?? {}) as Record<string, unknown>;

  if (suggestion.rule_type === 'name_mapping') {
    const alias = String(payload.alias_name ?? '').trim().toLowerCase();
    const target = payload.target_canonical_id as string | undefined;
    if (!alias || !target) {
      return c.json({ error: 'PAYLOAD_MISSING_FIELDS' }, 400);
    }
    await supabase.from('ingredient_aliases').insert({
      alias_name: alias,
      canonical_ingredient_id: target,
      source: 'user_rule',
      confidence: 1.0,
    });
  } else if (suggestion.rule_type === 'location_mapping') {
    const canonicalId = payload.canonical_ingredient_id as string | undefined;
    const userLocation = payload.user_location as string | undefined;
    if (!canonicalId || !userLocation) {
      return c.json({ error: 'PAYLOAD_MISSING_FIELDS' }, 400);
    }
    const { data: canonical } = await supabase
      .from('canonical_ingredients')
      .select('status')
      .eq('id', canonicalId)
      .maybeSingle();
    if (!canonical || canonical.status !== 'active') {
      // Don't dismiss — user can retry once promotion catches up.
      return c.json({ error: 'CANONICAL_NOT_ACTIVE' }, 400);
    }
    // Compute precedence = max+1 for consistency with POST /rules behavior.
    const { data: existing } = await supabase
      .from('user_location_rules')
      .select('precedence')
      .eq('user_id', user.id);
    const maxPrec = (existing ?? []).reduce(
      (acc: number, row: { precedence: number }) =>
        row.precedence > acc ? row.precedence : acc,
      -1,
    );
    await supabase.from('user_location_rules').insert({
      user_id: user.id,
      canonical_ingredient_id: canonicalId,
      source_location: userLocation,
      precedence: maxPrec + 1,
    });
  } else {
    return c.json({ error: 'UNKNOWN_RULE_TYPE' }, 400);
  }

  await supabase
    .from('suggested_rules')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);

  return c.json({ data: { accepted: true } });
});

/**
 * POST /suggestions/:id/dismiss — sets dismissed_at without creating a rule.
 */
pantry.post('/suggestions/:id/dismiss', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const id = c.req.param('id');
  await supabase
    .from('suggested_rules')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id);
  return c.json({ data: { dismissed: true } });
});

// ── /preview ────────────────────────────────────────────────────────────
/**
 * GET /preview?canonical_id=X — returns the 30-day scan_events impact list
 * (count + first 50 items). Match strategy (per RESEARCH Open Q1): item
 * matches if item.canonical_ingredient_id === target OR (for pre-canonical
 * events) normalized-name match against the canonical's canonical_name.
 */
pantry.get('/preview', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const canonicalId = c.req.query('canonical_id');
  if (!canonicalId) {
    return c.json({ error: 'Missing canonical_id query param' }, 400);
  }

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const { data: target } = await supabase
    .from('canonical_ingredients')
    .select('canonical_name')
    .eq('id', canonicalId)
    .maybeSingle();
  const normalizedTarget = ((target?.canonical_name as string | undefined) ?? '')
    .toLowerCase()
    .trim();

  const { data: events } = await supabase
    .from('scan_events')
    .select('id, final_items, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(100);

  const hits: Array<{ name: string; at: string }> = [];
  for (const ev of (events ?? []) as Array<{
    final_items?: unknown;
    created_at: string;
  }>) {
    const items = Array.isArray(ev.final_items) ? ev.final_items : [];
    for (const raw of items) {
      const item = raw as { name?: string; canonical_ingredient_id?: string };
      const byId = item.canonical_ingredient_id === canonicalId;
      const byName =
        !!normalizedTarget &&
        typeof item.name === 'string' &&
        item.name.toLowerCase().trim() === normalizedTarget;
      if (byId || byName) {
        hits.push({ name: String(item.name ?? ''), at: ev.created_at });
      }
    }
  }

  return c.json({ count: hits.length, items: hits.slice(0, 50) });
});

// ── /category-override ──────────────────────────────────────────────────
/**
 * POST /category-override — silent write to canonical_category_override
 * (SINGULAR table name per Phase 24a migration 00013). Upserts on
 * (user_id, canonical_ingredient_id) PK. Per CONTEXT ROADMAP criterion #3 —
 * no toast / no confirmation; the next pantry read reflects the override
 * transparently through reconcileItems' precedence ladder.
 */
pantry.post('/category-override', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    canonical_ingredient_id?: string;
    category?: string;
  }>();

  if (!body.canonical_ingredient_id || typeof body.canonical_ingredient_id !== 'string') {
    return c.json({ error: 'Missing canonical_ingredient_id' }, 400);
  }
  if (!body.category || !VALID_CATEGORIES.has(body.category)) {
    return c.json({ error: 'Invalid category' }, 400);
  }

  const { error } = await supabase
    .from('canonical_category_override')
    .upsert(
      {
        user_id: user.id,
        canonical_ingredient_id: body.canonical_ingredient_id,
        category: body.category,
      },
      { onConflict: 'user_id,canonical_ingredient_id' },
    );
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data: { ok: true } });
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
