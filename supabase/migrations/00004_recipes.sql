-- Create recipes table
-- Stores imported recipes from URL scraping, photo scanning, or manual entry
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]',
  steps JSONB NOT NULL DEFAULT '[]',
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  servings INTEGER,
  source_type TEXT NOT NULL CHECK (source_type IN ('url', 'photo', 'manual')),
  source_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recipes_profile ON recipes(profile_id);
CREATE INDEX idx_recipes_profile_title ON recipes(profile_id, title);

-- Enable Row Level Security
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own recipes
CREATE POLICY "Users can view own recipes"
  ON recipes
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Policy: Users can insert their own recipes
CREATE POLICY "Users can insert own recipes"
  ON recipes
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Policy: Users can update their own recipes
CREATE POLICY "Users can update own recipes"
  ON recipes
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Policy: Users can delete their own recipes
CREATE POLICY "Users can delete own recipes"
  ON recipes
  FOR DELETE
  USING (auth.uid() = profile_id);

-- Update updated_at on row modification (reuses existing function from 00001_profiles.sql)
CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
