-- Phase v1.0.2 — meal_plan_entries become full recipes.
--
-- Until now, the AI meal-plan generator emitted lightweight sketches
-- (title + ingredients hint + estimated time) and steps were fetched
-- on demand via a separate /recipes/expand-from-plan-entry endpoint.
-- That two-stage flow was visibly broken: opening a plan entry showed
-- "No steps listed" while the second Claude call ran in the background,
-- and any failure in the second call left the user looking at a stub.
--
-- Aligning with how Something New / suggest_recipes already works: the
-- planner now emits a complete ParsedRecipe per day in a single tool
-- call, and we persist the full payload (steps, prep/cook times, real
-- ingredient quantities, servings) onto the entry row. No more "save
-- before steps" dance.
--
-- Forward-only. Existing rows get an empty `steps` array — they were
-- generated under the old contract and there's no point trying to
-- back-fill cookable steps for them. New plans generated after this
-- migration deploys will carry full data; users who want steps for
-- the old rows can regenerate that week.

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]';
ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS prep_time_minutes INTEGER;
ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS cook_time_minutes INTEGER;
ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS servings INTEGER;

COMMENT ON COLUMN meal_plan_entries.steps IS
  'Ordered cooking steps as JSONB array of strings, e.g. ["Step 1...", "Step 2..."]. Populated when the generator emits the full recipe in one tool call.';
COMMENT ON COLUMN meal_plan_entries.prep_time_minutes IS
  'Active prep time in minutes; mirrors recipes.prep_time_minutes for parity.';
COMMENT ON COLUMN meal_plan_entries.cook_time_minutes IS
  'Inactive cook time in minutes; mirrors recipes.cook_time_minutes.';
COMMENT ON COLUMN meal_plan_entries.servings IS
  'Default serving count the recipe is written for; mirrors recipes.servings.';
