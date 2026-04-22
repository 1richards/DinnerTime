# Phase 24: AI Vision & Pantry Data-Model Deep Refactor - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Formalize the pantry data model into a canonical-ingredient + aliases + immutable event-log substrate, make deduplication identity-based, model quantity as value+unit+system, and (in 24b) add a prompt eval harness with fixture-based accuracy metrics and model routing per variant. Every existing scan flow (camera, batch, receipt, Instacart) adopts the new path.

**Split into two deliverable halves:**
- **Phase 24a — Data-model + dedup (criteria 6–23):** Canonical schema, identity dedup, quantity semantics, scan_events log, reconcileItems rewrite, minimum inline confidence UI. This half unblocks Phase 21 immediately.
- **Phase 24b — Vision quality (criteria 1–2, 4–5, 24–26):** Versioned prompt files, eval harness with golden fixtures, fixture-based accuracy metric, retry/fallback, model routing per variant. Depends on 24a for scan_events shape.

**Runs BEFORE Phase 21** per EXECUTION-PLAN.md. Phase 24's identity-based dedup replaces Phase 21's planned fuzzy-string dedup — running 21 first would build throwaway code.

**DESCOPED in this phase (criterion 3 — multi-pass reasoning):** Deferred to a post-beta investigation phase when real beta data shows where multi-pass is actually needed. scan_events schema does NOT include a `pass_number` column.

**NOT in scope:**
- Fuzzy matching as a primary path — canonical + aliases is the primary; fuzzy is fallback-only per criterion #14
- Multi-pass vision reasoning — deferred post-beta
- User-editable canonical admin UI — code-seeded only in this phase
- User rules UI / staples list — Phase 21 owns (this phase prepares the substrate)
- Full rollback mechanism — test data only; forward-only migration accepted
- Existing pantry data preservation / backfill — all test data; legacy rows get `canonical_ingredient_id = NULL` and stay that way

</domain>

<decisions>
## Implementation Decisions

### Phase chunking (split 24a + 24b)
- **24a ships:** canonical_ingredients + ingredient_aliases tables, `pantry_items.canonical_ingredient_id` FK, identity-based dedup (`canonical_id + source_location`), quantity as `{value, unit, system}`, unit conversion library, pantry quantity aggregation, scan_events immutable event log, reconcileItems rewrite across all 4 scan flows, per-field confidence stored on scan_events, minimum inline low-confidence UI treatment on review screen.
- **24b ships:** versioned prompt `.md` files in `packages/server/src/prompts/`, eval harness with golden fixtures + accuracy metric, retry/fallback (structured-tool → text parse → clear user error, never silent empty), model routing per scan variant through Phase 11 AIClient abstraction.
- **24b depends on 24a** for the scan_events shape (field_confidence JSONB). 24a depends on nothing in this phase.

### Execution order
- **Phase 24 (both halves) runs BEFORE Phase 21.** Confirms EXECUTION-PLAN.md sequencing. Phase 21's fuzzy dedup is NOT shipped — Phase 24a delivers real identity dedup; Phase 21 re-scopes around rules UI + staples + presentation.

### Canonical ingredient table (24a)
- **Seed size: ~300 curated entries**, hand-picked across produce (~80), proteins (~40), dairy (~20), grains (~30), condiments (~40), beverages (~30), frozen (~20), spices (~40). Maps to/extends the ~150-entry Phase 18 LOCATION_STATIC_MAP.
- **Seed lives as JSON** in `packages/server/src/data/canonicalIngredients.seed.json` (mirror of Phase 2's ingredient data file pattern). Migration reads JSON and INSERTs on first run. Diff-friendly in PRs.
- **Schema:** `canonical_ingredients(id uuid pk, canonical_name text unique, category text, default_source_location text, status text default 'active')`. `status` accepts `'active' | 'candidate' | 'merged' | 'deprecated'` — candidate entries surface in Phase 21 admin UI for promotion.
- **Category is a property of the canonical row** (criterion #10). Per-user category override stored separately (on canonical, keyed by user_id — matches criterion #11).
- **Mutations:** code-seeded only in this phase. Learning RPC for Phase 21 to consume: when unknown scan names recur (≥ 3 times per user, TBD threshold), they become `status='candidate'` canonical rows for admin review. No admin UI ships in this phase.

### Aliases table (24a)
- **Schema:** `ingredient_aliases(id uuid pk, canonical_ingredient_id uuid fk, alias_name text, source text, confidence float, created_at timestamptz default now())`. `source` enum: `'seed' | 'user_correction' | 'ai_learning' | 'admin'`.
- **Seed size: ~2000-3000 alias rows**, 3-10 per canonical. Includes plural variants, common abbreviations (`chkn brst`), common adjective prefixes (`organic`, `boneless skinless`), common brand-neutral variants. Seed lives in `packages/server/src/data/ingredientAliases.seed.json`.
- **Learning pipeline:** user overrides on review screen create new `user_correction` alias rows (Phase 18 `item_override_events` is the raw signal source; Phase 21 consumes to propose aliases).
- **Lookup: exact-match first, then fuzzy fallback.** Fuzzy matching (Levenshtein or small embedding lookup) is the FALLBACK when no exact alias/canonical match exists — becomes the "previous Phase 21 fuzzy helper" per criterion #14.

### Quantity model (24a)
- **Three-field shape:** `{value: number, unit: string, system: 'count' | 'imperial-weight' | 'imperial-volume' | 'metric-weight' | 'metric-volume' | 'custom'}`. Stored as JSONB on pantry_items (new `quantity JSONB` column, replaces existing `quantity` float + `unit` text if they exist).
- **Unit conversion library:** a new in-repo module `packages/server/src/services/units.ts`. Supports cooking-relevant conversions (cups↔tbsp↔tsp↔ml, oz↔lb↔g↔kg, pieces stays count). Does NOT attempt density conversions (volume↔weight). No external dependency — small, readable, unit-tested.
- **Aggregation on re-scan:** same canonical + compatible units → `value` sums, `unit` stays (converts to most-common unit if mixed). Incompatible units (e.g., "2 cups" + "1 lb" of the same canonical) → stored as MULTIPLE pantry_items rows, flagged with a UX hint for user to reconcile.

### Deduplication (24a)
- **Identity = `canonical_ingredient_id + source_location`** (criterion #13). Not a tuple of strings; a tuple of foreign keys.
- **reconcileItems rewrite:** looks up `canonical_ingredient_id` via alias/canonical lookup on scan output, then matches existing pantry_items on `(canonical_ingredient_id, source_location)`. Match = update (last_seen_at + quantity merge). No match = insert new row.
- **Batch scan dedup (Phase 14) uses canonical IDs** — merging across photos is deterministic instead of fuzzy.
- **Fuzzy fallback** kicks in only when canonical lookup misses (new unknown name). Creates a `status='candidate'` canonical automatically with the raw name, so future scans of the same string match on identity.

### scan_events immutable log (24a)
- **Schema:** `scan_events(id uuid pk, user_id uuid, scan_variant text, raw_ai_output jsonb, final_items jsonb, field_confidence jsonb, created_at timestamptz)`. `scan_variant` enum: `'camera' | 'batch' | 'receipt' | 'instacart'`.
- **field_confidence JSONB shape:** `[{item_index: 0, name: 0.92, quantity: 0.85, unit: 0.7, category: 0.98}, ...]`. Flexible — future fields slot in without migration.
- **Append-only.** No UPDATE/DELETE policies. RLS: `user_id = auth.uid()` on SELECT + INSERT only.
- **Intentionally NOT related** to `pantry_items` via FK — scan events survive pantry item deletion for future ML training.

### Migration strategy (24a)
- **Forward-only, no backfill.** Existing pantry_items are test data per user directive. New column `canonical_ingredient_id` is nullable; legacy rows stay NULL. New scans resolve canonical and populate the FK.
- **No rollback scripts** beyond basic schema-drop down-migration. Acceptable because data loss on pre-Phase-24 rows is acceptable.
- **No migration banner, no user-visible "cleanup" UX, no lazy-match-on-access backfill job.** Simplest possible migration.
- **Unknown names during ongoing scans:** auto-create candidate canonical (`status='candidate'`) with the raw name + flag for Phase 21 admin review. Scan completes normally; pantry_item points to the candidate canonical.

### Per-field confidence UI (24a)
- **Minimum inline treatment** on review screen: fields with confidence < 0.7 get a subtle visual marker (dashed underline on the field value or a small caution SF Symbol in the row). Uses Phase 19 tokens; no new design primitives needed. Ships for name, quantity, unit, category fields.

### Prompt files + eval harness (24b)
- **Prompt files live as `.md`** in `packages/server/src/prompts/` (one per scan variant: `fridge_scan.md`, `receipt_scan.md`, `instacart_scan.md`, `batch_scan.md`). Imported as string literals at runtime. Versioned via git history.
- **Eval harness design: deferred to 24b research.** Researcher picks between Git LFS in main repo vs separate fixtures repo vs Supabase bucket based on actual fixture sizes + CI time budget + photo sensitivity.
- **Accuracy metric:** per-fixture expected-output JSON + a runner that invokes the prompt against each fixture and scores match rate. PR fails if any fixture drops below its baseline. Exact scoring shape + threshold: 24b planning.

### Model routing per variant (24b)
- **All vision calls route through Phase 11 `getClientFor(task)`.** Task names per variant: `vision.camera` / `vision.batch` / `vision.receipt` / `vision.instacart`. Each task can map to a different model (Anthropic Sonnet 4.6 for fridge/batch — vision-heavy; Haiku for receipt OCR-style — cheaper).
- **Retry/fallback behavior (criterion #4):** structured-tool failure → fallback text parse → clear user error surfaced to mobile (not silent empty). Error surface uses Phase 15 ErrorState primitive.

### Claude's Discretion
- Exact canonical ingredient seed list (~300 entries) — propose during planning; user reviews before merge.
- Exact alias seed list (~2000-3000 entries) — propose during planning; format is well-defined.
- Threshold for recurring unknown names → candidate canonical promotion (3? 5? per user, per global?) — tune in 24a planning; default 3 per user.
- Unit conversion module architecture: pure-function table vs small class — Claude picks.
- Exact visual treatment of < 0.7 confidence marker (dashed underline vs chip vs icon) — Claude picks using Phase 19 tokens.
- scan_events retention policy (forever? N months?) — default forever; revisit if storage becomes a concern.
- 24b: eval harness fixture storage mechanism — researcher evaluates LFS vs submodule vs Supabase bucket in 24b research.
- 24b: accuracy metric scoring formula (exact match vs token F1 vs weighted by field) — 24b planning.

</decisions>

<specifics>
## Specific Ideas

- **"It's all test data"** — the user explicitly waived all migration, backfill, rollback, and banner concerns for pre-Phase-24 pantry rows. Planner should NOT invest any engineering in preserving legacy data.
- **24a unblocks Phase 21.** Phase 21's fuzzy dedup is dead on arrival — canonical+alias identity dedup supersedes it. Phase 21 re-scopes to rules UI + staples + presentation consuming the canonical schema.
- **Multi-pass reasoning is DESCOPED.** scan_events schema does NOT include `pass_number`. Post-beta investigation phase owns this when real data exists.
- **Categorization as canonical property** (criterion #10) — when a user overrides olive oil's category once, it applies everywhere (per user). The override lives on the canonical via a per-user link, not on individual pantry_items.
- **Prompt files in `.md`** to keep PR diffs readable. Version is git history; no separate version strings.
- **Candidate canonical pattern** — unknown scan names auto-create `status='candidate'` rows so no scan ever fails. Phase 21 admin promotes them to `'active'` or merges with existing canonicals.
- **Alias learning pipeline feeds on Phase 18 `item_override_events`** — that table was shipped exactly for this purpose; Phase 24a documents the read path, Phase 21 wires the UI.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/server/src/services/itemLocation.ts` (Phase 18) — STATIC_MAP + AI fallback + `classifyItems(items, aiClient)` shape. EXACT pattern for new `canonicalResolver.ts` (STATIC canonical table + alias lookup + fuzzy fallback + candidate auto-creation).
- `packages/server/src/services/ingredientCategories.ts` (Phase 8) — similar STATIC_MAP + Haiku fallback pattern.
- `packages/server/src/services/vision.ts` — extend tool schema to include `{name, quantity: {value, unit, system}, category, confidence: {name, quantity, unit, category}}` per item.
- `packages/server/src/services/identifyReceiptItems.ts` (Phase 13) — receipt + Instacart variants. Same tool-schema extension applies.
- `packages/server/src/services/pantry.ts` — `reconcileItems` function gets the canonical_id path; currently uses Phase 18 dual-write to item_attributes.
- `packages/server/src/data/` (new) — seed JSON files live here.
- Phase 18 `item_attributes` JSONB column — substrate persists; Phase 24a adds `canonical_ingredient_id uuid` as a proper column alongside.
- Phase 18 `item_override_events` table — raw signal source for alias learning pipeline (consumed by Phase 21 UI, read here for candidate generation).
- Phase 15 `ErrorState` primitive — 24b criterion #4 error surfacing uses this.
- Phase 19 `Chip` + `SymbolIcon` + typography tokens — minimum per-field confidence UI treatment uses these.

### Established Patterns
- Supabase migration pattern (prior 10 migrations) — `00011_canonical_ingredients.sql` + `00012_ingredient_aliases.sql` + `00013_pantry_items_canonical_fk.sql` + `00014_scan_events.sql` + `00015_quantity_jsonb.sql` follow shape.
- RLS gating via `user_id = auth.uid()` (all user-scoped tables); canonical_ingredients + ingredient_aliases are READ-all/WRITE-service-role (global tables).
- AIClient abstraction (Phase 11) — all vision calls route through `getClientFor(task)`. Task names extend to `vision.{variant}` for 24b model routing.
- Dual-write pattern (Phase 18 source_location + item_attributes) — Phase 24a adds a THIRD write: canonical_ingredient_id as FK column + item_attributes.canonical_ingredient_id for legacy shape compat (can phase out after 24a ships).
- Seed file pattern (Phase 2 ingredient data, Phase 8 STATIC_MAP, Phase 18 LOCATION_STATIC_MAP) — `packages/server/src/data/canonicalIngredients.seed.json` mirrors these.

### Integration Points
- `supabase/migrations/00011_canonical_ingredients.sql` through `00015_*` — new migrations.
- `packages/server/src/data/{canonicalIngredients, ingredientAliases}.seed.json` — new seed files.
- `packages/server/src/services/{canonicalResolver, units}.ts` — new services.
- `packages/server/src/services/{vision, identifyReceiptItems, pantry}.ts` — extended for canonical_id path + quantity JSONB + confidence JSONB.
- `packages/server/src/routes/pantry.ts` — scan routes return canonical_ingredient_id + field_confidence + quantity shape per item.
- `apps/mobile/src/stores/pantryStore.ts` — ScanResult type extends; store passes through new fields.
- `apps/mobile/src/components/pantry/ReviewItemRow.tsx` — minimum per-field confidence UI treatment (dashed underline OR caution icon on < 0.7 fields).
- `packages/server/src/prompts/` (new directory) — 24b prompt .md files.
- `packages/server/tests/fixtures/` OR separate fixtures repo (24b researcher decides) — golden scan images.

</code_context>

<deferred>
## Deferred Ideas

- **Multi-pass vision reasoning** (ROADMAP criterion #3) — post-beta investigation phase owns. Real beta data will surface where multi-pass actually helps.
- **Admin UI for canonical ingredient mutations** — future phase (post-launch admin tooling).
- **Density-based volume↔weight conversion** (e.g., "1 cup flour" → "125g flour") — deliberately out; unit conversion stays dimension-pure.
- **Embedding-based alias matching** — Phase 24a uses exact-match + Levenshtein fuzzy. Embedding lookup (e.g., OpenAI/Gemini embedding against canonical corpus) is a potential Phase 24.x or post-beta enrichment.
- **Global canonical corpus expansion via USDA FoodData Central** — considered but not shipped. Would add ~1000+ entries; audit cost + noise not worth it for private-beta. Revisit at public-launch scale.
- **Active migration/backfill of pre-Phase-24 pantry items** — user directive "it's all test data" waives this entirely.
- **Learning pipeline that auto-promotes candidates to active** — Phase 21 consumes `status='candidate'` canonicals + Phase 18 override events. Automatic promotion (without human review) is explicitly NOT shipped.
- **Rollback tooling beyond schema-drop** — forward-only accepted.
- **scan_events retention automation** (TTL, archival) — default forever; revisit when storage is a real concern.
- **Per-field confidence visible UI polish** beyond minimum treatment — Phase 19 design system already defines tokens; deeper polish can come in a future UI pass.
- **Multi-user shared canonical preferences** (household-wide category overrides) — each user has their own canonical_category_override for now; household-level override is a future feature.

</deferred>

---

*Phase: 24-ai-vision-and-pantry-data-model-deep-refactor-scan-quality-item-creation-categorization-deduplication-quantity-extraction-canonical-storage*
*Context gathered: 2026-04-19*
