# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## cook-later-creates-dupe-recipe — Cook Later from plan-day preview drops source recipe_id, creates ad-hoc dupe
- **Date:** 2026-05-03
- **Error patterns:** cook later, recipe_id, favorite, dupe, duplicate, plan, addToPlan, PlanEntryPreview, meal_plan_entries, recipes, heart, favorited
- **Root cause:** plan.tsx PlanEntryPreview onCookLater handler hardcoded recipe_id=null when calling mealPlanStore.addToPlan, even though the source previewEntry could carry a recipe_id (cached-recipe-miss fallthrough or post-onAdHocFavorite linking). Result: target-day entry created with recipe_id=null, opening it routed through ad-hoc preview path with empty heart, user perceived this as a duplicate.
- **Fix:** Read live entry from useMealPlanStore at firing time (covers heart-then-cook-later), fall back to closure's previewEntry.recipe_id, forward to addToPlan. Added mealPlanStore tests asserting addToPlan forwards recipe_id contract.
- **Files changed:** apps/mobile/src/app/(tabs)/plan.tsx, apps/mobile/src/stores/__tests__/mealPlanStore.test.ts
---
