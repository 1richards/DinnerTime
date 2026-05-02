-- 00035_recipes_difficulty_skills.sql
-- Add per-recipe skill scaffolding: difficulty tier + practiced skills
-- (taxonomy-bound to the 8-key set used by FocusPickerSheet) + an optional
-- one-line note explaining the skill payoff.
--
-- All columns are nullable. Legacy rows continue to load and render
-- without chips; the AI populates the new fields going forward (no
-- backfill — explicitly out of scope for this plan).
--
-- The 8-key practiced_skills allowlist is enforced at the application
-- layer (services/mealPlanner.ts validateSkills, services/recipeDiscovery.ts
-- mapping) — keeping it out of a CHECK constraint lets us evolve the
-- taxonomy via a code-only PR without a migration round-trip.

-- ---------- recipes ----------

ALTER TABLE recipes
  ADD COLUMN difficulty TEXT
    CHECK (difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')),
  ADD COLUMN practiced_skills TEXT[],
  ADD COLUMN skill_note TEXT;

-- Helpful for "find recipes practicing X" queries (matching-focus surface,
-- and any future "skills you've practiced this month" analytics).
CREATE INDEX idx_recipes_practiced_skills ON recipes USING GIN (practiced_skills);

COMMENT ON COLUMN recipes.difficulty IS
  'Difficulty tier: easy (≤30min, basic technique) | medium (30-60min OR one new technique) | hard (>60min OR advanced technique). NULL on legacy rows.';
COMMENT ON COLUMN recipes.practiced_skills IS
  '1-3 practiced-skill keys from the 8-key taxonomy used by FocusPickerSheet. NULL on legacy rows.';
COMMENT ON COLUMN recipes.skill_note IS
  'Optional one-line technique payoff (≤200 chars) — e.g. "Practices fond → reduction → mounted butter". NULL when no specific technique to call out.';

-- ---------- meal_plan_entries ----------
--
-- meal_plan_entries.difficulty already exists (added pre-22). Add the two
-- new fields so plan-only entries (which insert directly into entries —
-- not via saveRecipe) carry the same skill scaffolding.

ALTER TABLE meal_plan_entries
  ADD COLUMN practiced_skills TEXT[],
  ADD COLUMN skill_note TEXT;

CREATE INDEX idx_meal_plan_entries_practiced_skills
  ON meal_plan_entries USING GIN (practiced_skills);

COMMENT ON COLUMN meal_plan_entries.practiced_skills IS
  '1-3 practiced-skill keys from the 8-key taxonomy. Mirror of recipes.practiced_skills for plan-only entries.';
COMMENT ON COLUMN meal_plan_entries.skill_note IS
  'Optional one-line technique payoff — mirror of recipes.skill_note.';
