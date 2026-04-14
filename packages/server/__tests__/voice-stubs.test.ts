/**
 * Voice stub routes — all return 501 Not Implemented.
 * Note: the route has authMiddleware, but the stub still returns 501
 * before auth is checked (or auth check happens first — we include a token anyway).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { BASE_URL, authHeaders } from './_helpers/test-user.js';

const base = `${BASE_URL}/voice`;

let headers: Record<string, string>;

beforeAll(async () => {
  headers = await authHeaders();
});

describe('Voice stub routes (501)', () => {
  it('POST /voice/transcribe with auth returns 501', async () => {
    const res = await fetch(`${base}/transcribe`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(501);
  });

  it('POST /voice/transcribe without auth also returns 401 or 501', async () => {
    const res = await fetch(`${base}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // authMiddleware runs first so unauthenticated gets 401; stub still 501 with auth
    expect([401, 501]).toContain(res.status);
  });
});
