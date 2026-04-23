// Dev-only tooling: exercises /recipes/discover and /recipes/generate-image against the
// running server at http://localhost:3000 using the test user's JWT. Prints each
// discovered recipe's title, description, and generated image URL (or null) so we can
// eyeball whether Gemini's imagery matches the dish. Assumes the server is running;
// see CLAUDE.md "Dev Environment Startup" for how to launch it.
//
// Usage:
//   cd packages/server
//   tsx scripts/generate-test-recipes.ts
// Requires SUPABASE_URL + SUPABASE_ANON_KEY in env (same vars test-user.ts uses).
//
// Optional env:
//   API_BASE_URL          default http://localhost:3000 (override for tunnel)
//   TEST_USER_EMAIL       default uat@dinnertime.test
//   TEST_USER_PASSWORD    default UATovernight2026

import { createClient } from '@supabase/supabase-js';

type DiscoveredRecipeIngredient = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
};

type DiscoveredRecipe = {
  title: string;
  description: string | null;
  ingredients: DiscoveredRecipeIngredient[] | null;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.TEST_USER_EMAIL ?? 'uat@dinnertime.test';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'UATovernight2026';
const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !ANON_KEY) {
  console.error(
    'Missing SUPABASE_URL / SUPABASE_ANON_KEY in env. Source the repo-root .env first:\n' +
      '  set -a && source ../../.env && set +a'
  );
  process.exit(1);
}

/** Mint a fresh access token for the test user. Mirrors test-user.ts jwt(). */
async function mintJwt(): Promise<string> {
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  const token = data.session?.access_token;
  if (!token) throw new Error('No access_token returned from signInWithPassword.');
  return token;
}

async function discover(jwt: string): Promise<DiscoveredRecipe[]> {
  const res = await fetch(`${API_BASE_URL}/recipes/discover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[discover] HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  const json = (await res.json()) as { data?: DiscoveredRecipe[] };
  return json.data ?? [];
}

async function generateImage(
  jwt: string,
  recipe: DiscoveredRecipe
): Promise<string | null> {
  const res = await fetch(`${API_BASE_URL}/recipes/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      title: recipe.title,
      description: recipe.description ?? null,
      // Service docstring: passing description + ingredients dramatically improves
      // image specificity. Forward all three.
      ingredients: recipe.ingredients ?? null,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[generate-image] HTTP ${res.status} for "${recipe.title}": ${text}`);
    return null;
  }
  const json = (await res.json()) as { url?: string | null };
  return json.url ?? null;
}

async function main() {
  const jwt = await mintJwt();
  const recipes = await discover(jwt);
  console.log(`Discovered ${recipes.length} recipes`);

  // Sequential — Gemini has rate limits and we want stdout to stream readably.
  for (let i = 0; i < recipes.length; i += 1) {
    const recipe = recipes[i]!;
    const url = await generateImage(jwt, recipe);
    const label = `[${i + 1}/${recipes.length}]`;
    console.log('─────────────────────────────────────────');
    console.log(`${label} Title:       ${recipe.title}`);
    console.log(`      Description: ${recipe.description ?? '(null)'}`);
    console.log(`      Image:       ${url ?? '(null)'}`);
  }
}

main().catch((err) => {
  console.error('[generate-test-recipes] FAILED:', err.message ?? err);
  process.exit(1);
});
