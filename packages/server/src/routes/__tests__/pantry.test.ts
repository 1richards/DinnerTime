import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockIdentifyFoodItemsBatch, mockAuthMiddleware, supabase } = vi.hoisted(() => {
  const supabase = {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    })),
  };

  return {
    mockIdentifyFoodItemsBatch: vi.fn(),
    mockAuthMiddleware: vi.fn(async (c: any, next: any) => {
      const auth = c.req.header('Authorization');
      if (!auth) return c.json({ error: 'Missing auth' }, 401);
      c.set('user', { id: 'user-1' });
      c.set('supabase', supabase);
      await next();
    }),
    supabase,
  };
});

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: mockAuthMiddleware,
}));

vi.mock('../../services/vision.js', () => ({
  identifyFoodItems: vi.fn(),
  identifyFoodItemsBatch: mockIdentifyFoodItemsBatch,
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
