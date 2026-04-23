import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { buildExportDump } from '../services/accountExport.js';

/**
 * Phase 23-01 + 23-02: Account management endpoints.
 *
 * Surface:
 *   POST /change-password — re-auth via signInWithPassword(currentPassword)
 *                           then supabase.auth.updateUser({ password }).
 *   POST /change-email    — supabase.auth.updateUser({ email }). Supabase
 *                           emits its own confirmation email; the old address
 *                           stays active until the user clicks the link.
 *   GET  /export          — returns the authed user's full data payload as
 *                           application/json (5-table aggregate via
 *                           buildExportDump). NFR-03.
 *   POST /delete          — writes an audit row into account_deletions, then
 *                           cascade-deletes the auth.users row via
 *                           supabaseAdmin.auth.admin.deleteUser. NFR-04.
 *
 * All routes are authed; profile_id is ALWAYS derived from c.get('user') —
 * never trusted from the body.
 */

const account = new Hono();

account.use('*', authMiddleware);

// ---------------------------------------------------------------------------
// POST /change-password
// ---------------------------------------------------------------------------

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

account.post('/change-password', async (c) => {
  const user = c.get('user') as { id: string; email?: string };
  const supabase = c.get('supabase') as {
    auth: {
      signInWithPassword: (args: {
        email: string;
        password: string;
      }) => Promise<{ data: unknown; error: { message: string } | null }>;
      updateUser: (args: {
        password?: string;
        email?: string;
      }) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const { currentPassword, newPassword } = parsed.data;

  // Re-authenticate: defence against session theft. Supabase has no dedicated
  // reauthenticate primitive for password flows, so we exercise signInWithPassword
  // against the authenticated user's own email. A failure here means the caller
  // doesn't know the current password — respond 401.
  if (!user.email) {
    return c.json({ error: 'Authenticated user has no email' }, 400);
  }

  const signIn = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signIn.error) {
    return c.json({ error: 'Current password incorrect' }, 401);
  }

  const upd = await supabase.auth.updateUser({ password: newPassword });
  if (upd.error) {
    return c.json({ error: upd.error.message ?? 'Password update failed' }, 500);
  }

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /change-email
// ---------------------------------------------------------------------------

const ChangeEmailSchema = z.object({
  newEmail: z.string().email(),
});

account.post('/change-email', async (c) => {
  const supabase = c.get('supabase') as {
    auth: {
      updateUser: (args: {
        email?: string;
      }) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
  };

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const parsed = ChangeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  const { newEmail } = parsed.data;

  // Supabase's own confirmation email flow fires on this call — the new email
  // is NOT live on the account until the user clicks the link in it. The old
  // email stays active in the meantime (Supabase default, NFR-02).
  const upd = await supabase.auth.updateUser({ email: newEmail });
  if (upd.error) {
    return c.json({ error: upd.error.message ?? 'Email update failed' }, 500);
  }

  return c.json({ success: true, emailConfirmationSent: true });
});

// ---------------------------------------------------------------------------
// GET /export — NFR-03 (23-02)
// ---------------------------------------------------------------------------

account.get('/export', async (c) => {
  const user = c.get('user') as { id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = c.get('supabase') as any;

  const dump = await buildExportDump(supabase, user.id);

  // Stable filename helps macOS/iOS Files show something human-readable when
  // the share-sheet "Save to Files" path is chosen. YYYY-MM-DD keeps
  // timezone-free ordering if a user runs the export multiple times.
  const today = new Date().toISOString().slice(0, 10);
  const filename = `dinnertime-export-${user.id}-${today}.json`;

  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="${filename}"`);
  return c.body(JSON.stringify(dump));
});

// ---------------------------------------------------------------------------
// POST /delete — NFR-04 (23-02)
// ---------------------------------------------------------------------------

const DeleteAccountSchema = z.object({
  reason: z.string().optional(),
});

account.post('/delete', async (c) => {
  const user = c.get('user') as { id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAdmin = c.get('supabaseAdmin') as any;

  // Body is optional — a confirmed-tap delete without a reason is valid.
  let reason: string | null = null;
  try {
    const body = (await c.req.json()) as unknown;
    const parsed = DeleteAccountSchema.safeParse(body);
    if (parsed.success && typeof parsed.data.reason === 'string') {
      const trimmed = parsed.data.reason.trim();
      reason = trimmed.length > 0 ? trimmed : null;
    }
  } catch {
    // No body or malformed JSON — reason stays null.
  }

  // 1) Write the audit row FIRST. If the admin delete fails after this, we
  //    still have a record of the attempt (and a 30-day retention window per
  //    migration default). account_deletions is deny-by-default RLS, so this
  //    insert requires the service-role client.
  const auditInsert = await supabaseAdmin
    .from('account_deletions')
    .insert([{ profile_id: user.id, reason }]);

  if (auditInsert.error) {
    return c.json({ error: 'Failed to record deletion request' }, 500);
  }

  // 2) Cascade-delete the auth.users row. ON DELETE CASCADE in the migrations
  //    takes care of profiles, pantry_items, recipes, meal_plans, telemetry,
  //    etc. This is irreversible — from here on the caller's next request
  //    will 401.
  const delRes = await supabaseAdmin.auth.admin.deleteUser(user.id);

  if (delRes.error) {
    // Audit row already exists — user can retry from the client. 500 signals
    // "try again" while keeping the audit trail intact.
    return c.json({ error: 'delete_failed' }, 500);
  }

  return c.json({ deleted: true });
});

export default account;
