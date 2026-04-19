---
phase: 24-ai-vision-and-pantry-data-model-deep-refactor
plan: 04
subsystem: api
tags: [vision, tool-schema, quantity, field-confidence, scan-result, backward-compat, tdd]

# Dependency graph
requires:
  - phase: 24-02
    provides: "Quantity type + sanitize() defensive coercion (units.ts)"
  - phase: 18-ai-auto-location
    provides: "foodItemsSchema single source of truth; STATIC_MAP post-correction in normalizeScanItems; identifyReceiptItems lives inside vision.ts as a third entrypoint sharing the schema"
provides:
  - "ScanResult.quantity: Quantity (nested {value, unit, system} via units.sanitize)"
  - "ScanResult.fieldConfidence: FieldConfidence (per-field name/quantity/unit/category scores in [0,1])"
  - "ScanResult.confidence preserved as min(fieldConfidence.*) so Phase 14 0.7 threshold gate still works"
  - "foodItemsSchema tool schema: nested quantity object + nested confidence object, required for all three vision entrypoints (identifyFoodItems, identifyFoodItemsBatch, identifyReceiptItems)"
  - "Prompt-string edits (FILTERING_RULES + RECEIPT_FILTERING_RULES) teaching Claude the new shapes in place"
  - "Backward-compat normalizers: legacy flat quantity:number + unit:string and flat confidence:number still accepted (wrapped into new shapes)"
affects:
  - "24-05 (reconcileItems — will consume ScanResult.quantity as Quantity and ScanResult.fieldConfidence to persist scan_events.field_confidence JSONB)"
  - "24-06 (mobile review screen — reads fieldConfidence for < 0.7 inline hints)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nested-object tool schema for per-attribute AI outputs (quantity as {value, unit, system}; confidence as {name, quantity, unit, category}) — validated by JsonSchema's type:'object' + properties + required triple"
    - "Field-level confidence with overall legacy value derived as min(per-field) — preserves existing threshold gates without adding migration burden on downstream consumers"
    - "Defensive normalization pipeline (clamp01 + sanitize + coerceCategory + correctLocation) — every AI field flows through a dedicated sanitizer before reaching reconcileItems"
    - "Backward-compat via raw-shape sniffing (typeof + 'value' in) — same ScanResult output whether AI returns old flat or new nested shapes; lets rollout be atomic without a dual-code-path"

key-files:
  created: []
  modified:
    - "packages/server/src/services/vision.ts — ScanResult extended with Quantity quantity + FieldConfidence fieldConfidence; foodItemsSchema nests quantity + confidence; normalizeScanItems sanitizes via units.sanitize + clamp01; FILTERING_RULES + RECEIPT_FILTERING_RULES gain quantity.system + per-field confidence guidance"
    - "packages/server/src/services/__tests__/vision.test.ts — 40 tests now: 15 new + 25 updated; covers new nested shapes, legacy flat compat, NaN/Infinity/OOR clamping, missing-field defaults (0.5), overall-confidence-as-min invariant, malformed-quantity sanitize path, per-variant prompt guidance"

key-decisions:
  - "Task 2 collapsed into Task 1 (no separate file change) — plan assumed identifyReceiptItems lived in packages/server/src/services/identifyReceiptItems.ts but it has always lived inside vision.ts since Phase 13, sharing foodItemsSchema + normalizeScanItems with the pantry-scan flows. Extending vision.ts already covers receipt + Instacart variants through the single source of truth. Rule 3 (blocking / scope adjustment) deviation documented below."
  - "Overall legacy confidence = Math.min(name, quantity, unit, category) — surfaces the worst-case attribute so Phase 14's 0.7 threshold gate continues to filter items Claude is shaky about. Alternatives considered: average (masks uncertainty); weighted-by-name (ignores the other fields' warnings); drop the field entirely (would break Phase 14 without an in-phase consumer rewrite — out of scope here)."
  - "Missing per-field confidence defaults to 0.5, not 1.0 — plan explicit: 'surface uncertainty rather than hide it.' The downstream UI gate is < 0.7, so 0.5 paints the field with a dashed underline by default when the AI omits it. 1.0 would make missing data look confident, which is actively misleading."
  - "Legacy flat quantity:number wraps to {value: N, unit: flatUnit ?? 'piece', system: 'count'}. Old scans were always piece-style counts (Phase 3 quantity was a plain number); count is the right default system for that legacy shape. Non-count legacy units (e.g. 'lb' strings) will get system='count' — this is acceptable because no legacy data actually persists through to 24-05's aggregation path (the test-data directive means all real aggregation flows use the new nested shape)."
  - "normalizeQuantity sniffs 'value' in raw to detect the new shape — more permissive than checking system/unit (AI could drop those under token pressure and sanitize handles missing fields). A bare number means legacy; any object-with-value means new. Cleanly handles partial objects via units.sanitize."
  - "Prompt strings edited in-place (not moved to packages/server/src/prompts/*.md) — plan explicitly descopes versioned prompt files to 24b. Adding them now would duplicate 24b's research + migration work."
  - "RawScanItem interface added as the AI-tool return type (all-optional fields) so TypeScript preserves the hooks for normalization without leaking Partial<ScanResult> — Partial would make `quantity` optional at the ScanResult level, which is wrong (ScanResult guarantees non-null Quantity post-normalize)."

patterns-established:
  - "Per-field AI confidence: store as {name, quantity, unit, category} at the AI boundary, derive overall = min() for legacy consumers. Future Phase 24.x fields (e.g. confidence in source_location) slot in without breaking existing code — callers reading fieldConfidence.name stay intact."
  - "clamp01 + sanitize composition: every numeric AI field passes through a clamp helper (NaN → 0.5, OOR → [0,1]) and every quantity object passes through units.sanitize. Two tiny helpers that together neutralize every malformed-AI-output class seen in Phase 14 batch scans."
  - "Raw-shape sniffing for backward-compat: when extending an AI tool schema, keep accepting the old shape for N+1 releases by detecting shape via the presence of a key unique to the new shape ('value' in q → new; typeof q === 'number' → legacy). Cleanest migration for the vision layer."

requirements-completed:
  - "Platform quality (post-v1)"

# Metrics
duration: 6min
completed: 2026-04-19
---

# Phase 24 Plan 04: Vision Tool Schema — Quantity + Field Confidence Summary

**Vision tool schema now emits per-item `quantity: {value, unit, system}` and per-field `confidence: {name, quantity, unit, category}` across all three entrypoints (identifyFoodItems, identifyFoodItemsBatch, identifyReceiptItems) sharing one foodItemsSchema; normalizeScanItems sanitizes via units.sanitize + clamp01; legacy flat shapes still accepted for backward-compat; overall legacy `confidence` preserved as min(fieldConfidence.*) so Phase 14's 0.7 threshold gate keeps working — 40/40 vision tests green, zero new TypeScript errors.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-19T17:48:18Z
- **Completed:** 2026-04-19T17:54:30Z
- **Tasks:** 2 in plan; Task 1 executed (TDD RED + GREEN); Task 2 collapsed into Task 1 (shared-schema deviation documented)
- **Files modified:** 2 (vision.ts + vision.test.ts)
- **Files created:** 1 (this SUMMARY)

## Accomplishments

- **ScanResult type extended** — now exposes `quantity: Quantity` (from units.ts) and `fieldConfidence: FieldConfidence` on every scan result. Old `quantity: number` + `unit: string` pair removed from the interface; unit lives inside the nested Quantity.
- **Tool schema extended at a single source of truth** — `foodItemsSchema` now declares nested `quantity` object (required: value/unit/system; system is an enum of the six units.ts QuantitySystem values) and nested `confidence` object (required: name/quantity/unit/category numbers). Shared by all three vision entrypoints in vision.ts, so the four scan flows (camera/batch/receipt/Instacart) converge on one contract.
- **normalizeScanItems rewritten** with three composable helpers:
  - `clamp01(n)` — clamps a numeric confidence into [0, 1] with NaN/non-number → 0.5.
  - `normalizeFieldConfidence(raw)` — accepts nested-object shape, legacy flat-number shape, or missing (defaults to 0.5 uniform).
  - `normalizeQuantity(raw, flatUnit)` — delegates to units.sanitize for the nested shape; wraps legacy flat numbers into `{value, unit, system: 'count'}`; falls through to sanitize's default for null/missing.
  - Overall legacy `confidence` derived as `Math.min(fieldConfidence.*)` so Phase 14's 0.7 threshold gate keeps filtering low-confidence items.
- **Prompts edited in place** — FILTERING_RULES and RECEIPT_FILTERING_RULES each gained a `QUANTITY_AND_CONFIDENCE_RULES` paragraph teaching Claude the system enum (count/imperial-*/metric-*/custom) and per-field confidence expectation. RECEIPT_FILTERING_RULES also notes "receipts often show weights in lb or oz — use imperial-weight system" so line items translate cleanly. Prompts stay as in-file strings; versioned `.md` files are 24b scope and were NOT added (verified: no `packages/server/src/prompts/` directory created).
- **Backward-compat normalizers** — legacy flat `quantity: 3, unit: 'piece'` and legacy flat `confidence: 0.7` both still produce a well-formed ScanResult. This lets the schema rollout proceed without a dual-code-path; if Claude ever regresses to the old shape, vision still works.
- **40 vitest cases green** — 15 new `normalizeScanItems — 24a shape` tests plus 4 new tool-schema structural assertions plus updates to every pre-existing test that used the flat shape. Full server suite: 517/518 tests pass (1 pre-existing taskRouting.test.ts failure unrelated to this plan, documented in 24-01 + 24-02 SUMMARYs).

## Task Commits

1. **Task 1 RED (test):** `e3ecd20` — `test(24-04): add failing tests for 24a ScanResult + FieldConfidence shape` (15 failing tests)
2. **Task 1 GREEN (feat):** `086f738` — `feat(24-04): extend ScanResult with Quantity + FieldConfidence` (all 40 tests pass, 0 new TS errors)

Task 2 collapsed into Task 1: identifyReceiptItems shares foodItemsSchema + normalizeScanItems with the pantry-scan flows inside vision.ts (see Deviations below). No additional commit needed — the schema change propagates through the shared module.

## Files Created/Modified

**Created:**
- `.planning/phases/24-ai-vision-and-pantry-data-model-deep-refactor-.../24-04-SUMMARY.md` (this file)

**Modified:**
- `packages/server/src/services/vision.ts`
  - Imports `Quantity` + `sanitize` from `./units.js`.
  - Adds `FieldConfidence` interface.
  - Rewrites `ScanResult` with `quantity: Quantity` + `fieldConfidence: FieldConfidence` + preserved `confidence: number` (min of field scores).
  - Extends `foodItemsSchema` with nested `quantity` + nested `confidence` objects.
  - Adds `QUANTITY_SYSTEMS` constant for the schema enum.
  - Adds `clamp01`, `normalizeFieldConfidence`, `normalizeQuantity` helpers.
  - Rewrites `normalizeScanItems` to use the helpers.
  - Extends `FILTERING_RULES` + `RECEIPT_FILTERING_RULES` with `QUANTITY_AND_CONFIDENCE_RULES`.
  - Adds `RawScanItem` interface for tool-return typing.
  - Instacart variant preamble gains a one-sentence quantity-from-label hint.
- `packages/server/src/services/__tests__/vision.test.ts`
  - 25 pre-existing tests updated to use the nested quantity + confidence shapes in their mocked AI responses.
  - 15 new tests under `normalizeScanItems — 24a shape` describe block covering: nested quantity pass-through, backward-compat flat-number wrap, per-field confidence preservation, missing-fields → 0.5 defaults, NaN/Infinity/OOR clamp, flat-number confidence splits to four fields, overall-confidence-as-min invariant, malformed quantity → sanitize path, missing system → custom, completely-missing confidence → all 0.5.
  - 4 new tool-schema structural tests asserting nested quantity + nested confidence shape including enum values + required fields.
  - 2 new prompt-structure tests asserting FILTERING_RULES + RECEIPT_FILTERING_RULES carry the new guidance.

## Decisions Made

- **Task 2 collapses into Task 1** — there is no separate `packages/server/src/services/identifyReceiptItems.ts` file. The `identifyReceiptItems` function has always lived inside `vision.ts` since Phase 13, sharing `foodItemsSchema` and `normalizeScanItems` with the pantry-scan entrypoints. Extending vision.ts automatically covers all four scan flows (camera, batch, receipt, Instacart) — the single-source-of-truth contract Task 2 asked for is already the existing pattern. See Deviations below.
- **Overall legacy `confidence` = min(per-field)** — preserves the Phase 14 0.7 threshold gate without needing an in-phase consumer rewrite. Alternatives (average, weighted, drop) each had downsides documented in key-decisions.
- **Missing per-field confidence defaults to 0.5** (not 1.0) — surfaces uncertainty in the review UI instead of hiding it. Matches the plan's explicit instruction in the `<behavior>` block.
- **Legacy flat quantity wraps to `{value, unit: flatUnit ?? 'piece', system: 'count'}`** — legacy scans were all piece-style counts; count is the honest default. In the rare case a legacy call site emitted unit='lb' with quantity=1 (number), the wrap produces `{value:1, unit:'lb', system:'count'}`, which later aggregation would treat as count (incompatible with a real imperial-weight Quantity, falling into the multi-row fallback). Acceptable because no real legacy data flows through 24-05's aggregator; all real data is re-scanned under the new shape.
- **Raw-shape sniffing via `'value' in raw`** — more permissive than checking system/unit because Claude could drop those under token pressure; the `'value' in` presence is the cheapest reliable signal that the AI tried to emit the new shape. Sanitize handles partial objects downstream.
- **Prompt strings edited in place** — versioned `.md` files under `packages/server/src/prompts/` are explicitly 24b scope. Adding them here would duplicate 24b's research + migration. Verified no new `packages/server/src/prompts/` directory exists.
- **RawScanItem interface** — distinct from `Partial<ScanResult>` because Partial would mark `quantity` as optional at the ScanResult level (wrong — ScanResult guarantees non-null Quantity post-normalize). RawScanItem marks every field optional-and-unknown at the AI boundary; normalize turns it into ScanResult.
- **Added QUANTITY_SYSTEMS constant** — pulled from units.ts's QuantitySystem union to drive the schema enum. Keeps the single source of truth: if units.ts adds a new system, the vision schema needs an update (but TypeScript + the unit tests in units.test.ts will catch it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Scope adjustment] Task 2 file path does not exist**
- **Found during:** Task 2 setup (after Task 1 GREEN).
- **Issue:** Plan instructed "Locate the tool-schema definition inside `identifyReceiptItems.ts`" but no such file exists. The `identifyReceiptItems` function has always lived in `packages/server/src/services/vision.ts` since Phase 13 (confirmed via `Glob packages/server/src/services/identifyReceiptItems*` → no results). It is a third entrypoint sharing `foodItemsSchema` and `normalizeScanItems` with the pantry-scan flows.
- **Fix:** Task 2 collapses into Task 1 — the schema extension and prompt edit already cover the receipt + Instacart variants because they use the shared schema + normalizer. The Instacart variant preamble additionally gained a one-sentence hint ("...extract the product from the label (size on package) as quantity.{value, unit, system}") to honor Task 2's prompt-edit intent. Receipt variant already gets the weight-in-lb/oz guidance via RECEIPT_FILTERING_RULES.
- **Files modified:** `packages/server/src/services/vision.ts` (Instacart preamble + RECEIPT_FILTERING_RULES weight guidance — both part of the Task 1 commit `086f738`).
- **Verification:** Full server vitest suite (17 test files covering services + routes) green: 294/294 tests pass including all identifyReceiptItems cases. No test needed a separate identifyReceiptItems.ts file.
- **Committed in:** `086f738` (Task 1 GREEN commit — bundled with the shared schema change).

---

**Total deviations:** 1 scope adjustment (Rule 3 — plan file-path mismatch)
**Impact on plan:** None to the deliverable. Task 2's goal (single source of truth for tool shape across variants) was already the existing pattern in Phase 13's architecture; Task 1's changes satisfied both tasks' intent.

## Issues Encountered

- **Pre-existing tsc errors in server (26) and 1 vitest failure in taskRouting.test.ts** — all predate this plan (verified by `git stash && tsc --noEmit` probe: same 26 errors on main without our changes). Unchanged by Task 1's work. Out of scope per SCOPE BOUNDARY rule — already documented as deferred issues in 24-01 and 24-02 SUMMARYs.
- **`pnpm --filter @dinnertime/server test -- --run <path>` arg forwarding** — same issue documented in 24-02 (pnpm swallows `--run` as recursive flag). Worked around by running `npx vitest run <path>` directly from `packages/server`. Not a code bug.
- **ScanResult shape change could break mobile consumers** — the `/scan`, `/scan-batch`, `/scan-receipt`, `/import-instacart` routes return `{ data: ScanResult[] }`, so mobile clients now see `quantity: {value, unit, system}` instead of `quantity: number + unit: string`. This is the intended Phase 24 wire change. 24-06 (mobile review) will adapt `ReviewItem` + `ReviewItemRow` to consume the new shape. Until 24-06 lands, the mobile review screen may display the new object in place of the old number — acceptable during active Wave 2 development (no beta users yet per project directive).

## Next Phase Readiness

**Immediately unblocked:**
- **Plan 24-05 (reconcileItems rewrite + scan_events)** — can consume `ScanResult.quantity: Quantity` directly with `units.add()` for aggregation, and persist `ScanResult.fieldConfidence` into `scan_events.field_confidence` JSONB (24-01 migration 00014 already provides the column).
- **Plan 24-06 (mobile ReviewItemRow low-confidence inline hints)** — reads `item.fieldConfidence.{name,quantity,unit,category}` from the scan API response, applies dashed-underline treatment when any field < 0.7. No server-side additions needed; the shape is fully wired.

**Known open items downstream:**
- `pantry.ts` `ConfirmedItem` interface still uses flat `quantity: number + unit: string + confidence: number`. 24-05 will either rewrite `ConfirmedItem` to consume Quantity directly or add a compat adapter at the /confirm route boundary. Not a blocker: ConfirmedItem is an internal reconcile shape; the public ScanResult wire shape is now nested.
- Mobile `pantryStore.ts` `ReviewItem` type (in `apps/mobile/src/stores/`) likely still assumes flat quantity/confidence. 24-06 extends it pass-through. Server changes are complete and don't need mobile-side changes to function (the mobile review screen can render empty/garbled quantity for one iteration until 24-06 lands — acceptable under test-data directive).

**Not blocked by this plan:**
- 24b prompt-versioning work (versioned `.md` files + eval harness + retry/fallback) — intentionally out of scope here.

## Self-Check: PASSED

Verified post-SUMMARY:

- `packages/server/src/services/vision.ts` — MODIFIED (ScanResult.quantity: Quantity + fieldConfidence: FieldConfidence; foodItemsSchema nests quantity + confidence; normalizeScanItems sanitizes via units.sanitize + clamp01)
- `packages/server/src/services/__tests__/vision.test.ts` — MODIFIED (40 tests: 25 updated + 15 new)
- Task 1 RED commit `e3ecd20` — FOUND (`test(24-04): add failing tests for 24a ScanResult + FieldConfidence shape`)
- Task 1 GREEN commit `086f738` — FOUND (`feat(24-04): extend ScanResult with Quantity + FieldConfidence`)
- `npx vitest run packages/server/src/services/__tests__/vision.test.ts` — 40/40 green
- `npx vitest run packages/server/src/services/__tests__/ packages/server/src/routes/__tests__/pantry.test.ts` — 294/294 green
- Full server suite: 517/518 green (1 pre-existing `taskRouting.test.ts env.GOOGLE_API_KEY` failure, same as before plan, out of scope)
- `npx tsc --noEmit -p packages/server` — 0 errors in vision.ts / vision.test.ts (same 26 pre-existing errors elsewhere as before plan — verified by stash probe)
- No new `packages/server/src/prompts/` directory (24b scope respected)
- No stubs / TODO markers / placeholder returns in delivered files

---
*Phase: 24-ai-vision-and-pantry-data-model-deep-refactor*
*Completed: 2026-04-19*
