/**
 * Integration tests for /api/v1/cooking
 *
 * Routes covered:
 *   POST /cooking/ask   — voice cooking question (AI)
 *   GET  /cooking/tips  — per-step tip (AI, cached)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, authHeaders, resetTestUser } from './_helpers/test-user.js';
import { createClient } from '@supabase/supabase-js';

const base = `${BASE_URL}/cooking`;

let headers: Record<string, string>;
let recipeId: string;

beforeAll(async () => {
  await resetTestUser();
  headers = await authHeaders();

  // Seed a recipe so the cooking endpoints have something to reference
  const admin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session } = await anon.auth.signInWithPassword({
    email: 'uat@dinnertime.test',
    password: 'UATovernight2026',
  });
  const uid = session.user?.id;
  if (!uid) return;

  const { data: recipe } = await admin
    .from('recipes')
    .insert({
      profile_id: uid,
      title: 'Cooking Test Pasta',
      source_type: 'manual',
      // Pass arrays directly — supabase-js will serialize to JSONB
      ingredients: [
        { name: 'pasta', quantity: 200, unit: 'g' },
        { name: 'olive oil', quantity: 2, unit: 'tbsp' },
      ],
      steps: [
        'Bring a large pot of salted water to boil.',
        'Cook pasta al dente according to package directions.',
        'Drain and toss with olive oil.',
      ],
      servings: 2,
    })
    .select()
    .single();

  if (recipe) recipeId = (recipe as { id: string }).id;
});

// Wipe everything this suite seeded into the shared UAT account so
// "Cooking Test Pasta" doesn't show up in the user's Recipe Box.
afterAll(async () => {
  await resetTestUser();
});

async function readBody(res: Response) {
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = null; }
  return { text, json };
}

describe('POST /cooking/ask (AI)', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when question is empty string', async () => {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipe_id: '00000000-0000-0000-0000-000000000000',
        current_step_index: 0,
        question: '   ',
      }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 for a non-existent recipe', async () => {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        recipe_id: '00000000-0000-0000-0000-000000000000',
        current_step_index: 0,
        question: 'How much salt do I need?',
      }),
    });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await fetch(`${base}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipe_id: '00000000-0000-0000-0000-000000000000',
        current_step_index: 0,
        question: 'How much salt?',
      }),
    });
    expect(res.status).toBe(401);
  });

  it(
    'answers a cooking question and returns spoken-style text',
    { timeout: 60_000 },
    async () => {
      if (!recipeId) {
        console.warn('Skipping POST /cooking/ask — no recipe seeded');
        return;
      }
      const res = await fetch(`${base}/ask`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recipe_id: recipeId,
          current_step_index: 0,
          question: 'How much salt should I add to the water?',
        }),
      });
      const { text, json } = await readBody(res);
      expect(res.status, `body: ${text}`).toBe(200);
      const body = json as { answer: string };
      expect(body.answer).toBeTypeOf('string');
      expect(body.answer.length).toBeGreaterThan(0);
      expect(body.answer.length).toBeLessThanOrEqual(300);
    }
  );
});

describe('GET /cooking/tips (AI, cached)', () => {
  it('returns 400 when required query params are missing', async () => {
    const res = await fetch(`${base}/tips`, { headers });
    expect(res.status).toBe(400);
  });

  it('returns 400 for negative step_index', async () => {
    const url = new URL(`${base}/tips`);
    url.searchParams.set('recipe_id', '00000000-0000-0000-0000-000000000000');
    url.searchParams.set('step_index', '-1');
    url.searchParams.set('step_text', 'Cook pasta');
    const res = await fetch(url.toString(), { headers });
    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent recipe', async () => {
    const url = new URL(`${base}/tips`);
    url.searchParams.set('recipe_id', '00000000-0000-0000-0000-000000000000');
    url.searchParams.set('step_index', '0');
    url.searchParams.set('step_text', 'Cook pasta');
    const res = await fetch(url.toString(), { headers });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const url = new URL(`${base}/tips`);
    url.searchParams.set('recipe_id', '00000000-0000-0000-0000-000000000000');
    url.searchParams.set('step_index', '0');
    url.searchParams.set('step_text', 'Cook pasta');
    const res = await fetch(url.toString());
    expect(res.status).toBe(401);
  });

  it(
    'returns a tip string for a valid recipe step',
    { timeout: 60_000 },
    async () => {
      if (!recipeId) {
        console.warn('Skipping GET /cooking/tips — no recipe seeded');
        return;
      }
      const url = new URL(`${base}/tips`);
      url.searchParams.set('recipe_id', recipeId);
      url.searchParams.set('step_index', '0');
      url.searchParams.set('step_text', 'Bring a large pot of salted water to boil.');
      const res = await fetch(url.toString(), { headers });
      const { text, json } = await readBody(res);
      expect(res.status, `body: ${text}`).toBe(200);
      expect((json as { tip: string }).tip).toBeTypeOf('string');
    }
  );
});
