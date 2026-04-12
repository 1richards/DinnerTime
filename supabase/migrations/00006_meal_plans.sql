-- Create meal_plans and meal_plan_entries tables
-- Persistent weekly meal plans with per-day entries (recipe-backed or ad-hoc AI meals)

-- meal_plans: one row per (profile, week_start)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Monday of the week
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, week_start)
);

-- meal_plan_entries: one row per (plan, day_of_week)
CREATE TABLE meal_plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Monday
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]', -- [{name, quantity, unit}]
  ingredients_needed JSONB NOT NULL DEFAULT '[]', -- for Phase 8 shopping
  estimated_time_minutes INTEGER,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
  kid_friendly BOOLEAN DEFAULT FALSE,
  why_suggested TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'cooked', 'skipped')),
  cooked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meal_plan_id, day_of_week)
);

-- Indexes
CREATE INDEX idx_meal_plans_profile_week ON meal_plans(profile_id, week_start DESC);
CREATE INDEX idx_meal_plan_entries_plan ON meal_plan_entries(meal_plan_id);
CREATE INDEX idx_meal_plan_entries_cooked ON meal_plan_entries(meal_plan_id, status, cooked_at DESC);

-- Enable Row Level Security
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_entries ENABLE ROW LEVEL SECURITY;

-- meal_plans policies (scoped by profile_id = auth.uid())
CREATE POLICY "Users can view own meal plans"
  ON meal_plans
  FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own meal plans"
  ON meal_plans
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own meal plans"
  ON meal_plans
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete own meal plans"
  ON meal_plans
  FOR DELETE
  USING (auth.uid() = profile_id);

-- meal_plan_entries policies (scoped via parent meal_plan's profile_id)
CREATE POLICY "Users can view own meal plan entries"
  ON meal_plan_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_entries.meal_plan_id
        AND meal_plans.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own meal plan entries"
  ON meal_plan_entries
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_entries.meal_plan_id
        AND meal_plans.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own meal plan entries"
  ON meal_plan_entries
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_entries.meal_plan_id
        AND meal_plans.profile_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_entries.meal_plan_id
        AND meal_plans.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own meal plan entries"
  ON meal_plan_entries
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans
      WHERE meal_plans.id = meal_plan_entries.meal_plan_id
        AND meal_plans.profile_id = auth.uid()
    )
  );

-- Update updated_at on row modification (reuses existing function from 00001_profiles.sql)
CREATE TRIGGER meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
