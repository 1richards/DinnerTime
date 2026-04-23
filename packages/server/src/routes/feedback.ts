import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { env } from '../config/env.js';

/**
 * Phase 25-01: In-app feedback capture + admin beta-invite read-through.
 *
 * Surface:
 *   POST /feedback           — auth-required. Inserts one row into
 *                              feedback_submissions with profile_id derived
 *                              from c.get('user').id; platform hardcoded to
 *                              'ios' (Phase 25 is iOS-only). Returns 201 + { id }.
 *   GET  /admin/beta-invites — auth-required AND user.email must appear in
 *                              env.ADMIN_EMAILS_LIST. Reads the beta_invites
 *                              table (RLS deny-by-default — the admin service
 *                              client bypasses) and returns ordered rows for
 *                              Patrick's BETA-PLAYBOOK cohort tracking.
 *
 * Single-router-mount-at-root pattern: index.ts does `app.route('/', feedback)`
 * so this router owns both /feedback AND /admin/beta-invites without needing
 * a second router file. Keeps the admin surface minimal and co-located with
 * the feature it's auditing (BETA-07 / BETA-11 / BETA-24).
 *
 * Requirements: BETA-07 (in-app feedback UX), BETA-11 (admin read-through),
 * BETA-24 (feedback ingestion).
 */

const feedback = new Hono();

feedback.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// POST /feedback
// ---------------------------------------------------------------------------

// Mirrors the 00030_feedback_submissions.sql CHECK (length BETWEEN 1 AND 4000)
// so the 400 client-side error fires BEFORE the DB rejects the row. email is
// optional: the sheet may submit the auth email or let the user clear it.
const FeedbackSchema = z.object({
  message: z.string().min(1).max(4000),
  email: z.string().email().max(320).optional(),
  app_version: z.string().max(32).optional(),
  build_number: z.string().max(32).optional(),
  screenshot_path: z.string().max(512).optional(),
});

feedback.post('/feedback', async (c) => {
  const user = c.get('user') as { id: string; email?: string } | undefined;
  const supabase = c.get('supabase') as
    | {
        from: (table: string) => {
          insert: (row: unknown) => {
            select: (cols?: string) => {
              single: () => Promise<{ data: { id: unknown } | null; error: unknown }>;
            };
          };
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

  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: 'schema_error', details: parsed.error.flatten() },
      400,
    );
  }

  // profile_id is ALWAYS server-injected from the authed user — NEVER trusted
  // from the body. platform defaults to 'ios' (Phase 25 is iOS-only).
  const row = {
    profile_id: user.id,
    message: parsed.data.message,
    email: parsed.data.email ?? null,
    app_version: parsed.data.app_version ?? null,
    build_number: parsed.data.build_number ?? null,
    screenshot_path: parsed.data.screenshot_path ?? null,
    platform: 'ios' as const,
  };

  const { data, error } = await supabase
    .from('feedback_submissions')
    .insert(row)
    .select('id')
    .single();

  if (error || !data) {
    return c.json({ error: 'insert_failed' }, 500);
  }

  return c.json({ id: data.id }, 201);
});

// ---------------------------------------------------------------------------
// GET /admin/beta-invites
// ---------------------------------------------------------------------------
//
// Gated by env.ADMIN_EMAILS_LIST (comma-separated allowlist). Reads via the
// service-role supabaseAdmin client so it can bypass beta_invites' deny-by-
// default RLS. Returns at most 100 rows ordered most-recent-first — the
// private beta cohort is ≤15 users so pagination is unnecessary.

feedback.get('/admin/beta-invites', async (c) => {
  const user = c.get('user') as { id: string; email?: string } | undefined;
  const supabaseAdmin = c.get('supabaseAdmin') as
    | {
        from: (table: string) => {
          select: (cols: string) => {
            order: (col: string, opts: { ascending: boolean }) => {
              limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>;
            };
          };
        };
      }
    | undefined;

  if (!user || !supabaseAdmin) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  const email = (user.email ?? '').toLowerCase();
  if (!email || !env.ADMIN_EMAILS_LIST.includes(email)) {
    return c.json({ error: 'forbidden' }, 403);
  }

  const { data, error } = await supabaseAdmin
    .from('beta_invites')
    .select('*')
    .order('invited_at', { ascending: false })
    .limit(100);

  if (error) {
    return c.json({ error: 'query_failed' }, 500);
  }

  return c.json({ invites: data ?? [] }, 200);
});

export default feedback;
