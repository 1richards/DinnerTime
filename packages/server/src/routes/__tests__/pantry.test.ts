import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIdentifyFoodItems, mockIdentifyFoodItemsBatch, mockIdentifyReceiptItems, mockReconcileItems, mockAuthMiddleware, supabase, supabaseState } = vi.hoisted(() => {
  // Mutable shared state so individual tests can seed existing-items rows +
  // observe insert() payloads (override-events).
  const supabaseState = {
    existingItems: [] as Array<{ name: string }>,
    lastInsertTable: null as string | null,
    lastInsertPayload: null as any,
    insertError: null as null | { message: string },
  };
  const supabase = {
    from: vi.fn((table: string) => {
      const chain: any = {
        select: vi.fn(() => chain),
        insert: vi.fn((payload: any) => {
          supabaseState.lastInsertTable = table;
          supabaseState.lastInsertPayload = payload;
          const insertChain: any = {
            select: vi.fn(() => insertChain),
            then: (resolve: (v: any) => void) =>
              resolve({ data: supabaseState.insertError ? null : payload, error: supabaseState.insertError }),
          };
          return insertChain;
        }),
        // The existing-names query fires `.eq(...).eq(...).eq(...)` — the final
        // call must be awaitable (Promise-like). We make the chain itself thenable
        // so `await ....eq(...)` resolves with `{ data: existingItems }`.
        eq: vi.fn(() => chain),
        order: vi.fn(() => chain),
        then: (resolve: (v: any) => void) => resolve({ data: supabaseState.existingItems }),
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
