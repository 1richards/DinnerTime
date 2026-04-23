-- Phase 22 Wave 0: meal_plans.focus_theme + meal_plan_entries.skip_reason
--
-- Both columns nullable. No new indexes. Non-destructive — existing rows
-- retain NULL for these fields.
--
-- Consumers:
--   - meal_plans.focus_theme: Plan 22-05 (Skill Progression) — optional
--     weekly theme that the generator uses as a prompt nudge (e.g. "knife
--     skills", "one-pan recipes"). Free-form text; NOT a controlled enum so
--     new themes don't require a migration.
--   - meal_plan_entries.skip_reason: Plan 22-02 (Week Actions) + 22-03
--     (Month View) — free-form reason surfaced as a chip when status is
--     'skipped' (e.g. "travel", "ate out", "leftovers"). Month view aggregates
--     these into a travel/event-day heatmap overlay.

ALTER TABLE meal_plans
  ADD COLUMN IF NOT EXISTS focus_theme TEXT;

ALTER TABLE meal_plan_entries
  ADD COLUMN IF NOT EXISTS skip_reason TEXT;

COMMENT ON COLUMN meal_plans.focus_theme IS
  'Phase 22: Optional weekly skill focus, e.g. "knife skills". Generator nudge only — free-form text.';

COMMENT ON COLUMN meal_plan_entries.skip_reason IS
  'Phase 22: Free-form reason when status="skipped" (e.g., "travel", "ate out"). Month view surfaces this as a chip.';
