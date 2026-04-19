-- Phase 18: Append-only log of user corrections to AI-inferred source_location.
--
-- Phase 21 consumes this table to derive per-user location rules.
-- Phase 24 may join canonical_ingredient_id when the canonical-ingredient
-- refactor lands.
--
-- Immutability:
--   RLS allows SELECT and INSERT only. No UPDATE or DELETE policy is defined,
--   so authenticated users cannot mutate or remove past events.
--
-- No FK to pantry_items:
--   item_name is the rollup key for Phase 21 rule inference. If a user deletes
--   a pantry item, the override signal must persist ("user historically moves
--   'avocado' to fridge"). Decoupled from pantry-item lifecycle by design.

CREATE TABLE item_override_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  ai_location TEXT NOT NULL CHECK (ai_location IN ('fridge', 'pantry', 'freezer')),
  user_location TEXT NOT NULL CHECK (user_location IN ('fridge', 'pantry', 'freezer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_override_events_user ON item_override_events(user_id);
CREATE INDEX idx_override_events_user_name ON item_override_events(user_id, item_name);
CREATE INDEX idx_override_events_created ON item_override_events(user_id, created_at DESC);

ALTER TABLE item_override_events ENABLE ROW LEVEL SECURITY;

-- SELECT: users see their own events
CREATE POLICY "Users can view own override events"
  ON item_override_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: users can append their own events
CREATE POLICY "Users can insert own override events"
  ON item_override_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE policy (events are append-only).
-- No DELETE policy (events are immutable).

COMMENT ON TABLE item_override_events IS
  'Append-only log of user corrections to AI-inferred source_location. Phase 21 consumes this to derive per-user location rules. Phase 24 may join canonical_ingredient_id.';
