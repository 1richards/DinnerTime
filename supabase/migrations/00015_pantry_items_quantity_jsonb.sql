-- Phase 24a: Replace pantry_items.quantity (NUMERIC) + unit (TEXT) with quantity JSONB.
--
-- New shape: { value: number, unit: string, system: 'count' | 'imperial-weight' |
-- 'imperial-volume' | 'metric-weight' | 'metric-volume' | 'custom' }.
--
-- Forward-only. User directive: "it's all test data" — pre-Phase-24 pantry rows
-- are not preserved. DROP is safe.

ALTER TABLE pantry_items DROP COLUMN IF EXISTS quantity;
ALTER TABLE pantry_items DROP COLUMN IF EXISTS unit;

ALTER TABLE pantry_items
  ADD COLUMN quantity JSONB NOT NULL
  DEFAULT '{"value":1,"unit":"piece","system":"count"}'::jsonb;

COMMENT ON COLUMN pantry_items.quantity IS
  'Phase 24a. Shape: {value: number, unit: string, system: count|imperial-weight|imperial-volume|metric-weight|metric-volume|custom}';
