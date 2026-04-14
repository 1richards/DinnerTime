/**
 * Integration test helpers for the UAT test user.
 *
 * Provides:
 *   - getToken()       — fresh JWT via supabase-js anon client
 *   - resetTestUser()  — wipe owned rows + re-upsert clean profile
 *   - authHeaders()    — { Authorization: 'Bearer <token>' }
 */

import { createClient } from '@supabase/supabase-js';

const TEST_EMAIL = 'uat@dinnertime.test';
const TEST_PASSWORD = 'UAT-overnight-2026!';
const TEST_DISPLAY_NAME = 'UAT Tester';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY in env. ' +
      'Ensure the root .env is loaded by vitest.config.ts.'
  );
}

const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Get a fresh access token for the test user. */
export async function getToken(): Promise<string> {
  const { data, error } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`[test-user] signIn failed: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error('[test-user] No access_token returned');
  return token;
}

/** Return headers object with Bearer token. */
export async function authHeaders(): Promise<{ Authorization: string; 'Content-Type': string }> {
  const token = await getToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Delete all rows owned by the test user then re-upsert a clean profile.
 * Safe to call in beforeAll — never touches other users' data.
 */
export async function resetTestUser(): Promise<void> {
  // Find the user id
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const user = list.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    console.warn('[test-user] resetTestUser: test user not found — skipping reset');
    return;
  }

  const uid = user.id;

  // Order matters for FK constraints
  const tables: string[] = [
    'recipe_cooks',
    'shopping_orders',
    'shopping_lists', // items cascade
    'meal_plans',     // entries cascade
    'recipes',        // step_tips cascade
    'pantry_items',
    'household_members',
  ];

  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('profile_id', uid);
    if (error) {
      console.warn(`[test-user] reset ${table}: ${error.message}`);
    }
  }

  // Re-upsert clean profile
  const { error: profileErr } = await admin.from('profiles').upsert(
    {
      id: uid,
      display_name: TEST_DISPLAY_NAME,
      household_size: 2,
      cuisine_preferences: ['Italian', 'Mexican'],
      dietary_preferences: [],
      disliked_ingredients: [],
      onboarding_complete: true,
      skill_level: 'beginner',
    },
    { onConflict: 'id' }
  );
  if (profileErr) {
    console.warn(`[test-user] reset profiles: ${profileErr.message}`);
  }
}

/** Base URL for the running server. */
export const BASE_URL = 'http://localhost:3000/api/v1';
