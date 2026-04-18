import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIdentifyFoodItemsBatch, mockIdentifyReceiptItems, mockAuthMiddleware, supabase, supabaseState } = vi.hoisted(() => {
  // Mutable shared state so individual tests can seed existing-items rows.
  const supabaseState = { existingItems: [] as Array<{ name: string }> };
  const supabase = {
    from: vi.fn(() => {
      const chain: any = {
        select: vi.fn(() => chain),
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
    mockIdentifyFoodItemsBatch: vi.fn(),
    mockIdentifyReceiptItems: vi.fn(),
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
  identifyFoodItems: vi.fn(),
  identifyFoodItemsBatch: mockIdentifyFoodItemsBatch,
  identifyReceiptItems: mockIdentifyReceiptItems,
}));

vi.mock('../../services/pantry.js', () => ({
  reconcileItems: vi.fn(),
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

describe('POST /scan-batch', () => {
  beforeEach(() => {
    mockIdentifyFoodItemsBatch.mockReset();
  });

  it('returns 400 when images array is missing', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_location: 'fridge' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/images/i);
  });

  it('returns 400 when images array is empty', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [], source_location: 'fridge' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when images array exceeds 5 elements', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: ['a', 'b', 'c', 'd', 'e', 'f'],
        source_location: 'fridge',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/1.*5/);
  });

  it('returns 400 for invalid source_location', async () => {
    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: ['img1'], source_location: 'garage' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source_location/i);
  });

  it('returns 200 with merged item list on success', async () => {
    mockIdentifyFoodItemsBatch.mockResolvedValue([
      { name: 'milk', quantity: 1, unit: 'gallon', confidence: 0.9, category: 'dairy' },
      { name: 'eggs', quantity: 12, unit: 'piece', confidence: 0.85, category: 'protein' },
    ]);

    const res = await req('/scan-batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: ['img1', 'img2'],
        source_location: 'fridge',
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe('milk');
    expect(mockIdentifyFoodItemsBatch).toHaveBeenCalledWith(['img1', 'img2'], 'fridge', expect.any(Array));
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
      body: JSON.stringify({ source_location: 'pantry' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/image/i);
  });

  it('returns 400 for invalid source_location', async () => {
    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG', source_location: 'bathroom' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/source_location/i);
  });

  it('defaults source_location to pantry when omitted', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([]);

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(res.status).toBe(200);
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', 'pantry', expect.any(Array), 'receipt');
  });

  it('returns 200 with { data: ScanResult[] } on success', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([
      { name: 'chicken', quantity: 1, unit: 'lb', confidence: 0.9, category: 'protein' },
    ]);

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG', source_location: 'pantry' }),
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
      body: JSON.stringify({ image: 'IMG', source_location: 'fridge' }),
    });
    expect(res.status).toBe(200);
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', 'fridge', ['milk', 'eggs'], 'receipt');
  });

  it('passes variant=receipt as 4th arg', async () => {
    mockIdentifyReceiptItems.mockResolvedValue([]);

    await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG', source_location: 'pantry' }),
    });
    const lastCall = mockIdentifyReceiptItems.mock.calls[mockIdentifyReceiptItems.mock.calls.length - 1];
    expect(lastCall[3]).toBe('receipt');
  });

  it('returns 500 when the service throws', async () => {
    mockIdentifyReceiptItems.mockRejectedValue(new Error('vision boom'));

    const res = await req('/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG', source_location: 'pantry' }),
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
      { name: 'apples', quantity: 4, unit: 'piece', confidence: 0.95, category: 'produce' },
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

  it("calls service with sourceLocation='pantry' and variant='instacart_screenshot'", async () => {
    mockIdentifyReceiptItems.mockResolvedValue([]);

    await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', 'pantry', expect.any(Array), 'instacart_screenshot');
  });

  it('passes existing pantry names to the service', async () => {
    supabaseState.existingItems = [{ name: 'olive oil' }, { name: 'rice' }];
    mockIdentifyReceiptItems.mockResolvedValue([]);

    await req('/import-instacart', {
      method: 'POST',
      headers: { Authorization: 'Bearer test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'IMG' }),
    });
    expect(mockIdentifyReceiptItems).toHaveBeenCalledWith('IMG', 'pantry', ['olive oil', 'rice'], 'instacart_screenshot');
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
