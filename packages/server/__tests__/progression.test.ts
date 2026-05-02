/**
 * Integration tests for /api/v1/progression
 *
 * Routes covered:
 *   GET /progression/cook-stats           — per-recipe cook stats
 *   GET /progression/suggestions          — AI ambition ranking
 *   GET /progression/variations/:recipeId — creative variations (AI)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, authHeaders, resetTestUser } from './_helpers/test-user.js';

const base = `${BASE_URL}/progression`;

let headers: Record<string, string>;

beforeAll(async () => {
  await resetTestUser();
  headers = await authHeaders();
});


async function readBody(res: Response) {
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = null; }
  return { text, json };
}

describe('GET /progression/cook-stats', () => {
  it('returns 200 with an array', async () => {
    const res = await fetch(`${base}/cook-stats`, { headers });
    const { text, json } = await readBody(res);
    expect(res.status, `body: ${text}`).toBe(200);
    expect((json as { data: unknown[] }).data).toBeInstanceOf(Array);
  });

  it('returns 401 without auth', async () => {
    const res = await fetch(`${base}/cook-stats`);
    expect(res.status).toBe(401);
  });
});

describe('GET /progression/suggestions (AI)', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch(`${base}/suggestions`);
    expect(res.status).toBe(401);
  });

  it(
    'returns an array of suggestions (may be empty if library is empty)',
    { timeout: 60_000 },
    async () => {
      const res = await fetch(`${base}/suggestions`, { headers });
      const { text, json } = await readBody(res);
      expect(res.status, `body: ${text}`).toBe(200);
      expect((json as { data: unknown[] }).data).toBeInstanceOf(Array);
    }
  );
});

describe('GET /progression/variations/:recipeId (AI)', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch(`${base}/variations/00000000-0000-0000-0000-000000000000`);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a non-existent recipe', async () => {
    const res = await fetch(
      `${base}/variations/00000000-0000-0000-0000-000000000000`,
      { headers }
    );
    expect(res.status).toBe(404);
  });
});
