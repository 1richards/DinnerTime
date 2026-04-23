/**
 * Red test stub (Phase 23 Wave 0) — routes ship in 23-01 (change-password,
 * change-email, export) and 23-02 (delete).
 *
 * Imports `../account.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../account.js'" — that is the red signal.
 *
 * Wave 1 creates `packages/server/src/routes/account.ts` with four handlers:
 *   POST /change-password  body: { currentPassword, newPassword }
 *   POST /change-email     body: { newEmail }
 *   GET  /export           → application/json dump
 *   POST /delete           body: { reason? } → writes account_deletions + cascades delete
 *
 * All routes are authed via the shared middleware. profile_id is always
 * derived from c.get('user') — never trusted from the body.
 *
 * Requirements: NFR-03 (change password), NFR-04 (delete), NFR-07 (export).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthMiddleware,
  supabase,
  supabaseAdmin,
  tableState,
  authState,
} = vi.hoisted(() => {
  type Resp = { data: unknown; error: unknown };
  const tableState: Record<
    string,
    { insertResult?: Resp; insertedRows?: unknown[] }
  > = {};
  const authState: {
    updateUserResult?: Resp;
    updateUserArgs?: unknown;
    signInResult?: Resp;
    signInArgs?: unknown;
    adminDeleteResult?: Resp;
    adminDeleteArgs?: unknown;
  } = {};

  function makeBuilder(table: string) {
    const s = tableState[table] ?? (tableState[table] = {});
    const builder: any = {
      insert: vi.fn(async (rows: unknown[]) => {
        s.insertedRows = rows;
        return s.insertResult ?? { data: rows, error: null };
      }),
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    };
    return builder;
  }

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table)),
    auth: {
      updateUser: vi.fn(async (args: unknown) => {
        authState.updateUserArgs = args;
        return authState.updateUserResult ?? { data: { user: { id: 'user-1' } }, error: null };
      }),
      signInWithPassword: vi.fn(async (args: unknown) => {
        authState.signInArgs = args;
        return authState.signInResult ?? { data: { user: { id: 'user-1' } }, error: null };
      }),
    },
  };

  const supabaseAdmin = {
    auth: {
      admin: {
        deleteUser: vi.fn(async (uid: string) => {
          authState.adminDeleteArgs = uid;
          return authState.adminDeleteResult ?? { data: { user: { id: uid } }, error: null };
        }),
      },
    },
    from: vi.fn((table: string) => makeBuilder(table)),
  };

  return {
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'Missing auth' }, 401);
      c.set('user', { id: 'user-1', email: 'user1@example.com' });
      c.set('supabase', supabase);
      c.set('supabaseAdmin', supabaseAdmin);
      await next();
    }),
    supabase,
    supabaseAdmin,
    tableState,
    authState,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

// Module shipped in 23-01 (change-password + change-email handlers) and
// extended in 23-02 (export + delete handlers); the @ts-expect-error the
// Wave-0 red stub carried is now redundant.
const { default: account } = await import('../account.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/account', account);
  return app;
}

function resetAll() {
  for (const k of Object.keys(tableState)) delete tableState[k];
  authState.updateUserResult = undefined;
  authState.updateUserArgs = undefined;
  authState.signInResult = undefined;
  authState.signInArgs = undefined;
  authState.adminDeleteResult = undefined;
  authState.adminDeleteArgs = undefined;
}

describe('POST /account/change-password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAll();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/account/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'a', newPassword: 'b' }),
    });
    expect(res.status).toBe(401);
  });

  it('400 when currentPassword missing', async () => {
    const app = makeApp();
    const res = await app.request('/account/change-password', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: 'newpw-longenough' }),
    });
    expect(res.status).toBe(400);
  });

  it('401 when currentPassword wrong (re-auth fails)', async () => {
    authState.signInResult = {
      data: null,
      error: { message: 'Invalid login credentials' },
    };
    const app = makeApp();
    const res = await app.request('/account/change-password', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'wrong-pw',
        newPassword: 'newpw-longenough',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('200 on success — supabase.auth.updateUser({ password }) called', async () => {
    const app = makeApp();
    const res = await app.request('/account/change-password', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'current-ok',
        newPassword: 'newpw-longenough',
      }),
    });
    expect(res.status).toBe(200);
    expect(supabase.auth.updateUser).toHaveBeenCalled();
    const call = (supabase.auth.updateUser as any).mock.calls[0][0];
    expect(call.password).toBe('newpw-longenough');
  });
});

describe('POST /account/change-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAll();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/account/change-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail: 'x@y.com' }),
    });
    expect(res.status).toBe(401);
  });

  it('400 on malformed email', async () => {
    const app = makeApp();
    const res = await app.request('/account/change-email', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });

  it('200 triggers supabase.auth.updateUser({ email })', async () => {
    const app = makeApp();
    const res = await app.request('/account/change-email', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ newEmail: 'new@example.com' }),
    });
    expect(res.status).toBe(200);
    expect(supabase.auth.updateUser).toHaveBeenCalled();
    const call = (supabase.auth.updateUser as any).mock.calls[0][0];
    expect(call.email).toBe('new@example.com');
  });
});

describe('GET /account/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAll();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/account/export', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('200 returns application/json with profile + pantry + recipes + meal_plans + cook_history keys', async () => {
    const app = makeApp();
    const res = await app.request('/account/export', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/i);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('profile');
    expect(body).toHaveProperty('pantry');
    expect(body).toHaveProperty('recipes');
    expect(body).toHaveProperty('meal_plans');
    expect(body).toHaveProperty('cook_history');
  });
});

describe('POST /account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAll();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'no longer using app' }),
    });
    expect(res.status).toBe(401);
  });

  it('200 writes to account_deletions then calls supabaseAdmin.auth.admin.deleteUser', async () => {
    const app = makeApp();
    const res = await app.request('/account/delete', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'switching apps' }),
    });
    expect(res.status).toBe(200);

    // Audit log written BEFORE the user row is destroyed.
    const inserted = tableState['account_deletions']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    expect(inserted).toHaveLength(1);
    expect(inserted?.[0]?.profile_id).toBe('user-1');
    expect(inserted?.[0]?.reason).toBe('switching apps');

    // Then cascade-delete the auth.users row.
    expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalled();
    expect(authState.adminDeleteArgs).toBe('user-1');

    const body = (await res.json()) as { deleted?: boolean };
    expect(body.deleted).toBe(true);
  });

  it('reason is optional — omitting body still succeeds with reason=null', async () => {
    const app = makeApp();
    const res = await app.request('/account/delete', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const inserted = tableState['account_deletions']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    expect(inserted?.[0]?.reason ?? null).toBeNull();
  });
});
