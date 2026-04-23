---
phase: quick/1-build-reusable-pantry-seed-test-recipe-g
plan: 1
subsystem: dev-tooling
tags: [dev-scripts, pantry-seed, recipe-discovery, image-generation]
dependency_graph:
  requires: []
  provides:
    - scripts/fixtures/seed-pantry.ts (reusable pantry dataset + row builder)
    - scripts/test-user.ts clear command
    - scripts/generate-test-recipes.ts
  affects: []
tech_stack:
  added: []
  patterns:
    - "Shared fixture module: scripts consume `buildSeedPantryRows(profileId)` instead of re-declaring inline seed data"
    - "Self-contained dev scripts: no imports from src/ (keeps tooling decoupled from production code paths)"
key_files:
  created:
    - packages/server/scripts/fixtures/seed-pantry.ts
    - packages/server/scripts/generate-test-recipes.ts
  modified:
    - packages/server/scripts/test-user.ts
decisions:
  - "`clear` wipes ONLY `recipes` + `pantry_items`, leaving auth.users, profiles, household_members, meal_plans, shopping_lists untouched — purpose-built for the regenerate-and-eyeball loop."
  - "generate-test-recipes.ts runs image generation sequentially, not in parallel, to avoid Gemini rate limits and keep stdout readable."
  - "Forward `description + ingredients` (not just title) to /recipes/generate-image, per recipeImageGen service docstring."
metrics:
  duration: "~20m"
  completed: 2026-04-23
---

# Quick Task 1: Reusable Pantry Seed + Test Recipe Generator Summary

One-liner: Extracted the pantry seed into a reusable fixture module, added a surgical `clear` command to test-user.ts, and shipped `generate-test-recipes.ts` — a dev script that drives `/recipes/discover` + `/recipes/generate-image` and prints title/description/image URL per recipe so we can eyeball Gemini's imagery quality fast.

## What Was Built

### 1. `packages/server/scripts/fixtures/seed-pantry.ts` (NEW)

Typed, categorized pantry dataset shared between `test-user.ts reset` and `generate-test-recipes.ts`.

**Pantry breakdown (42 items across 7 categories):**

| Category   | Count | Examples                                                                                                           |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| protein    | 7     | Chicken Breast, Ground Beef, Eggs, Salmon Filets, Shrimp, Bacon, Tofu                                              |
| grain      | 8     | Pasta, Rice, Quinoa, Bread, Tortillas, Black Beans, Chickpeas, Rolled Oats                                         |
| produce    | 12    | Onion, Garlic, Tomatoes, Bell Peppers, Spinach, Carrots, Broccoli, Lemons, Avocado, Cilantro, Ginger Root, Potatoes |
| dairy      | 6     | Milk, Cheddar Cheese, Parmesan, Butter, Greek Yogurt, Heavy Cream                                                  |
| condiment  | 8     | Olive Oil, Soy Sauce, Sriracha, Dijon Mustard, Honey, Balsamic Vinegar, Peanut Butter, Canned Tomatoes             |
| frozen     | 3     | Frozen Peas, Frozen Berries, Frozen Dumplings                                                                      |
| snack      | 1     | Tortilla Chips                                                                                                     |
| **Total**  | **42**|                                                                                                                    |

Category values are constrained to the migration-00003 `pantry_category` enum (`produce|dairy|protein|grain|condiment|beverage|frozen|snack|other`) — `beverage` and `other` are intentionally unused for now but available for future additions.

**Exported signatures:**

```ts
export type PantryCategory =
  | 'produce' | 'dairy' | 'protein' | 'grain' | 'condiment'
  | 'beverage' | 'frozen' | 'snack' | 'other';

export type SourceLocation = 'fridge' | 'pantry' | 'freezer';

export interface SeedPantryItem {
  name: string;
  category: PantryCategory;
  source_location: SourceLocation;
  unit: string;
  quantity: number;
}

export const seedPantryItems: SeedPantryItem[];

export function buildSeedPantryRows(profileId: string): Array<
  SeedPantryItem & {
    profile_id: string;
    normalized_name: string;
    confidence: 1;
    status: 'available';
  }
>;
```

### 2. `packages/server/scripts/test-user.ts` (REFACTORED)

- Imports `buildSeedPantryRows` from the new fixture.
- `reset()` now calls `buildSeedPantryRows(user.id)` instead of an inline 15-item array. The `+ N pantry items` log is already dynamic via `seedPantry.length`, so it now reads `+ 42 pantry items`.
- Added `clear` subcommand. Behavior:
  - **Tables touched:** `recipes`, `pantry_items` — both scoped to `.eq('profile_id', user.id)`.
  - **Tables preserved:** `auth.users` (same JWT stays valid), `profiles` (onboarding stays complete), `household_members` (discovery still has dietary context), `meal_plans`, `meal_plan_entries`, `shopping_lists`, `shopping_list_items`, `shopping_orders`, `recipe_cooks`.
  - **Error pattern:** mirrors `reset()` — per-table errors logged via `console.error`, loop continues.
  - **No-user case:** logs `[test-user] no user to clear: ${TEST_EMAIL}` and returns `null`.
- Header comment + CLI switch updated to document `clear`.

### 3. `packages/server/scripts/generate-test-recipes.ts` (NEW)

Dev-only script. Workflow:

1. Validate `SUPABASE_URL` + `SUPABASE_ANON_KEY` at module load (fail fast with clear "source .env" hint).
2. Mint a JWT inline via `createClient(...).auth.signInWithPassword(...)` — no shelling out to `test-user.ts`.
3. `POST ${API_BASE_URL}/recipes/discover` with `Authorization: Bearer <jwt>` and `{}` body.
4. On non-2xx: print status + body and `process.exit(1)`.
5. For each recipe, sequentially `POST /recipes/generate-image` with `{ title, description, ingredients }` — all three forwarded per the recipeImageGen service docstring.
6. Print a formatted block per recipe.

**Sample stdout:**

```
Discovered 6 recipes
─────────────────────────────────────────
[1/6] Title:       Lemon-Garlic Salmon with Roasted Broccoli
      Description: Pan-seared salmon filets finished with a bright lemon-butter pan sauce, served over charred broccoli florets.
      Image:       https://<supabase-project>.supabase.co/storage/v1/object/public/recipe-images/<hash>.png
─────────────────────────────────────────
[2/6] Title:       Shrimp Tacos with Avocado-Cilantro Crema
      Description: Quick-sautéed shrimp tucked into warm tortillas with a zippy avocado-cilantro sauce.
      Image:       (null)
...
```

Env: `API_BASE_URL` defaults to `http://localhost:3000`; override for tunnel testing. `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` default to the same values as `test-user.ts`.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

- `pnpm exec tsc --noEmit` on all three scripts: **clean** (pre-existing errors under `src/` are out of scope per plan constraints).
- `git diff --name-only HEAD~2 HEAD`: only `packages/server/scripts/**` — no routes, services, migrations, or mobile code touched.
- `grep -rn "import.*fixtures/seed-pantry" packages/server/src/`: **no matches** — fixture stays dev-only.
- No new npm dependencies.
- Live smoke (E2E against dev server) explicitly deferred per plan constraints — the user will run it when their dev stack is up.

## Commits

- `356228d` — refactor(quick-1): extract pantry seed fixture, add test-user clear command
- `1467611` — feat(quick-1): add generate-test-recipes.ts dev script

## Follow-ups Discovered

- **(optional) Biome / lint integration:** `tsconfig.json` `include` is `src/**` only, so `scripts/` files are never typechecked during a normal `pnpm build`. Today's `tsc --noEmit scripts/...` works but is manual. A future tiny chore could be adding a `scripts/tsconfig.json` extending the base and a `pnpm typecheck:scripts` npm script so CI can catch script regressions cheaply.
- **`beverage` / `other` categories unused:** Seed covers 7 of 9 enum values. Not a gap — just a note that if recipe discovery starts asking for "drinks" we have room to expand without enum migrations.
- **Image QA classifier:** Eyeballing imagery quality is now a fast loop, but still manual. When we're ready to tune `buildPrompt` in `recipeImageGen.ts`, we could add a follow-up script that compares title → image with a Claude vision pass ("does this image depict {title}?") to score specificity at volume.
- **`clear` doesn't touch `meal_plans` / `shopping_lists`:** Intentional per plan, but if someone runs `clear` mid-iteration they may see stale meal plan entries referencing deleted recipe IDs. Today's mobile code handles missing recipes gracefully (falls back to placeholder), but worth noting.

## Self-Check: PASSED

- packages/server/scripts/fixtures/seed-pantry.ts: FOUND
- packages/server/scripts/test-user.ts: FOUND (modified)
- packages/server/scripts/generate-test-recipes.ts: FOUND
- Commit 356228d: FOUND
- Commit 1467611: FOUND
- `pnpm exec tsc --noEmit` on all three scripts: passes clean
