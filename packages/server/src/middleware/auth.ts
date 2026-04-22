import type { Context, Next } from 'hono';
import { createUserClient, supabaseAdmin } from '../config/supabase.js';

/**
 * Auth middleware that verifies Bearer tokens via Supabase.
 * Sets `user`, `supabase` (user-scoped client) and `supabaseAdmin`
 * (service-role client — bypasses RLS, used by privileged flows like
 * /account/delete → supabase.auth.admin.deleteUser) on the Hono context.
 *
 * Exposing supabaseAdmin on the context (rather than importing it directly
 * in routes) keeps the auth-layer mock surface stable: route tests swap the
 * middleware out entirely and inject mock clients via c.set(...) without
 * needing to vi.mock each route's config import.
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const supabase = createUserClient(token);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('user', user);
  c.set('supabase', supabase);
  c.set('supabaseAdmin', supabaseAdmin);

  await next();
}
