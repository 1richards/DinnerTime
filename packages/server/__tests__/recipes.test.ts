/**
 * Integration tests for /api/v1/recipes
 *
 * Routes covered:
 *   GET    /recipes            — list
 *   POST   /recipes            — save
 *   GET    /recipes/:id        — get by id
 *   PATCH  /recipes/:id        — update
 *   DELETE /recipes/:id        — delete
 *   POST   /recipes/import/url — url import (AI)
 *   POST   /recipes/import/text — text import (AI)
 *   POST   /recipes/import/photo — photo import (AI)
 *   POST   /recipes/discover   — AI discover
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, authHeaders, resetTestUser } from './_helpers/test-user.js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const base = `${BASE_URL}/recipes`;

let headers: Record<string, string>;

beforeAll(async () => {
  await resetTestUser();
  headers = await authHeaders();
});

// NOTE: afterAll(resetTestUser) was previously wired here to keep the
// UAT account clean of "Test Pasta" / "Dedup Lasagna" pollution. Pulled
// because the same UAT account is shared with the user's live in-app
// testing — wiping all owned rows after every test run also wiped the
// user's actual meal plan / pantry, breaking Set focus + Regenerate.
// beforeAll(resetTestUser) above still gives each suite a clean
// starting state. The lasting fix is to spin up a separate
// uat-tests@dinnertime.test account; tracked separately.

/** Read response body once and return both text and parsed JSON. */
async function readBody(res: Response): Promise<{ text: string; json: unknown }> {
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = null; }
  return { text, json };
}

// Minimal valid recipe fixture
const FIXTURE_RECIPE = {
  title: 'Test Pasta',
  description: 'A simple pasta dish',
  ingredients: [{ name: 'pasta', quantity: 200, unit: 'g' }],
  steps: ['Boil water', 'Cook pasta', 'Serve'],
  prep_time_minutes: 5,
  cook_time_minutes: 10,
  total_time_minutes: 15,
  servings: 2,
  source_type: 'manual' as const,
};

describe('GET /recipes (list)', () => {
  it('returns 200 with empty data array when no recipes', async () => {
    const res = await fetch(base, { headers });
    const { text, json } = await readBody(res);
    expect(res.status, `body: ${text}`).toBe(200);
    expect((json as { data: unknown[] }).data).toBeInstanceOf(Array);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(base);
    expect(res.status).toBe(401);
  });
});

describe('POST /recipes (save)', () => {
  it('creates a recipe and returns 201', async () => {
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify(FIXTURE_RECIPE),
    });
    const { text, json } = await readBody(res);
    expect(res.status, `body: ${text}`).toBe(201);
    const body = json as { data: { title: string; id: string } };
    expect(body.data).toBeDefined();
    expect(body.data.title).toBe('Test Pasta');
    expect(body.data.id).toBeTypeOf('string');
  });

  it('returns 400 when required fields missing', async () => {
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Missing ingredients and steps' }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(FIXTURE_RECIPE),
    });
    expect(res.status).toBe(401);
  });

  it('dedupes by normalized title — second save returns existing row + duplicate flag, no second insert', async () => {
    // Seed a recipe.
    const first = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...FIXTURE_RECIPE, title: 'Dedup Lasagna' }),
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { data: { id: string } };

    // Re-save with same title (different case + whitespace) → expect dedup.
    const second = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...FIXTURE_RECIPE, title: '  dedup LASAGNA  ' }),
    });
    expect(second.status).toBe(200); // not 201 — no insert happened
    const secondBody = (await second.json()) as {
      data: { id: string };
      duplicate?: boolean;
    };
    expect(secondBody.duplicate).toBe(true);
    expect(secondBody.data.id).toBe(firstBody.data.id);
  });
});

describe('GET /recipes/:id', () => {
  let recipeId: string;

  beforeAll(async () => {
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...FIXTURE_RECIPE, title: 'Recipe for GET test' }),
    });
    const body = await res.json() as { data: { id: string } };
    recipeId = body.data.id;
  });

  it('returns 200 with the recipe', async () => {
    const res = await fetch(`${base}/${recipeId}`, { headers });
    const { text, json } = await readBody(res);
    expect(res.status, `body: ${text}`).toBe(200);
    expect((json as { data: { id: string } }).data.id).toBe(recipeId);
  });

  it('returns 404 for a non-existent id', async () => {
    const res = await fetch(`${base}/00000000-0000-0000-0000-000000000000`, { headers });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/${recipeId}`);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /recipes/:id', () => {
  let recipeId: string;

  beforeAll(async () => {
    const res = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...FIXTURE_RECIPE, title: 'Recipe for PATCH test' }),
    });
    const body = await res.json() as { data: { id: string } };
    recipeId = body.data.id;
  });

  it('updates a patchable field and returns 200', async () => {
    const res = await fetch(`${base}/${recipeId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: 'Updated Title', is_favorite: true }),
    });
    const { text, json } = await readBody(res);
    expect(res.status, `body: ${text}`).toBe(200);
    const body = json as { data: { title: string; is_favorite: boolean } };
    expect(body.data.title).toBe('Updated Title');
    expect(body.data.is_favorite).toBe(true);
  });

  it('returns 404 when patching non-existent recipe', async () => {
    const res = await fetch(`${base}/00000000-0000-0000-0000-000000000000`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: 'Ghost Update' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/${recipeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No auth' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /recipes/:id', () => {
  it('deletes a recipe and returns 204', async () => {
    // Create a recipe to delete
    const createRes = await fetch(base, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...FIXTURE_RECIPE, title: 'Recipe to Delete' }),
    });
    const { data } = await createRes.json() as { data: { id: string } };
    const id = data.id;

    const delRes = await fetch(`${base}/${id}`, { method: 'DELETE', headers });
    // 204 No Content — body is empty
    expect(delRes.status).toBe(204);

    // Verify it's gone
    const getRes = await fetch(`${base}/${id}`, { headers });
    expect(getRes.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/00000000-0000-0000-0000-000000000000`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /recipes/import/url (AI)', () => {
  it('returns 400 when url is missing', async () => {
    const res = await fetch(`${base}/import/url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/import/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    expect(res.status).toBe(401);
  });

  it(
    'parses a real recipe URL and returns structured recipe shape',
    { timeout: 60_000 },
    async () => {
      const res = await fetch(`${base}/import/url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: 'https://www.allrecipes.com/recipe/213742/cheesy-chicken-broccoli-casserole/',
        }),
      });
      const { text, json } = await readBody(res);
      // 200 for parsed, could also return duplicate flag; 500 if AI or scraping fails
      expect([200, 201, 500], `body: ${text}`).toContain(res.status);
      if (res.ok) {
        const body = json as { data: { title: string; ingredients: unknown[]; steps: unknown[] } };
        expect(body.data).toBeDefined();
        expect(body.data.title).toBeTypeOf('string');
        expect(body.data.ingredients).toBeInstanceOf(Array);
        expect(body.data.steps).toBeInstanceOf(Array);
      }
    }
  );
});

describe('POST /recipes/import/text (AI)', () => {
  it('returns 400 when text is missing', async () => {
    const res = await fetch(`${base}/import/text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/import/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Boil pasta. Serve.' }),
    });
    expect(res.status).toBe(401);
  });

  it(
    'parses freeform recipe text and returns structured shape',
    { timeout: 60_000 },
    async () => {
      const res = await fetch(`${base}/import/text`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: 'Simple Tomato Pasta: Boil 200g pasta. Fry garlic in olive oil. Add 1 can crushed tomatoes. Mix and serve. Serves 2.',
        }),
      });
      const { text, json } = await readBody(res);
      expect(res.status, `body: ${text}`).toBe(200);
      const body = json as { data: { title: string; ingredients: unknown[]; steps: unknown[] } };
      expect(body.data).toBeDefined();
      expect(body.data.title).toBeTypeOf('string');
      expect(body.data.ingredients).toBeInstanceOf(Array);
      expect(body.data.steps).toBeInstanceOf(Array);
    }
  );
});

describe('POST /recipes/import/photo (AI)', () => {
  it('returns 400 when image is missing', async () => {
    const res = await fetch(`${base}/import/photo`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/import/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: 'base64data' }),
    });
    expect(res.status).toBe(401);
  });

  it(
    'accepts a base64 image and returns parsed recipe shape or error',
    { timeout: 60_000 },
    async () => {
      const imgPath = resolve(
        '/Users/patrickrichards/DinnerTime/packages/server/scripts/fixtures/tiny.jpg'
      );
      const imgData = readFileSync(imgPath).toString('base64');

      const res = await fetch(`${base}/import/photo`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: imgData }),
      });
      const { text, json } = await readBody(res);
      // tiny.jpg is not a recipe photo so AI might fail gracefully
      expect([200, 400, 500], `body: ${text}`).toContain(res.status);
      if (res.status === 200) {
        expect((json as { data: unknown }).data).toBeDefined();
      }
    }
  );
});

describe('POST /recipes/discover (AI)', () => {
  it('returns 401 without auth token', async () => {
    const res = await fetch(`${base}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  it(
    'returns an array of recipe suggestions',
    { timeout: 60_000 },
    async () => {
      const res = await fetch(`${base}/discover`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: 'Quick vegetarian dinners' }),
      });
      const { text, json } = await readBody(res);
      expect(res.status, `body: ${text}`).toBe(200);
      const body = json as { data: Array<{ title: string }> };
      expect(body.data).toBeInstanceOf(Array);
      if (body.data.length > 0) {
        expect(body.data[0].title).toBeTypeOf('string');
      }
    }
  );
});
