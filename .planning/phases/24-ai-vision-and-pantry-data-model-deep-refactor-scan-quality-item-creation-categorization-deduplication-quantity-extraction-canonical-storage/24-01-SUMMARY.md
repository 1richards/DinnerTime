---
phase: 24-ai-vision-and-pantry-data-model-deep-refactor
plan: 01
subsystem: database
tags: [postgres, supabase, migrations, canonical-ingredients, aliases, jsonb, rls, seed-data, append-only]

# Dependency graph
requires:
  - phase: 03-pantry-core
    provides: pantry_items table (profile_id, normalized_name, source_location, confidence, status, timestamps)
  - phase: 18-ai-auto-location
    provides: LOCATION_STATIC_MAP (71 entries) — canonical seed default_source_location aligns against it; item_attributes JSONB column persists unchanged; item_override_events append-only pattern mirrored here
provides:
  - canonical_ingredients table (global-read, service-role-write, 366 seed rows, status enum)
  - ingredient_aliases table (1587 seed rows, source enum, FK CASCADE to canonical)
  - pantry_items.canonical_ingredient_id nullable FK (legacy rows stay NULL)
  - pantry_items dedup index (profile_id, canonical_ingredient_id, source_location) — NOT UNIQUE
  - canonical_category_override per-user table (4 RLS policies keyed on auth.uid())
  - scan_events append-only table (RLS SELECT+INSERT only, no pass_number, no FK to pantry_items)
  - pantry_items.quantity as JSONB {value, unit, system} (old NUMERIC quantity + TEXT unit dropped)
affects: [24-02-units, 24-03-canonicalResolver, 24-04-reconcileItems-rewrite, 24-05-vision-tool-schema, 24-06-mobile-ui, 21-pantry-intelligence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forward-only migration with no backfill (test-data directive; legacy NULL canonical_ingredient_id tolerated by downstream services)"
    - "Seed JSON spliced into migration via dollar-quoted string ($seed$[...]$seed$) + DO block + jsonb_array_elements loop — diff-friendly, idempotent via ON CONFLICT DO NOTHING"
    - "Append-only table via RLS construction — declare only SELECT + INSERT policies; omit UPDATE + DELETE to make mutation impossible for authenticated users (first established by 00010_item_override_events.sql)"
    - "Global reference table via RLS construction — FOR SELECT USING (true) + FOR ALL TO service_role — read-open, write-privileged"
    - "Contract test via static SQL regex + live-DB probe (inherited from Phase 18 two-layer migration test pattern)"

key-files:
  created:
    - "supabase/migrations/00011_canonical_ingredients.sql — canonical corpus table + seed DO block (366 rows)"
    - "supabase/migrations/00012_ingredient_aliases.sql — alias corpus table + seed DO block (1587 rows)"
    - "supabase/migrations/00013_pantry_items_canonical_link.sql — canonical_ingredient_id FK + canonical_category_override table + dedup index"
    - "supabase/migrations/00014_scan_events.sql — append-only scan event log with raw/final/field_confidence JSONB"
    - "supabase/migrations/00015_pantry_items_quantity_jsonb.sql — replace NUMERIC quantity + TEXT unit with JSONB {value,unit,system}"
    - "packages/server/src/data/canonicalIngredients.seed.json — 366 curated canonical rows across 10 categories"
    - "packages/server/src/data/ingredientAliases.seed.json — 1587 alias rows (avg 4.3/canonical, 310/366 canonicals have ≥3)"
    - "packages/server/scripts/generate-aliases.cjs — regenerable alias builder (curated table + auto-rules)"
    - "packages/server/scripts/splice-seed-into-migrations.cjs — one-shot splicer from JSON to migration DO blocks"
  modified:
    - "packages/server/src/__tests__/migrations.test.ts — 36 new contract assertions across 6 describe blocks (5 migrations + seed shape)"

key-decisions:
  - "Canonical seed size landed at 366 (target ~300, plan-accepted band 250-400). Distribution: produce 83 / protein 40 / dairy 25 / grain 31 / condiment 41 / beverage 30 / frozen 20 / spice 40 / bakery 14 / other 42. Produce leans heavy because Phase 18 LOCATION_STATIC_MAP concentrated there and we mirrored."
  - "Alias seed landed at 1587 (plan-accepted band 1500-3500). Avg 4.3 aliases per canonical, 310/366 canonicals (85%) have ≥3 aliases. The 56 canonicals below the 3-alias target are predominantly MASS nouns (milk, butter, flour, sugar) that naturally have fewer pluralization/adjective variants — covered by curated entries where useful."
  - "Seed JSON splicing pattern: separate generator script writes JSON to `packages/server/src/data/*.json`; one-shot splicer replaces __*_PLACEHOLDER__ tokens in migration DO blocks. Keeps diffs readable in PRs (seed changes visible in JSON) while letting the migration be self-contained at apply time."
  - "canonical_ingredient_id FK on pantry_items declared as nullable (no NOT NULL constraint) so legacy rows continue working unchanged. Forward-only: Phase 18 test data persists with NULL canonical_ingredient_id; Phase 24 scans populate for new rows."
  - "Dedup index (profile_id, canonical_ingredient_id, source_location) is NOT UNIQUE per 24a-RESEARCH §7 + §13 — incompatible-unit rescans (e.g., 2 cups + 1 lb of flour) intentionally create multiple rows with identical identity tuple. Uniqueness would break the aggregation fallback."
  - "scan_events deliberately omits pass_number column (ROADMAP criterion #3 descoped to post-beta). Table COMMENT uses phrase 'Multi-pass reasoning deliberately descoped' instead of the literal token 'pass_number' to let contract tests enforce column absence via a comment-stripped regex without false-positive matches."
  - "Minor migration edit during Task 3 (COMMENT text in 00014 rewritten to avoid the literal 'pass_number' token) is additive documentation — no schema changes. Committed alongside the test extension that required the rename."

patterns-established:
  - "Seed JSON + migration DO block pattern: author JSON in packages/server/src/data/, splice via helper script, preserve JSON-as-source-of-truth for diff readability"
  - "Global reference table RLS: `FOR SELECT USING (true)` + `FOR ALL TO service_role` (canonical_ingredients, ingredient_aliases)"
  - "Append-only table RLS: declare only SELECT + INSERT policies, omit UPDATE + DELETE (scan_events follows item_override_events precedent)"
  - "Contract test for column absence via comment-stripped regex — lets self-documenting SQL comments reference the descoped field without false-positives"

requirements-completed:
  - "Platform quality (post-v1)"

# Metrics
duration: 13min
completed: 2026-04-19
---

# Phase 24 Plan 01: Canonical Ingredient Substrate Summary

**Five forward-only Supabase migrations (00011-00015) + 366 canonical ingredient seed + 1587 alias seed + 36 contract-test assertions — the data substrate every other Phase 24 plan builds on.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-19T17:31:22Z
- **Completed:** 2026-04-19T17:44:12Z
- **Tasks:** 3 (all autonomous)
- **Files created:** 9 (5 migrations, 2 seed JSON, 2 helper scripts)
- **Files modified:** 2 (migrations.test.ts, 00014_scan_events.sql COMMENT tweak)

## Accomplishments

- **Canonical + alias substrate lands** — 366 canonical ingredients across 10 categories, 1587 aliases (plurals, receipt abbreviations like `evoo`/`oj`/`pb`, adjective prefixes like `organic X`/`fresh X`, brand-neutral variants). Both seeded via JSONB DO-block + `jsonb_array_elements` at migration-apply time; idempotent via `ON CONFLICT DO NOTHING`.
- **Identity-based dedup index ready** — `pantry_items.canonical_ingredient_id` nullable FK + `(profile_id, canonical_ingredient_id, source_location)` non-unique composite index. Downstream `reconcileItems` rewrite (Plan 24-04) will key dedup on this tuple instead of the legacy `(profile_id, normalized_name)` pair.
- **scan_events append-only log** — 7-column table (id, user_id, scan_variant, raw_ai_output, final_items, field_confidence, created_at). RLS declares SELECT + INSERT only; UPDATE/DELETE omitted by construction. No `pass_number` column (criterion #3 explicitly descoped). No FK to pantry_items so events survive pantry deletion for future ML training.
- **Quantity JSONB migration** — old `quantity NUMERIC` + `unit TEXT` dropped; new `quantity JSONB NOT NULL DEFAULT '{"value":1,"unit":"piece","system":"count"}'`. Unlocks Plan 24-02's `units.ts` conversion library and Plan 24-04's aggregation logic.
- **Contract tests cover everything** — 36 new assertions verify column shapes, CHECK enums, indexes (including NOT-UNIQUE check on dedup index), RLS policy presence and absence, FK ON DELETE semantics, seed count bounds (canonical 250-400, alias 1500-3500), alias→canonical referential integrity, and `pass_number` absence outside comments.

## Task Commits

1. **Task 1: Author migrations 00011-00015** — `24db90b` (feat) — 5 migrations with RLS, indexes, CHECK constraints, seed DO-block placeholders
2. **Task 2: Author canonical + alias seed JSONs and splice into migrations** — `be3d8ac` (feat) — 366 canonicals, 1587 aliases, generator script, splicer script, migrations updated in place
3. **Task 3: Extend migrations.test.ts** — `25ff475` (test) — 36 contract assertions + minor 00014 COMMENT text adjustment

**Plan metadata (final commit):** pending after this summary lands.

## Files Created/Modified

**Created:**
- `supabase/migrations/00011_canonical_ingredients.sql` — canonical_ingredients table (global read, service-role write) + 366-row seed via DO block
- `supabase/migrations/00012_ingredient_aliases.sql` — ingredient_aliases table (FK CASCADE to canonical, source enum, UNIQUE triple) + 1587-row seed via DO block with canonical_name→id join
- `supabase/migrations/00013_pantry_items_canonical_link.sql` — pantry_items.canonical_ingredient_id FK (nullable, ON DELETE SET NULL) + dedup index (non-unique) + canonical_category_override table (per-user RLS)
- `supabase/migrations/00014_scan_events.sql` — append-only event log with 4-variant scan_variant CHECK, SELECT+INSERT policies only, no pass_number column
- `supabase/migrations/00015_pantry_items_quantity_jsonb.sql` — drops NUMERIC quantity + TEXT unit, adds JSONB quantity with {value,unit,system} default
- `packages/server/src/data/canonicalIngredients.seed.json` — 366 curated canonical rows
- `packages/server/src/data/ingredientAliases.seed.json` — 1587 alias rows
- `packages/server/scripts/generate-aliases.cjs` — regenerable alias builder (curated overrides + auto-rules for plurals/abbreviations/adjective prefixes)
- `packages/server/scripts/splice-seed-into-migrations.cjs` — idempotent seed-JSON → migration-DO-block splicer

**Modified:**
- `packages/server/src/__tests__/migrations.test.ts` — 6 new describe blocks, 36 assertions across migrations 00011-00015 + seed contract
- `supabase/migrations/00014_scan_events.sql` — COMMENT text rewritten to avoid literal `pass_number` token (wording change only, no schema impact)

## Decisions Made

- **Seed sizing above target, within accepted band.** Canonical 366 (target ~300, band 250-400). Alias 1587 (band 1500-3500). Plan's verify gate explicitly accepts these ranges; focusing on quality + coverage over hitting an exact count.
- **Generator + splicer scripts checked into `packages/server/scripts/`.** Keeps seed JSON re-derivable in a PR review if someone expands coverage — the script is the source of the curated alias table.
- **`packages/server/src/data/` is a new directory.** Mirrors Phase 2 ingredient-data pattern and Phase 18 LOCATION_STATIC_MAP precedent (though LOCATION_STATIC_MAP lives inline in `itemLocation.ts`; we chose JSON to keep PR diffs readable given the 1587-row alias table).
- **`packages/server/src/__tests__/migrations.test.ts` chosen over `packages/server/tests/migrations.test.ts`** (research suggested the latter but file already lived at the former path; vitest config covers both via `src/**/*.test.ts`).

## Seed JSON vs LOCATION_STATIC_MAP alignment

- **51 canonical entries overlap with LOCATION_STATIC_MAP.** Every overlap agrees on `default_source_location` (0 mismatches). Cross-checked via a Node probe that parsed `itemLocation.ts` and diffed against the canonical seed.
- **Canonicals NOT in LOCATION_STATIC_MAP** use the following default-picking rules per plan Task 2 instructions: dairy/meat/fresh-produce → fridge; frozen-prefixed → freezer; shelf-stable/canned/dry → pantry.
- **Judgment calls documented inline.** Examples: `tomato` → pantry (matches static map; ripe tomatoes counter-default), `cherry tomato` → fridge (small fresh produce in containers), `red wine` → pantry vs `white wine` → fridge (US serving convention).

## Alias expansion density per canonical

Curated table emphasizes high-traffic ingredients (chicken breast 6 aliases, olive oil 5, ground beef 7, peanut butter 7, greek yogurt 6). Auto-rules contribute plural + receipt-abbreviation + organic/fresh prefixes on top. Canonicals below the 3-alias target are predominantly MASS nouns (milk, butter, flour, sugar, salt, rice, water, coffee, tea) that the pluralizer deliberately skips — MASS table lives at the top of `generate-aliases.cjs` and can be adjusted if later signals show scan coverage gaps.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration 00014 COMMENT text included the literal `pass_number` token**
- **Found during:** Task 3 (migration contract tests)
- **Issue:** The `00014_scan_events.sql` table COMMENT originally read "... No pass_number (criterion #3 descoped)". A contract assertion that scan_events does NOT include a pass_number column (criterion #3) would false-positive match on this self-documenting text. Stripping `--` line comments before matching (implemented in the test helper) handles `-- ...` lines, but `COMMENT ON TABLE ... IS '...'` is an executable SQL statement, not a line comment, so it remains visible to the regex.
- **Fix:** Rewrote the COMMENT string to "Multi-pass reasoning (criterion #3) deliberately descoped." — preserves the documentation intent without using the literal column-name token.
- **Files modified:** `supabase/migrations/00014_scan_events.sql` (COMMENT line only, no schema changes)
- **Verification:** Full migrations.test.ts suite passes (36/36 new assertions green).
- **Committed in:** `25ff475` (Task 3 commit — bundled with the test extension that required the wording tweak)

---

**Total deviations:** 1 auto-fixed (Rule 1 wording bug)
**Impact on plan:** Cosmetic. No schema, behavior, or interface changes. Test contract clarity improved.

## Issues Encountered

- **Initial alias generator had a syntax typo** — `'rolled oats',` as a bare JS array element in an object-literal CURATED table caused a SyntaxError. Fixed inline by replacing with `'rolled oats': [...]` and running the generator to completion. Output: 1587 rows.
- **Pre-existing test failures in the broader `@dinnertime/server` suite** — `taskRouting.test.ts > env.GOOGLE_API_KEY throws when unset` fails on main both before and after this plan's work (verified via stash/unstash). Out of scope for Plan 24-01 per SCOPE BOUNDARY rule. Logged here for awareness; will be addressed by a future tooling plan.
- **Parallel auto-chain activity observed during execution** — commits `9bc1a98` (test 24-02 RED), `e293f54` (feat 24-02 GREEN), `d60b47a` (docs 24-02 SUMMARY), `8e26d3d` (test 24-03 RED), `2fe9a57` (feat 24-03 GREEN), `a7b0e05` (docs 24-03 SUMMARY) appeared on main alongside our 24-01 work. Those commits are scoped to `packages/server/src/services/units.ts`, `canonicalResolver.ts`, and their tests — zero overlap with the migrations + seed JSON + migrations.test.ts surface area of this plan. No conflicts.

## User Setup Required

None - no external service configuration required. Seed data ships in the migrations; no manual Supabase console steps needed. Local dev gets the new tables + seed on next `supabase db push`.

## Next Phase Readiness

**Immediately unblocked:**
- **Plan 24-02 (units.ts)** — already landed in parallel; can freely read `pantry_items.quantity` as JSONB shape.
- **Plan 24-03 (canonicalResolver)** — already landed in parallel; can query `canonical_ingredients` + `ingredient_aliases` tables.
- **Plan 24-04 (reconcileItems rewrite)** — can key dedup on `(profile_id, canonical_ingredient_id, source_location)` and call `units.add()` on JSONB quantities.
- **Plan 24-05 (vision tool schema + scan_events write)** — can INSERT into `scan_events` with the defined JSONB shape.
- **Plan 24-06 (mobile UI)** — no dependency on this plan (UI consumes Plan 24-05 API shape).

**Known open items downstream:**
- The Phase 18 dual-write pattern (`item_attributes.source_location`) persists unchanged by this plan. Plan 24-04 should add `item_attributes.canonical_ingredient_id` as the third dual-write slot (transitional — can be phased out once all readers migrate to the FK column).
- Candidate auto-creation path (unknown scan name → `canonical_ingredients` row with `status='candidate'`) requires service-role credentials. The service-role write policy is in place; Plan 24-03's `canonicalResolver` implementation must use a supabase client with service-role auth for the INSERT.

## Self-Check: PASSED

Verified post-SUMMARY:

- `supabase/migrations/00011_canonical_ingredients.sql` — FOUND
- `supabase/migrations/00012_ingredient_aliases.sql` — FOUND
- `supabase/migrations/00013_pantry_items_canonical_link.sql` — FOUND
- `supabase/migrations/00014_scan_events.sql` — FOUND
- `supabase/migrations/00015_pantry_items_quantity_jsonb.sql` — FOUND
- `packages/server/src/data/canonicalIngredients.seed.json` — FOUND (366 rows)
- `packages/server/src/data/ingredientAliases.seed.json` — FOUND (1587 rows)
- `packages/server/src/__tests__/migrations.test.ts` — MODIFIED (36 new assertions)
- Commit `24db90b` — FOUND
- Commit `be3d8ac` — FOUND
- Commit `25ff475` — FOUND
- Plan verify gate: 5 migration files present, seed counts within bounds, 36/36 migration contract tests green.

---
*Phase: 24-ai-vision-and-pantry-data-model-deep-refactor*
*Completed: 2026-04-19*
