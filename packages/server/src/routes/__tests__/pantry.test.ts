import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockIdentifyFoodItems,
  mockIdentifyFoodItemsBatch,
  mockIdentifyReceiptItems,
  mockReconcileItems,
  mockAggregateLocationSuggestions,
  mockPromoteCandidateCanonicals,
  mockIncrementScanCounts,
  mockAuthMiddleware,
  supabase,
  supabaseState,
  tables,
  operations,
} = vi.hoisted(() => {
  /**
   * Phase 21-03 — per-table fixture + op-capture store for the 5 new route
   * groups. Each route that needs something beyond the legacy hoisted mock
   * uses the `tables` store for row data and `operations` for assertion of
   * insert/update/delete shapes.
   */
  const tables = {
    user_staples: [] as Array<Record<string, unknown>>,
    user_location_rules: [] as Array<Record<string, unknown>>,
    ingredient_aliases: [] as Array<Record<string, unknown>>,
    canonical_ingredients: [] as Array<Record<string, unknown>>,
    suggested_rules: [] as Array<Record<string, unknown>>,
    canonical_category_override: [] as Array<Record<string, unknown>>,
    scan_events: [] as Array<Record<string, unknown>>,
  };
  const operations: Array<{
    table: string;
    op: string;
    payload?: unknown;
    filters?: Record<string, unknown>;
    opts?: unknown;
  }> = [];
  // Mutable shared state so individual tests can seed existing-items rows +
  // observe insert() payloads (override-events).
  const supabaseState = {
    existingItems: [] as Array<{ name: string }>,
    pantryItems: [] as Array<Record<string, unknown>>, // for GET /pantry (REQ-23 legacy NULL rows)
    lastInsertTable: null as string | null,
    lastInsertPayload: null as any,
    insertError: null as null | { message: string },
    // Per-table insert capture (24-05: scan_events writer on all 4 scan flows)
    scanEventsInserts: [] as any[],
    // Simulate a specific table's insert throwing, to verify fire-and-forget
    insertThrows: new Map<string, Error>(),
  };
  // Tables that route requests via the Phase 21-03 fixture/operation store.
  // `scan_events` is split-routed: the new chain handles SELECT reads (for the
  // /preview route), while inserts ALSO dual-write into
  // `supabaseState.scanEventsInserts` so 24-05 existing tests keep passing.
  const NEW_ROUTE_TABLES = new Set([
    'user_staples',
    'user_location_rules',
    'ingredient_aliases',
    'canonical_ingredients',
    'suggested_rules',
    'canonical_category_override',
    'scan_events',
  ]);

  function buildNewTableChain(table: string): any {
    const filters: Record<string, unknown> = {};
    const gteFilters: Record<string, unknown> = {};
    let limitN: number | undefined;
    let orderCol: string | undefined;
    let orderAsc = true;
    let selectCols = '*';

    const matchRows = (rows: Array<Record<string, unknown>>) =>
      rows.filter((r) => {
        for (const [col, val] of Object.entries(filters)) {
          if ((r as any)[col] !== val) return false;
        }
        for (const [col, val] of Object.entries(gteFilters)) {
          if (!((r as any)[col] >= (val as string | number))) return false;
        }
        return true;
      });

    const makeResolver = () => (resolve: (v: any) => void) => {
      let rows = matchRows((tables as any)[table] ?? []);
      if (orderCol) {
        rows = [...rows].sort((a: any, b: any) =>
          orderAsc
            ? (a[orderCol!] ?? 0) < (b[orderCol!] ?? 0)
              ? -1
              : 1
            : (a[orderCol!] ?? 0) < (b[orderCol!] ?? 0)
              ? 1
              : -1,
        );
      }
      if (typeof limitN === 'number') rows = rows.slice(0, limitN);
      return resolve({ data: rows, error: null });
    };

    const chain: any = {
      select: vi.fn((cols?: string) => {
        if (cols) selectCols = cols;
        return chain;
      }),
      eq: vi.fn((col: string, val: unknown) => {
        filters[col] = val;
        return chain;
      }),
      gte: vi.fn((col: string, val: unknown) => {
        gteFilters[col] = val;
        return chain;
      }),
      order: vi.fn((col: string, o?: { ascending?: boolean }) => {
        orderCol = col;
        orderAsc = o?.ascending !== false;
        return chain;
      }),
      limit: vi.fn((n: number) => {
        limitN = n;
        return chain;
      }),
      maybeSingle: vi.fn(() => {
        const rows = matchRows((tables as any)[table] ?? []);
        return Promise.resolve({
          data: rows[0] ?? null,
          error: null,
        });
      }),
      insert: vi.fn((payload: any) => {
        if (table === 'scan_events' && supabaseState.insertThrows.has('scan_events')) {
          throw supabaseState.insertThrows.get('scan_events');
        }
        operations.push({ table, op: 'insert', payload, filters: { ...filters } });
        const payloads = Array.isArray(payload) ? payload : [payload];
        (tables as any)[table].push(...payloads);
        if (table === 'scan_events') {
          supabaseState.scanEventsInserts.push(...payloads);
        }
        const insertChain: any = {
          select: vi.fn(() => insertChain),
          maybeSingle: () => Promise.resolve({ data: payloads[0], error: null }),
          then: (resolve: (v: any) => void) =>
            resolve({ data: payloads, error: null }),
        };
        return insertChain;
      }),
      upsert: vi.fn((payload: any, opts?: any) => {
        operations.push({ table, op: 'upsert', payload, opts });
        const payloads = Array.isArray(payload) ? payload : [payload];
        for (const row of payloads) {
          const conflictKeys = (opts?.onConflict as string | undefined)
            ?.split(',')
            .map((k) => k.trim());
          if (conflictKeys && conflictKeys.length > 0) {
            const existing = (tables as any)[table].findIndex((r: any) =>
              conflictKeys.every((k) => r[k] === (row as any)[k]),
            );
            if (existing >= 0) {
              (tables as any)[table][existing] = {
                ...(tables as any)[table][existing],
                ...row,
              };
              continue;
            }
          }
          (tables as any)[table].push(row);
        }
        const upsertChain: any = {
          select: vi.fn(() => upsertChain),
          then: (resolve: (v: any) => void) =>
            resolve({ data: payloads, error: null }),
        };
        return upsertChain;
      }),
      update: vi.fn((payload: any) => {
        const updateChain: any = {
          eq: vi.fn((col: string, val: unknown) => {
            filters[col] = val;
            return updateChain;
          }),
          then: (resolve: (v: any) => void) => {
            operations.push({
              table,
              op: 'update',
              payload,
              filters: { ...filters },
            });
            const rows = (tables as any)[table];
            for (const row of rows) {
              let ok = true;
              for (const [col, val] of Object.entries(filters)) {
                if ((row as any)[col] !== val) {
                  ok = false;
                  break;
                }
              }
              if (ok) Object.assign(row, payload);
            }
            return resolve({ data: null, error: null });
          },
        };
        return updateChain;
      }),
      delete: vi.fn(() => {
        const deleteChain: any = {
          eq: vi.fn((col: string, val: unknown) => {
            filters[col] = val;
            return deleteChain;
          }),
          then: (resolve: (v: any) => void) => {
            operations.push({
              table,
              op: 'delete',
              filters: { ...filters },
            });
            (tables as any)[table] = (tables as any)[table].filter(
              (row: any) => {
                for (const [col, val] of Object.entries(filters)) {
                  if (row[col] !== val) return true;
                }
                return false;
              },
            );
            return resolve({ data: null, error: null });
          },
        };
        return deleteChain;
      }),
      then: makeResolver(),
    };
    return chain;
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (NEW_ROUTE_TABLES.has(table)) {
        return buildNewTableChain(table);
      }
      const chain: any = {
        select: vi.fn(() => chain),
        insert: vi.fn((payload: any) => {
          if (supabaseState.insertThrows.has(table)) {
            throw supabaseState.insertThrows.get(table);
          }
          supabaseState.lastInsertTable = table;
          supabaseState.lastInsertPayload = payload;
          if (table === 'scan_events') {
            supabaseState.scanEventsInserts.push(payload);
          }
          const insertChain: any = {
            select: vi.fn(() => insertChain),
            then: (resolve: (v: any) => void) =>
              resolve({ data: supabaseState.insertError ? null : payload, error: supabaseState.insertError }),
          };
          return insertChain;
        }),
        // The existing-names / GET /pantry / scan-batch existing-items chain
        // fires `.eq(...).eq(...).eq(...)` — the final call must be awaitable.
        // GET /pantry resolves from pantryItems; everything else from existingItems.
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: (resolve: (v: any) => void) => {
          if (table === 'pantry_items') {
            // Route layer GET /pantry does .from('pantry_items').select().eq('profile_id',...).order('category').eq('status','available')
            // — its .eq/.order/.eq all return chain; eventual await resolves here.
            // Return pantryItems when seeded, otherwise fall back to existingItems shape.
            if (supabaseState.pantryItems.length > 0) {
              return resolve({ data: supabaseState.pantryItems, error: null });
            }
            return resolve({ data: supabaseState.existingItems, error: null });
          }
          return resolve({ data: supabaseState.existingItems, error: null });
        },
      };
      return chain;
    }),
  };

  return {
    mockIdentifyFoodItems: vi.fn(),
    mockIdentifyFoodItemsBatch: vi.fn(),
    mockIdentifyReceiptItems: vi.fn(),
    mockReconcileItems: vi.fn(),
    // Phase 21-03: learning-pipeline services (fire-and-forget on /confirm)
    mockAggregateLocationSuggestions: vi.fn(),
    mockPromoteCandidateCanonicals: vi.fn(),
    mockIncrementScanCounts: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'Missing auth' }, 401);
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    supabase,
    supabaseState,
    tables,
    operations,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../services/vision.js', () => ({
  identifyFoodItems: mockIdentifyFoodItems,
  identifyFoodItemsBatch: mockIdentifyFoodItemsBatch,
  identifyReceiptItems: mockIdentifyReceiptItems,
}));

vi.mock('../../services/pantry.js', () => ({
  reconcileItems: mockReconcileItems,
}));

// Phase 21-03 — learning-pipeline services (imported at routes/pantry.ts load
// so they must be mocked hoisted). All three are fire-and-forget from /confirm;
// tests may configure them to reject so the fire-and-forget contract is
// stressed under failure.
vi.mock('../../services/suggestionAggregator.js', () => ({
  aggregateLocationSuggestions: mockAggregateLocationSuggestions,
}));
vi.mock('../../services/canonicalPromoter.js', () => ({
  promoteCandidateCanonicals: mockPromoteCandidateCanonicals,
  incrementScanCounts: mockIncrementScanCounts,
}));

import { Hono } from 'hono';
import pantry from '../pantry.js';

const app = new Hono();
app.route('/pantry', pantry);

function req(path: string, init?: RequestInit) {
  return app.request(`/pantry${path}`, {
    headers: { Authorization: 'Bearer test' },
    ...init,
  });
}

describe('POST /scan', () => {
  beforeEach(() => {
    mockIdentifyFoodItems.mockReset();
  });

  it('returns 400 when image is missing', async () => {
    const res = await req('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  it('calls identifyFoodItems with image only (no source_location)', async () => {
    mockIdentifyFoodItems.mockResolvedValue([
      { name: 'milk', quantity: 1, unit: 'gallon', confidence: 0.9, category: 'dairy', source_location: 'fridge' },
    ]);
    const res = await req('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(mockIdentifyFoodItems).toHaveBeenCalledWith('IMG');
  });

  it('silently ignores source_location in body (not consumed)', async () => {
    mockIdentifyFoodItems.mockResolvedValue([]);
    const res = await req('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG', source_location: 'garage' }),
    });
    expect(res.status).toBe(200);
    // Only one arg forwarded.
    expect(mockIdentifyFoodItems).toHaveBeenCalledWith('IMG');
  });
});

describe('POST /scan-batch', () => {
  beforeEach(() => {
    mockIdentifyFoodItemsBatch.mockReset();
    supabaseState.existingItems = [];
  });

  it('returns 400 when images array is missing', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/images/i);
  });

  it('returns 400 when images array is empty', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when images array exceeds 5 elements', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/1.*5/);
  });

  it('returns 200 with merged item list on success and does not consume source_location', async () => {
    mockIdentifyFoodItemsBatch.mockResolvedValue([
      { name: 'milk', quantity: 1, unit: 'gallon', confidence: 0.9, category: 'dairy', source_location: 'fridge' },
      { name: 'eggs', quantity: 12, unit: 'piece', confidence: 0.85, category: 'protein', source_location: 'fridge' },
    ]);

    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: ['img1', 'img2'],
        // Legacy field should be ignored silently.
        source_location: 'fridge',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(mockIdentifyFoodItemsBatch).toHaveBeenCalledWith(['img1', 'img2'], expect.any(Array));
  });
});

describe('POST /scan-receipt', () => {
  beforeEach(() => {
    mockIdentifyReceiptItems.mockReset();
    supabaseState.existingItems = [];
  });

  it('returns 400 when image is missing', async () => {
    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  it('calls service with (image, existingNames, variant=receipt) — no location arg', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([]);

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', expect.any(Array), 'receipt');
  });

  it('returns 200 with { data: ScanResult[] } on success', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([
      { name: 'chicken', quantity: 1, unit: 'lb', confidence: 0.9, category: 'protein', source_location: 'fridge' },
    ]);

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('chicken');
  });

  it('passes existing item names from supabase to the service', async () => {
    supabaseState.existingItems = [{ name: 'milk' }, { name: 'eggs' }];
    mockIdentifyReceiptItems.mockResolvedValue([]);

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', ['milk', 'eggs'], 'receipt');
  });

  it('silently ignores legacy source_location body field', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([]);

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG', source_location: 'garage' }),
    });
    // No 400 — legacy field ignored.
    expect(res.status).toBe(200);
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', expect.any(Array), 'receipt');
  });

  it('returns 500 when the service throws', async () => {
    mockIdentifyReceiptItems.mockRejectedValue(new Error('vision boom'));

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/vision boom/);
  });
});

describe('POST /import-instacart', () => {
  beforeEach(() => {
    mockIdentifyReceiptItems.mockReset();
    supabaseState.existingItems = [];
  });

  it('returns 400 when image is missing', async () => {
    const res = await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  it('returns 200 with { data } on success', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([
      { name: 'apples', quantity: 4, unit: 'piece', confidence: 0.95, category: 'produce', source_location: 'fridge' },
    ]);

    const res = await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'INSTACART_IMG' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('apples');
  });

  it("calls service with variant='instacart_screenshot' and NO sourceLocation arg", async () => {
    mockIdentifyReceiptItems.mockResolvedValue([]);

    await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', expect.any(Array), 'instacart_screenshot');
  });

  it('passes existing pantry names to the service', async () => {
    supabaseState.existingItems = [{ name: 'olive oil' }, { name: 'rice' }];
    mockIdentifyReceiptItems.mockResolvedValue([]);

    await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', ['olive oil', 'rice'], 'instacart_screenshot');
  });

  it('returns 500 when the service throws', async () => {
    mockIdentifyReceiptItems.mockRejectedValue(new Error('instacart boom'));

    const res = await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/instacart boom/);
  });
});

describe('POST /confirm', () => {
  beforeEach(() => {
    mockReconcileItems.mockReset();
  });

  it('returns 400 when items array is missing', async () => {
    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: 'user-1' }),
    });
    expect(res.status).toBe(400);
  });

  it('calls reconcileItems with per-item source_location on each entry', async () => {
    mockReconcileItems.mockResolvedValue([]);

    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            name: 'milk',
            quantity: 1,
            unit: 'gallon',
            category: 'dairy',
            confidence: 0.9,
            source_location: 'fridge',
          },
        ],
        profile_id: 'user-1',
      }),
    });
    expect(res.status).toBe(200);
    // Service called with (supabase, userId, items) — no top-level location.
    const call = mockReconcileItems.mock.calls[0];
    expect(call[1]).toBe('user-1');
    expect(call[2][0].source_location).toBe('fridge');
  });

  it('returns 400 when an item has an invalid source_location', async () => {
    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            name: 'milk',
            quantity: 1,
            unit: 'gallon',
            category: 'dairy',
            confidence: 0.9,
            source_location: 'attic',
          },
        ],
        profile_id: 'user-1',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source_location/i);
  });

  it('returns 400 when an item is missing source_location', async () => {
    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            name: 'milk',
            quantity: 1,
            unit: 'gallon',
            category: 'dairy',
            confidence: 0.9,
          },
        ],
        profile_id: 'user-1',
      }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /override-events', () => {
  beforeEach(() => {
    supabaseState.lastInsertTable = null;
    supabaseState.lastInsertPayload = null;
    supabaseState.insertError = null;
  });

  it('returns 400 when events array is missing', async () => {
    const res = await req('/override-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/events/i);
  });

  it('returns 400 when events array is empty', async () => {
    const res = await req('/override-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/events/i);
  });

  it('returns 200 and inserts valid events into item_override_events', async () => {
    const res = await req('/override-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          { item_name: 'Milk', ai_location: 'pantry', user_location: 'fridge' },
          { item_name: ' Eggs ', ai_location: 'pantry', user_location: 'fridge' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.inserted).toBe(2);

    // Inserted into the correct table with normalized item_name.
    expect(supabaseState.lastInsertTable).toBe('item_override_events');
    expect(Array.isArray(supabaseState.lastInsertPayload)).toBe(true);
    const payload = supabaseState.lastInsertPayload as any[];
    expect(payload.map((r) => r.item_name)).toEqual(['milk', 'eggs']);
    expect(payload.every((r) => r.ai_location !== r.user_location)).toBe(true);
  });

  it('filters out no-op events (ai_location === user_location)', async () => {
    const res = await req('/override-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          { item_name: 'rice', ai_location: 'pantry', user_location: 'pantry' }, // no-op
          { item_name: 'milk', ai_location: 'pantry', user_location: 'fridge' }, // real
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.inserted).toBe(1);
    const payload = supabaseState.lastInsertPayload as any[];
    expect(payload).toHaveLength(1);
    expect(payload[0].item_name).toBe('milk');
  });

  it('filters out invalid locations silently', async () => {
    const res = await req('/override-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [
          { item_name: 'milk', ai_location: 'attic', user_location: 'fridge' },
          { item_name: 'rice', ai_location: 'pantry', user_location: 'garage' },
        ],
      }),
    });
    // All invalid -> inserted:0 with 200 (not 400).
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.inserted).toBe(0);
    expect(supabaseState.lastInsertTable).toBe(null);
  });

  it('uses the user-authenticated supabase client (RLS), not service role', async () => {
    // The request-scoped supabase mock is what c.get('supabase') returns.
    // If the handler reached for a different client (service role), our mock
    // would never see the insert. Drive an insert and verify the mock captured it.
    await req('/override-events', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{ item_name: 'milk', ai_location: 'pantry', user_location: 'fridge' }],
      }),
    });
    expect(supabase.from).toHaveBeenCalledWith('item_override_events');
    expect(supabaseState.lastInsertPayload).not.toBeNull();
  });
});

/**
 * Phase 24-05 — scan_events writer + convergence + legacy NULL readability.
 *
 * REQ-15: all four scan flows converge at /confirm → reconcileItems.
 * REQ-19: each scan route writes one scan_events row with scan_variant +
 *         raw_ai_output + final_items + field_confidence.
 * REQ-23: GET /pantry surfaces pantry_items with canonical_ingredient_id=NULL
 *         (legacy rows) alongside new canonical rows.
 * scan_events INSERT failure logs warn but does NOT fail the scan.
 */
describe('scan_events writer on all 4 scan flows (24-05)', () => {
  // A single ScanResult shape used across variants — matches 24-04 nested
  // quantity + per-field confidence.
  const sampleItem = {
    name: 'milk',
    quantity: { value: 1, unit: 'gallon', system: 'custom' },
    category: 'dairy',
    source_location: 'fridge',
    confidence: 0.9,
    fieldConfidence: { name: 0.92, quantity: 0.8, unit: 0.7, category: 0.95 },
  };

  beforeEach(() => {
    supabaseState.scanEventsInserts = [];
    supabaseState.lastInsertTable = null;
    supabaseState.lastInsertPayload = null;
    supabaseState.insertError = null;
    supabaseState.existingItems = [];
    supabaseState.pantryItems = [];
    supabaseState.insertThrows = new Map();
    mockIdentifyFoodItems.mockReset();
    mockIdentifyFoodItemsBatch.mockReset();
    mockIdentifyReceiptItems.mockReset();
  });

  it('POST /scan writes one scan_events row with scan_variant="camera"', async () => {
    mockIdentifyFoodItems.mockResolvedValue([sampleItem]);
    const res = await req('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(supabaseState.scanEventsInserts).toHaveLength(1);
    const row = supabaseState.scanEventsInserts[0];
    expect(row.user_id).toBe('user-1');
    expect(row.scan_variant).toBe('camera');
    expect(row.final_items).toEqual([sampleItem]);
    // field_confidence is an array of per-item {item_index, name, quantity, unit, category}
    expect(Array.isArray(row.field_confidence)).toBe(true);
    expect(row.field_confidence).toHaveLength(1);
    expect(row.field_confidence[0]).toEqual({
      item_index: 0,
      name: 0.92,
      quantity: 0.8,
      unit: 0.7,
      category: 0.95,
    });
    // raw_ai_output is present (non-null) — exact value mirrors final_items in
    // 24-05 since vision.ts does not expose pre-normalize raw (documented).
    expect(row.raw_ai_output).toBeDefined();
    // No pass_number (criterion #3 descoped).
    expect('pass_number' in row).toBe(false);
  });

  it('POST /scan-batch writes one scan_events row with scan_variant="batch"', async () => {
    mockIdentifyFoodItemsBatch.mockResolvedValue([sampleItem, { ...sampleItem, name: 'eggs' }]);
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: ['A', 'B'] }),
    });
    expect(res.status).toBe(200);
    expect(supabaseState.scanEventsInserts).toHaveLength(1);
    const row = supabaseState.scanEventsInserts[0];
    expect(row.scan_variant).toBe('batch');
    expect(row.final_items).toHaveLength(2);
    expect(row.field_confidence).toHaveLength(2);
    expect(row.field_confidence[1].item_index).toBe(1);
  });

  it('POST /scan-receipt writes one scan_events row with scan_variant="receipt"', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([sampleItem]);
    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(supabaseState.scanEventsInserts).toHaveLength(1);
    expect(supabaseState.scanEventsInserts[0].scan_variant).toBe('receipt');
  });

  it('POST /import-instacart writes one scan_events row with scan_variant="instacart"', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([sampleItem]);
    const res = await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(supabaseState.scanEventsInserts).toHaveLength(1);
    expect(supabaseState.scanEventsInserts[0].scan_variant).toBe('instacart');
  });

  it('scan_events INSERT failure does NOT fail the scan (fire-and-forget)', async () => {
    supabaseState.insertThrows.set('scan_events', new Error('scan_events boom'));
    mockIdentifyFoodItems.mockResolvedValue([sampleItem]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const res = await req('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('milk');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('scan_events final_items stores PRE-canonical ScanResult[] (no canonical_ingredient_id)', async () => {
    // Plan's must_haves.truth: "canonical_ingredient_id is written only to
    // pantry_items via /confirm (not on scan_events rows)". Verify nothing in
    // final_items carries canonical_ingredient_id after scan_events INSERT.
    mockIdentifyFoodItems.mockResolvedValue([sampleItem]);
    await req('/scan', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    const row = supabaseState.scanEventsInserts[0];
    for (const item of row.final_items) {
      expect('canonical_ingredient_id' in item).toBe(false);
    }
  });
});

describe('REQ-23: GET /pantry surfaces legacy NULL canonical rows + new FK rows', () => {
  beforeEach(() => {
    supabaseState.pantryItems = [];
    supabaseState.scanEventsInserts = [];
  });

  it('returns both rows with canonical_ingredient_id=null and rows with canonical_ingredient_id=uuid', async () => {
    supabaseState.pantryItems = [
      {
        id: 'legacy-row',
        profile_id: 'user-1',
        name: 'old milk',
        normalized_name: 'old milk',
        canonical_ingredient_id: null,
        source_location: 'fridge',
        status: 'available',
      },
      {
        id: 'new-row',
        profile_id: 'user-1',
        name: 'flour',
        normalized_name: 'flour',
        canonical_ingredient_id: '00000000-0000-0000-0000-000000000001',
        source_location: 'pantry',
        status: 'available',
      },
    ];
    const res = await req('', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    const ids = body.data.map((r: any) => r.id);
    expect(ids).toContain('legacy-row');
    expect(ids).toContain('new-row');
  });
});

describe('REQ-15 convergence: POST /confirm dispatches to rewritten reconcileItems', () => {
  beforeEach(() => {
    mockReconcileItems.mockReset();
  });

  it('surfaces reconcileItems return shape { inserted, updated, incompatibleUnits } to the response', async () => {
    mockReconcileItems.mockResolvedValue({
      inserted: 2,
      updated: 1,
      incompatibleUnits: 0,
    });

    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [
          {
            name: 'milk',
            quantity: { value: 1, unit: 'gallon', system: 'custom' },
            category: 'dairy',
            confidence: 0.9,
            source_location: 'fridge',
            fieldConfidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 },
          },
        ],
        profile_id: 'user-1',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({ inserted: 2, updated: 1, incompatibleUnits: 0 });
    // reconcileItems invoked once with (supabase, userId, items[])
    expect(mockReconcileItems).toHaveBeenCalledTimes(1);
    const args = mockReconcileItems.mock.calls[0];
    expect(args[1]).toBe('user-1');
    expect(Array.isArray(args[2])).toBe(true);
    expect(args[2][0].source_location).toBe('fridge');
  });
});

/**
 * Phase 21-03 — Rule evaluator integration + learning-pipeline fire-and-forget
 * contract on POST /confirm.
 *
 * - reconcileItems is the integration point for user_location_rules (verified
 *   via services/pantry.test.ts Phase 21-03 W2 test).
 * - /confirm MUST fire aggregateLocationSuggestions + promoteCandidateCanonicals
 *   + incrementScanCounts as `void` — scan never blocked even when all three
 *   reject. Test asserts each was called exactly once with a 200 response.
 */
describe('Phase 21-03 — /confirm fires learning-pipeline services fire-and-forget', () => {
  const sampleItem = {
    name: 'milk',
    quantity: { value: 1, unit: 'gallon', system: 'custom' },
    category: 'dairy',
    confidence: 0.9,
    source_location: 'fridge',
    fieldConfidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 },
  };

  beforeEach(() => {
    mockReconcileItems.mockReset();
    mockAggregateLocationSuggestions.mockReset();
    mockPromoteCandidateCanonicals.mockReset();
    mockIncrementScanCounts.mockReset();
  });

  it('fires aggregator + promoter + incrementScanCounts exactly once on success', async () => {
    mockReconcileItems.mockResolvedValue({
      inserted: 1,
      updated: 0,
      incompatibleUnits: 0,
      canonicalIds: ['canon-milk'],
    });
    mockAggregateLocationSuggestions.mockResolvedValue(undefined);
    mockPromoteCandidateCanonicals.mockResolvedValue(0);
    mockIncrementScanCounts.mockResolvedValue(undefined);

    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [sampleItem],
        profile_id: 'user-1',
      }),
    });
    expect(res.status).toBe(200);

    expect(mockAggregateLocationSuggestions).toHaveBeenCalledTimes(1);
    expect(mockPromoteCandidateCanonicals).toHaveBeenCalledTimes(1);
    expect(mockIncrementScanCounts).toHaveBeenCalledTimes(1);

    // Pitfall 1: aggregator uses the request's authedSupabase, not service role.
    // The mock supabase is the same reference set by authMiddleware; assert it
    // was passed as the first arg to aggregateLocationSuggestions.
    expect(mockAggregateLocationSuggestions.mock.calls[0][0]).toBe(supabase);
    expect(mockAggregateLocationSuggestions.mock.calls[0][1]).toBe('user-1');

    // incrementScanCounts receives the canonicalIds from the reconcile result.
    expect(mockIncrementScanCounts.mock.calls[0][1]).toEqual(['canon-milk']);
  });

  it('returns 200 even when aggregator/promoter/counter all reject (fire-and-forget)', async () => {
    mockReconcileItems.mockResolvedValue({
      inserted: 1,
      updated: 0,
      incompatibleUnits: 0,
      canonicalIds: ['canon-milk'],
    });
    // All three reject — the handler MUST NOT await them. Unhandled-rejection
    // noise is swallowed by .catch inside the route or by the service itself.
    mockAggregateLocationSuggestions.mockRejectedValue(new Error('agg boom'));
    mockPromoteCandidateCanonicals.mockRejectedValue(new Error('promote boom'));
    mockIncrementScanCounts.mockRejectedValue(new Error('count boom'));

    // Quiet any unhandled-rejection logs during this test.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await req('/confirm', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [sampleItem],
        profile_id: 'user-1',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      inserted: 1,
      updated: 0,
      incompatibleUnits: 0,
      canonicalIds: ['canon-milk'],
    });

    expect(mockAggregateLocationSuggestions).toHaveBeenCalledTimes(1);
    expect(mockPromoteCandidateCanonicals).toHaveBeenCalledTimes(1);
    expect(mockIncrementScanCounts).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

/**
 * Phase 21-03 — Task 2: 5 new route groups (staples, rules, suggestions,
 * preview, category-override).
 */

function resetTables() {
  if (!tables) return;
  for (const k of Object.keys(tables)) {
    (tables as any)[k] = [];
  }
  if (operations) operations.length = 0;
}

describe('Phase 21-03 — /staples routes', () => {
  beforeEach(() => {
    resetTables();
  });

  it('POST /staples: inserts into user_staples when canonical.status=active', async () => {
    tables.canonical_ingredients.push({
      id: 'canon-milk',
      status: 'active',
      canonical_name: 'milk',
    });

    const res = await req('/staples', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonical_ingredient_id: 'canon-milk' }),
    });
    expect(res.status).toBe(201);
    const inserts = operations.filter(
      (o) => o.table === 'user_staples' && o.op === 'insert',
    );
    expect(inserts).toHaveLength(1);
    const payload = inserts[0].payload as any;
    expect(payload.user_id).toBe('user-1');
    expect(payload.canonical_ingredient_id).toBe('canon-milk');
  });

  it('POST /staples: returns 400 when canonical.status=candidate (anti-candidate guard)', async () => {
    tables.canonical_ingredients.push({
      id: 'canon-mystery',
      status: 'candidate',
      canonical_name: 'mystery',
    });

    const res = await req('/staples', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonical_ingredient_id: 'canon-mystery' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/CANONICAL_NOT_ACTIVE/);
    expect(
      operations.filter((o) => o.table === 'user_staples' && o.op === 'insert'),
    ).toHaveLength(0);
  });

  it('POST /staples: returns 400 when canonical not found', async () => {
    const res = await req('/staples', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ canonical_ingredient_id: 'canon-nope' }),
    });
    expect(res.status).toBe(400);
  });

  it('GET /staples: returns caller staples (shape verified via inserts)', async () => {
    tables.user_staples.push({
      user_id: 'user-1',
      canonical_ingredient_id: 'canon-milk',
      created_at: '2026-04-18T00:00:00Z',
    });
    tables.user_staples.push({
      user_id: 'user-2',
      canonical_ingredient_id: 'canon-eggs',
      created_at: '2026-04-18T00:00:00Z',
    });
    const res = await req('/staples', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    // RLS is enforced by Supabase in prod; our mock filters on .eq('user_id', 'user-1')
    // but only if the route calls .eq explicitly. Verify only user-1 row returned.
    expect(body.data.length).toBe(1);
    expect(body.data[0].canonical_ingredient_id).toBe('canon-milk');
  });

  it('DELETE /staples/:canonical_id: removes the row', async () => {
    tables.user_staples.push({
      user_id: 'user-1',
      canonical_ingredient_id: 'canon-milk',
    });
    const res = await req('/staples/canon-milk', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.user_staples).toHaveLength(0);
    const deletes = operations.filter(
      (o) => o.table === 'user_staples' && o.op === 'delete',
    );
    expect(deletes).toHaveLength(1);
  });
});

describe('Phase 21-03 — /rules routes', () => {
  beforeEach(() => {
    resetTables();
  });

  it("POST /rules name_mapping: writes ingredient_aliases with source='user_rule' confidence=1.0", async () => {
    const res = await req('/rules', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_type: 'name_mapping',
        alias_name: 'half and half',
        target_canonical_id: 'canon-cream',
      }),
    });
    expect(res.status).toBe(201);
    const inserts = operations.filter(
      (o) => o.table === 'ingredient_aliases' && o.op === 'insert',
    );
    expect(inserts).toHaveLength(1);
    const payload = inserts[0].payload as any;
    expect(payload.alias_name).toBe('half and half');
    expect(payload.canonical_ingredient_id).toBe('canon-cream');
    expect(payload.source).toBe('user_rule');
    expect(payload.confidence).toBe(1.0);
  });

  it('POST /rules location_mapping: writes user_location_rules with precedence=max+1', async () => {
    tables.user_location_rules.push({
      id: 'rule-existing',
      user_id: 'user-1',
      canonical_ingredient_id: 'canon-butter',
      source_location: 'fridge',
      precedence: 2,
    });

    const res = await req('/rules', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_type: 'location_mapping',
        canonical_ingredient_id: 'canon-yogurt',
        source_location: 'fridge',
      }),
    });
    expect(res.status).toBe(201);
    const inserts = operations.filter(
      (o) => o.table === 'user_location_rules' && o.op === 'insert',
    );
    expect(inserts).toHaveLength(1);
    const payload = inserts[0].payload as any;
    expect(payload.user_id).toBe('user-1');
    expect(payload.canonical_ingredient_id).toBe('canon-yogurt');
    expect(payload.source_location).toBe('fridge');
    expect(payload.precedence).toBe(3); // max(2) + 1
  });

  it('POST /rules location_mapping: precedence=0 on first rule', async () => {
    const res = await req('/rules', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rule_type: 'location_mapping',
        canonical_ingredient_id: 'canon-yogurt',
        source_location: 'fridge',
      }),
    });
    expect(res.status).toBe(201);
    const inserts = operations.filter(
      (o) => o.table === 'user_location_rules' && o.op === 'insert',
    );
    expect((inserts[0].payload as any).precedence).toBe(0);
  });

  it('GET /rules: returns combined name_mapping + location_mapping lists', async () => {
    tables.ingredient_aliases.push({
      id: 'alias-1',
      alias_name: 'half and half',
      canonical_ingredient_id: 'canon-cream',
      source: 'user_rule',
    });
    tables.ingredient_aliases.push({
      id: 'alias-global',
      alias_name: 'milk 2%',
      canonical_ingredient_id: 'canon-milk',
      source: 'canonical_seed',
    });
    tables.user_location_rules.push({
      id: 'rule-1',
      user_id: 'user-1',
      canonical_ingredient_id: 'canon-butter',
      source_location: 'fridge',
      precedence: 0,
    });
    tables.user_location_rules.push({
      id: 'rule-2',
      user_id: 'user-1',
      canonical_ingredient_id: 'canon-yogurt',
      source_location: 'fridge',
      precedence: 1,
    });

    const res = await req('/rules', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.name_mapping)).toBe(true);
    expect(Array.isArray(body.location_mapping)).toBe(true);
    expect(body.name_mapping).toHaveLength(1); // only user_rule rows
    expect(body.name_mapping[0].alias_name).toBe('half and half');
    expect(body.location_mapping).toHaveLength(2);
    expect(body.location_mapping[0].precedence).toBe(0);
    expect(body.location_mapping[1].precedence).toBe(1);
  });

  it('PATCH /rules/reorder: rewrites precedence for location rules by index order', async () => {
    tables.user_location_rules.push({
      id: 'rule-a',
      user_id: 'user-1',
      canonical_ingredient_id: 'c-a',
      source_location: 'fridge',
      precedence: 0,
    });
    tables.user_location_rules.push({
      id: 'rule-b',
      user_id: 'user-1',
      canonical_ingredient_id: 'c-b',
      source_location: 'pantry',
      precedence: 1,
    });
    tables.user_location_rules.push({
      id: 'rule-c',
      user_id: 'user-1',
      canonical_ingredient_id: 'c-c',
      source_location: 'freezer',
      precedence: 2,
    });

    const res = await req('/rules/reorder', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rule_ids: ['rule-c', 'rule-a', 'rule-b'] }),
    });
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(
      tables.user_location_rules.map((r: any) => [r.id, r.precedence]),
    );
    expect(byId['rule-c']).toBe(0);
    expect(byId['rule-a']).toBe(1);
    expect(byId['rule-b']).toBe(2);
  });

  it('DELETE /rules/:id: removes from ingredient_aliases when id matches there', async () => {
    tables.ingredient_aliases.push({
      id: 'alias-1',
      alias_name: 'half and half',
      canonical_ingredient_id: 'canon-cream',
      source: 'user_rule',
    });

    const res = await req('/rules/alias-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.ingredient_aliases).toHaveLength(0);
  });

  it('DELETE /rules/:id: removes from user_location_rules when id matches there', async () => {
    tables.user_location_rules.push({
      id: 'rule-1',
      user_id: 'user-1',
      canonical_ingredient_id: 'canon-butter',
      source_location: 'fridge',
      precedence: 0,
    });

    const res = await req('/rules/rule-1', { method: 'DELETE' });
    expect(res.status).toBe(204);
    expect(tables.user_location_rules).toHaveLength(0);
  });
});

describe('Phase 21-03 — /suggestions routes', () => {
  beforeEach(() => {
    resetTables();
  });

  it('GET /suggestions: returns only rows where dismissed_at IS NULL', async () => {
    tables.suggested_rules.push({
      id: 'sug-1',
      user_id: 'user-1',
      rule_type: 'location_mapping',
      payload: { item_name: 'milk', user_location: 'fridge', canonical_ingredient_id: 'canon-milk' },
      dismissed_at: null,
      occurrence_count: 2,
    });
    tables.suggested_rules.push({
      id: 'sug-2',
      user_id: 'user-1',
      rule_type: 'location_mapping',
      payload: { item_name: 'rice', user_location: 'pantry', canonical_ingredient_id: 'canon-rice' },
      dismissed_at: '2026-04-10T00:00:00Z',
      occurrence_count: 3,
    });

    const res = await req('/suggestions', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe('sug-1');
  });

  it('POST /suggestions/:id/dismiss: sets dismissed_at without creating a rule', async () => {
    tables.suggested_rules.push({
      id: 'sug-1',
      user_id: 'user-1',
      rule_type: 'location_mapping',
      payload: { item_name: 'milk', user_location: 'fridge', canonical_ingredient_id: 'canon-milk' },
      dismissed_at: null,
    });

    const res = await req('/suggestions/sug-1/dismiss', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(tables.suggested_rules[0].dismissed_at).not.toBeNull();
    expect(
      operations.filter((o) => o.table === 'user_location_rules' && o.op === 'insert'),
    ).toHaveLength(0);
    expect(
      operations.filter((o) => o.table === 'ingredient_aliases' && o.op === 'insert'),
    ).toHaveLength(0);
  });

  it('POST /suggestions/:id/accept (location_mapping): inserts user_location_rules + dismisses (W3: reads canonical from payload)', async () => {
    tables.canonical_ingredients.push({
      id: 'canon-milk',
      status: 'active',
      canonical_name: 'milk',
    });
    tables.suggested_rules.push({
      id: 'sug-1',
      user_id: 'user-1',
      rule_type: 'location_mapping',
      payload: {
        item_name: 'milk',
        user_location: 'fridge',
        canonical_ingredient_id: 'canon-milk',
      },
      dismissed_at: null,
    });

    const res = await req('/suggestions/sug-1/accept', { method: 'POST' });
    expect(res.status).toBe(200);
    const rulesInserts = operations.filter(
      (o) => o.table === 'user_location_rules' && o.op === 'insert',
    );
    expect(rulesInserts).toHaveLength(1);
    const payload = rulesInserts[0].payload as any;
    expect(payload.canonical_ingredient_id).toBe('canon-milk');
    expect(payload.source_location).toBe('fridge');
    expect(tables.suggested_rules[0].dismissed_at).not.toBeNull();
  });

  it('POST /suggestions/:id/accept (location_mapping) returns 400 when payload canonical is candidate (W3 guard)', async () => {
    tables.canonical_ingredients.push({
      id: 'canon-weird',
      status: 'candidate',
      canonical_name: 'weird-thing',
    });
    tables.suggested_rules.push({
      id: 'sug-weird',
      user_id: 'user-1',
      rule_type: 'location_mapping',
      payload: {
        item_name: 'weird-thing',
        user_location: 'fridge',
        canonical_ingredient_id: 'canon-weird',
      },
      dismissed_at: null,
    });

    const res = await req('/suggestions/sug-weird/accept', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/CANONICAL_NOT_ACTIVE/);
    // No rule written; suggestion NOT dismissed (so user can retry later).
    expect(
      operations.filter((o) => o.table === 'user_location_rules' && o.op === 'insert'),
    ).toHaveLength(0);
  });

  it('POST /suggestions/:id/accept (name_mapping): inserts ingredient_aliases row + dismisses', async () => {
    tables.suggested_rules.push({
      id: 'sug-name',
      user_id: 'user-1',
      rule_type: 'name_mapping',
      payload: {
        alias_name: 'half and half',
        target_canonical_id: 'canon-cream',
      },
      dismissed_at: null,
    });

    const res = await req('/suggestions/sug-name/accept', { method: 'POST' });
    expect(res.status).toBe(200);
    const aliasInserts = operations.filter(
      (o) => o.table === 'ingredient_aliases' && o.op === 'insert',
    );
    expect(aliasInserts).toHaveLength(1);
    const payload = aliasInserts[0].payload as any;
    expect(payload.alias_name).toBe('half and half');
    expect(payload.canonical_ingredient_id).toBe('canon-cream');
    expect(payload.source).toBe('user_rule');
    expect(payload.confidence).toBe(1.0);
    expect(tables.suggested_rules[0].dismissed_at).not.toBeNull();
  });

  it('POST /suggestions/:id/accept returns 404 when suggestion missing', async () => {
    const res = await req('/suggestions/nope/accept', { method: 'POST' });
    expect(res.status).toBe(404);
  });
});

describe('Phase 21-03 — /preview route', () => {
  beforeEach(() => {
    resetTables();
  });

  it('GET /preview?canonical_id=X returns 30-day items matching canonical_id OR normalized-name', async () => {
    tables.canonical_ingredients.push({
      id: 'canon-milk',
      canonical_name: 'milk',
      status: 'active',
    });
    // Two events in window, one match by canonical_ingredient_id, one match by
    // normalized-name, one unmatched.
    const now = new Date();
    const withinWindow = new Date(now.getTime() - 5 * 86400_000).toISOString();
    tables.scan_events.push({
      id: 'ev-1',
      user_id: 'user-1',
      final_items: [{ name: 'milk', canonical_ingredient_id: 'canon-milk' }],
      created_at: withinWindow,
    });
    tables.scan_events.push({
      id: 'ev-2',
      user_id: 'user-1',
      final_items: [{ name: 'Milk' }], // pre-canonical event — matches by name
      created_at: withinWindow,
    });
    tables.scan_events.push({
      id: 'ev-3',
      user_id: 'user-1',
      final_items: [{ name: 'eggs' }],
      created_at: withinWindow,
    });

    const res = await req('/preview?canonical_id=canon-milk', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.items).toHaveLength(2);
    for (const item of body.items) {
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('at');
    }
  });

  it('GET /preview limits returned items to 50', async () => {
    tables.canonical_ingredients.push({
      id: 'canon-bulk',
      canonical_name: 'bulk',
      status: 'active',
    });
    const withinWindow = new Date(Date.now() - 1 * 86400_000).toISOString();
    // 60 events all matching canonical_id.
    for (let i = 0; i < 60; i++) {
      tables.scan_events.push({
        id: `ev-${i}`,
        user_id: 'user-1',
        final_items: [{ name: `bulk-${i}`, canonical_ingredient_id: 'canon-bulk' }],
        created_at: withinWindow,
      });
    }

    const res = await req('/preview?canonical_id=canon-bulk', { method: 'GET' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(60);
    expect(body.items).toHaveLength(50);
  });

  it('GET /preview returns 400 when canonical_id missing', async () => {
    const res = await req('/preview', { method: 'GET' });
    expect(res.status).toBe(400);
  });
});

describe('Phase 21-03 — /category-override route (W4: singular table name)', () => {
  beforeEach(() => {
    resetTables();
  });

  it('POST /category-override: upserts canonical_category_override (singular)', async () => {
    const res = await req('/category-override', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonical_ingredient_id: 'canon-milk',
        category: 'dairy',
      }),
    });
    expect(res.status).toBe(200);
    const upserts = operations.filter(
      (o) => o.table === 'canonical_category_override' && o.op === 'upsert',
    );
    expect(upserts).toHaveLength(1);
    const payload = upserts[0].payload as any;
    expect(payload.user_id).toBe('user-1');
    expect(payload.canonical_ingredient_id).toBe('canon-milk');
    expect(payload.category).toBe('dairy');
    const opts = upserts[0].opts as any;
    expect(opts.onConflict).toBe('user_id,canonical_ingredient_id');
  });

  it('POST /category-override: idempotent — second call updates in place via onConflict', async () => {
    await req('/category-override', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonical_ingredient_id: 'canon-milk',
        category: 'dairy',
      }),
    });
    await req('/category-override', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonical_ingredient_id: 'canon-milk',
        category: 'beverage',
      }),
    });
    expect(tables.canonical_category_override).toHaveLength(1);
    expect(tables.canonical_category_override[0].category).toBe('beverage');
  });

  it('POST /category-override: returns 400 for invalid category', async () => {
    const res = await req('/category-override', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canonical_ingredient_id: 'canon-milk',
        category: 'not-a-valid-category',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /category-override: returns 400 when canonical_ingredient_id missing', async () => {
    const res = await req('/category-override', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'dairy' }),
    });
    expect(res.status).toBe(400);
  });
});
