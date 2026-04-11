-- Add skill_level to profiles
ALTER TABLE profiles ADD COLUMN skill_level TEXT DEFAULT 'beginner'
  CHECK (skill_level IN ('beginner', 'intermediate', 'confident', 'adventurous'));

-- Create household_members table
-- Stores individual family member profiles with per-member dietary needs
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  member_type TEXT NOT NULL CHECK (member_type IN ('adult', 'kid')),
  age_range TEXT CHECK (
    age_range IS NULL OR age_range IN ('toddler', 'young_kid', 'older_kid', 'teen')
  ),
  dietary_restrictions JSONB DEFAULT '[]'::jsonb,
  dietary_allergies JSONB DEFAULT '[]'::jsonb,
  disliked_ingredients JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own household members
CREATE POLICY "Users can view own household members"
  ON household_members
  FOR SELECT
  USING (profile_id = auth.uid());

-- Policy: Users can insert their own household members
CREATE POLICY "Users can insert own household members"
  ON household_members
  FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Policy: Users can update their own household members
CREATE POLICY "Users can update own household members"
  ON household_members
  FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Policy: Users can delete their own household members
CREATE POLICY "Users can delete own household members"
  ON household_members
  FOR DELETE
  USING (profile_id = auth.uid());

-- Reuse existing update_updated_at() trigger function
CREATE TRIGGER household_members_updated_at
  BEFORE UPDATE ON household_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
