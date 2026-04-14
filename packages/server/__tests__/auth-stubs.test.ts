/**
 * Auth stub routes — all return 501 Not Implemented.
 * These are intentionally trivial assertions.
 */

import { describe, it, expect } from 'vitest';
import { BASE_URL } from './_helpers/test-user.js';

const base = `${BASE_URL}/auth`;

describe('Auth stub routes (501)', () => {
  it('POST /auth/signup returns 501', async () => {
    const res = await fetch(`${base}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@x.com', password: 'password' }),
    });
    expect(res.status).toBe(501);
  });

  it('POST /auth/login returns 501', async () => {
    const res = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x@x.com', password: 'password' }),
    });
    expect(res.status).toBe(501);
  });

  it('POST /auth/logout returns 501', async () => {
    const res = await fetch(`${base}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(501);
  });
});
