-- Phase 24a: Link pantry_items to canonical_ingredients + per-user category overrides.
--
-- New nullable FK on pantry_items: legacy rows stay canonical_ingredient_id = NULL
-- (forward-only, no backfill per user directive "it's all test data"). New scans
-- resolve canonical via canonicalResolver and populate the column.
--
-- Dedup lookup index on (profile_id, canonical_ingredient_id, source_location).
-- NOT UNIQUE: incompatible-unit rescans may intentionally produce multiple rows
-- with identical identity tuple (per 24a-RESEARCH § 7 + § 13).
--
-- canonical_category_override: per-user override of the canonical row's category
-- (criterion #11). Keyed by (user_id, canonical_ingredient_id). RLS user-scoped.

ALTER TABLE pantry_items
  ADD COLUMN canonical_ingredient_id UUID REFERENCES canonical_ingredients(id) ON DELETE SET NULL;

CREATE INDEX idx_pantry_items_canonical_dedup
  ON pantry_items(profile_id, canonical_ingredient_id, source_location);

COMMENT ON COLUMN pantry_items.canonical_ingredient_id IS
  'Phase 24a. Nullable FK to canonical_ingredients. Legacy rows stay NULL; new scans populate.';

-- Per-user canonical category override.
CREATE TABLE canonical_category_override (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canonical_ingredient_id UUID NOT NULL REFERENCES canonical_ingredients(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('produce','protein','dairy','grain','condiment','beverage','frozen','spice','bakery','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, canonical_ingredient_id)
);

CREATE INDEX idx_cco_user ON canonical_category_override(user_id);

ALTER TABLE canonical_category_override ENABLE ROW LEVEL SECURITY;

CREATE POLICY cco_select
  ON canonical_category_override
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY cco_insert
  ON canonical_category_override
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cco_update
  ON canonical_category_override
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY cco_delete
  ON canonical_category_override
  FOR DELETE
  USING (user_id = auth.uid());

COMMENT ON TABLE canonical_category_override IS
  'Phase 24a. Per-user override of canonical_ingredients.category. Criterion #11.';
