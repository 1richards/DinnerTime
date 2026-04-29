-- Custom user labels on recipes (e.g., "tacos", "game nights").
--
-- Free-form text array — no controlled vocabulary so users can invent
-- their own organizing categories. Empty array default keeps existing
-- rows clean. Index supports the Recipe Box filter that lets users
-- pick a label to narrow their library.
--
-- Consumers:
--   - Mobile Recipe Box detail (PreviewSheet variant) — adds an inline
--     "Labels" editor that PATCHes /recipes/:id with the next array.
--   - Mobile Recipe Box filter sheet — exposes a label-multi-select
--     that intersects with the existing favorites/cuisine/time filters.
--   - Mobile RecipeCard — renders each label as a small chip under
--     the title for at-a-glance scanning.

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN recipes.labels IS
  'User-defined free-form labels for organizing recipes (e.g., "tacos", "game nights"). Free-form; no controlled vocabulary.';

-- GIN index supports the array-contains filter ("show me recipes
-- tagged 'tacos'") without sequential scans.
CREATE INDEX IF NOT EXISTS recipes_labels_gin_idx
  ON recipes USING GIN (labels);
