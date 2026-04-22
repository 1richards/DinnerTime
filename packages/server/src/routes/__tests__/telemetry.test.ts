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

/**
 * Red test stub (Phase 20 Wave 0) — route handler lands in 20-01.
 *
 * These cases target a NOT-YET-SHIPPED POST /telemetry/shopping sibling of
 * /telemetry/cooking. Wave 1 (plan 20-01) will either:
 *   (a) extend routes/telemetry.ts with a second handler, or
 *   (b) add a new /telemetry/:channel parametric route,
 *   (c) ship a sibling routes/shopping-telemetry.ts router and mount it.
 *
 * Whichever path is chosen, the HTTP contract (mount point + status codes +
 * insert target table) must match these cases. See 20-RESEARCH.md
 * Pattern 2 and Open Question 3.
 *
 * Requirement: SHOP-DC-04 (server-side shopping telemetry ingest).
 */
describe('POST /telemetry/shopping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('204 when events: [] (no-op)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/shopping', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(204);
  });

  it('200 and inserts 3 rows into shopping_events with profile_id + event_type + list/order ids', async () => {
    const app = makeApp();
    const validEvent = (name: string) => ({
      name,
      session_id: 'sess-shop-abc',
      timestamp: new Date().toISOString(),
      shopping_list_id: 'list-fixture-20',
      shopping_order_id: 'order-abc',
      payload: { item_count: 4, variant: 'ok' },
    });

    const res = await app.request('/telemetry/shopping', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          validEvent('shopping.draft_cart_started'),
          validEvent('shopping.draft_cart_succeeded'),
          validEvent('shopping.handoff_opened_app'),
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(supabase.from).toHaveBeenCalled();
    // Wave 1 target table — shopping_events mirrors cooking_events path.
    const inserted = tableState['shopping_events']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    expect(inserted).toHaveLength(3);
    expect(inserted?.[0]?.profile_id).toBe('user-1');
    expect(inserted?.[0]?.event_type).toBe('shopping.draft_cart_started');
    expect(inserted?.[0]?.shopping_list_id).toBe('list-fixture-20');
    expect(inserted?.[0]?.shopping_order_id).toBe('order-abc');
  });

  it('400 when schema invalid (missing events array)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/shopping', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(res.status).toBe(400);
  });

  it('500 when supabase insert returns an error', async () => {
    // Seed the shopping_events insert to fail. We can't call makeApp()
    // before seeding because makeBuilder is created lazily on first access;
    // seed the table state then fire the request.
    tableState['shopping_events'] = {
      insertResult: { data: null, error: { message: 'insert boom' } },
    };
    const app = makeApp();
    const res = await app.request('/telemetry/shopping', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            name: 'shopping.draft_cart_started',
            session_id: 'sess-shop-abc',
            timestamp: new Date().toISOString(),
            payload: { item_count: 1 },
          },
        ],
      }),
    });
    expect(res.status).toBe(500);
  });
});

/**
 * Phase 22 Wave 0: POST /telemetry/plan — sibling of /cooking and /shopping.
 * Mirrors the shopping pattern with meal_plan_id + meal_plan_entry_id FKs
 * instead of list/order IDs. Target table: plan_events (migration 00025).
 *
 * Requirement: PLAN-X-10 foundation (telemetry pipeline backing
 * stretch_displayed, week_regenerated, day_drill_opened, swipe_action,
 * focus_theme_set, etc.).
 */
describe('POST /telemetry/plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('204 when events: [] (no-op)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/plan', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(204);
  });

  it('200 and inserts 3 rows into plan_events with profile_id + event_type + meal_plan ids', async () => {
    const app = makeApp();
    const validEvent = (name: string) => ({
      name,
      session_id: 'sess-plan-abc',
      timestamp: new Date().toISOString(),
      meal_plan_id: 'plan-fixture-22',
      meal_plan_entry_id: 'entry-fixture-22',
      payload: { ms: 1200, variant: 'swap' },
    });

    const res = await app.request('/telemetry/plan', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          validEvent('plan.recipe_pin_succeeded'),
          validEvent('plan.shopping_handoff_opened'),
          validEvent('plan.swipe_action'),
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(supabase.from).toHaveBeenCalled();
    const inserted = tableState['plan_events']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    expect(inserted).toHaveLength(3);
    expect(inserted?.[0]?.profile_id).toBe('user-1');
    expect(inserted?.[0]?.event_type).toBe('plan.recipe_pin_succeeded');
    expect(inserted?.[0]?.meal_plan_id).toBe('plan-fixture-22');
    expect(inserted?.[0]?.meal_plan_entry_id).toBe('entry-fixture-22');
  });

  it('400 when schema invalid (missing events array)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/plan', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: 'bar' }),
    });
    expect(res.status).toBe(400);
  });

  it('400 schema_error on invalid JSON', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/plan', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });

  it('500 when supabase insert returns an error', async () => {
    tableState['plan_events'] = {
      insertResult: { data: null, error: { message: 'insert boom' } },
    };
    const app = makeApp();
    const res = await app.request('/telemetry/plan', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            name: 'plan.recipe_pin_succeeded',
            session_id: 'sess-plan-abc',
            timestamp: new Date().toISOString(),
            payload: { ms: 1 },
          },
        ],
      }),
    });
    expect(res.status).toBe(500);
  });
});

/**
 * Red test stub (Phase 23 Wave 0) — handler lands in 23-06.
 *
 * Mirrors plan/shopping/cooking with task_name + model fields instead of
 * domain FKs. Target table: ai_events (migration 00027). Requirement: NFR-17.
 *
 * Critical server-side contract: profile_id is ALWAYS server-injected from
 * the authed user — never trusted from the body.
 */
describe('POST /telemetry/ai', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
  });

  it('401 without Authorization', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(401);
  });

  it('204 when events: [] (no-op)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/ai', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(204);
  });

  it('200 and inserts 3 rows into ai_events with profile_id + task_name + model', async () => {
    const app = makeApp();
    const validEvent = (name: string, task_name: string) => ({
      name,
      session_id: 'sess-ai-abc',
      timestamp: new Date().toISOString(),
      task_name,
      model: 'claude-sonnet-4-20250514',
      payload: { latency_ms: 1200, input_tokens: 400, output_tokens: 180 },
    });

    const res = await app.request('/telemetry/ai', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          validEvent('ai.request_succeeded', 'pantry.scan'),
          validEvent('ai.request_succeeded', 'recipe.discover'),
          validEvent('ai.rate_limited', 'planner.generate_week'),
        ],
      }),
    });
    expect(res.status).toBe(200);
    expect(supabase.from).toHaveBeenCalled();
    const inserted = tableState['ai_events']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    expect(inserted).toHaveLength(3);
    expect(inserted?.[0]?.profile_id).toBe('user-1');
    expect(inserted?.[0]?.event_type).toBe('ai.request_succeeded');
    expect(inserted?.[0]?.task_name).toBe('pantry.scan');
    expect(inserted?.[0]?.model).toBe('claude-sonnet-4-20250514');
  });

  it('profile_id is server-injected — body override is ignored', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/ai', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            name: 'ai.request_succeeded',
            session_id: 'sess-ai-xyz',
            timestamp: new Date().toISOString(),
            task_name: 'pantry.scan',
            model: 'claude-sonnet-4-20250514',
            // Malicious client attempts to spoof a different profile_id:
            profile_id: 'attacker-profile-id',
            payload: {},
          },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const inserted = tableState['ai_events']?.insertedRows as
      | Array<Record<string, unknown>>
      | undefined;
    // Server MUST inject the authed user's id — never the body's profile_id.
    expect(inserted?.[0]?.profile_id).toBe('user-1');
    expect(inserted?.[0]?.profile_id).not.toBe('attacker-profile-id');
  });

  it('400 when schema invalid (missing task_name or model)', async () => {
    const app = makeApp();
    const res = await app.request('/telemetry/ai', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          {
            name: 'ai.request_succeeded',
            session_id: 'sess-ai-abc',
            timestamp: new Date().toISOString(),
            // missing task_name and model — both required per the ai_events table
            payload: {},
          },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });
});
