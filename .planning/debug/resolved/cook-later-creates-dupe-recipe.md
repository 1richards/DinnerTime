---
status: resolved
trigger: "When I copy a favorited recipe in the plan by using 'cook later' it seems to be a new recipe in the database because the new recipe doesn't show as favorited."
created: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED. The PlanEntryPreview (ad-hoc entry preview) Cook Later handler at plan.tsx:1210 hardcodes `null` as the recipe_id passed to addToPlan, even though `previewEntry.recipe_id` may be set (e.g. when a recipe_id exists but the cached recipe lookup misses) AND even more critically when the user hits the heart in the same modal which retroactively links the entry to a saved recipe — that newly-set recipe_id is in entry but the closure still passes null. Result: the new day's entry has recipe_id=null, so opening it shows the "ad-hoc" preview UI with an empty heart, leading the user to perceive it as a duplicate non-favorited recipe.
test: Read the previewEntry's onCookLater handler vs savedDetail's onCookLater handler. Compare what's passed for the recipe_id arg.
expecting: previewEntry path passes null; savedDetail path passes savedDetail.id.
next_action: Apply fix — pass previewEntry.recipe_id (with read-current-state to handle post-favorite link) to addToPlan.

## Symptoms

expected: Using "Cook later" on a favorited recipe produces a meal_plan_entry whose recipe_id points back to the original favorited recipes row. Opening that day's preview shows "favorited" state. Opening Recipe Box shows ONE copy, still favorited.

actual: Cook later produces a meal_plan_entry that either has recipe_id=null AND a duplicate recipes row gets inserted, OR has a recipe_id pointing to a NEW recipes row (lost favorite). User sees duplicate recipes in Recipe Box, the new copy not favorited.

errors: No error banner (silent dupe).

reproduction: |
  1. Open Recipe Box, favorite (heart) a recipe.
  2. Open the Plan tab.
  3. On a day's hero card, use "Cook later" to add that recipe to a different future day.
  4. Open Recipe Box again.
  5. See a duplicate non-favorited copy of the recipe.

started: Recent. Likely related to the Plan-tab Cook-later affordance refactor (commits 3efc809 / a530d5d / 360704e / cb3e248).

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-03T00:01:00Z
  checked: apps/mobile/src/app/(tabs)/plan.tsx:985-1002
  found: handleEntryPress decides between savedDetail (when entry.recipe_id is set AND cached recipe found) vs previewEntry (otherwise). When the cached lookup misses but recipe_id IS set, it falls through to previewEntry — carrying recipe_id with it.
  implication: previewEntry can carry a recipe_id, but the downstream Cook Later handler ignores it.

- timestamp: 2026-05-03T00:02:00Z
  checked: apps/mobile/src/app/(tabs)/plan.tsx:1210-1222 (PlanEntryPreview onCookLater)
  found: addToPlan(iso, previewRecipe, null) — third arg is HARDCODED null. previewEntry.recipe_id is never consulted.
  implication: Bug. Cook Later from the ad-hoc preview path always strips recipe_id from the source entry.

- timestamp: 2026-05-03T00:03:00Z
  checked: apps/mobile/src/app/(tabs)/plan.tsx:1278-1302 (SavedRecipeDetail onCookLater)
  found: addToPlan(iso, {...recipe fields...}, savedDetail.id) — correctly passes the recipe id.
  implication: The savedDetail path is correct. Only the previewEntry path is broken.

- timestamp: 2026-05-03T00:04:00Z
  checked: apps/mobile/src/app/(tabs)/kitchen.tsx:719-733 (Something New preview)
  found: addToPlan(iso, previewRecipe, null) — passes null. This is correct behavior because Something New previews are ad-hoc Discover results that have no saved recipe yet.
  implication: kitchen.tsx Something New path is fine — passing null is appropriate.

- timestamp: 2026-05-03T00:05:00Z
  checked: apps/mobile/src/app/(tabs)/plan.tsx:1417-1471 (PlanEntryPreview heart)
  found: When user taps heart on an ad-hoc entry, onAdHocFavorite saves the recipe AND POSTs to /entries/assign with recipe_id: saved.id, retroactively linking the entry. Then refetches the plan via fetchCurrent.
  implication: After a heart-tap, the ENTRY is now linked, but the modal's `previewEntry` state snapshot was set before the heart tap and still has recipe_id=null. The Cook Later closure also captures the stale snapshot. Even if we re-read from current state, until fetchCurrent finishes, the entry isn't yet linked. Need to either (a) refetch before Cook Later, or (b) read from the live store at the moment Cook Later fires.

- timestamp: 2026-05-03T00:06:00Z
  checked: apps/mobile/src/stores/mealPlanStore.ts:291-328 (addToPlan)
  found: forwards recipe_id arg verbatim to /meal-plans/entries/assign. Server validates against recipes table and strips if FK invalid.
  implication: Store and server are fine. Fix is purely in plan.tsx.

- timestamp: 2026-05-03T00:07:00Z
  checked: packages/server/src/routes/meal-plans.ts:319-349 (POST /entries/assign recipe_id validation)
  found: Server validates recipe_id, strips if not found. recipe_id null path is fine and doesn't create a recipes row.
  implication: Server-side dedup is solid. The "duplicate in Recipe Box" mental model is actually about the new entry showing an empty heart (no recipe_id link), which the user perceives as a separate recipe.

## Resolution

root_cause: |
  PlanEntryPreview's onCookLater handler in apps/mobile/src/app/(tabs)/plan.tsx
  hardcoded `null` as the recipe_id passed to mealPlanStore.addToPlan, even
  though the source previewEntry can have a non-null recipe_id (when the
  entry was already linked to a saved/favorited recipe but the cached recipe
  lookup missed, or after the user retroactively links the entry via the
  heart bubble's onAdHocFavorite handler). Result: Cook Later created a new
  meal_plan_entry on the target day with recipe_id=null. When the user
  opened that new day, the modal routed through the ad-hoc preview path
  (because no recipe_id) and rendered the heart as empty — the user
  perceived this as a duplicate, un-favorited copy of the recipe.
  
  The savedDetail path was already correct (passed savedDetail.id). Only
  the previewEntry path was broken.

fix: |
  In apps/mobile/src/app/(tabs)/plan.tsx (around line 1210), the
  PlanEntryPreview onCookLater handler now reads the live plan's entry
  state at firing time (handles the heart-then-cook-later sequence where
  fetchCurrent has just re-linked the entry) and falls back to the
  closure's previewEntry.recipe_id, then passes that to addToPlan instead
  of the hardcoded null. Server-side validation of recipe_id was already
  in place (POST /entries/assign strips unknown ids), so the change is
  forward-compatible.
  
  Added two regression tests in apps/mobile/src/stores/__tests__/mealPlanStore.test.ts:
  - addToPlan forwards recipe_id to /entries/assign when provided
  - addToPlan passes recipe_id=null when omitted (for unsaved Discover previews)
  These guard the contract the plan.tsx fix relies on.

verification: |
  - Vitest: 37/37 mealPlanStore tests pass (35 pre-existing + 2 new).
  - TypeScript: no new tsc errors introduced by the fix or test (verified
    by filtering tsc output to plan.tsx + mealPlanStore.test.ts paths).
  - Logic walkthrough:
    * Source entry has recipe_id and cached recipe found → savedDetail
      path (unchanged, was already correct).
    * Source entry has recipe_id but cached recipe missed → previewEntry
      path; fix now forwards the recipe_id from previewEntry.
    * User taps heart on ad-hoc entry, then Cook Later → onAdHocFavorite
      links entry + awaits fetchCurrent → live store has updated entry;
      fix reads live entry's recipe_id, forwards to addToPlan.
    * Truly ad-hoc entry, never linked, Cook Later → both live and
      snapshot recipe_id are null; addToPlan still gets null (matches
      Something New behavior — no false-positive linking).

files_changed:
  - apps/mobile/src/app/(tabs)/plan.tsx
  - apps/mobile/src/stores/__tests__/mealPlanStore.test.ts
