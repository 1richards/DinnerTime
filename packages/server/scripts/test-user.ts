// Provision and reset a deterministic test user for UAT + integration tests.
//
// Usage:
//   tsx scripts/test-user.ts ensure   # create if missing, print id + jwt
//   tsx scripts/test-user.ts reset    # delete all rows owned by the test user (does NOT delete the user)
//   tsx scripts/test-user.ts jwt      # print a fresh access token (requires existing user)
//   tsx scripts/test-user.ts info     # print user id + email + jwt as JSON
//
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY from process.env.

import { createClient } from '@supabase/supabase-js';

const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'uat@dinnertime.test';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'UAT-overnight-2026!';
const TEST_DISPLAY_NAME = 'UAT Tester';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in env.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function ensure() {
  // Look up by email via admin listUsers (no direct getUserByEmail in supabase-js v2).
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  let user = list.users.find((u) => u.email === TEST_EMAIL);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user!;
    console.error(`[test-user] created ${TEST_EMAIL} → ${user.id}`);
  } else {
    // Reset password in case it drifted.
    const { error } = await admin.auth.admin.updateUserById(user.id, { password: TEST_PASSWORD });
    if (error) throw error;
    console.error(`[test-user] exists ${TEST_EMAIL} → ${user.id}`);
  }

  // Mark profile onboarded so flows can skip onboarding when desired.
  const { error: profileErr } = await admin
    .from('profiles')
    .upsert(
      {
        id: user.id,
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
  if (profileErr) throw profileErr;

  return user;
}

async function reset() {
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const user = list.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    console.error(`[test-user] no user to reset: ${TEST_EMAIL}`);
    return null;
  }

  // Delete owned rows. Order matters for FKs.
  const tables = [
    'recipe_step_tips',  // child of recipes
    'recipe_cooks',
    'shopping_orders',
    'shopping_list_items', // FK via shopping_lists
    'shopping_lists',
    'meal_plan_entries',  // FK via meal_plans
    'meal_plans',
    'recipes',
    'pantry_items',
    'household_members',
  ];

  for (const table of tables) {
    if (table === 'recipe_step_tips' || table === 'meal_plan_entries' || table === 'shopping_list_items') {
      // Cascading deletes from parents will handle these — skip direct delete.
      continue;
    }
    const { error } = await admin.from(table).delete().eq('profile_id', user.id);
    if (error) console.error(`[test-user] reset ${table}: ${error.message}`);
  }

  // Re-upsert clean profile so onboarding stays completed.
  await admin.from('profiles').upsert(
    {
      id: user.id,
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

  console.error(`[test-user] reset complete for ${TEST_EMAIL}`);
  return user;
}

async function jwt() {
  const { data, error } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw error;
  return data.session?.access_token ?? null;
}

async function main() {
  const cmd = process.argv[2] ?? 'info';
  switch (cmd) {
    case 'ensure': {
      const u = await ensure();
      const token = await jwt();
      console.log(JSON.stringify({ id: u.id, email: u.email, token }, null, 2));
      break;
    }
    case 'reset': {
      await reset();
      break;
    }
    case 'jwt': {
      const t = await jwt();
      console.log(t);
      break;
    }
    case 'info': {
      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const u = list.data?.users.find((x) => x.email === TEST_EMAIL);
      const t = u ? await jwt() : null;
      console.log(JSON.stringify({ id: u?.id ?? null, email: TEST_EMAIL, token: t }, null, 2));
      break;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('[test-user] FAILED:', err.message ?? err);
  process.exit(1);
});
