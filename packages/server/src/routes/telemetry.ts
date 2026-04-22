import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Phase 16 Wave 1: cooking-mode telemetry ingest.
 *
 * POST /cooking — accept a batch of client-generated cooking events, insert
 * into `cooking_events` under the authed user's profile. RLS enforced by
 * the user-scoped supabase client (authMiddleware seeds c.get('supabase')).
 *
 * The payload is treated as opaque — the client is responsible for scrubbing
 * PII (raw transcript text, user names, etc.) before sending. See the
 * `sanitizePayload` helper in apps/mobile/src/cooking/telemetry.ts and the
 * "Anti-pattern" note in 16-RESEARCH.md Pattern 1.
 */

const telemetry = new Hono();

telemetry.use('*', authMiddleware);

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

const BatchSchema = z.object({
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

  const parsed = BatchSchema.safeParse(body);
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

export default telemetry;
