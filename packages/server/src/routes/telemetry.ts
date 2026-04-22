import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Telemetry ingest — two channels on one router:
 *   POST /cooking  — Phase 16 Wave 1 (cooking_events table)
 *   POST /shopping — Phase 20 Wave 1 (shopping_events table)
 *
 * Both mounts share the same auth middleware and the same payload-is-opaque
 * contract: clients scrub PII via their own sanitizePayload helpers before
 * sending (see apps/mobile/src/cooking/telemetry.ts and
 * apps/mobile/src/shopping/telemetry.ts; and 16-RESEARCH.md Pattern 1 +
 * 20-RESEARCH.md Pattern 2 Pitfall 6).
 *
 * Per 20-RESEARCH.md Open Question 3: add /shopping as a second handler on
 * the existing router rather than spawning a sibling file. Keeps
 * `app.route('/telemetry', telemetry)` in index.ts unchanged.
 */

const telemetry = new Hono();

telemetry.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// /cooking — Phase 16
// ---------------------------------------------------------------------------

// Event shape from client. `name` maps to `event_type` column; `timestamp`
// maps to `client_ts`. Schema-light: we don't enum-validate `name` so adding
// event kinds in later waves does not require a migration OR a server deploy.
const CookingEventSchema = z.object({
  name: z.string().min(1),
  session_id: z.string().min(1),
  timestamp: z.string().min(1),
  recipe_id: z.string().nullable().optional(),
  step_index: z.number().int().nullable().optional(),
  payload: z.record(z.any()).optional(),
});

const CookingBatchSchema = z.object({
  events: z.array(CookingEventSchema),
});

telemetry.post('/cooking', async (c) => {
  const user = c.get('user') as { id: string } | undefined;
  const supabase = c.get('supabase') as
    | {
        from: (table: string) => {
          insert: (rows: unknown[]) => Promise<{ data: unknown; error: unknown }>;
        };
      }
    | undefined;

  if (!user || !supabase) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'schema_error', details: 'invalid JSON' }, 400);
  }

  const parsed = CookingBatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'schema_error', details: parsed.error.flatten() },
      400,
    );
  }

  const events = parsed.data.events;
  if (events.length === 0) {
    // 204 No Content — no-op.
    return c.body(null, 204);
  }

  // Build rows. profile_id is injected from the authed user (never trusted
  // from the client). payload is opaque — client must sanitize per 16-RESEARCH.md
  // Pattern 1 anti-pattern guard (no raw transcripts).
  const rows = events.map((e) => ({
    profile_id: user.id,
    session_id: e.session_id,
    event_type: e.name,
    recipe_id: e.recipe_id ?? null,
    step_index: e.step_index ?? null,
    payload: e.payload ?? {},
    client_ts: e.timestamp,
  }));

  const { error } = await supabase.from('cooking_events').insert(rows);

  if (error) {
    return c.json({ error: 'insert_failed' }, 500);
  }

  return c.json({ inserted: rows.length }, 200);
});

// ---------------------------------------------------------------------------
// /shopping — Phase 20
// ---------------------------------------------------------------------------

// Mirrors CookingEventSchema with recipe_id/step_index swapped for
// shopping_list_id/shopping_order_id. Schema-light: `name` is an open string
// so new event kinds don't require deploys.
const ShoppingEventSchema = z.object({
  name: z.string().min(1),
  session_id: z.string().min(1),
  timestamp: z.string().min(1),
  shopping_list_id: z.string().nullable().optional(),
  shopping_order_id: z.string().nullable().optional(),
  payload: z.record(z.any()).optional(),
});

const ShoppingBatchSchema = z.object({
  events: z.array(ShoppingEventSchema),
});

telemetry.post('/shopping', async (c) => {
  const user = c.get('user') as { id: string } | undefined;
  const supabase = c.get('supabase') as
    | {
        from: (table: string) => {
          insert: (rows: unknown[]) => Promise<{ data: unknown; error: unknown }>;
        };
      }
    | undefined;

  if (!user || !supabase) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'schema_error', details: 'invalid JSON' }, 400);
  }

  const parsed = ShoppingBatchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'schema_error', details: parsed.error.flatten() },
      400,
    );
  }

  const events = parsed.data.events;
  if (events.length === 0) {
    // 204 No Content — no-op.
    return c.body(null, 204);
  }

  // Build rows. profile_id ALWAYS server-injected from the authed user —
  // NEVER trusted from the body. payload is opaque — client sanitizes via
  // the 14-key whitelist in apps/mobile/src/shopping/telemetry.ts.
  const rows = events.map((e) => ({
    profile_id: user.id,
    session_id: e.session_id,
    event_type: e.name,
    shopping_list_id: e.shopping_list_id ?? null,
    shopping_order_id: e.shopping_order_id ?? null,
    payload: e.payload ?? {},
    client_ts: e.timestamp,
  }));

  const { error } = await supabase.from('shopping_events').insert(rows);

  if (error) {
    return c.json({ error: 'insert_failed' }, 500);
  }

  return c.json({ inserted: rows.length }, 200);
});

export default telemetry;
