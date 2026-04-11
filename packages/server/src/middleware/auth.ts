import type { Context, Next } from 'hono';
import { createUserClient } from '../config/supabase.js';

/**
 * Auth middleware that verifies Bearer tokens via Supabase.
 * Sets `user` and `supabase` (user-scoped client) on the Hono context.
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

  await next();
}
