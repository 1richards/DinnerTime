-- Add favorites support and extend source_type to include AI-discovered recipes
-- Phase 6 Plan 01: Recipe Library foundation

-- 1. Add is_favorite column (defaults to FALSE for existing and new rows)
ALTER TABLE recipes
  ADD COLUMN is_favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Partial index for efficient "favorites only" filtering per profile
--    Only indexes rows where is_favorite = TRUE to keep the index small
CREATE INDEX idx_recipes_profile_favorite
  ON recipes(profile_id, is_favorite)
  WHERE is_favorite = TRUE;

-- 3. Extend source_type CHECK constraint to allow 'ai' (AI-discovered recipes)
--    Existing UPDATE RLS policy (auth.uid() = profile_id) already covers the new column.
ALTER TABLE recipes
  DROP CONSTRAINT recipes_source_type_check;

ALTER TABLE recipes
  ADD CONSTRAINT recipes_source_type_check
  CHECK (source_type IN ('url', 'photo', 'manual', 'ai'));
