# Phase 24a: Data Model + Dedup - Research

**Researched:** 2026-04-18
**Domain:** Postgres schema evolution + canonical-ingredient resolver + identity-based dedup + per-field confidence UI
**Confidence:** HIGH (all substrate is in-repo; patterns proven by Phase 18)

## Summary

Phase 24a formalizes the pantry data model. Five forward-only migrations add `canonical_ingredients`, `ingredient_aliases`, `canonical_category_override`, `scan_events`, plus `canonical_ingredient_id` FK + `quantity JSONB` on `pantry_items`. A new `canonicalResolver.ts` service follows the Phase 18 `itemLocation.ts` pattern (static-first, AI never overrides a known canonical, candidate auto-creation on miss). `units.ts` provides dimension-pure conversion (no density). `reconcileItems` is rewritten to key dedup on `(canonical_ingredient_id, source_location)` instead of `(profile_id, normalized_name)`. All four scan flows converge at `POST /pantry/confirm` so mobile integration is a single pass-through change plus an inline low-confidence UI hint in `ReviewItemRow.tsx`.

**Primary recommendation:** 3 waves, ~6 plans — (W1) migrations + seed data + canonicalResolver + units, (W2) vision tool schema + reconcileItems rewrite + scan_events append, (W3) mobile ScanResult passthrough + inline confidence UI + UAT. All test data; forward-only; no backfill.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Phase chunking:** 24a ships canonical_ingredients + ingredient_aliases + `pantry_items.canonical_ingredient_id` FK + identity dedup (`canonical_id + source_location`) + quantity JSONB `{value, unit, system}` + unit conversion library + aggregation + scan_events immutable log + reconcileItems rewrite across 4 scan flows + per-field confidence on scan_events + minimum inline < 0.7 confidence UI. 24b ships versioned prompt `.md` files, eval harness, retry/fallback, model routing — **NOT IN 24a SCOPE**.
- **Execution order:** Phase 24 (both halves) runs BEFORE Phase 21.
- **Canonical table:** ~300 curated entries in `packages/server/src/data/canonicalIngredients.seed.json`. Schema `canonical_ingredients(id uuid pk, canonical_name text unique, category text, default_source_location text, status text default 'active')`. Status enum: `active | candidate | merged | deprecated`. Code-seeded only in this phase.
- **Category is a property of canonical row** (criterion #10). Per-user override on a separate table keyed by `(user_id, canonical_ingredient_id)`.
- **Aliases table:** `ingredient_aliases(id uuid pk, canonical_ingredient_id uuid fk, alias_name text, source text, confidence float, created_at timestamptz)`. Source enum: `seed | user_correction | ai_learning | admin`. ~2000-3000 rows seeded.
- **Lookup order:** exact canonical → exact alias → fuzzy (Levenshtein) → auto-create `status='candidate'` canonical. Fuzzy is fallback-only per criterion #14.
- **Quantity shape:** `{value: number, unit: string, system: 'count' | 'imperial-weight' | 'imperial-volume' | 'metric-weight' | 'metric-volume' | 'custom'}`. JSONB column on pantry_items, replaces existing `quantity` float + `unit` text.
- **Unit conversion:** new `packages/server/src/services/units.ts`. Cooking-relevant conversions only (cups↔tbsp↔tsp↔ml, oz↔lb↔g↔kg, pieces=count). **NO density conversion.** No external dependency.
- **Aggregation on re-scan:** compatible units → `value` sums, canonical unit preserved. Incompatible → stored as MULTIPLE pantry_items rows with UX reconcile hint.
- **Dedup identity:** `(canonical_ingredient_id, source_location)` — a tuple of FKs, not strings.
- **scan_events:** `scan_events(id uuid pk, user_id uuid, scan_variant text, raw_ai_output jsonb, final_items jsonb, field_confidence jsonb, created_at timestamptz)`. Variant enum: `camera | batch | receipt | instacart`. Append-only, no FK to pantry_items. RLS: user_id = auth.uid() on SELECT + INSERT only.
- **field_confidence JSONB shape:** `[{item_index: 0, name: 0.92, quantity: 0.85, unit: 0.7, category: 0.98}, ...]`.
- **Migration strategy:** forward-only, no backfill, no rollback beyond schema-drop. Legacy pantry_items stay `canonical_ingredient_id = NULL`.
- **Unknown scan names:** auto-create `status='candidate'` canonical with raw name; scan completes normally.
- **Per-field confidence UI:** minimum inline treatment. Fields with confidence < 0.7 get dashed underline OR caution SymbolIcon. Uses Phase 19 tokens.
- **DESCOPED criterion #3:** multi-pass reasoning — scan_events has NO `pass_number` column.
- **Dual-write:** `canonical_ingredient_id` as FK column + also `item_attributes.canonical_ingredient_id` for legacy compat (phase out after 24a ships).

### Claude's Discretion
- Exact canonical seed list (~300 entries) — propose during planning; user reviews before merge.
- Exact alias seed list (~2000-3000 entries) — propose during planning.
- Threshold for candidate-promotion recurrence (default 3 per user).
- Unit conversion module architecture: pure-function table vs small class.
- Exact visual treatment of < 0.7 confidence marker (dashed underline vs chip vs icon) — Phase 19 tokens only.
- scan_events retention policy (default forever).

### Deferred Ideas (OUT OF SCOPE)
- Multi-pass vision reasoning (criterion #3) — post-beta phase.
- Admin UI for canonical mutations — post-launch tooling.
- Density-based volume↔weight conversion — deliberately out.
- Embedding-based alias matching — potential 24.x / post-beta.
- USDA FoodData Central expansion — revisit at public launch.
- Active backfill of pre-Phase-24 pantry items — test data, waived.
- Auto-promote candidate → active without human review — Phase 21 owns UI.
- Rollback tooling beyond schema-drop.
- scan_events retention automation (TTL / archival).
- Per-field confidence UI polish beyond minimum.
- Household-wide canonical category overrides.
- **Versioned prompt files, eval harness, fixture-based accuracy, retry/fallback, model routing per variant — ALL 24b SCOPE.**

</user_constraints>

<phase_requirements>
## Phase Requirements (ROADMAP criteria 6-23, 24a scope)

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-06 | Canonical ingredient table exists | Migration 00011 (below) |
| REQ-07 | Canonical resolver with alias fallback | `canonicalResolver.ts` algorithm (§ 4) |
| REQ-08 | Seed ~300 canonical entries | Seed JSON shape (§ 2) |
| REQ-09 | Candidate auto-creation on miss | resolver pseudocode step 4 |
| REQ-10 | Category as property of canonical | `canonical_ingredients.category` column |
| REQ-11 | Per-user category override | Migration 00013 (canonical_category_override) |
| REQ-12 | ~2000-3000 aliases seeded | Alias seed shape (§ 3) |
| REQ-13 | Identity = `(canonical_id, source_location)` | reconcileItems rewrite (§ 7) |
| REQ-14 | Fuzzy match is fallback-only | resolver algorithm order |
| REQ-15 | Batch + receipt + instacart all use canonical identity | 4-flow convergence point (§ 8) |
| REQ-16 | Quantity = `{value, unit, system}` JSONB | Migration 00015 (§ 5) |
| REQ-17 | Unit conversion library | `units.ts` shape (§ 6) |
| REQ-18 | Aggregation on re-scan | reconcileItems aggregation step |
| REQ-19 | Per-field confidence scored | Tool schema extension (§ 11), flow (§ 10) |
| REQ-20 | `pantry_items.canonical_ingredient_id` FK column | Migration 00013 |
| REQ-21 | scan_events immutable log | Migration 00014 (§ 9) |
| REQ-22 | RLS on user-scoped tables | All migrations (§ 1) |
| REQ-23 | Forward-only, no backfill | Decision — reflected in migrations 0 rollback |

</phase_requirements>

## 1. Migration Ordering

Five new files in `supabase/migrations/`, applied in order:

| # | File | Shape | RLS |
|---|------|-------|-----|
| 00011 | `canonical_ingredients.sql` | `(id uuid pk, canonical_name text unique, category text CHECK IN (9 enum), default_source_location text CHECK IN ('fridge','pantry','freezer'), status text CHECK IN ('active','candidate','merged','deprecated') DEFAULT 'active', created_at timestamptz, updated_at timestamptz)`. Global table. INSERTs seed rows from JSON. | Public READ (SELECT USING true); service-role WRITE. |
| 00012 | `ingredient_aliases.sql` | `(id uuid pk, canonical_ingredient_id uuid FK → canonical_ingredients(id) ON DELETE CASCADE, alias_name text, source text CHECK IN ('seed','user_correction','ai_learning','admin'), confidence float, created_at timestamptz)`. UNIQUE `(canonical_ingredient_id, alias_name, source)`. INDEX on `alias_name`. | Public READ; service-role WRITE (user_correction rows inserted via RPC). |
| 00013 | `pantry_items_canonical_link.sql` | Adds `pantry_items.canonical_ingredient_id uuid REFERENCES canonical_ingredients(id) ON DELETE SET NULL` (nullable). Creates `canonical_category_override(user_id uuid, canonical_ingredient_id uuid, category text, PRIMARY KEY (user_id, canonical_ingredient_id))`. INDEX on `pantry_items(profile_id, canonical_ingredient_id, source_location)` for dedup lookup. | canonical_category_override RLS: `user_id = auth.uid()` on all verbs. pantry_items RLS unchanged. |
| 00014 | `scan_events.sql` | `(id uuid pk, user_id uuid FK → auth.users, scan_variant text CHECK IN ('camera','batch','receipt','instacart'), raw_ai_output jsonb, final_items jsonb, field_confidence jsonb, created_at timestamptz)`. No `pass_number` column (criterion #3 descoped). INDEX on `(user_id, created_at DESC)`. | SELECT USING `user_id = auth.uid()`. INSERT WITH CHECK same. **NO UPDATE/DELETE policies** (append-only). |
| 00015 | `pantry_items_quantity_jsonb.sql` | `ALTER TABLE pantry_items DROP COLUMN quantity; DROP COLUMN unit; ADD COLUMN quantity jsonb NOT NULL DEFAULT '{"value":1,"unit":"piece","system":"count"}'::jsonb;`. **Test-data only — drop is safe.** | N/A (column ALTER). |

**Ordering rationale:** 00011 before 00012 (alias FK). 00011 before 00013 (pantry FK). 00014 independent. 00015 last so quantity migration doesn't churn during dev.

## 2. Canonical Seed Shape

`packages/server/src/data/canonicalIngredients.seed.json` — JSON array:

```json
[
  { "canonical_name": "chicken breast", "category": "protein", "default_source_location": "fridge" },
  { "canonical_name": "ground beef", "category": "protein", "default_source_location": "fridge" },
  { "canonical_name": "whole milk", "category": "dairy", "default_source_location": "fridge" },
  { "canonical_name": "greek yogurt", "category": "dairy", "default_source_location": "fridge" },
  { "canonical_name": "olive oil", "category": "condiment", "default_source_location": "pantry" },
  { "canonical_name": "canned tomatoes", "category": "other", "default_source_location": "pantry" },
  { "canonical_name": "brown rice", "category": "grain", "default_source_location": "pantry" },
  { "canonical_name": "frozen peas", "category": "frozen", "default_source_location": "freezer" },
  { "canonical_name": "banana", "category": "produce", "default_source_location": "pantry" },
  { "canonical_name": "orange juice", "category": "beverage", "default_source_location": "fridge" }
]
```

Target distribution (approximate): produce ~80, proteins ~40, dairy ~20, grains ~30, condiments ~40, beverages ~30, frozen ~20, spices ~40. Extends Phase 18 LOCATION_STATIC_MAP (`itemLocation.ts:20-245`).

`id` / `status` / timestamps assigned by DB defaults at INSERT time. `status` omitted → DB default `'active'`.

## 3. Alias Seed Shape

`packages/server/src/data/ingredientAliases.seed.json` — JSON array, references canonical by `canonical_name` (migration resolves to `id`):

```json
[
  { "canonical_name": "chicken breast", "alias_name": "chkn brst", "source": "seed", "confidence": 0.95 },
  { "canonical_name": "chicken breast", "alias_name": "boneless skinless chicken breast", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "chicken breast", "alias_name": "chicken breasts", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "whole milk", "alias_name": "gv whl mlk", "source": "seed", "confidence": 0.9 },
  { "canonical_name": "whole milk", "alias_name": "milk, whole", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "ground beef", "alias_name": "hamburger", "source": "seed", "confidence": 0.9 },
  { "canonical_name": "ground beef", "alias_name": "80/20 ground beef", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "banana", "alias_name": "bananas", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "banana", "alias_name": "organic banana", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "olive oil", "alias_name": "evoo", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "olive oil", "alias_name": "extra virgin olive oil", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "canned tomatoes", "alias_name": "diced tomatoes", "source": "seed", "confidence": 0.85 },
  { "canonical_name": "canned tomatoes", "alias_name": "crushed tomatoes", "source": "seed", "confidence": 0.85 },
  { "canonical_name": "frozen peas", "alias_name": "frozen pea", "source": "seed", "confidence": 1.0 },
  { "canonical_name": "orange juice", "alias_name": "oj", "source": "seed", "confidence": 0.95 }
]
```

Plan generator writes ~3-10 aliases per canonical covering: plural variants, receipt abbreviations, adjective prefixes (`organic`, `boneless skinless`, `unsalted`), common brand-neutral names. Target 2000-3000 rows total.

## 4. canonicalResolver Algorithm

`packages/server/src/services/canonicalResolver.ts` — follows `itemLocation.ts:298-389` template exactly (static-first, AI never overrides known, batch fallback, candidate auto-create is 24a-specific addition).

```
resolveCanonical(supabase, rawName: string) → { canonicalId, matchType, confidence }
  const norm = rawName.trim().toLowerCase()
  // 1) Exact canonical (confidence 1.0)
  const c = SELECT id FROM canonical_ingredients WHERE canonical_name = norm AND status IN ('active','candidate')
  if (c) return { canonicalId: c.id, matchType: 'exact_canonical', confidence: 1.0 }
  // 2) Exact alias (confidence = alias.confidence, typically 0.9-1.0)
  const a = SELECT canonical_ingredient_id, confidence FROM ingredient_aliases WHERE alias_name = norm ORDER BY confidence DESC LIMIT 1
  if (a) return { canonicalId: a.canonical_ingredient_id, matchType: 'exact_alias', confidence: a.confidence }
  // 3) Fuzzy (Levenshtein, max distance = 2, only for len >= 4)
  const f = fuzzyLookup(norm, allCanonicalNames) // in-process; cache canonical list
  if (f.distance <= 2) return { canonicalId: f.id, matchType: 'fuzzy', confidence: 0.6 }
  // 4) Candidate auto-create (never fails a scan)
  const newId = INSERT INTO canonical_ingredients (canonical_name, category, default_source_location, status)
                 VALUES (norm, 'other', 'pantry', 'candidate') RETURNING id
  return { canonicalId: newId, matchType: 'candidate_created', confidence: 0.3 }
```

Batch entry point `resolveCanonicalBatch(names)` mirrors `classifyItems` (`itemLocation.ts:357-389`) — dedups input, single Levenshtein pass against cached canonical name list, single INSERT batch for candidates. Cache canonical name list in-process with 60-second TTL (Levenshtein cost is O(n*m); cache avoids reloading 300 rows per scan).

**Fuzzy implementation:** plain JS Levenshtein (~30 lines, well-known). No npm dependency.

## 5. Quantity JSONB Migration

**Existing schema** (`supabase/migrations/00003_pantry_items.sql:8-9`):
```sql
quantity NUMERIC DEFAULT 1,
unit TEXT DEFAULT 'piece',
```

**New schema** (migration 00015, test-data only — straight drop):
```sql
ALTER TABLE pantry_items DROP COLUMN quantity;
ALTER TABLE pantry_items DROP COLUMN unit;
ALTER TABLE pantry_items ADD COLUMN quantity jsonb NOT NULL
  DEFAULT '{"value":1,"unit":"piece","system":"count"}'::jsonb;
COMMENT ON COLUMN pantry_items.quantity IS
  'Phase 24a. Shape: {value: number, unit: string, system: count|imperial-weight|imperial-volume|metric-weight|metric-volume|custom}';
```

No backfill (test data directive). ~10 lines total.

## 6. units.ts Shape

`packages/server/src/services/units.ts` — pure-function module. ~20-line skeleton:

```typescript
export type QuantitySystem =
  | 'count' | 'imperial-weight' | 'imperial-volume'
  | 'metric-weight' | 'metric-volume' | 'custom';

export interface Quantity {
  value: number;
  unit: string;     // 'cup' | 'tbsp' | 'oz' | 'lb' | 'g' | 'kg' | 'ml' | 'piece' | ...
  system: QuantitySystem;
}

// Base units per system: imperial-volume → 'tsp', imperial-weight → 'oz',
// metric-volume → 'ml', metric-weight → 'g', count → 'piece'.
const CONVERSION_TABLE: Record<string, { base: string; toBase: number }> = {
  tsp: { base: 'tsp', toBase: 1 },
  tbsp: { base: 'tsp', toBase: 3 },
  cup: { base: 'tsp', toBase: 48 },
  oz: { base: 'oz', toBase: 1 },
  lb: { base: 'oz', toBase: 16 },
  g: { base: 'g', toBase: 1 },
  kg: { base: 'g', toBase: 1000 },
  ml: { base: 'ml', toBase: 1 },
  l: { base: 'ml', toBase: 1000 },
  piece: { base: 'piece', toBase: 1 },
};

export function areCompatible(a: Quantity, b: Quantity): boolean { /* same system */ }
export function convert(q: Quantity, targetUnit: string): Quantity | null { /* null if cross-dimension */ }
export function add(a: Quantity, b: Quantity): Quantity | null { /* null = incompatible → caller stores multi-row */ }
```

Unit tests: compatible-add, incompatible-returns-null, cup→tbsp, lb→oz, count stays count.

## 7. reconcileItems Rewrite

Current impl at `packages/server/src/services/pantry.ts:59-152` — keys dedup on `(profile_id, normalized_name)`. New impl keys on `(profile_id, canonical_ingredient_id, source_location)`:

```
reconcileItems(supabase, profileId, items: ConfirmedItem[]):
  for item of items:
    // 1. Resolve canonical (exact → alias → fuzzy → candidate)
    const { canonicalId } = await resolveCanonical(supabase, item.name)
    // 2. Match existing row on identity tuple
    const existing = SELECT * FROM pantry_items
      WHERE profile_id = $1 AND canonical_ingredient_id = $2 AND source_location = $3
    if (existing):
      // 3. Aggregate: sum if units compatible; else insert multi-row + UX hint flag
      const merged = units.add(existing.quantity, item.quantity)
      if (merged) UPDATE pantry_items SET quantity = merged, last_seen_at = NOW(), confidence = item.confidence WHERE id = existing.id
      else INSERT INTO pantry_items (...) with item_attributes.reconcile_hint = 'incompatible_units'
    else:
      // 4. Insert new row with canonical FK
      INSERT INTO pantry_items (profile_id, canonical_ingredient_id, name, normalized_name, quantity, category, source_location, item_attributes, confidence, ...)
      // item_attributes dual-writes { canonical_ingredient_id, source_location } for legacy readers
```

Four scan flows (`camera`, `batch`, `receipt`, `instacart_screenshot`) all converge at `POST /pantry/confirm` (see § 8). One rewrite = all flows covered.

## 8. 4-Scan-Flow Convergence Point

All four scan flows (camera single, batch multi-photo, receipt OCR, Instacart screenshot) dispatch through different vision entry points BUT converge at the same dedup/persistence function:

**`reconcileItems` in `packages/server/src/services/pantry.ts:59`**, invoked from **`POST /pantry/confirm` in `packages/server/src/routes/pantry.ts:186-210`**.

Confirmed by `grep "reconcileItems"` — single call site in routes. Mobile passes accepted ScanResult[] to `/confirm`; server resolves canonical + reconciles. This means the canonical resolution + aggregation logic lives in ONE place. Scan-variant-specific logic (OCR denylist, batch dedup preamble) stays in the vision extractors and does NOT leak into reconcile.

## 9. scan_events Table Shape

```sql
CREATE TABLE scan_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_variant    text NOT NULL CHECK (scan_variant IN ('camera','batch','receipt','instacart')),
  raw_ai_output   jsonb NOT NULL,          -- full tool-use response pre-normalization
  final_items     jsonb NOT NULL,          -- server-normalized ScanResult[] with canonical_id
  field_confidence jsonb NOT NULL,         -- [{item_index, name, quantity, unit, category}]
  created_at      timestamptz NOT NULL DEFAULT NOW()
  -- NO pass_number column (criterion #3 descoped)
  -- NO FK to pantry_items (survives deletion for future ML training)
);
CREATE INDEX idx_scan_events_user_time ON scan_events(user_id, created_at DESC);
ALTER TABLE scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY scan_events_select ON scan_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY scan_events_insert ON scan_events FOR INSERT WITH CHECK (user_id = auth.uid());
-- No UPDATE/DELETE policies → append-only by construction.
```

INSERT happens in the vision route after `normalizeScanItems` and before returning to mobile. Non-blocking failure (log + continue) — a scan_events outage must never break a scan.

## 10. Per-Field Confidence Data Flow

`field_confidence` JSONB shape on scan_events:

```json
[
  { "item_index": 0, "name": 0.92, "quantity": 0.85, "unit": 0.7, "category": 0.98 },
  { "item_index": 1, "name": 0.55, "quantity": 0.3,  "unit": 0.4, "category": 0.9  }
]
```

**Propagation path (5 steps):**
- **Vision tool response:** AI returns `confidence: { name, quantity, unit, category }` per item (see § 11).
- **Server normalize:** `normalizeScanItems` (`vision.ts:192-201`) extracts into parallel array keyed by item_index; ScanResult gains `fieldConfidence: { name, quantity, unit, category }`.
- **Route POST /pantry/scan (and siblings):** returns `{ items: ScanResult[] }` with fieldConfidence on each; also appends scan_events row with field_confidence JSONB.
- **Mobile store:** `pantryStore.ts` `ReviewItem` type gains `fieldConfidence?: {...}` — pass-through, no logic.
- **ReviewItemRow render:** per-field check `item.fieldConfidence?.name < 0.7 ? applyLowConfidenceStyle` (see § 12).

## 11. Tool Schema Extension

Current schema at `vision.ts:41-71`. Extension for 24a:

```typescript
// Existing (simplified):
{ name: string, quantity: number, unit: string, confidence: number,
  category: enum, source_location: enum }

// 24a shape:
{
  name: string,
  quantity: { value: number, unit: string, system: enum },  // was: quantity:number + unit:string
  category: enum,
  source_location: enum,
  confidence: {                                              // was: flat number
    name: number,
    quantity: number,
    unit: number,
    category: number
  }
}
```

Schema additions to `foodItemsSchema` in `vision.ts`:

```typescript
quantity: {
  type: 'object',
  properties: {
    value: { type: 'number' },
    unit:  { type: 'string' },
    system: { type: 'string', enum: ['count','imperial-weight','imperial-volume','metric-weight','metric-volume','custom'] },
  },
  required: ['value', 'unit', 'system'],
},
confidence: {
  type: 'object',
  properties: {
    name:     { type: 'number' },
    quantity: { type: 'number' },
    unit:     { type: 'number' },
    category: { type: 'number' },
  },
  required: ['name', 'quantity', 'unit', 'category'],
},
```

`normalizeScanItems` (`vision.ts:192`) updates to handle the new shapes and produce flat `fieldConfidence` for downstream. Prompt strings (`FILTERING_RULES`, `RECEIPT_FILTERING_RULES`) need one-sentence additions explaining per-field confidence + quantity.system. Prompt file versioning is 24b; for 24a, edit the strings in place.

## 12. Low-Confidence UI Treatment

**Recommendation:** dashed underline on the field value via a NativeWind utility class, no icon. Reasoning: icon clutters a row that already has status chip + location chip + remove button; dashed underline is the web-standard "uncertain" affordance (spellcheck, uncertain OCR), non-blocking, 1-tap to edit.

Implementation at `ReviewItemRow.tsx`: add a `lowConfidence` boolean computed per field from `item.fieldConfidence?.{field} < 0.7`. Apply `border-b border-dashed border-amber-400` to the name `Text` and quantity `TextInput`. Use Phase 19 token `amber-400` (maps to existing warning token). No new design primitives. For consistency on the `LocationChip`, if `item.fieldConfidence?.category < 0.7` add a thin amber border on the chip — still no icon. Accessibility: pass `accessibilityHint="Low confidence — tap to edit"` when the dashed style applies.

## 13. Pitfalls

- **Gemini tool-schema strictness** — nested objects with `enum` on a deep field occasionally trigger `MalformedFunctionCallError` on Gemini flash-lite (`taskRouting.ts:43` uses flash-lite for `ingredient.categorize`). Keep `confidence` as flat numbers per field (not nested), and keep `quantity` one level deep. Vision task uses Anthropic Sonnet (`vision.pantryScan`), which is more tolerant — but `canonicalResolver` batch-AI fallback would use flash-lite; mirror `classifyLocationsTool` shape (`itemLocation.ts:256-280`).
- **FK ordering in migrations** — 00011 (canonical) must land before 00012 (aliases) and 00013 (pantry FK). Supabase CLI applies in filename order, so numeric prefixes are load-bearing; don't rename or gap.
- **Fuzzy cost at scan time** — Levenshtein over 300-entry canonical name list × 20 items per scan = 6000 comparisons. Fine in JS, but cache the canonical name list in-process (60s TTL) to avoid re-fetching 300 rows per scan. Invalidate on candidate INSERT.
- **RLS on global canonical_ingredients / ingredient_aliases** — these are READ-public tables, but service-role INSERTs for candidate auto-create must run under a supabase client that bypasses RLS (or use `auth.role() = 'service_role'` write policy). The scan path already runs server-side with service-role credentials via `packages/server/src/middleware/auth.ts` pattern; confirm this when wiring `canonicalResolver`.
- **Tool schema backcompat during rollout** — while 24a lands, `pantry_items` briefly coexists with rows lacking `canonical_ingredient_id`. `GET /pantry` must not assume `canonical_ingredient_id` is non-null. Mobile renders legacy rows fine (no canonical features depend on it for display).
- **Test-data assumption pitfall** — the "all test data, forward-only" directive applies only to pre-Phase-24 rows. If any beta tester has scanned meaningfully, the user waived concern, but researchers should still flag this in the PR body so the user confirms no surprise data loss.
- **Quantity aggregation edge cases** — `{value:0, unit:'piece', system:'count'}` is a valid returned value and must not crash `units.add`. `NaN`/`Infinity` from malformed AI must be sanitized in `normalizeScanItems` before reaching `reconcileItems`. Incompatible-units insert creates a SECOND pantry_items row with identical `(canonical_id, source_location)` — the dedup index on `(profile_id, canonical_ingredient_id, source_location)` must NOT be UNIQUE; it's a lookup index only. (The decision above calls out multi-row explicitly.)

## 14. Validation Architecture

Test framework already in place: **Vitest 4.1.4** (`packages/server/package.json`). Command: `pnpm --filter @dinnertime/server test`. Migration harness exists at `packages/server/tests/migrations.test.ts`. TypeScript check: `npx tsc --noEmit -p packages/server` and `-p apps/mobile`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | none (Vitest defaults); tests live next to code in `__tests__/` |
| Quick run command | `pnpm --filter @dinnertime/server test -- --run` |
| Full suite command | `pnpm test && npx tsc --noEmit -p packages/server && npx tsc --noEmit -p apps/mobile` |
| Phase gate | All above green + Maestro smoke on iOS sim (`apps/mobile/.maestro/scripts/uat.sh smoke`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-06 | canonical_ingredients table + unique canonical_name | migration | `pnpm --filter @dinnertime/server test -- --run tests/migrations.test.ts` | Wave 0 (extend) |
| REQ-07 | canonicalResolver exact → alias → fuzzy → candidate | unit | `pnpm --filter @dinnertime/server test -- --run src/services/__tests__/canonicalResolver.test.ts` | Wave 0 |
| REQ-08 | Seed loads ~300 rows on migration | integration | migration test counts `SELECT COUNT(*) FROM canonical_ingredients` | Wave 0 |
| REQ-09 | Unknown name creates candidate row | unit | canonicalResolver.test — `expect(matchType).toBe('candidate_created')` | Wave 0 |
| REQ-10 | canonical.category FK used | unit | pantry.test — reconcile stores canonical.category not item.category | Wave 0 (extend existing) |
| REQ-11 | canonical_category_override per user | integration | pantry.test — insert override, verify merged read | Wave 0 |
| REQ-12 | ~2000-3000 aliases loaded | integration | migration test counts aliases | Wave 0 |
| REQ-13 | Dedup = (canonical_id, source_location) | unit | pantry.test — rescan same canonical same location merges | Wave 0 (REWRITE existing) |
| REQ-14 | Fuzzy fallback only when exact miss | unit | canonicalResolver.test ordering | Wave 0 |
| REQ-15 | 4 scan flows reach reconcileItems | integration | routes/__tests__/pantry.test.ts — exercise /scan, /scan/batch, /receipt, /instacart → all end at reconcileItems (spy) | Wave 0 (extend) |
| REQ-16 | quantity JSONB shape on insert | unit | pantry.test asserts `{value,unit,system}` on inserted row | Wave 0 |
| REQ-17 | units.ts conversions | unit | `src/services/__tests__/units.test.ts` — tbsp↔tsp, oz↔lb, incompatible=null | Wave 0 |
| REQ-18 | Aggregation on re-scan sums values | unit | pantry.test — rescan doubles quantity when compatible | Wave 0 |
| REQ-19 | field_confidence propagates to scan_events | integration | routes test — POST /scan writes scan_events row with field_confidence jsonb | Wave 0 |
| REQ-20 | pantry_items.canonical_ingredient_id nullable FK | migration | migration test schema assertion | Wave 0 (extend) |
| REQ-21 | scan_events append-only, RLS, user-scoped | integration | migration test — UPDATE fails (no policy); SELECT filtered by user_id | Wave 0 |
| REQ-22 | RLS on canonical_category_override + scan_events | integration | same as above, tested per table | Wave 0 |
| REQ-23 | Forward-only — legacy NULL canonical_ingredient_id works | integration | routes test — GET /pantry returns both old + new rows | Wave 0 (extend) |

Mobile UI (§ 12 inline confidence): snapshot via component test (`apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx` — extend) + Maestro smoke on sim to visually verify dashed underline renders.

### Sampling Rate
- **Per task commit:** `pnpm --filter @dinnertime/server test -- --run` + `npx tsc --noEmit -p packages/server`
- **Per wave merge:** full server vitest + both tsc + mobile vitest (`pnpm --filter @dinnertime/mobile test -- --run`)
- **Phase gate:** full suite green + Maestro smoke flow on iOS sim

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/canonicalResolver.test.ts` — new file covering REQ-07/09/14
- [ ] `packages/server/src/services/__tests__/units.test.ts` — new file covering REQ-17
- [ ] `packages/server/tests/migrations.test.ts` — extend for REQ-06/08/12/20/21/22 (new migrations + seed counts)
- [ ] `packages/server/src/services/__tests__/pantry.test.ts` — REWRITE dedup tests for REQ-13, extend for REQ-10/11/16/18
- [ ] `packages/server/src/routes/__tests__/pantry.test.ts` — extend for REQ-15/19/23 (scan_events assertion + all-flows convergence + legacy NULL rows)
- [ ] `apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx` — extend for § 12 inline confidence snapshot
- [ ] `.maestro/scripts/uat.sh smoke` re-run after mobile changes

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** all edits flow through a GSD command. Planner should structure work into GSD plans under this phase.
- **Backend:** Node 22 + Hono + TypeScript. Supabase client on backend uses service-role via middleware (`src/middleware/auth.ts`).
- **AI stack:** All vision calls MUST route through `getClientFor(task)` (`src/ai/clientFactory.ts`). 24a does NOT add new task names — 24b introduces `vision.camera/batch/receipt/instacart`. 24a uses existing `vision.pantryScan` task.
- **Database:** Supabase Postgres + RLS. Forward-only migrations, numeric filename prefixes load-bearing.
- **Mobile:** Expo SDK 55, NativeWind 4, expo-router, Zustand + React Query. UI changes must pass Maestro smoke on iOS sim (`.maestro/scripts/uat.sh smoke`).
- **Environment:** server reads root `.env`; mobile reads `apps/mobile/.env` (bundle-time inline for `EXPO_PUBLIC_*`).
- **Testing:** Vitest for unit/integration; Maestro for mobile UAT on iOS sim.
- **No Expo Go:** dev-client only — not relevant to 24a (no new native modules).
- **No direct edits outside GSD:** acknowledged.

## Sources

### Primary (HIGH confidence — in-repo files)
- `packages/server/src/services/itemLocation.ts:20-389` — STATIC_MAP + AI-fallback + hybrid `classifyItems` pattern (template for canonicalResolver).
- `packages/server/src/services/vision.ts:41-308` — tool schema + `normalizeScanItems` + all 3 vision entrypoints.
- `packages/server/src/services/pantry.ts:59-152` — current `reconcileItems` (target of rewrite).
- `packages/server/src/routes/pantry.ts:186-210` — `POST /confirm` convergence point.
- `packages/server/src/ai/taskRouting.ts:26-44` — existing task routes.
- `supabase/migrations/00003_pantry_items.sql` — existing pantry_items schema.
- `supabase/migrations/00009_item_attributes.sql` — Phase 18 dual-write substrate.
- `packages/server/tests/migrations.test.ts` — migration test harness to extend.
- `apps/mobile/src/components/pantry/ReviewItemRow.tsx` — inline confidence UI target.
- Phase 24 CONTEXT.md — all locked decisions.
- Phase 18 CONTEXT.md + 18-RESEARCH.md — hybrid classifier precedent.

### Secondary (MEDIUM)
- Vitest 4.1.4 defaults — matches package.json scripts.

## Metadata

**Confidence breakdown:**
- Migration shape: HIGH — mirrors in-repo patterns.
- canonicalResolver algorithm: HIGH — direct template in `itemLocation.ts`.
- Quantity aggregation: MEDIUM — multi-row fallback is novel; needs careful unit tests.
- Fuzzy cost: MEDIUM — assumes 300 canonical names × 20 scan items; revisit if canonical grows.
- UI treatment: MEDIUM — dashed underline recommendation is opinionated (user discretion zone).

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable in-repo substrate)
