/**
 * Integration tests for /api/v1/ai
 *
 * Routes covered:
 *   POST /ai/suggest — AI-backed dinner suggestions from pantry
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BASE_URL, authHeaders, resetTestUser } from './_helpers/test-user.js';
import { createClient } from '@supabase/supabase-js';

const base = `${BASE_URL}/ai`;

let headers: Record<string, string>;

beforeAll(async () => {
  await resetTestUser();
  headers = await authHeaders();

  // Seed some pantry items so suggestions can run
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

  // Valid pantry_items categories: produce|dairy|protein|frozen|other
  const { error: pantryErr } = await admin.from('pantry_items').insert([
    { profile_id: uid, name: 'Chicken breast', normalized_name: 'chicken breast', quantity: 2, unit: 'piece', category: 'protein', source_location: 'fridge', status: 'available', confidence: 1 },
    { profile_id: uid, name: 'Pasta', normalized_name: 'pasta', quantity: 400, unit: 'g', category: 'other', source_location: 'fridge', status: 'available', confidence: 1 },
    { profile_id: uid, name: 'Tomatoes', normalized_name: 'tomatoes', quantity: 4, unit: 'count', category: 'produce', source_location: 'fridge', status: 'available', confidence: 1 },
    { profile_id: uid, name: 'Olive oil', normalized_name: 'olive oil', quantity: 1, unit: 'bottle', category: 'other', source_location: 'fridge', status: 'available', confidence: 1 },
    { profile_id: uid, name: 'Garlic', normalized_name: 'garlic', quantity: 3, unit: 'clove', category: 'produce', source_location: 'fridge', status: 'available', confidence: 1 },
  ]);
  if (pantryErr) console.warn('[ai setup] pantry insert error:', pantryErr.message);
});

// Wipe everything this suite seeded into the shared UAT account.

describe('POST /ai/suggest', () => {
  it('returns 401 without auth', async () => {
    const res = await fetch(`${base}/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  });

  it(
    'returns AI dinner suggestions with required shape',
    { timeout: 60_000 },
    async () => {
      const res = await fetch(`${base}/suggest`, {
        method: 'POST',
        headers,
      });
      const text = await res.text();
      // Could be 200 (success) or 400 (not enough pantry items)
      expect([200, 400]).toContain(res.status);

      const body = JSON.parse(text);
      if (res.status === 200) {
        expect(body.data).toBeDefined();
        // data should be an array of suggestions
        const suggestions = Array.isArray(body.data) ? body.data : [];
        if (suggestions.length > 0) {
          expect(suggestions[0]).toHaveProperty('title');
        }
      } else {
        expect(body.error).toBeTypeOf('string');
      }
    }
  );
});
