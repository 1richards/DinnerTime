-- 00033_recipe_nutrition.sql
-- Per-serving nutrition fields on recipes for the new label badges that
-- show on PreviewSheet (Recipe Box detail / Discover preview / Plan day
-- modal) and recipe detail screens.
--
-- Why nullable: existing recipes shipped pre-v1.0.2 don't have these
-- values. New saves populate them via Claude (extended parse_recipe
-- tool schema). Backfill happens when users re-save; no batch script.
--
-- Why _per_serving (not totals): users care about what they're eating,
-- and the recipe row already carries `servings` so totals are derivable
-- if ever needed (totals = per_serving * servings).
--
-- Units pinned to grams (protein/fat) and kcal (calories) — the only
-- variation we'd want is energy in kJ for SI-strict locales, deferred.

ALTER TABLE recipes
  ADD COLUMN calories_per_serving INTEGER,
  ADD COLUMN protein_grams_per_serving NUMERIC(5, 1),
  ADD COLUMN fat_grams_per_serving NUMERIC(5, 1);

COMMENT ON COLUMN recipes.calories_per_serving IS 'Estimated kcal per serving. Populated by Claude at recipe save time. Nullable for legacy rows.';
COMMENT ON COLUMN recipes.protein_grams_per_serving IS 'Estimated grams of protein per serving. NUMERIC(5,1) supports up to 9999.9 g.';
COMMENT ON COLUMN recipes.fat_grams_per_serving IS 'Estimated grams of total fat per serving. NUMERIC(5,1) supports up to 9999.9 g.';
