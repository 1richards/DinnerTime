-- 00036_meal_plan_entries_nutrition.sql
-- Per-serving nutrition fields on meal_plan_entries.
--
-- Mirrors recipes.calories_per_serving + recipes.protein_grams_per_serving
-- (added in migration 00033) so AI-generated plan entries carry these
-- values directly without requiring the user to first save the entry as
-- a Recipe Box recipe. The "This Week" weekly-average chip in plan.tsx
-- (added in commit f6ae91c) reads from entry-level fields when present,
-- falling back to the linked recipe row.
--
-- Why nullable: legacy meal_plan_entries rows (pre-this-migration) won't
-- have values; the AI may also omit the fields when it can't estimate
-- confidently. Existing flows must keep working with NULL.
--
-- Why no fat_per_serving: the Plan-tab chip surfaces only kcal + protein.
-- Adding fat here would be dead schema; the recipes table already has it
-- for the recipe detail screen, which is sufficient.

ALTER TABLE meal_plan_entries
  ADD COLUMN calories_per_serving INTEGER,
  ADD COLUMN protein_grams_per_serving NUMERIC(5, 1);

COMMENT ON COLUMN meal_plan_entries.calories_per_serving IS 'Estimated kcal per serving. Populated by Claude at meal-plan generation time. Nullable for legacy rows.';
COMMENT ON COLUMN meal_plan_entries.protein_grams_per_serving IS 'Estimated grams of protein per serving. NUMERIC(5,1) supports up to 9999.9 g. Nullable for legacy rows.';
