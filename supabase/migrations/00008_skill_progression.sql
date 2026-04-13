-- Phase 10: Skill progression foundation
-- Two tables:
--   1. recipe_cooks: append-only log of every cook event
--      (decouples cook count from meal plan lifecycle - Pitfall 3)
--   2. recipe_step_tips: per-step Haiku-generated tip cache

-- recipe_cooks: append-only cook event log
CREATE TABLE recipe_cooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  cooked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cook count aggregation and recent-history queries
CREATE INDEX idx_recipe_cooks_profile_recipe ON recipe_cooks(profile_id, recipe_id);
CREATE INDEX idx_recipe_cooks_profile_time ON recipe_cooks(profile_id, cooked_at DESC);

-- Enable Row Level Security
ALTER TABLE recipe_cooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own cooks select"
  ON recipe_cooks
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "own cooks insert"
  ON recipe_cooks
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- recipe_step_tips: per-step Haiku tip cache
CREATE TABLE recipe_step_tips (
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_index SMALLINT NOT NULL,
  tip TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (recipe_id, step_index)
);

-- Enable Row Level Security
ALTER TABLE recipe_step_tips ENABLE ROW LEVEL SECURITY;

-- Tips are scoped via parent recipe ownership
CREATE POLICY "own recipe step tips select"
  ON recipe_step_tips
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_step_tips.recipe_id
        AND recipes.profile_id = auth.uid()
    )
  );

CREATE POLICY "own recipe step tips insert"
  ON recipe_step_tips
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes
      WHERE recipes.id = recipe_step_tips.recipe_id
        AND recipes.profile_id = auth.uid()
    )
  );
