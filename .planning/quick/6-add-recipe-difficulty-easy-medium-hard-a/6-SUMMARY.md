---
phase: 6-add-recipe-difficulty
plan: 6
subsystem: recipes / meal-plan / mobile-ui
tags: [recipes, ai-generation, plan-day-card, recipe-detail, skill-scaffolding]
type: quick
one-liner: "End-to-end skill scaffolding — AI tags every recipe with difficulty + 1-3 practiced_skills + optional skill_note; surfaces as chips on Plan day cards (with matching-focus highlight) and on recipe detail."
requires: []
provides:
  - "recipes.difficulty (TEXT, nullable, easy|medium|hard)"
  - "recipes.practiced_skills (TEXT[], nullable, 8-key taxonomy)"
  - "recipes.skill_note (TEXT, nullable)"
  - "meal_plan_entries.practiced_skills (TEXT[])"
  - "meal_plan_entries.skill_note (TEXT)"
  - "PRACTICED_SKILLS / PracticedSkill exports from apps/mobile/src/types/recipe.ts"
  - "deriveStatusChips difficulty + matching-focus chip behavior"
affects:
  - "Discover recipe generation (recipeDiscovery)"
  - "Weekly plan generation (mealPlanner) + single-day regeneration"
  - "Plan day card chip layout"
  - "Recipe detail screen Skills practiced card"
tech-stack:
  added: []
  patterns:
    - "Tool schema enum binding for AI taxonomy compliance"
    - "Allowlist filter at server boundary; null-suppress at UI boundary"
key-files:
  created:
    - "supabase/migrations/00035_recipes_difficulty_skills.sql"
    - "apps/mobile/src/components/plan/dayRowHelpers.test.ts (extended)"
  modified:
    - "packages/server/src/services/recipeStore.ts"
    - "packages/server/src/services/recipeDiscovery.ts"
    - "packages/server/src/services/recipeParser.ts"
    - "packages/server/src/services/mealPlanner.ts"
    - "packages/server/src/routes/recipes.ts"
    - "apps/mobile/src/types/recipe.ts"
    - "apps/mobile/src/types/mealPlan.ts"
    - "apps/mobile/src/components/plan/dayRowHelpers.ts"
    - "apps/mobile/src/components/plan/DayRow.tsx"
    - "apps/mobile/src/components/plan/SwipeableDayRow.tsx"
    - "apps/mobile/src/app/(tabs)/plan.tsx"
    - "apps/mobile/src/app/recipes/[id]/index.tsx"
decisions:
  - "8-key taxonomy enum-bound at AI tool schema layer + allowlist-filtered server-side; invalid AI emissions silently dropped (don't fail the whole recipe)"
  - "Case-insensitive compare between entry.practiced_skills and meal_plans.focus_theme so AI casing variants still match user-selected focus"
  - "Null-suppress at UI: legacy rows (all three fields null) render no chips and no Skills practiced card"
  - "Difficulty tone mapping: easy=default, medium=info, hard=warning — same in DayRow and recipe detail"
  - "Matching-focus chip uses 'warning' tone + sparkles icon to mirror FocusBanner warm-brand vibe; only the matched skill renders (not all skills)"
metrics:
  completed: "2026-05-02"
  tasks: 3
  duration: ~2.5h
---

# Quick Task 6: Recipe Difficulty + Practiced Skills Summary

End-to-end skill-scaffolding feature shipped: AI now tags every generated recipe with a difficulty tier, 1-3 practiced_skills from the same 8-key taxonomy used by FocusPickerSheet, and an optional one-line skill_note. The Plan day card surfaces a difficulty chip on every entry plus a warm-toned matching-focus chip when the day's recipe practices the active focus_theme. Recipe detail shows a "Skills practiced" card with the same data plus the italic skill_note. Legacy rows (no AI tagging) render nothing — no fallback badges.

## Tasks Completed

| Task | Description | Commit |
| ---- | --------------------------------------------------------------- | ------------------ |
| 1    | DB migration + server-side AI generation (recipeDiscovery + mealPlanner + recipeStore + routes) | `2619de8` |
| 2    | Mobile types + plan day card UI — TDD (RED → GREEN) for dayRowHelpers + DayRow + plan.tsx wiring | `63c6bf2` (RED) + `23c1216` (GREEN) |
| 3    | Recipe detail Skills practiced card + UAT visual confirmation   | `1d4c475` |

## Files Touched (grouped)

**Migration**
- `supabase/migrations/00035_recipes_difficulty_skills.sql` — adds `difficulty` (recipes only), `practiced_skills` (TEXT[]), `skill_note` (TEXT) to `recipes`; adds `practiced_skills` + `skill_note` to `meal_plan_entries`. GIN indexes on both `practiced_skills` columns. All columns nullable.

**Server**
- `packages/server/src/services/recipeStore.ts` — `RecipeRow` extended; `saveRecipe` persists three new fields.
- `packages/server/src/services/recipeParser.ts` — `ParsedRecipe` extended with the three optional fields.
- `packages/server/src/services/recipeDiscovery.ts` — `suggestRecipesSchema` enum-bound additions (difficulty + practiced_skills required, skill_note optional); `buildDiscoveryPrompt` SKILL TAGGING block; AI output normalized + allowlist-filtered.
- `packages/server/src/services/mealPlanner.ts` — `generateMealPlanSchema` parallel additions; `buildMealPlanPrompt` SKILL TAGGING block + focus_theme guidance ("≥2 themed recipes MUST include the theme in practiced_skills"); `entryRows` and `regenerateDay` persist tags via `validateSkills` allowlist helper.
- `packages/server/src/routes/recipes.ts` — `PATCHABLE_FIELDS` extended for symmetry.

**Mobile types**
- `apps/mobile/src/types/recipe.ts` — exports `PRACTICED_SKILLS` 8-key constant + `PracticedSkill` type; `Recipe` and `ParsedRecipe` extended with the three new optional/nullable fields.
- `apps/mobile/src/types/mealPlan.ts` — `MealPlanEntry` extended with `practiced_skills` and `skill_note`.

**Plan UI**
- `apps/mobile/src/components/plan/dayRowHelpers.ts` — `DeriveArgs` extended; `deriveStatusChips` emits difficulty chip (tone scales: easy=default, medium=info, hard=warning) + matching-focus chip (case-insensitive compare; only matched skill rendered, not all skills; warm `warning` tone + `sparkles` icon).
- `apps/mobile/src/components/plan/dayRowHelpers.test.ts` — matrix-extended with 9 new cases (difficulty rendering for each tier + null suppression; case-insensitive matching; non-match suppression; multi-skill single-chip rule).
- `apps/mobile/src/components/plan/DayRow.tsx` — `DayRowProps` gains `focusTheme`; passes `entry.difficulty / entry.practiced_skills / focusTheme` into `deriveStatusChips`.
- `apps/mobile/src/components/plan/SwipeableDayRow.tsx` — `focusTheme` flows through existing `dayRowProps` rest spread.
- `apps/mobile/src/app/(tabs)/plan.tsx` — wires `currentPlan.focus_theme ?? null` into the swipeable row.

**Recipe detail UI**
- `apps/mobile/src/app/recipes/[id]/index.tsx` — adds Skills practiced card above Servings; renders only when at least one of difficulty / practiced_skills / skill_note is populated; difficulty chip + every practiced_skill as a chip + italic skill_note line (color `#7A6651`).

## Test Results

Task 1 (server) — `pnpm typecheck` passes; existing `mealPlanner` and `recipeDiscovery` test suites green.

Task 2 (mobile dayRowHelpers TDD)
- RED step (`63c6bf2`): 9 new cases written, all initially failing as expected.
- GREEN step (`23c1216`): full `dayRowHelpers.test.ts` suite green — every existing matrix test plus all 9 new difficulty + matching-focus cases.
- `pnpm typecheck` (apps/mobile) passes.

Task 3 — `pnpm typecheck` (apps/mobile) passes after recipe detail edits. UAT visual confirmation completed by user (see Deviations).

## Schema Highlights

Tool schema enum block (added to both `suggestRecipesSchema` and `generateMealPlanSchema` per-day items):

```json
{
  "difficulty": {
    "type": "string",
    "enum": ["easy", "medium", "hard"],
    "description": "easy=≤30min, basic technique. medium=30-60min OR one new technique. hard=>60min OR advanced technique."
  },
  "practiced_skills": {
    "type": "array",
    "items": {
      "type": "string",
      "enum": [
        "knife skills", "pan sauces", "braising", "stir-frying",
        "plant-forward", "pasta from scratch", "global flavors", "baking & breads"
      ]
    },
    "minItems": 1,
    "maxItems": 3
  },
  "skill_note": {
    "type": "string",
    "description": "Optional one-line technique payoff explanation, ≤120 chars."
  }
}
```

`difficulty` + `practiced_skills` are required; `skill_note` stays optional.

## Deviations from Plan

**1. [Optional UAT steps skipped — user pre-approved]**
- **Found during:** Task 3 checkpoint
- **Issue:** The `<how-to-verify>` block called for an optional Maestro smoke run (`maestro test .maestro/smoke.yaml`) and `xcrun simctl io booted screenshot` captures.
- **Action:** User reviewed the implementation + typecheck output and typed approval without requesting either artifact. Both were marked optional in the plan ("optional but encouraged"; screenshots "Attach to summary").
- **Impact:** No regression test artifact for this change beyond the existing dayRowHelpers unit tests. Smoke flow was not exercised against the new chip rendering. Low risk — chip rendering is additive and null-suppressed; existing flows can't reach the new code path until a user regenerates a plan post-migration.
- **Follow-up suggestion:** Next plan that touches plan day cards should add a Maestro flow that asserts at least one chip on a generated day card and captures a screenshot for visual diff baselines.

No auto-fixes (Rules 1-3) were triggered — all three tasks executed exactly as planned.

## Known Stubs

None. Every field flows end-to-end (DB → server AI → mobile rendering) with no placeholder UI. Legacy recipes intentionally render no chips/no card per `must_haves.truths`.

## Deferred Items

- Maestro flow asserting chip rendering on a freshly regenerated plan (mentioned above).
- Screenshot baselines for the new Skills practiced card and matching-focus chip.
- Tighten AI prompt with explicit examples if telemetry shows frequent `wok / stir-fry` style mismatches (current allowlist filter handles silently).

## Self-Check: PASSED

- File `supabase/migrations/00035_recipes_difficulty_skills.sql`: present in repo (created in commit `2619de8`).
- File `apps/mobile/src/components/plan/dayRowHelpers.test.ts`: present (extended in commits `63c6bf2` + `23c1216`).
- File `apps/mobile/src/app/recipes/[id]/index.tsx`: modified in commit `1d4c475`.
- Commit `2619de8`: present in `git log`.
- Commit `63c6bf2`: present in `git log`.
- Commit `23c1216`: present in `git log`.
- Commit `1d4c475`: present in `git log` (HEAD).
