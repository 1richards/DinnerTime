/**
 * Red test stub (Phase 16 Wave 0) — route ships in 16-01.
 *
 * Imports `../telemetry.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../telemetry.js'" — that is the red signal.
 *
 * Wave 1 (plan 16-01) creates `packages/server/src/routes/telemetry.ts` to
 * make these tests green.
 *
 * Requirement: COOK-UX-02 (telemetry backend — POST /api/v1/telemetry/cooking).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthMiddleware,
  supabase,
  tableState,
} = vi.hoisted(() => {
  type Resp = { data: unknown; error: unknown };
  const tableState: Record<
    string,
    { insertResult?: Resp; insertedRows?: unknown[] }
  > = {};

  function makeBuilder(table: string) {
    const s = tableState[table] ?? (tableState[table] = {});
    const builder: any = {
      insert: vi.fn(async (rows: unknown[]) => {
        s.insertedRows = rows;
        return s.insertResult ?? { data: rows, error: null };
      }),
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
    };
    return builder;
  }

  const supabase = { from: vi.fn((table: string) => makeBuilder(table)) };

  return {
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'Missing auth' }, 401);
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    supabase,
    tableState,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; shipped 16-01)
const { default: telemetry } = await import('../telemetry.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/telemetry', telemetry);
  return app;
}

function resetTables() {
  for (const k of Object.keys(tableState)) delete tableState[k];
}

describe('POST /telemetry/cooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/cooking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('204 when events: [] (no-op)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/cooking', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(204);
  });

  it('200 and inserts 3 rows when body has 3 valid events', async () => {
    const app = makeApp();
    const validEvent = (name: string) => ({
      name,
      session_id: 'sess-abc',
      timestamp: new Date().toISOString(),
      payload: { ms: 1200 },
    });

    const res = await app.request('/telemetry/cooking', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [validEvent('stt_final'), validEvent('intent_route'), validEvent('ask_latency')],
      }),
    });
    expect(res.status).toBe(200);
    expect(supabase.from).toHaveBeenCalled();
    // Implementation-defined table name — we just confirm insert fired with 3 rows.
    const insertedTable = (supabase.from as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(tableState[insertedTable]?.insertedRows).toHaveLength(3);
  });

  it('400 when schema invalid (missing events array)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/cooking', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(res.status).toBe(400);
  });
});
