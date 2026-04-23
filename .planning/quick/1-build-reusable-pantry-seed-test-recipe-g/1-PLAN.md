---
phase: quick/1-build-reusable-pantry-seed-test-recipe-g
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/server/scripts/fixtures/seed-pantry.ts
  - packages/server/scripts/test-user.ts
  - packages/server/scripts/generate-test-recipes.ts
autonomous: true
requirements:
  - QUICK-01

must_haves:
  truths:
    - "Running `tsx scripts/test-user.ts reset` seeds the test user with a richer pantry covering proteins, grains, produce, dairy, condiments, frozen, and snacks."
    - "Running `tsx scripts/test-user.ts clear` removes ONLY the test user's recipes and pantry_items — the auth user, profile row, and household_members survive untouched."
    - "Running `tsx scripts/generate-test-recipes.ts` against a running localhost:3000 server prints each discovered recipe's title, description, and an image URL (or explicit null) to stdout."
    - "No production code paths, routes, services, or migrations are changed by this work."
  artifacts:
    - path: "packages/server/scripts/fixtures/seed-pantry.ts"
      provides: "Typed, categorized pantry seed dataset + shared helper that hydrates rows with profile_id/normalized_name/confidence/status"
      contains: "export const seedPantryItems"
    - path: "packages/server/scripts/test-user.ts"
      provides: "ensure | reset | clear | jwt | info CLI; reset now imports the shared seed"
      contains: "case 'clear'"
    - path: "packages/server/scripts/generate-test-recipes.ts"
      provides: "Dev-only script: mints JWT via test-user helper, calls /recipes/discover, then /recipes/generate-image per result, prints title/description/image URL."
      contains: "fetch('http://localhost:3000/recipes/discover'"
  key_links:
    - from: "packages/server/scripts/test-user.ts"
      to: "packages/server/scripts/fixtures/seed-pantry.ts"
      via: "import { seedPantryItems, buildSeedPantryRows } from './fixtures/seed-pantry.js'"
      pattern: "from ['\"]\\./fixtures/seed-pantry"
    - from: "packages/server/scripts/generate-test-recipes.ts"
      to: "http://localhost:3000/recipes/discover + /recipes/generate-image"
      via: "fetch with Authorization: Bearer <jwt>"
      pattern: "/recipes/(discover|generate-image)"
---

<objective>
Stand up reusable dev tooling for recipe-generation eyeballing: a richer categorized pantry seed, a `clear` command on test-user.ts that surgically wipes recipes + pantry (leaving auth/profile/household intact), and a new `generate-test-recipes.ts` script that drives /recipes/discover + /recipes/generate-image against the running dev server and prints results to stdout.

Purpose: Right now the only pantry seed is inlined in test-user.ts with 15 items across 4 categories, which bottlenecks recipe-image QA to the same handful of dishes. Breaking the seed out + adding a clear-and-regenerate loop lets us flip between "wipe recipes, regenerate from pantry, eyeball imagery" in seconds. Dev-only. No production surface area changes.

Output: Three files — one new fixture module, one refactored script, one new script.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@packages/server/scripts/test-user.ts
@packages/server/src/routes/recipes.ts
@packages/server/src/services/recipeDiscovery.ts
@packages/server/src/services/recipeImageGen.ts
@packages/server/package.json

<interfaces>
<!-- Key types + contracts the executor needs. No codebase exploration required. -->

### pantry_items row shape (from test-user.ts lines 125-149, enforced by migration 00003)

```ts
// Columns the existing reset() writes, must be honored byte-exact:
type PantryItemInsert = {
  name: string;
  normalized_name: string;        // lowercased + trimmed name
  category:
    | 'produce' | 'dairy' | 'protein' | 'grain' | 'condiment'
    | 'beverage' | 'frozen' | 'snack' | 'other';
  source_location: 'fridge' | 'pantry' | 'freezer';
  unit: string;                   // 'lb' | 'box' | 'piece' | 'head' | 'bag' | 'dozen' | 'gal' | 'block' | 'bottle' | 'can' | 'bunch' | 'oz' | 'jar' etc. (free-form text)
  quantity: number;
  profile_id: string;             // auth.users.id of test user
  confidence: number;             // 0..1, test seed uses 1
  status: 'available';            // test seed uses 'available' (matches services/suggestions.ts filter)
};
```

### test-user.ts CLI surface (existing — extending)

```
tsx scripts/test-user.ts ensure   # create user, upsert profile, print {id,email,token}
tsx scripts/test-user.ts reset    # delete owned rows (incl. pantry) + re-seed pantry + ensure profile stays onboarded
tsx scripts/test-user.ts jwt      # print fresh access_token for TEST_USER_EMAIL
tsx scripts/test-user.ts info     # print {id,email,token} JSON
# ADD:
tsx scripts/test-user.ts clear    # delete ONLY recipes + pantry_items for the test user (keep auth user, profile, household_members)
```

Environment: reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` from process.env. Optional `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` overrides. Script is run from `packages/server` via `tsx scripts/test-user.ts <cmd>` after `set -a && source .env && set +a` at repo root (per CLAUDE.md dev env startup).

### /recipes/discover contract (from packages/server/src/routes/recipes.ts lines 246-313)

```
POST http://localhost:3000/recipes/discover
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json
Body: {}                          # optional { prompt?: string }; default empty JSON is fine
Returns 200:
  { data: ParsedRecipe[] }        # array (usually 6 items), each has:
                                  #   title, description, ingredients[], steps[],
                                  #   prep_time_minutes, cook_time_minutes,
                                  #   total_time_minutes, servings,
                                  #   source_url: null, source_type: 'ai', image_url: null
```

### /recipes/generate-image contract (from packages/server/src/routes/recipes.ts lines 476-529)

```
POST http://localhost:3000/recipes/generate-image
Headers:
  Authorization: Bearer <jwt>
  Content-Type: application/json
Body:
  {
    title: string,                              # required, non-empty
    description?: string | null,
    ingredients?: Array<{ name: string; quantity?: number|null; unit?: string|null }> | null
  }
Returns 200:
  { url: string | null }                        # null is a valid response (safety block / model failure)
Errors: 400 on missing title, otherwise 200 with null url
```

Passing `description + ingredients` dramatically improves image specificity (see service docstring). The new script MUST forward all three.

### Useful pattern from existing reset()

```ts
const seedPantry = [...].map((p) => ({
  ...p,
  profile_id: user.id,
  normalized_name: p.name.toLowerCase().trim(),
  confidence: 1,
  status: 'available',
}));
await admin.from('pantry_items').insert(seedPantry);
```

The fixtures module should expose both:
1. `seedPantryItems` — raw typed records WITHOUT profile_id (reusable in other tests/scripts)
2. `buildSeedPantryRows(profileId)` — returns fully-hydrated insert rows
</interfaces>

</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract pantry seed fixture + refactor test-user.ts (add `clear`, swap reset to shared seed)</name>
  <files>packages/server/scripts/fixtures/seed-pantry.ts, packages/server/scripts/test-user.ts</files>
  <action>
Create `packages/server/scripts/fixtures/seed-pantry.ts` as a new file exporting a richer categorized pantry dataset, then refactor `packages/server/scripts/test-user.ts` to consume it and add a `clear` subcommand.

**File 1 — `packages/server/scripts/fixtures/seed-pantry.ts` (NEW):**

Export:
- `PantryCategory` type union: `'produce' | 'dairy' | 'protein' | 'grain' | 'condiment' | 'beverage' | 'frozen' | 'snack' | 'other'` (migration 00003 enum — do NOT invent categories outside this list).
- `SourceLocation` type union: `'fridge' | 'pantry' | 'freezer'`.
- `SeedPantryItem` interface: `{ name: string; category: PantryCategory; source_location: SourceLocation; unit: string; quantity: number }`.
- `seedPantryItems: SeedPantryItem[]` — roughly 30-40 items, covering ALL of: proteins (chicken breast, ground beef, eggs, salmon filets, shrimp, bacon, tofu), grains (pasta, rice, quinoa, bread, tortillas, black beans, chickpeas, rolled oats), produce (onion, garlic, tomatoes, bell peppers, spinach, carrots, broccoli, lemons, avocado, cilantro, ginger root, potatoes), dairy (milk, cheddar cheese, parmesan, butter, greek yogurt, heavy cream), condiments (olive oil, soy sauce, sriracha, dijon mustard, honey, balsamic vinegar, peanut butter, canned tomatoes), frozen (frozen peas, frozen berries, frozen dumplings), snacks (tortilla chips). Use realistic units/quantities (lb, piece, head, bag, dozen, gal, block, bottle, can, oz, bunch, jar, loaf, carton, clove — free-form strings are fine, no unit enum in the schema).
- `buildSeedPantryRows(profileId: string)` — returns the items hydrated with `profile_id: profileId`, `normalized_name: name.toLowerCase().trim()`, `confidence: 1`, `status: 'available' as const`. Match the insert shape the existing reset() uses today.

Header comment: `// Dev-only pantry seed fixture used by scripts/test-user.ts reset and scripts/generate-test-recipes.ts. Never imported from src/. Category values must match migration 00003 enum: produce|dairy|protein|grain|condiment|beverage|frozen|snack|other.`

**File 2 — `packages/server/scripts/test-user.ts` (REFACTOR):**

1. Add import at top: `import { buildSeedPantryRows } from './fixtures/seed-pantry.js';` (note `.js` extension — ESM module resolution).
2. Update usage header comment to document the new `clear` command: `tsx scripts/test-user.ts clear   # delete recipes + pantry_items for the test user (keeps auth user, profile, household)`.
3. In `reset()`, replace the inline 15-item `seedPantry` array and its `.map((p) => ({ ...p, profile_id: user.id, normalized_name: ..., confidence: 1, status: 'available' }))` with `const seedPantry = buildSeedPantryRows(user.id);`. Keep the `admin.from('pantry_items').insert(seedPantry)` call and the `console.error` message reporting count — the count message is now dynamic (`seedPantry.length`), which already reads correctly.
4. Add a new `clear()` function. It must:
   - Look up the test user via `admin.auth.admin.listUsers` (same pattern as reset).
   - If no user found: `console.error('[test-user] no user to clear: ${TEST_EMAIL}')` and return null.
   - Delete ONLY from these tables, scoped to the test user's profile_id: `recipes`, `pantry_items`. Do NOT touch: `household_members`, `profiles`, auth user, meal_plans, shopping_lists, recipe_cooks (rationale: `clear` is the "wipe just recipes+pantry so I can regenerate" loop; `reset` remains the nuclear option). Use the same error-logging pattern as reset (`console.error` on per-table errors, don't abort).
   - Log `[test-user] cleared recipes + pantry_items for ${TEST_EMAIL}` on success.
   - Return the user object.
5. Add `case 'clear': { await clear(); break; }` to the switch in `main()`.
6. Leave `ensure`, `jwt`, `info` completely untouched.
  </action>
  <verify>
    <automated>cd packages/server &amp;&amp; pnpm exec tsc --noEmit scripts/test-user.ts scripts/fixtures/seed-pantry.ts</automated>
    After env is sourced, smoke-run:
    `cd packages/server && tsx scripts/test-user.ts ensure` → prints JSON with id + token.
    `tsx scripts/test-user.ts reset` → logs "[test-user] reset complete ... (+ 30+ pantry items)".
    `tsx scripts/test-user.ts clear` → logs cleared message; a follow-up query on `pantry_items` for the test user returns 0 rows; `household_members` row survives.
  </verify>
  <done>
    - `packages/server/scripts/fixtures/seed-pantry.ts` exists, exports `seedPantryItems` (30-40 items across 7+ categories, all categories ∈ the allowed enum) and `buildSeedPantryRows(profileId)`.
    - `test-user.ts` imports the fixture, `reset()` uses `buildSeedPantryRows`, and `clear` is a documented, working command that wipes only `recipes` + `pantry_items` for the test profile_id.
    - `tsc --noEmit` on the two files passes with no errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add generate-test-recipes.ts — drives /recipes/discover + /recipes/generate-image against localhost:3000</name>
  <files>packages/server/scripts/generate-test-recipes.ts</files>
  <action>
Create a new standalone script at `packages/server/scripts/generate-test-recipes.ts`.

Header comment:
```
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
```

Implementation:

1. Read env vars — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, optional `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` (defaults identical to test-user.ts: `uat@dinnertime.test` / `UATovernight2026`). Fail fast with a clear message if the two supabase vars are missing.
2. Optional env override: `API_BASE_URL` (default `http://localhost:3000`). Let the user override to point at a Cloudflare tunnel later, but default to localhost per CLAUDE.md dev-env docs.
3. Mint a JWT inline by calling `createClient(SUPABASE_URL, SUPABASE_ANON_KEY).auth.signInWithPassword({ email, password })`. Reuse the pattern from `test-user.ts` `jwt()` (lines 155-162). Throw if no session. Do NOT shell out to test-user.ts — keep the script self-contained so it works without stdout parsing.
4. POST to `${API_BASE_URL}/recipes/discover` with `Authorization: Bearer <jwt>`, `Content-Type: application/json`, body `{}`. On non-2xx, print the response body and `process.exit(1)`.
5. Parse `{ data: ParsedRecipe[] }`. Log `Discovered N recipes` where N = data.length.
6. For each recipe, POST to `${API_BASE_URL}/recipes/generate-image` with body `{ title, description: r.description ?? null, ingredients: r.ingredients ?? null }`. The service docstring explicitly notes passing all three massively improves specificity — do not skip description/ingredients.
7. Generate images sequentially (not in parallel) — Gemini has rate limits and we want the stdout stream to stay readable. A single sequential await loop is fine; the whole run will take ~30-60s for 6 recipes.
8. For each recipe, print a formatted block to stdout:
   ```
   ─────────────────────────────────────────
   [i/N] Title:       <title>
         Description: <description>
         Image:       <url or (null)>
   ```
   where `i` is 1-indexed. Use `console.log` for the block.
9. Wrap main in try/catch; log error.message and `process.exit(1)` on any failure. Add `main().catch(...)` exit handler mirroring test-user.ts (lines 195-198).
10. Use native `fetch` (Node 22 LTS ships with it — package.json already depends on it transitively via `@hono/node-server`; no new deps).
11. TypeScript: use `import { createClient } from '@supabase/supabase-js';` and define minimal local types for the discover response (`type DiscoveredRecipe = { title: string; description: string | null; ingredients: Array<{ name: string; quantity?: number | null; unit?: string | null }> | null }`) — do NOT import from `src/` (dev-only scripts must not reach into production code paths).

Do NOT add any new dependencies to package.json. Do NOT add an npm script entry (user will invoke via `tsx scripts/generate-test-recipes.ts` directly — mirrors the existing ai-smoke-test + test-user pattern).
  </action>
  <verify>
    <automated>cd packages/server &amp;&amp; pnpm exec tsc --noEmit scripts/generate-test-recipes.ts</automated>
    Manual smoke (after user starts the dev server + runs `test-user.ts ensure` and `reset`):
    `cd packages/server && tsx scripts/generate-test-recipes.ts`
    → prints "Discovered 6 recipes" then 6 formatted blocks, each with a title, description, and either a supabase recipe-images public URL or `(null)`. Exit code 0.
  </verify>
  <done>
    - `packages/server/scripts/generate-test-recipes.ts` exists, compiles with `tsc --noEmit`, and runs end-to-end against a dev server on localhost:3000 using the test user's JWT.
    - Script forwards `description` + `ingredients` to `/generate-image` (not just title) so imagery captures the specific dish.
    - No new npm dependencies; no changes outside `packages/server/scripts/`.
    - No imports from `src/` — the script is fully decoupled from production code paths.
  </done>
</task>

</tasks>

<verification>
Whole-plan checks:
1. `cd packages/server && pnpm exec tsc --noEmit scripts/test-user.ts scripts/fixtures/seed-pantry.ts scripts/generate-test-recipes.ts` — all three compile clean.
2. `git diff --name-only` shows changes confined to `packages/server/scripts/**` (no route, service, migration, or mobile code touched).
3. Source-side sanity: `grep -rn "import.*fixtures/seed-pantry" packages/server/src/ || echo "OK: no src/ imports"` prints OK (fixture must remain dev-only).
4. End-to-end smoke (manual, with dev server running per CLAUDE.md):
   a. `tsx scripts/test-user.ts ensure` → prints JSON with id/email/token.
   b. `tsx scripts/test-user.ts reset` → "+ N pantry items" where N ≥ 30.
   c. `tsx scripts/generate-test-recipes.ts` → prints N titled blocks with image URLs.
   d. `tsx scripts/test-user.ts clear` → silently empties recipes + pantry_items; `household_members` + `profiles` row for test user both survive.
</verification>

<success_criteria>
- Three files land under `packages/server/scripts/`, nothing else modified.
- `reset` command produces a pantry covering at least 7 categories (proteins, grains, produce, dairy, condiments, frozen, snacks) with 30+ items.
- `clear` command wipes ONLY `recipes` + `pantry_items` for the test profile_id — auth user, profile, household_members rows all survive.
- `generate-test-recipes.ts` exits 0 when run against a healthy localhost:3000 dev server and prints title/description/image URL (or `(null)`) per recipe.
- No production code paths, routes, services, migrations, or mobile code changed.
- No new npm dependencies added.
</success_criteria>

<output>
After completion, create `.planning/quick/1-build-reusable-pantry-seed-test-recipe-g/1-SUMMARY.md` summarizing:
- Final pantry seed breakdown (count per category).
- Exact signatures exported from `fixtures/seed-pantry.ts`.
- `test-user.ts clear` behavior (tables touched, tables preserved).
- Sample output block from `generate-test-recipes.ts`.
- Any follow-ups discovered (e.g., recipes that render as identifiable dishes vs. generic "food photo" misses — useful for tuning `buildPrompt` in recipeImageGen.ts later).
</output>
