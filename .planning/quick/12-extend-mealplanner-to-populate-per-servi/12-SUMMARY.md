---
phase: quick-12
plan: 12
subsystem: meal-planning
tags: [meal-plan, nutrition, schema, server, mobile]
requirements: [QUICK-12]
dependency_graph:
  requires:
    - migration 00033 (recipes nutrition columns — shape mirrored here)
    - migration 00026 (meal_plans focus_theme — same table extension pattern)
    - commit f6ae91c (the existing weekNutrition memo + chip render in plan.tsx)
  provides:
    - meal_plan_entries.calories_per_serving (INTEGER, nullable)
    - meal_plan_entries.protein_grams_per_serving (NUMERIC(5,1), nullable)
    - generateMealPlanTool schema fields for AI tool to populate nutrition per day
    - /entries/assign body fields for non-/generate persistence paths
  affects:
    - apps/mobile/src/app/(tabs)/plan.tsx weekNutrition memo (entry-first, recipe-fallback)
tech_stack:
  added: []
  patterns:
    - "ALTER TABLE … ADD COLUMN … (nullable) + COMMENT ON COLUMN — column shape mirrored byte-shape from 00033"
    - "typeof v === 'number' ? v : null coercion — guards INTEGER + NUMERIC columns from non-numeric AI output"
    - "Static SQL contract test pattern via readMigration(name) + regex assertions"
key_files:
  created:
    - supabase/migrations/00036_meal_plan_entries_nutrition.sql
  modified:
    - packages/server/src/__tests__/migrations.test.ts
    - packages/server/src/services/mealPlanner.ts
    - packages/server/src/services/__tests__/mealPlanner.test.ts
    - packages/server/src/routes/meal-plans.ts
    - apps/mobile/src/types/mealPlan.ts
    - apps/mobile/src/app/(tabs)/plan.tsx
decisions:
  - "Mirrored 00033 column shape exactly (INTEGER + NUMERIC(5,1)) — keeps recipe fallback math identical to entry math when both sources contribute to the same week."
  - "Both new columns nullable — legacy entries survive without backfill; AI may legitimately omit when uncertain (matches recipeParser tool pattern)."
  - "Per-field fallback in weekNutrition memo (vs all-or-nothing) — partial AI output (e.g. only protein) still contributes to its side of the average."
metrics:
  duration: ~6 min
  tasks_completed: 3
  files_changed: 7
  tests_added: 8 (6 migration static + 2 schema)
  completed_date: 2026-05-03
---

# Quick Task 12: Extend Meal Planner to Populate Per-Serving Nutrition Summary

Extended the meal-planner pipeline so AI-generated `meal_plan_entries` rows carry per-serving calories + protein directly, eliminating the visible regression where the "This Week" weekly-average chip (commit f6ae91c) only fired for users who had already saved Recipe Box recipes. Migration mirrors 00033's column shapes; nutrition flows through the tool schema → entry insert → /entries/assign body type → mobile MealPlanEntry → plan.tsx memo (entry-first, recipe-fallback).

## Migration

**Number used:** `00036_meal_plan_entries_nutrition.sql`

**Live-DB application status: NOT YET APPLIED.** The migration file is committed but has not been pushed to the live Supabase project. Per task constraints, the executor did not run `supabase db push` against live. **Human must apply the migration before the next /generate call** — either:

1. `supabase db push` from the project root, OR
2. Paste the SQL from `supabase/migrations/00036_meal_plan_entries_nutrition.sql` into the Supabase dashboard SQL editor and run, then run `NOTIFY pgrst, 'reload schema';` in the same editor to refresh PostgREST's schema cache (per CLAUDE.md "PostgREST schema cache" gotcha).

Until the migration is applied, the next `/meal-plans/generate` call will fail with a PostgREST "Could not find the 'calories_per_serving' column of 'meal_plan_entries' in the schema cache" error from the entry-insert step.

## Files Modified (7)

| # | File | Change |
|---|------|--------|
| 1 | `supabase/migrations/00036_meal_plan_entries_nutrition.sql` | NEW — adds calories_per_serving INTEGER + protein_grams_per_serving NUMERIC(5,1), both nullable, with COMMENT ON COLUMN docs |
| 2 | `packages/server/src/__tests__/migrations.test.ts` | +6 static contract test cases under `// ----- Quick task 12 -----` divider |
| 3 | `packages/server/src/services/mealPlanner.ts` | generateMealPlanSchema gains 2 new optional per-day properties; ClaudeMealDay extended; entryRows insert + regenerateDay patch both write the fields with typeof === 'number' null-coercion |
| 4 | `packages/server/src/services/__tests__/mealPlanner.test.ts` | +2 generateMealPlanTool cases (Test 3: schema shape; Test 4: not in required list) |
| 5 | `packages/server/src/routes/meal-plans.ts` | /entries/assign body type + entryPayload accept and persist both fields |
| 6 | `apps/mobile/src/types/mealPlan.ts` | MealPlanEntry interface gains both fields under `// ---- Quick task 12 extensions ----` block |
| 7 | `apps/mobile/src/app/(tabs)/plan.tsx` | weekNutrition memo rewritten: entry-level fields first, recipe lookup fallback; per-field (not all-or-nothing) fallback |

## Tests Added (8 total)

**Migration static contract (6 cases in `00036_meal_plan_entries_nutrition.sql (static)` describe):**
1. Targets meal_plan_entries via ALTER TABLE
2. Adds calories_per_serving INTEGER (nullable — line-scoped NOT NULL grep)
3. Adds protein_grams_per_serving NUMERIC(5,1) (nullable — line-scoped)
4. Does NOT add fat_grams_per_serving (out of scope)
5. Does NOT create new indexes or NOT NULL constraints (file-wide grep)
6. Documents both columns via COMMENT ON COLUMN

**Schema contract (2 cases in `generateMealPlanTool` describe):**
7. Test 3 (quick-12): per-day properties include both fields as type:number with non-empty descriptions
8. Test 4 (quick-12): nutrition fields NOT in per-day required list (Claude may omit when uncertain)

## Verification Results

- `pnpm vitest run src/__tests__/migrations.test.ts` → **146/146 passed**
- `pnpm vitest run src/services/__tests__/mealPlanner.test.ts` → **36/36 passed**
- `cd packages/server && pnpm tsc --noEmit` → 300 errors, **identical to pre-change baseline (verified via git stash diff)**. All errors are pre-existing in unrelated test files / Hono context typing — none introduced by this plan.
- `cd apps/mobile && npx vitest run` → **908/908 passed**
- `cd apps/mobile && npx tsc --noEmit` → 32 errors, **identical to pre-change baseline (verified via stash diff)**. All errors are pre-existing @ts-expect-error directives + test fixtures missing v1.0.2 fields.
- Pre-existing canonicalResolver.test.ts DB-state-leak failures (6) and shoppingStore.test.ts test runner stuck (none reproduced on this run) ignored per task constraints.

## Deviations from Plan

**None.** Plan executed exactly as written. Zero Rule 1/2/3/4 deviations.

## Commits

| Hash | Task | Subject |
|------|------|---------|
| `db4e1d3` | 1 | feat(quick-12): add migration 00036 + static tests for meal_plan_entries nutrition |
| `b94271f` | 2 | feat(quick-12): thread per-serving nutrition through planner pipeline |
| `8318f39` | 3 | feat(quick-12): mobile MealPlanEntry + weekNutrition memo prefer entry-level fields |

## Next Steps

1. **Apply migration to live Supabase** (out-of-band by Patrick) — see Migration section above. Without this, the next /generate call fails.
2. **Maestro UAT (optional, high-value)** after migration is applied — generate a fresh week on the simulator (or physical iPhone via Tailscale Serve per CLAUDE.md) and screenshot the "This Week" card to confirm the avg-kcal/protein chip renders for AI-generated entries with no Recipe Box save step. Recommended Maestro flow naming: `apps/mobile/.maestro/41-this-week-nutrition-chip.yaml`.
3. **Spot-check DB after smoke** — query `select day_of_week, title, calories_per_serving, protein_grams_per_serving from meal_plan_entries where meal_plan_id = '<new-plan-id>'` to confirm Claude is populating the columns; expect non-null for most days but tolerate occasional nulls (the AI legitimately omits when it can't estimate).
4. **Legacy regression check** — open the app on a profile with a pre-migration plan in history (week_start before today). Chip should render (recipe-linked entries) or hide (no recipe links) — same as before this plan, no crashes.

## Self-Check: PASSED

**Created files exist:**
- FOUND: supabase/migrations/00036_meal_plan_entries_nutrition.sql

**Commits exist:**
- FOUND: db4e1d3
- FOUND: b94271f
- FOUND: 8318f39
