---
status: awaiting_human_verify
trigger: "Plan tab surfaces a top-banner error from POST /meal-plans/entries/assign — FK violation on recipe_id"
created: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Focus

hypothesis: REVISED — All client-side call sites that pass non-null recipe_id forward a real recipes-table id (or null). However, the recipeStore is persisted in AsyncStorage (zustand persist with `partialize: state => ({ recipes: state.recipes })`), and AddMealSheet sources its list from this persisted state. If a recipe was deleted server-side (other device, account reset, partial-recovery flow, etc.) but the persisted list still references it, picking it via AddMealSheet -> addToPlan(iso, {...}, recipe.id) -> server upsert with stale recipe_id -> FK violation. CLAUDE.md explicitly documents this class of bug for shoppingStore and instructs that any "lazy resource" pattern needs the same 404-recovery branch — but meal-plan/entries/assign does not have it. The FK on meal_plan_entries.recipe_id is REFERENCES recipes(id) ON DELETE SET NULL, so the system already tolerates orphaned entries when a recipe is deleted; the same tolerance should apply on insert/upsert (graceful degradation: strip stale recipe_id, keep the entry's title/description/ingredients).

test: Read every site that forwards recipe_id to /entries/assign. Confirm none send AI/transient ids. Apply server-side defensive fix.
expecting: After fix, server upsert never 500s on stale recipe_id; the entry is created with recipe_id=null. Subsequent /fetchCurrent reconciles client state. The user's banner stops appearing.
next_action: Edit packages/server/src/routes/meal-plans.ts to validate recipe_id existence; on miss, strip and proceed.

## Symptoms

expected: Tapping a recipe / swap / remix variation / suggestion to assign it to a day succeeds and that day's card updates with the new entry. No error banner.

actual: Top-banner error: "Failed to assign entry: insert or update on table 'meal_plan_entries' violates foreign key constraint 'meal_plan_entries_recipe_id_fkey'" surfaced from server route at packages/server/src/routes/meal-plans.ts:351.

errors: insert or update on table 'meal_plan_entries' violates foreign key constraint 'meal_plan_entries_recipe_id_fkey'

reproduction: User reproed by interacting with Plan tab. Most plausible: Month view -> tap empty cell -> AddMealSheet -> pick a recipe whose id has been removed from the recipes table while the persisted recipeStore still lists it.

started: Today, 2026-05-03.

## Eliminated

- hypothesis: Remix variation auto-apply forwards a transient AI id as recipe_id.
  evidence: RemixSheet.handleApplyToDay -> onApplyToDay(full) -> parent calls applySwap(day, full). mealPlanStore.applySwap (line 257-269) does NOT include recipe_id in the request body. Even if `full` carried an id, applySwap drops it.
  timestamp: 2026-05-03T00:00:00Z

- hypothesis: Swap modal AI candidate pick forwards a transient AI id as recipe_id.
  evidence: SwapSheet -> onSelect(candidate) -> parent calls applySwap(day, candidate). Same applySwap path — no recipe_id in body.
  timestamp: 2026-05-03T00:00:00Z

- hypothesis: SuggestionCard / SuggestionPreviewModal forwards a stale id.
  evidence: Both explicitly send `recipe_id: null` (SuggestionCard.tsx:66, SuggestionPreviewModal.tsx:87 — both annotated "ad-hoc — 22-RESEARCH Pitfall 7").
  timestamp: 2026-05-03T00:00:00Z

- hypothesis: Month-grid empty-cell pin-confirm and skipped-day mark forward a stale id.
  evidence: plan.tsx:596 and plan.tsx:637 explicitly hard-code `recipe_id: null`.
  timestamp: 2026-05-03T00:00:00Z

- hypothesis: PlanEntryPreview onAdHocFavorite forwards a transient id.
  evidence: It calls saveRecipe(recipe) first and uses saved.id (Recipe row from server). saveRecipe returns either the freshly inserted row (POST /recipes 201) or the existing row from the dedup branch — both real DB rows. Null-checked at line 1427.
  timestamp: 2026-05-03T00:00:00Z

## Evidence

- timestamp: 2026-05-03T00:00:00Z
  checked: Server route signature
  found: packages/server/src/routes/meal-plans.ts line 324 — `recipe_id: body.recipe_id ?? null`. No existence/ownership check before upsert.
  implication: Server is permissive; bug is preventable at the server boundary.

- timestamp: 2026-05-03T00:00:00Z
  checked: FK definition
  found: supabase/migrations/00006_meal_plans.sql line 20 — `recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL`.
  implication: System already tolerates orphaned entries on delete (auto-nulls). Insert/upsert should follow the same tolerance.

- timestamp: 2026-05-03T00:00:00Z
  checked: All mobile call sites forwarding non-null recipe_id
  found: AddToPlanSheet.tsx:73 (recipe.id from Recipe Box), mealPlanStore.addToPlan (caller's recipeId), reorderDays (original.recipe_id), duplicateLastWeek (e.recipe_id), plan.tsx:1456 (saved.id), plan.tsx:1143 (recipe.id from AddMealSheet). All sources are persisted Zustand state OR fresh server response.
  implication: The vector is stale persisted state. Either the recipe row was deleted server-side or the recipeStore wasn't refetched after a server-side change. Same class as shoppingStore stale-currentList.

- timestamp: 2026-05-03T00:00:00Z
  checked: CLAUDE.md "Known Gotchas"
  found: "Stale persisted state on cart-add: Zustand-persisted currentList in shoppingStore can point at a server-deleted row. The store now self-recovers (refresh-or-create + retry on 404 from /shopping/items); same pattern lives in mealPlanStore. If you add a new 'lazy resource' pattern, replicate the 404-recovery branch."
  implication: Established pattern is server returns a structured error and client retries. /entries/assign currently returns generic 500 — needs same treatment, OR can graceful-strip server-side.

## Resolution

root_cause: POST /meal-plans/entries/assign upserts body.recipe_id directly into meal_plan_entries.recipe_id without verifying the referenced recipes row exists. When the client's persisted recipeStore (or any other source) hands the server a recipe_id that has since been deleted server-side (or that RLS hides from the current user), the FK fires and the user sees a banner error. The system already tolerates orphaned entries on delete (ON DELETE SET NULL), so the same graceful behavior should apply on insert/upsert.

fix: Server-side defense in packages/server/src/routes/meal-plans.ts POST /entries/assign — when body.recipe_id is non-null, verify the recipe row exists and is visible to the authenticated user via RLS before upserting. If missing, log a warning and proceed with recipe_id=null. The plan entry is still created with title/description/ingredients, matching the ON DELETE SET NULL semantics. Same self-healing pattern documented in CLAUDE.md for the shoppingStore stale-currentList case.

verification:
- packages/server vitest: 34/34 meal-plans route tests pass (3 new tests added: 22-D5 stale id stripped, 22-D6 valid id preserved, 22-D7 omitted id back-compat).
- Wider server suite: 784/790 pass; the 6 failures are pre-existing canonicalResolver DB unique-constraint races unrelated to this change (called out in task context).
- Mobile mealPlanStore tests still pass (35/35).
- TypeScript check: only pre-existing TS18046 'supabase'/'user' is unknown errors that affect every Hono handler in the file — my new code follows the same pattern as all surrounding code, no new error categories.
- Pending: real-device confirmation that the banner no longer appears for the user's reproduction.

files_changed:
- packages/server/src/routes/meal-plans.ts (insert recipe_id existence guard before upsert)
- packages/server/src/routes/__tests__/meal-plans.test.ts (extend mock with `from('recipes')` branch + state.recipeLookupRow / state.lastRecipeLookupId; add 22-D5/22-D6/22-D7 tests)
