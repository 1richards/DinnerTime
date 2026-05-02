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
const TEST_PASSWORD = 'UATovernight2026';
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
 * Delete all rows owned by the test user. Safe to call in beforeAll OR
 * afterAll — never touches other users' data. Also (insert-only)
 * ensures the test profile exists, but does NOT overwrite display_name
 * if a row already exists, so a user-customized display name on the
 * shared UAT account survives test runs.
 *
 * Both `beforeAll(resetTestUser)` and `afterAll(resetTestUser)` should
 * be wired in every integration test file: beforeAll guarantees a
 * clean starting state, afterAll guarantees we don't pollute the live
 * UAT account with leftover Test Pasta / Dedup Lasagna / etc. rows
 * the user reported seeing.
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

  // Profile reset — insert-only on display_name. Read existing first;
  // if a row already exists, keep its display_name as-is so any name
  // the user has personalized on the shared UAT account (e.g. "Jessi")
  // survives the suite. Only touch the columns the tests actually need
  // to be in a known state (household_size, cuisine_preferences, etc.).
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', uid)
    .maybeSingle();

  const profilePayload: Record<string, unknown> = {
    id: uid,
    household_size: 2,
    cuisine_preferences: ['Italian', 'Mexican'],
    dietary_preferences: [],
    disliked_ingredients: [],
    onboarding_complete: true,
    skill_level: 'beginner',
  };
  if (!existingProfile) {
    profilePayload.display_name = TEST_DISPLAY_NAME;
  }

  const { error: profileErr } = await admin.from('profiles').upsert(profilePayload, {
    onConflict: 'id',
  });
  if (profileErr) {
    console.warn(`[test-user] reset profiles: ${profileErr.message}`);
  }
}

/** Base URL for the running server. */
export const BASE_URL = 'http://localhost:3000/api/v1';
