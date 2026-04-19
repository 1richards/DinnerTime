-- Phase 24a: Canonical ingredients table.
--
-- Global, read-all / write-service-role substrate for identity-based dedup.
-- Status enum supports the candidate-autocreation pattern: unknown scan
-- names auto-create a row with status='candidate' so Phase 21 admin UI can
-- later promote or merge them. Forward-only; no backfill.

CREATE TABLE canonical_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('produce','protein','dairy','grain','condiment','beverage','frozen','spice','bakery','other')),
  default_source_location TEXT NOT NULL CHECK (default_source_location IN ('fridge','pantry','freezer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','candidate','merged','deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canonical_ingredients_name ON canonical_ingredients(canonical_name);
CREATE INDEX idx_canonical_ingredients_status ON canonical_ingredients(status);

ALTER TABLE canonical_ingredients ENABLE ROW LEVEL SECURITY;

-- Public READ: canonical corpus is a global reference shared across all users.
CREATE POLICY canonical_ingredients_select
  ON canonical_ingredients
  FOR SELECT
  USING (true);

-- service-role WRITE: only trusted server paths may insert/update/delete.
-- Scan-time candidate auto-creation runs under service-role via middleware/auth.ts.
CREATE POLICY canonical_ingredients_write
  ON canonical_ingredients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE canonical_ingredients IS
  'Phase 24a. Canonical ingredient corpus. Global read, service-role write. status enum supports candidate auto-creation + Phase 21 admin promotion.';

-- Seed rows from packages/server/src/data/canonicalIngredients.seed.json.
-- Spliced by Task 2 of plan 24-01.
DO $$
DECLARE
  seed_json JSONB := $seed$__CANONICAL_SEED_PLACEHOLDER__$seed$::JSONB;
  r JSONB;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(seed_json) LOOP
    INSERT INTO canonical_ingredients (canonical_name, category, default_source_location)
    VALUES (r->>'canonical_name', r->>'category', r->>'default_source_location')
    ON CONFLICT (canonical_name) DO NOTHING;
  END LOOP;
END $$;
