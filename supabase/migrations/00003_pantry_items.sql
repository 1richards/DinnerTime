-- Create pantry_items table
-- Stores scanned food items from fridge/pantry/freezer photos
CREATE TABLE pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'piece',
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'protein', 'grain', 'condiment', 'beverage', 'frozen', 'snack', 'other')),
  source_location TEXT NOT NULL CHECK (source_location IN ('fridge', 'pantry', 'freezer')),
  confidence NUMERIC DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'depleted')),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pantry_items_profile ON pantry_items(profile_id);
CREATE INDEX idx_pantry_items_lookup ON pantry_items(profile_id, normalized_name, source_location);
CREATE INDEX idx_pantry_items_status ON pantry_items(profile_id, status);

-- Enable Row Level Security
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own pantry items
CREATE POLICY "Users can view own pantry items"
  ON pantry_items
  FOR SELECT
  USING (auth.uid() = profile_id);

-- Policy: Users can insert their own pantry items
CREATE POLICY "Users can insert own pantry items"
  ON pantry_items
  FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

-- Policy: Users can update their own pantry items
CREATE POLICY "Users can update own pantry items"
  ON pantry_items
  FOR UPDATE
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Policy: Users can delete their own pantry items
CREATE POLICY "Users can delete own pantry items"
  ON pantry_items
  FOR DELETE
  USING (auth.uid() = profile_id);

-- Update updated_at on row modification (reuses existing function from 00001_profiles.sql)
CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON pantry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
