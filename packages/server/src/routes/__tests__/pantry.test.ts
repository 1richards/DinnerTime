import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIdentifyFoodItems, mockIdentifyFoodItemsBatch, mockIdentifyReceiptItems, mockReconcileItems, mockAuthMiddleware, supabase, supabaseState } = vi.hoisted(() => {
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
  const supabase = {
    from: vi.fn((table: string) => {
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
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'Missing auth' }, 401);
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    supabase,
    supabaseState,
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
