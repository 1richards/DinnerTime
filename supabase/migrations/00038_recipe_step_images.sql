-- 00038_recipe_step_images.sql
-- Add an array of supplementary preparation-step image URLs to recipes.
--
-- The recipe detail page already shows a single finished-dish hero
-- (recipes.image_url). When a user opens a recipe's detail — a signal of
-- real interest — the app generates a couple more images depicting
-- preparation steps and shows hero + steps as an image slider.
--
-- These are generated once, in the background, then persisted here so
-- reopening the recipe is instant and we never pay to regenerate. Nullable:
-- legacy rows and recipes the user hasn't opened simply have no step images
-- and the detail page falls back to the single hero.

ALTER TABLE recipes
  ADD COLUMN step_image_urls TEXT[];

COMMENT ON COLUMN recipes.step_image_urls IS
  'Supplementary preparation-step photo URLs (typically 2) generated lazily when the user opens the recipe detail. NULL until generated; hero stays in image_url.';
