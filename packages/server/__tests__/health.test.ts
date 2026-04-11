import { describe, it, expect } from 'vitest';
import { app } from '../src/index.js';

describe('Health Check', () => {
  it('GET /api/v1/health returns 200 with status ok', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
