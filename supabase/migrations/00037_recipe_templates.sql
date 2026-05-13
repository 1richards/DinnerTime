-- 00037_recipe_templates.sql
--
-- Baseline recipe library. Every new user lands with cuisine-matching
-- recipes already in their personal `recipes` table — populated from
-- `recipe_templates` by the backend route POST /api/v1/recipes/seed-baseline.
--
-- Templates are READ-ONLY for clients and PUBLIC-READABLE to every
-- authenticated user. The seed itself (the row contents) is loaded
-- one-time by POST /api/v1/recipes/seed-templates from the TS data file
-- at packages/server/src/data/seedRecipes.ts — the SQL here is just
-- the schema + RLS, not the data, so editing the recipe set is a
-- one-file edit + redeploy rather than a new migration.
--
-- Why this isn't owned by a profile: every user gets the same baseline.
-- Owning duplicates per-user would balloon DB size and make "update the
-- baseline" impossible without touching every user's rows. Pattern matches
-- canonical_ingredients (00011) — public reference data, app-scope read.

CREATE TABLE recipe_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable identifier from seedRecipes.ts templateKey() — used as the
  -- upsert target so the seed script can edit / add recipes without
  -- needing to know existing UUIDs.
  template_key TEXT UNIQUE NOT NULL,
  cuisine_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  difficulty TEXT CHECK (
    difficulty IS NULL OR difficulty IN ('easy', 'medium', 'hard')
  ),
  practiced_skills TEXT[],
  skill_note TEXT,
  labels TEXT[] NOT NULL DEFAULT '{}',
  calories_per_serving INTEGER,
  protein_grams_per_serving NUMERIC(5, 1),
  fat_grams_per_serving NUMERIC(5, 1),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recipe_templates_cuisine ON recipe_templates(cuisine_type);

-- RLS: every authenticated user can read templates. No writes from clients —
-- the seed-templates route uses the service role to populate.
ALTER TABLE recipe_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read templates"
  ON recipe_templates
  FOR SELECT
  TO authenticated
  USING (true);

-- Reuse the shared trigger function from 00001_profiles.sql.
CREATE TRIGGER recipe_templates_updated_at
  BEFORE UPDATE ON recipe_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Profile flag — tracks whether a user has had baseline recipes seeded.
-- Prevents re-seeding on every onboarding-completion call (which would
-- create duplicates if the user has saved/edited any of them).
ALTER TABLE profiles
  ADD COLUMN baseline_recipes_seeded BOOLEAN NOT NULL DEFAULT FALSE;
