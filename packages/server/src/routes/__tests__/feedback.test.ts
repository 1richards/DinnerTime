/**
 * Phase 25-01: feedback route + admin beta-invites route contract tests.
 *
 * Shape mirrors packages/server/src/routes/__tests__/telemetry.test.ts exactly —
 * auth middleware is swapped with a test-only stub that injects `user` +
 * `supabase` + `supabaseAdmin` on the Hono context, and individual tables are
 * backed by an in-memory builder so each assertion can inspect the rows that
 * would have landed in Postgres.
 *
 * Requirements tracked: BETA-07 (in-app feedback), BETA-11 (admin beta-invite
 * read-through for Patrick), BETA-24 (feedback ingestion).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthMiddleware,
  supabase,
  supabaseAdmin,
  tableState,
  setAuthUser,
} = vi.hoisted(() => {
  type Resp = { data: unknown; error: unknown };
  type SingleResp = { data: unknown; error: unknown };

  const tableState: Record<
    string,
    {
      insertResult?: Resp;
      insertedRows?: unknown[];
      selectRows?: unknown[];
      selectError?: unknown;
    }
  > = {};

  function makeBuilder(table: string) {
    const s = tableState[table] ?? (tableState[table] = {});
    const builder: any = {
      insert: vi.fn((rows: unknown) => {
        // Normalize single-object inserts into an array for inspection.
        const arr = Array.isArray(rows) ? rows : [rows];
        s.insertedRows = arr;
        // Support .insert(...).select('id').single() chain.
        const inserted = arr[0];
        const insertResult = s.insertResult ?? { data: arr, error: null };
        builder._pendingInsertResult = insertResult;
        builder._pendingInsertedRow = inserted;
        return builder;
      }),
      select: vi.fn((_cols?: string) => builder),
      single: vi.fn(async () => {
        if (builder._pendingInsertResult) {
          const r = builder._pendingInsertResult;
          if (r.error) return { data: null, error: r.error };
          // Default: echo back the inserted row augmented with an id.
          const row = builder._pendingInsertedRow as Record<string, unknown>;
          return { data: { ...row, id: (row as any).id ?? 'fb-123' }, error: null };
        }
        return { data: null, error: null };
      }),
      order: vi.fn(() => builder),
      limit: vi.fn(async () => {
        if (s.selectError) return { data: null, error: s.selectError };
        return { data: s.selectRows ?? [], error: null };
      }),
      eq: vi.fn(() => builder),
    };
    return builder;
  }

  const supabase = { from: vi.fn((table: string) => makeBuilder(table)) };
  const supabaseAdmin = { from: vi.fn((table: string) => makeBuilder(table)) };

  let currentUser: { id: string; email?: string } | null = {
    id: 'user-1',
    email: 'user@example.com',
  };

  return {
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'unauthorized' }, 401);
      if (!currentUser) return c.json({ error: 'unauthorized' }, 401);
      c.set('user', currentUser);
      c.set('supabase', supabase);
      c.set('supabaseAdmin', supabaseAdmin);
      await next();
    }),
    supabase,
    supabaseAdmin,
    tableState,
    setAuthUser: (u: { id: string; email?: string } | null) => {
      currentUser = u;
    },
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

// Mock env to control ADMIN_EMAILS_LIST without touching process.env.
vi.mock('../../config/env.js', () => ({
  env: {
    get ADMIN_EMAILS_LIST() {
      return (process.env.__TEST_ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    },
  },
}));

const { default: feedback } = await import('../feedback.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/', feedback);
  return app;
}

function resetTables() {
  for (const k of Object.keys(tableState)) delete tableState[k];
}

describe('POST /feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
    setAuthUser({ id: 'user-1', email: 'user@example.com' });
    process.env.__TEST_ADMIN_EMAILS = '';
  });

  it('inserts a feedback_submission row with auth.uid() as profile_id', async () => {
    const app = makeApp();
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'The pantry scan took 20 seconds.',
        app_version: '1.0.0',
        build_number: '42',
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: unknown };
    expect(body.id).toBeDefined();

    expect(supabase.from).toHaveBeenCalledWith('feedback_submissions');
    const inserted = tableState['feedback_submissions']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    expect(inserted).toHaveLength(1);
    expect(inserted?.[0]?.profile_id).toBe('user-1');
    expect(inserted?.[0]?.platform).toBe('ios');
    expect(inserted?.[0]?.message).toBe('The pantry scan took 20 seconds.');
    expect(inserted?.[0]?.app_version).toBe('1.0.0');
    expect(inserted?.[0]?.build_number).toBe('42');
  });

  it('rejects message shorter than 1 char or longer than 4000', async () => {
    const app = makeApp();

    // Empty message → 400 schema_error.
    const tooShort = await app.request('/feedback', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: '' }),
    });
    expect(tooShort.status).toBe(400);

    // Message too long → 400 schema_error.
    const longMsg = 'x'.repeat(4001);
    const tooLong = await app.request('/feedback', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer t',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: longMsg }),
    });
    expect(tooLong.status).toBe(400);
  });

  it('returns 401 when no auth', async () => {
    const app = makeApp();
    const res = await app.request('/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /admin/beta-invites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
    setAuthUser({ id: 'user-1', email: 'admin@example.com' });
    process.env.__TEST_ADMIN_EMAILS = 'admin@example.com';
  });

  it('returns beta_invites rows when requesting user email is in ADMIN_EMAILS allowlist', async () => {
    tableState['beta_invites'] = {
      selectRows: [
        { id: 'inv-1', email: 'a@x.com', status: 'invited' },
        { id: 'inv-2', email: 'b@x.com', status: 'onboarded' },
      ],
    };
    const app = makeApp();
    const res = await app.request('/admin/beta-invites', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { invites: unknown[] };
    expect(Array.isArray(body.invites)).toBe(true);
    expect(body.invites).toHaveLength(2);
  });

  it('returns 403 when requesting user is not admin', async () => {
    process.env.__TEST_ADMIN_EMAILS = 'someone-else@example.com';
    setAuthUser({ id: 'user-1', email: 'user@example.com' });
    const app = makeApp();
    const res = await app.request('/admin/beta-invites', {
      method: 'GET',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(403);
  });
});
