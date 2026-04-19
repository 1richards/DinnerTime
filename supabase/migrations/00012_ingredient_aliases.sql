-- Phase 24a: Ingredient aliases table.
--
-- Maps alternate names (plurals, receipt abbreviations, adjective prefixes,
-- brand-neutral expansions) to canonical ingredients. Lookup order in the
-- canonicalResolver is: exact canonical -> exact alias -> fuzzy -> candidate.
-- This table owns the "exact alias" layer; seed rows ship ~2000-3000 entries
-- covering common scan patterns. Phase 21 extends with user_correction and
-- ai_learning rows sourced from item_override_events.

CREATE TABLE ingredient_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_ingredient_id UUID NOT NULL REFERENCES canonical_ingredients(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('seed','user_correction','ai_learning','admin')),
  confidence FLOAT NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (canonical_ingredient_id, alias_name, source)
);

CREATE INDEX idx_ingredient_aliases_name ON ingredient_aliases(alias_name);
CREATE INDEX idx_ingredient_aliases_canonical ON ingredient_aliases(canonical_ingredient_id);

ALTER TABLE ingredient_aliases ENABLE ROW LEVEL SECURITY;

-- Public READ: alias corpus is a global reference.
CREATE POLICY ingredient_aliases_select
  ON ingredient_aliases
  FOR SELECT
  USING (true);

-- service-role WRITE: trusted server paths only.
CREATE POLICY ingredient_aliases_write
  ON ingredient_aliases
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE ingredient_aliases IS
  'Phase 24a. Alias corpus mapping alternate names to canonical ingredients. Global read, service-role write. source enum: seed | user_correction | ai_learning | admin.';

-- Seed rows from packages/server/src/data/ingredientAliases.seed.json.
-- Joins on canonical_name at insert time (canonical seed must land first).
-- Spliced by Task 2 of plan 24-01.
DO $$
DECLARE
  seed_json JSONB := $seed$__ALIAS_SEED_PLACEHOLDER__$seed$::JSONB;
  r JSONB;
  cid UUID;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(seed_json) LOOP
    SELECT id INTO cid
    FROM canonical_ingredients
    WHERE canonical_name = r->>'canonical_name';
    IF cid IS NOT NULL THEN
      INSERT INTO ingredient_aliases (canonical_ingredient_id, alias_name, source, confidence)
      VALUES (cid, r->>'alias_name', r->>'source', (r->>'confidence')::FLOAT)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
