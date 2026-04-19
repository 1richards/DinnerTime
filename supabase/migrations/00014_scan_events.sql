-- Phase 24a: Append-only scan event log.
--
-- Records every scan (camera, batch, receipt, instacart) with raw AI output,
-- server-normalized final items, and per-field confidence. Survives pantry-item
-- deletion (no FK to pantry_items) for future ML training.
--
-- Immutability: RLS exposes only SELECT + INSERT. No UPDATE or DELETE policies
-- are defined, so authenticated users cannot mutate or remove past events.
-- Service-role bypasses RLS but must treat this table as append-only by convention.
--
-- DELIBERATELY NO pass_number column — ROADMAP criterion #3 (multi-pass reasoning)
-- is descoped to a post-beta investigation phase. Do not add it here; revisit
-- when real data shows where multi-pass is actually needed.

CREATE TABLE scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_variant TEXT NOT NULL CHECK (scan_variant IN ('camera','batch','receipt','instacart')),
  raw_ai_output JSONB NOT NULL,
  final_items JSONB NOT NULL,
  field_confidence JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scan_events_user_time ON scan_events(user_id, created_at DESC);

ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;

-- SELECT: users see their own scan events.
CREATE POLICY scan_events_select
  ON scan_events
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: users can append their own scan events.
CREATE POLICY scan_events_insert
  ON scan_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE policy (events are append-only).
-- No DELETE policy (events are immutable).

COMMENT ON TABLE scan_events IS
  'Phase 24a. Append-only log of every scan across all 4 variants. field_confidence JSONB shape: [{item_index, name, quantity, unit, category}]. Survives pantry-item deletion for future ML training. Multi-pass reasoning (criterion #3) deliberately descoped.';
