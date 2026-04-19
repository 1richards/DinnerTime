-- Phase 18: Forward-compatible item metadata on pantry_items
--
-- Adds an untyped JSONB column that the Phase 18 service layer dual-writes
-- alongside the existing source_location column. No Zod validation at the
-- application layer; the expected shape is documented on the column comment
-- and in types/pantry.ts.
--
-- Phase 24 formalizes this schema and migrates readers off the dedicated
-- source_location column.

ALTER TABLE pantry_items
  ADD COLUMN item_attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

-- No index in Phase 18. Pantry queries still hit source_location (which is
-- already indexed via idx_pantry_items_lookup). A GIN index on item_attributes
-- is premature until Phase 24 migrates readers to this column.

COMMENT ON COLUMN pantry_items.item_attributes IS
  'Forward-compatible item metadata. Phase 18 writes { "source_location": fridge|pantry|freezer } via service-layer dual-write. Phase 24 formalizes schema and may add brand, size_tier, freshness, canonical_ingredient_id. No application-layer Zod validation — shape is documented here.';
