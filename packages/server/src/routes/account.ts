import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';

/**
 * Phase 23-01: Account management endpoints.
 *
 * Ships the non-destructive half of the /account surface:
 *   POST /change-password — re-auth via signInWithPassword(currentPassword)
 *                           then supabase.auth.updateUser({ password }).
 *   POST /change-email    — supabase.auth.updateUser({ email }). Supabase
 *                           emits its own confirmation email; the old address
 *                           stays active until the user clicks the link.
 *
 * Export + Delete are declared here as 501 stubs so the 401-no-auth case
 * shipped in 23-00's red tests goes green (authMiddleware short-circuits
 * before the handler runs) while the happy-path cases remain red for 23-02.
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
// GET /export — ships in 23-02
// ---------------------------------------------------------------------------
// Intentionally a 501 stub. The 401-no-auth case already goes green via
// authMiddleware; the happy-path case stays RED until 23-02.
account.get('/export', (c) => {
  return c.json({ error: 'Not implemented (ships in 23-02)' }, 501);
});

// ---------------------------------------------------------------------------
// POST /delete — ships in 23-02
// ---------------------------------------------------------------------------
account.post('/delete', (c) => {
  return c.json({ error: 'Not implemented (ships in 23-02)' }, 501);
});

export default account;
