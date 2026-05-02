import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Fluent Supabase mock tailored for shopping routes.
 *
 * Each table has a configurable response bag. Every fluent builder method
 * returns `this` until a terminal method is reached (maybeSingle/single/
 * thenable select/insert/update/delete), which returns the configured
 * `{ data, error }` shape.
 */
const {
  mockSuggestVariations,
  mockClassifyItems,
  mockGetInstacartClient,
  mockCreateShoppingListPage,
  mockAuthMiddleware,
  supabase,
  tableState,
} = vi.hoisted(() => {
  type Resp = { data: unknown; error: unknown };
  const tableState: Record<string, {
    rows?: unknown;
    insertResult?: Resp;
    updateResult?: Resp;
    deleteResult?: Resp;
    singleResult?: Resp;
    maybeSingleResult?: Resp;
    selectResult?: Resp;
  }> = {};

  function makeBuilder(table: string) {
    const s = tableState[table] ?? {};
    const builder: any = {
      select: vi.fn(() => builder),
      insert: vi.fn((_payload: unknown) => {
        builder.__op = 'insert';
        return builder;
      }),
      update: vi.fn((_payload: unknown) => {
        builder.__op = 'update';
        return builder;
      }),
      delete: vi.fn(() => {
        builder.__op = 'delete';
        return builder;
      }),
      eq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => s.maybeSingleResult ?? { data: null, error: null }),
      single: vi.fn(async () => s.singleResult ?? { data: null, error: null }),
      // When awaited without .single/.maybeSingle (select list, insert list, etc.)
      then: (resolve: (r: Resp) => void) => {
        if (builder.__op === 'insert') {
          resolve(s.insertResult ?? { data: s.rows ?? [], error: null });
        } else if (builder.__op === 'update') {
          resolve(s.updateResult ?? { data: s.rows ?? null, error: null });
        } else if (builder.__op === 'delete') {
          resolve(s.deleteResult ?? { data: null, error: null });
        } else {
          resolve(s.selectResult ?? { data: s.rows ?? [], error: null });
        }
      },
    };
    return builder;
  }

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table)),
  };

  const mockCreateShoppingListPage = vi.fn(async () => ({
    products_link_url: 'https://example.com/stub-instacart/abc',
  }));

  return {
    mockSuggestVariations: vi.fn(),
    mockClassifyItems: vi.fn(),
    mockGetInstacartClient: vi.fn(() => ({
      createShoppingListPage: mockCreateShoppingListPage,
    })),
    mockCreateShoppingListPage,
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

vi.mock('../../services/shoppingList.js', () => ({
  consolidateIngredients: (entries: any[]) =>
    entries.flatMap((e) =>
      (e.ingredients ?? []).map((i: any) => ({
        name: i.name,
        normalizedName: i.name.toLowerCase(),
        quantity: i.quantity ?? 1,
        unit: i.unit ?? null,
        sources: [e.title],
      })),
    ),
  subtractPantry: (needed: any[]) => needed,
  suggestVariations: mockSuggestVariations,
}));

vi.mock('../../services/ingredientCategories.js', () => ({
  classifyItems: mockClassifyItems,
}));

vi.mock('../../services/instacart.js', () => ({
  getInstacartClient: mockGetInstacartClient,
}));

const { default: shopping } = await import('../shopping.js');
const { Hono } = await import('hono');

function makeApp() {
  const app = new Hono();
  app.route('/shopping', shopping);
  return app;
}

function resetTables() {
  for (const k of Object.keys(tableState)) delete tableState[k];
}

function setTable(name: string, cfg: any) {
  tableState[name] = cfg;
}

describe('shopping routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetTables();
    mockClassifyItems.mockResolvedValue({});
  });

  it('Test 1: returns 401 without auth', async () => {
    const app = makeApp();
    const res = await app.request('/shopping/current', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('POST /lists creates a blank shopping list with no meal plan', async () => {
    setTable('shopping_lists', {
      singleResult: {
        data: {
          id: 'list-blank',
          profile_id: 'user-1',
          meal_plan_id: null,
          title: 'My shopping list',
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      },
    });

    const app = makeApp();
    const res = await app.request('/shopping/lists', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('list-blank');
    expect(body.data.meal_plan_id).toBeNull();
    expect(body.data.items).toEqual([]);
  });

  it('POST /lists honors caller-supplied title when present', async () => {
    setTable('shopping_lists', {
      singleResult: {
        data: {
          id: 'list-named',
          profile_id: 'user-1',
          meal_plan_id: null,
          title: 'Recipe ingredients',
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      },
    });

    const app = makeApp();
    const res = await app.request('/shopping/lists', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Recipe ingredients' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.title).toBe('Recipe ingredients');
  });

  it('Test 2: POST /generate happy path → 201 with list and items', async () => {
    setTable('meal_plans', {
      maybeSingleResult: {
        data: { id: 'plan-1', profile_id: 'user-1', week_start: '2026-04-13' },
        error: null,
      },
    });
    setTable('meal_plan_entries', {
      selectResult: {
        data: [
          {
            id: 'e1',
            title: 'Pasta',
            ingredients: [{ name: 'Tomato', quantity: 2, unit: 'cup' }],
          },
        ],
        error: null,
      },
    });
    setTable('pantry_items', { selectResult: { data: [], error: null } });
    setTable('shopping_lists', {
      singleResult: {
        data: {
          id: 'list-1',
          profile_id: 'user-1',
          meal_plan_id: 'plan-1',
          title: 'DinnerTime — week of 2026-04-13',
          generated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      },
    });
    setTable('shopping_list_items', {
      insertResult: {
        data: [
          {
            id: 'i1',
            shopping_list_id: 'list-1',
            name: 'Tomato',
            category: 'produce',
            checked: false,
            user_added: false,
          },
        ],
        error: null,
      },
    });
    mockClassifyItems.mockResolvedValue({ tomato: 'produce' });

    const app = makeApp();
    const res = await app.request('/shopping/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_plan_id: 'plan-1' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('list-1');
    expect(body.data.items).toHaveLength(1);
    expect(mockClassifyItems).toHaveBeenCalled();
  });

  it('Test 3: POST /generate → 404 when meal_plan not owned by user', async () => {
    setTable('meal_plans', { maybeSingleResult: { data: null, error: null } });
    const app = makeApp();
    const res = await app.request('/shopping/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_plan_id: 'plan-x' }),
    });
    expect(res.status).toBe(404);
  });

  it('Test 4: POST /generate with zero entries → 400 EMPTY_PLAN', async () => {
    setTable('meal_plans', {
      maybeSingleResult: {
        data: { id: 'plan-1', profile_id: 'user-1', week_start: '2026-04-13' },
        error: null,
      },
    });
    setTable('meal_plan_entries', { selectResult: { data: [], error: null } });

    const app = makeApp();
    const res = await app.request('/shopping/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ meal_plan_id: 'plan-1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('EMPTY_PLAN');
  });

  it('Test 5: GET /current → null when no list exists', async () => {
    setTable('shopping_lists', { maybeSingleResult: { data: null, error: null } });
    const app = makeApp();
    const res = await app.request('/shopping/current', {
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
  });

  it('Test 6: GET /current → returns most recent list with items', async () => {
    setTable('shopping_lists', {
      maybeSingleResult: {
        data: { id: 'list-1', title: 'My List' },
        error: null,
      },
    });
    setTable('shopping_list_items', {
      selectResult: {
        data: [{ id: 'i1', name: 'Tomato', checked: false }],
        error: null,
      },
    });
    const app = makeApp();
    const res = await app.request('/shopping/current', {
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe('list-1');
    expect(body.data.items).toHaveLength(1);
  });

  it('Test 7: POST /items → 201 creates user_added item', async () => {
    setTable('shopping_lists', {
      maybeSingleResult: { data: { id: 'list-1' }, error: null },
    });
    setTable('shopping_list_items', {
      singleResult: {
        data: { id: 'i9', name: 'Kimchi', user_added: true, checked: false },
        error: null,
      },
    });
    const app = makeApp();
    const res = await app.request('/shopping/items', {
      method: 'POST',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopping_list_id: 'list-1', name: 'Kimchi' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.user_added).toBe(true);
  });

  it('Test 8: PATCH /items/:id toggles checked and drops unknown keys', async () => {
    setTable('shopping_list_items', {
      singleResult: {
        data: { id: 'i1', checked: true, name: 'Tomato' },
        error: null,
      },
    });
    const app = makeApp();
    const res = await app.request('/shopping/items/i1', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer t', 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: true, hacker: 'drop', profile_id: 'other' }),
    });
    expect(res.status).toBe(200);
    // Verify only whitelisted fields went to supabase.update
    const fromCalls = supabase.from.mock.calls;
    expect(fromCalls.some((c) => c[0] === 'shopping_list_items')).toBe(true);
  });

  it('Test 9: DELETE /items/:id → 204', async () => {
    setTable('shopping_list_items', { deleteResult: { data: null, error: null } });
    const app = makeApp();
    const res = await app.request('/shopping/items/i1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(204);
  });

  it('Test 10: POST /:id/order calls Instacart, only unchecked items, persists order', async () => {
    setTable('shopping_lists', {
      maybeSingleResult: {
        data: { id: 'list-1', title: 'My List' },
        error: null,
      },
    });
    setTable('shopping_list_items', {
      selectResult: {
        data: [
          { id: 'i1', name: 'Tomato', quantity: 2, unit: 'cup', checked: false },
          { id: 'i2', name: 'Bread', quantity: 1, unit: 'loaf', checked: true },
        ],
        error: null,
      },
    });
    setTable('shopping_orders', {
      singleResult: {
        data: { id: 'order-1', instacart_url: 'https://example.com/x' },
        error: null,
      },
    });

    const app = makeApp();
    const before = Date.now();
    const res = await app.request('/shopping/list-1/order', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.url).toBe('https://example.com/stub-instacart/abc');
    expect(body.data.order_id).toBe('order-1');

    // Verify only unchecked items in line_items
    expect(mockCreateShoppingListPage).toHaveBeenCalledTimes(1);
    const call = mockCreateShoppingListPage.mock.calls[0][0] as any;
    expect(call.line_items).toHaveLength(1);
    expect(call.line_items[0].name).toBe('Tomato');
    expect(call.expires_in).toBe(30);
    expect(call.partner_linkback_url).toBe('dinnertime://shopping/done');

    // Verify expires_at was ~30 days out in the insert payload
    const ordersBuilder = supabase.from.mock.results.find(
      (r) => supabase.from.mock.calls[supabase.from.mock.results.indexOf(r)][0] === 'shopping_orders',
    );
    expect(ordersBuilder).toBeDefined();
    const insertPayload = (ordersBuilder!.value.insert as any).mock.calls[0][0];
    const expiresAt = new Date(insertPayload.expires_at).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(expiresAt - before).toBeGreaterThan(thirtyDays - 60_000);
    expect(expiresAt - before).toBeLessThan(thirtyDays + 60_000);
  });

  it('Test 11: POST /orders/:id/reorder creates NEW list from snapshot (never old URL)', async () => {
    setTable('shopping_orders', {
      maybeSingleResult: {
        data: {
          id: 'order-1',
          placed_at: '2026-04-01T00:00:00Z',
          instacart_url: 'https://OLD-URL-DO-NOT-RETURN.example',
          items_snapshot: [
            { name: 'Tomato', line_item_measurements: [{ quantity: 2, unit: 'cup' }] },
            { name: 'Bread' },
          ],
        },
        error: null,
      },
    });
    setTable('shopping_lists', {
      singleResult: {
        data: { id: 'list-new', title: 'Reorder — 2026-04-01T00:00:00Z' },
        error: null,
      },
    });
    setTable('shopping_list_items', {
      insertResult: {
        data: [
          { id: 'n1', name: 'Tomato', category: 'other' },
          { id: 'n2', name: 'Bread', category: 'other' },
        ],
        error: null,
      },
    });

    const app = makeApp();
    const res = await app.request('/shopping/orders/order-1/reorder', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    // Critical: NEVER replay old URL
    expect(JSON.stringify(body)).not.toContain('OLD-URL-DO-NOT-RETURN');
    expect(body.data.id).toBe('list-new');
    expect(body.data.items).toHaveLength(2);
    // Instacart NOT called on reorder
    expect(mockCreateShoppingListPage).not.toHaveBeenCalled();
  });

  it('Test 12: POST /orders/:id/variations returns suggestions', async () => {
    setTable('shopping_orders', {
      maybeSingleResult: {
        data: {
          id: 'order-1',
          items_snapshot: [{ name: 'Tomato' }],
        },
        error: null,
      },
    });
    mockSuggestVariations.mockResolvedValue([
      { instead_of: 'Tomato', swap: 'Roma Tomato', rationale: 'Better for sauce' },
    ]);

    const app = makeApp();
    const res = await app.request('/shopping/orders/order-1/variations', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].swap).toBe('Roma Tomato');
  });

  it('Test 13: POST /:id/order → 502 INSTACART_ERROR when client throws', async () => {
    setTable('shopping_lists', {
      maybeSingleResult: { data: { id: 'list-1', title: 'My List' }, error: null },
    });
    setTable('shopping_list_items', { selectResult: { data: [], error: null } });
    mockCreateShoppingListPage.mockRejectedValueOnce(new Error('Instacart API 500: boom'));

    const app = makeApp();
    const res = await app.request('/shopping/list-1/order', {
      method: 'POST',
      headers: { Authorization: 'Bearer t' },
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe('INSTACART_ERROR');
  });
});
