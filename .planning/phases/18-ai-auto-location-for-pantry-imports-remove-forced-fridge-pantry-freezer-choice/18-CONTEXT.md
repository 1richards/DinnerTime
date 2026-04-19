# Phase 18: AI Auto-Location for Pantry Imports - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the forced fridge/pantry/freezer choice as a gating step on every pantry import flow (camera scan, batch scan, receipt scan, Instacart import). The AI infers `source_location` per item from ingredient context. The review screen exposes a per-item location chip for easy override. Ship a forward-compatible JSONB attribute column on `pantry_items` and an append-only `item_override_events` table to seed the downstream taxonomic system (Phase 21 rules UI, Phase 24 canonical ingredient refactor).

**NOT in scope:**
- User-editable location rules UI — Phase 21 owns this ("user-defined scan rules", "staples list", Settings list view)
- Canonical ingredient table / aliases / quantity semantics refactor — Phase 24
- Learning from overrides (consuming `item_override_events` to adjust future AI behavior) — Phase 21 consumes this table
- Bulk multi-select edit mode on review screen — deferred
- New location options beyond fridge/pantry/freezer — schema fixed at these three

</domain>

<decisions>
## Implementation Decisions

### LocationPicker removal (all scan flows)
- **Camera scan (single-photo):** LocationPicker removed entirely. Tap camera FAB → straight to camera. AI classifies per item on photo analysis.
- **Batch scan (multi-photo, Phase 14):** Session-level location lock REMOVED. AI classifies each item across all photos independently. Matches ROADMAP #5 ("distribute across all three locations in one session").
- **Receipt scan:** Phase 13's hardcoded `source_location='pantry'` replaced with per-item AI fan-out. Dairy→fridge, frozen→freezer, shelf-stable→pantry automatically.
- **Instacart import:** Same treatment as receipt — unified code path. AI per-item classification.

### Hybrid classifier (AI + static rules)
- **Static rule layer first:** Ship a curated `name → location` map in the backend (analogous to Phase 8's `ingredientCategories` STATIC_MAP pattern). Covers the ~150 most common ingredients as a fast, free, deterministic path.
- **AI fallback for unknowns:** When the static map doesn't match, fall back to Claude for classification. Keeps cost low + prompt focused.
- **Unified across flows:** Same hybrid classifier serves camera scan, batch scan, receipt, Instacart. No per-flow duplication.
- **Where the classifier lives:** Backend service (e.g., `packages/server/src/services/itemLocation.ts`) exposed via existing scan/receipt/Instacart endpoints. Consumes the AI result post-identification.
- **User-editable rules:** OUT of scope for Phase 18. Phase 21 wraps a Settings UI around these rules. Phase 18's static map is static.

### Review screen chip UX
- **Chip appearance:** SF Symbol + label ("Fridge" / "Pantry" / "Freezer"). Icons already adopted in Phase 15 (`snowflake.circle.fill`, `archivebox.fill`, `snowflake`). Uses Phase 19 `Chip` component with `kind="display"`.
- **Tap interaction:** Tap opens a **3-choice bottom sheet** (fridge/pantry/freezer) with the current value highlighted. User taps new value; sheet dismisses.
- **No special visual treatment for AI-classified vs user-overridden:** Once committed, chips look identical regardless of provenance. Override provenance is captured in `item_override_events` table, not the UI.
- **No special visual treatment for low-confidence classifications:** AI always picks one value. If it's wrong, user overrides via chip. No blockers, no "?" indicators.
- **Per-item only:** No bulk multi-select edit in this phase. User taps each item to change.

### Data model (forward-compatible)
- **New column: `pantry_items.item_attributes JSONB NOT NULL DEFAULT '{}'::jsonb`.** Phase 18 writes `{"source_location": "fridge"}` as part of item creation/update. No Zod validation at the application layer — the column is docstring-documented expected-shape for now. Phase 24's data-model refactor formalizes the schema.
- **Keep existing `pantry_items.source_location` column** in parallel. Phase 18 writes the same value to both (dual-write) so mobile UI that reads the column directly keeps working. Phase 24 migrates readers to `item_attributes.source_location` and drops the dedicated column.
- **New table: `item_override_events`.** Append-only, RLS-gated, minimal shape:
  ```sql
  create table item_override_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    item_name text not null,
    ai_location text not null,        -- 'fridge' | 'pantry' | 'freezer'
    user_location text not null,       -- 'fridge' | 'pantry' | 'freezer'
    created_at timestamptz not null default now()
  );
  ```
  RLS: `user_id = auth.uid()` on SELECT/INSERT. No UPDATE/DELETE (immutable).
- Phase 21 consumes this table to derive user-specific rules. Phase 24 may add `canonical_ingredient_id` later.

### Instacart fan-out UX
- **Same review screen pattern across camera/receipt/Instacart.** List view, each item row has a location chip. User sees the fan-out naturally as they scroll.
- **No summary bar, no grouped-by-location sections.** Keeps Instacart review visually consistent with camera scan review.

### Existing pantry items
- **Migration strategy: Claude's Discretion during planning.** Default is "leave them alone" — existing items keep their current `source_location` and get `item_attributes='{}'` or `{"source_location": <existing>}` via dual-write. Phase 24's canonical-ingredient refactor will naturally re-classify on next scan. Planner may propose a lazy re-classify on user edit; do not ship an app-open background sweep without explicit approval.

### Claude's Discretion
- Exact static-map ingredient list (~150 entries for hybrid classifier fast path) — Claude can seed during implementation and expand via usage.
- AI prompt wording for location classification (tool schema addition to existing `vision.pantryScan` / receipt / Instacart tool shapes).
- Existing-item migration approach (default: leave alone; planner may propose lazy re-classify).
- Whether the dual-write to `source_location` and `item_attributes.source_location` happens in the service layer or a Postgres trigger.
- Bottom sheet component pattern (reuse existing `BulkImportSheet`/`SwapSheet` Modal pattern from prior phases; no new dependency).
- Confidence threshold (if Claude adds one at all — not user-facing in Phase 18, but useful for telemetry). Default to 0.7 if implemented.

</decisions>

<specifics>
## Specific Ideas

- **"Taxonomic system beyond location":** The `item_attributes` JSONB column is deliberately forward-compatible for future metadata (brand, size tier, freshness indicator, custom tags). Phase 18 only writes `source_location`; Phase 24 formalizes the schema and adds more fields.
- **The static map should be small + honest.** Not a comprehensive ingredient database — that's Phase 24's canonical_ingredients. Just the common, unambiguous cases ("milk" → fridge, "pasta" → pantry, "ice cream" → freezer) where a rule beats an AI round-trip.
- **Pattern reference for the hybrid:** Phase 8's `ingredientCategories` STATIC_MAP + Haiku fallback is the template. Same factoring: a small static map in server code, AI fallback for unknowns, both return the same shape.
- **AI should "just handle" ambiguous items.** Olive oil, butter (salted vs unsalted), eggs (some cultures refrigerate, some don't) — AI picks the most-common-US answer. User overrides in 1 tap if wrong. No prompts, no warnings.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/server/src/services/vision.ts` — current `identifyItems` + `identifyItemsBatch` Claude calls. Tool schema adds `source_location` field per item.
- `packages/server/src/services/identifyReceiptItems.ts` (Phase 13) — receipt/Instacart hybrid service. Same tool-schema extension applies.
- `packages/server/src/services/ingredientCategories.ts` (Phase 8) — TEMPLATE pattern: STATIC_MAP + Haiku fallback + hybrid `classifyItems` export. `itemLocation.ts` mirrors this shape exactly.
- `apps/mobile/src/components/ui/Chip.tsx` (Phase 19) — `kind="display"` + `tone` prop for the location chip on review screen.
- `apps/mobile/src/components/ui/SymbolIcon.tsx` (Phase 15) — location SF Symbols already mapped.
- Existing Modal pattern (`SwapSheet`, `BulkImportSheet`, `FilterSheet`) — template for the 3-choice bottom sheet.
- Supabase migration pattern (prior phases) — `item_attributes` JSONB + `item_override_events` table migration follows Phase 3/13 migration shape.

### Established Patterns
- RLS via `user_id = auth.uid()` on user-scoped tables (every phase).
- AIClient abstraction (Phase 11) — Claude calls route through `getClientFor('vision.pantryScan')` / `'vision.receipt')` / `'vision.instacart')`. Extensions land there, not in direct SDK imports.
- Confidence-threshold gating at the store layer (Phase 14 set `0.7` for batch scan item acceptance) — same constant reused.
- Dual-write pattern for schema evolution (Phase 14 did this with `scan_events` table, reused here for `source_location` ↔ `item_attributes`).

### Integration Points
- `pantryStore` (mobile Zustand) — the `startScan` / `startBatchScan` / `startReceiptScan` / `startInstacartImport` actions now populate review items with `source_location` from the server response. Store shape extended with `item_attributes` passthrough.
- `/scan/review.tsx` — review screen. Each item row gains a `LocationChip` that opens the 3-choice sheet.
- `PantryItemCard.tsx` — existing pantry-tab card. Already shows location icon; now gains tap-to-open same sheet for manual overrides post-commit. (Or stays read-only — Claude's Discretion.)
- `LocationPicker.tsx` (Phase 3 component) — **deleted** from camera + batch scan entry points. File itself may stay temporarily for Phase 21 Settings UI to reuse.

</code_context>

<deferred>
## Deferred Ideas

- **User-editable location rules UI** — Phase 21 scope ("user-defined scan rules", "staples list", Settings list view with edit/delete/reorder).
- **Canonical ingredient resolution** — Phase 24 (aliases table, canonical_ingredients, identity-based dedup).
- **Quantity + unit semantics refactor** — Phase 24 (value + unit + unit-system modeling).
- **Consuming `item_override_events`** to learn per-user preferences — Phase 21.
- **Bulk multi-select edit mode** on review screen — future polish phase (Phase 22 Plan Experience or a dedicated pantry polish).
- **Background re-classify sweep of existing pantry_items on app open** — risky mass mutation, not shipped. Phase 24 refactor naturally re-classifies on canonical-ingredient rollup.
- **Additional locations beyond fridge/pantry/freezer** (e.g., counter, spice rack, deep freeze) — would need a roadmap decision. For now, schema is fixed at 3.
- **AI prompt learning from historical overrides (RAG over `item_override_events`)** — Phase 24 canonical-ingredient era or later.
- **Client-side location suggestions before AI round-trip** — not in scope; backend hybrid classifier is the source of truth.

</deferred>

---

*Phase: 18-ai-auto-location-for-pantry-imports-remove-forced-fridge-pantry-freezer-choice*
*Context gathered: 2026-04-18*
