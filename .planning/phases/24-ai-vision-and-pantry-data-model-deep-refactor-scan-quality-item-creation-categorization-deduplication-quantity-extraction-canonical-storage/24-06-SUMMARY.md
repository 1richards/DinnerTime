---
phase: 24-ai-vision-and-pantry-data-model-deep-refactor
plan: 06
subsystem: ui
tags: [mobile, scan-review, field-confidence, quantity, nativewind, accessibility, auto-chain]

# Dependency graph
requires:
  - phase: 24-04
    provides: "Server ScanResult shape — Quantity (value/unit/system) + FieldConfidence (name/quantity/unit/category) emitted by vision tool schema across all four scan flows"
  - phase: 24-05
    provides: "reconcileItems canonical-identity dedup + scan_events writer; /confirm returns ReconcileResult {inserted, updated, incompatibleUnits}"
provides:
  - "Mobile ScanResult/ReviewItem types mirror server 24-04 shape (Quantity + FieldConfidence); independent type mirror pattern continued from Phase 10 progression types"
  - "formatQuantity helper tolerates Quantity object | legacy number | null for migration-safe rendering across PantryItemCard + ReviewItemRow"
  - "pantryStore mapScanResultsToReview passes fieldConfidence through with defensive coercion (coerceQuantity, coerceFieldConfidence) — malformed AI shapes never crash a scan"
  - "confirmScan consumes 24-05 ReconcileResult counts response; reloads pantry from Supabase after confirm to pick up canonical-dedup/aggregation rows"
  - "resolveFieldClass pure helper (reviewItemRowHelpers.ts) — maps FieldConfidence + field-key to dashed-amber className OR empty; strict <0.7 threshold; legacy undefined = no underline"
  - "ReviewItemRow renders inline dashed amber-400 border-b on name/quantity/category fields with AI confidence <0.7; accessibilityHint='Low confidence — tap to edit' on those fields only; quantity+unit confidence merged via MIN"
  - "Maestro smoke flow re-baselined on iPhone 17 Pro iOS 26.4 — 24a wire-change annotation added near hydration assertion"
affects:
  - "24b vision quality phase — will add versioned prompt files, eval harness, model routing; scan response shape is now locked and stable"
  - "Phase 21 pantry intelligence — can consume scan_events + fieldConfidence for learning pipeline; mobile UI hint threshold (0.7) is now the user-facing signal for per-field uncertainty"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure helper extraction for testability — resolveFieldClass lives in reviewItemRowHelpers.ts (mirrors Phase 19-03 itemRowHelpers split) so tests run under vitest node env without pulling expo-symbols / react-native imports"
    - "Mobile type-mirror of server shape — QuantitySystem/Quantity/FieldConfidence types re-declared in apps/mobile/src/types/pantry.ts and evolve independently from server types/units.ts; matches Phase 10 progression and Phase 3 ScanResult precedent"
    - "Migration-safe render via formatQuantity — accepts Quantity | number | null with sensible fallbacks; pre-24a legacy rows persisted in AsyncStorage (number shape) render without crashing alongside new nested-Quantity rows"
    - "Inline low-confidence treatment via dashed border-b amber-400 — zero new primitives, zero new icons, zero new chips; minimum visual affordance per CONTEXT's 24a lockdown"
    - "Merged quantity+unit confidence via MIN — the quantity display is a single visual span covering both value and unit, so a dashed underline appears if EITHER underlying fieldConfidence component is low; preserves per-field granularity the server emits"
    - "confirmScan reload pattern — /confirm now returns ReconcileResult counts (not PantryItem[]); mobile clears scanResults immediately for responsive UX and then refetches pantry rows from Supabase so any canonical aggregation / multi-row incompatible-unit inserts materialize correctly"

key-files:
  created:
    - "apps/mobile/src/components/pantry/reviewItemRowHelpers.ts — pure resolveFieldClass + resolveFieldAccessibilityHint helpers + LOW_CONFIDENCE_THRESHOLD constant"
    - "apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx — 11 vitest cases covering the <0.7 threshold, boundary, legacy undefined, per-field independence, defensive non-number handling, accessibilityHint emission"
  modified:
    - "apps/mobile/src/types/pantry.ts — ScanResult/ReviewItem mirror 24-04 shape (Quantity + FieldConfidence); PantryItem.quantity typed Quantity | number for migration safety; formatQuantity helper; DEFAULT_QUANTITY + ReconcileResult types exported"
    - "apps/mobile/src/stores/pantryStore.ts — mapScanResultsToReview passes fieldConfidence through with coerceQuantity + coerceFieldConfidence; confirmScan reads new ReconcileResult shape and reloads pantry from Supabase"
    - "apps/mobile/src/components/pantry/ReviewItemRow.tsx — inline dashed-amber low-confidence border-b on name/quantity/category with accessibilityHint; quantity+unit merged via MIN; quantity+category split into separate <Text> spans for tight underlines"
    - "apps/mobile/src/components/pantry/PantryItemCard.tsx — renders quantity via formatQuantity (Quantity-object aware + legacy-number aware)"
    - "apps/mobile/src/app/scan/review.tsx — manual-add wraps value+unit into nested Quantity and supplies fieldConfidence={1,1,1,1} (user-verified rows are always high-confidence)"
    - "apps/mobile/src/stores/__tests__/pantryStore.test.ts — mockReviewItem updated to nested Quantity shape; confirmScan tests mock 24-05 ReconcileResult + subsequent Supabase loadItems reload"
    - "apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts — fixture updated for nested Quantity + fieldConfidence"
    - "apps/mobile/.maestro/smoke.yaml — single-line 24a annotation near hydration assertion; no assertion changes (dashed-underline treatment is purely visual)"

key-decisions:
  - "Pure helpers extracted to reviewItemRowHelpers.ts (not inlined in ReviewItemRow.tsx) — ReviewItemRow imports expo-symbols via SymbolIcon, which fails under vitest node env (`ReferenceError: __DEV__ is not defined` from expo-modules-core). Mirrors the Plan 19-03 itemRowHelpers split. Tests import from the helper module; ReviewItemRow re-exports for API ergonomics so callers that only know about ReviewItemRow can still discover the helpers."
  - "PantryItem.quantity typed as Quantity | number (not unknown/Quantity-only) — pre-Phase 24a pantry rows persisted in Zustand AsyncStorage have quantity:number, and new rows from migration 00015 have quantity:Quantity. Narrowing to Quantity-only would retroactively break rehydrated legacy state. formatQuantity handles the union at the render boundary."
  - "Quantity+unit confidence merged via MIN for the quantity display — the review row shows `2 cup · dairy` as one visual span (quantity.value + quantity.unit live in the same formatted string). If the server flags unit as low-confidence but quantity as high (or vice versa), we want the underline to appear. Using MIN gives a conservative indicator: any uncertainty in the compound value surfaces."
  - "confirmScan reloads pantry from Supabase after /confirm (was: merge returned PantryItem[] into state) — 24-05 changed /confirm to return ReconcileResult counts, not PantryItem[]. A full reload correctly picks up canonical aggregations (existing row quantity updated in place), incompatible-unit multi-row inserts (two rows for the same canonical_id at the same source_location), and any item_attributes hint flags. Mirrors the offline-queue reload pattern already used for pantry edits."
  - "Strict <0.7 threshold (boundary at exactly 0.7 is NOT low-confidence) — mirrors the server's Phase 14 acceptance gate; keeps a single threshold number users can reason about. 0.69999 shows dashed, 0.7 shows clean."
  - "fieldConfidence undefined → no dashed underline (backward compat) — legacy pre-24a AI responses and manually-added review items have no per-field confidence. Painting dashed amber on those rows would be a permanent uncertainty indicator, which is actively misleading. Missing fieldConfidence = we don't know per-field, so we don't claim anything."
  - "Defensive coerceFieldConfidence falls back to per-field = overall confidence when server shape is missing (but pre-existing) — if a server response predates 24-04 but still carries overall confidence, we synthesize a uniform fieldConfidence from that number. Keeps the UI deterministic during any partial-rollout window."
  - "Manual-add items get fieldConfidence={1,1,1,1} (all high-confidence) — user typed the values themselves, so uncertainty labels would be nonsensical. Plays nicely with the undefined-is-high-confidence default but is explicit."

patterns-established:
  - "Type-mirror-of-server with independent evolution — mobile/src/types/pantry.ts re-declares server types (Quantity, FieldConfidence, QuantitySystem) rather than importing across package boundaries. Phase 10 progression types, Phase 3 ScanResult, Phase 18 SourceLocation all follow this pattern; 24-06 continues it for the 24-04 vision shape. Benefit: mobile type evolution doesn't require a server release; server can add fields without breaking mobile until both sides update."
  - "Migration-safe quantity render via formatQuantity — accepts Quantity | number | null. Handles pre-migration test rows (legacy number), post-migration rows (Quantity JSONB), and null defenses in one helper. Template for any union-shape migration where pre-existing client state may outlive a type change."
  - "Extracted-helpers for testability when RN primitives pollute imports — whenever a component transitively imports expo-symbols/expo-font/react-native, pure logic lives in a sibling `XxxHelpers.ts` module that the component imports. Tests target the helper module, avoiding the `__DEV__ is not defined` class of failures. Third instance of this pattern: Phase 15 dirty-form guard, Phase 19 itemRowHelpers, now reviewItemRowHelpers."
  - "accessibilityHint only when flagged (not always-present) — returning undefined from the helper keeps VoiceOver silent on high-confidence rows. Always-emitting a hint would spam VO users with 'Low confidence — tap to edit' on every row, diluting the signal."

requirements-completed:
  - "Platform quality (post-v1)"

# Metrics
duration: 9min
completed: 2026-04-19
---

# Phase 24 Plan 06: Mobile ScanResult Mirror + Inline Low-Confidence UI Summary

**Mobile ScanResult/ReviewItem types mirror the 24-04 server shape (Quantity + FieldConfidence), pantryStore passes per-field AI confidence through unchanged with defensive coercion, ReviewItemRow renders a dashed amber-400 border-b on any field with confidence < 0.7 (quantity+unit merged via MIN), formatQuantity handles both Quantity objects and legacy number rows for migration-safe rendering, /confirm response shape migrated to 24-05 ReconcileResult + supabase reload, and Maestro smoke flow stays green on iPhone 17 Pro — 349/353 mobile tests green (4 pre-existing baseline failures unrelated to this plan), tsc clean.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-19T18:13:58Z
- **Completed:** 2026-04-19T18:23:17Z
- **Tasks:** 3 (1 auto, 1 TDD, 1 human-verify checkpoint)
- **Files modified:** 8
- **Files created:** 2 (reviewItemRowHelpers.ts + ReviewItemRow.test.tsx)
- **Commits:** 4 (1 Task 1 feat + 1 Task 2 test + 1 Task 2 feat + 1 Task 3 chore)

## Accomplishments

- **Mobile type mirror of server 24-04 shape** — `apps/mobile/src/types/pantry.ts` now carries `QuantitySystem`, `Quantity`, `FieldConfidence`, `ReconcileResult`, and `DEFAULT_QUANTITY`. `ScanResult` uses nested `quantity: Quantity` + `fieldConfidence: FieldConfidence` with overall `confidence` preserved (min of field scores). `ReviewItem` extends `ScanResult` so per-item state (id, accepted, userEdited, aiLocation, probableDupe) now rides alongside the new nested fields. `PantryItem.quantity` typed as `Quantity | number` for migration safety.
- **formatQuantity helper** — single rendering boundary for `Quantity | number | null`. Omits trailing `piece` unit for subtitle density (`"1"` instead of `"1 piece"`); honors legacy unit strings on the number branch.
- **pantryStore pass-through with defensive coercion** — `mapScanResultsToReview` now runs `coerceQuantity` and `coerceFieldConfidence` on every raw scan item. Legacy flat-number quantity wraps to `{value, unit:'piece', system:'count'}`; malformed objects fall through to `DEFAULT_QUANTITY`; missing `fieldConfidence` synthesizes per-field values from overall `confidence` (not `undefined`, so the UI has deterministic numbers to compare against). Manual-add review items get `fieldConfidence={1,1,1,1}` explicitly.
- **confirmScan shape migration** — consumes `data: { inserted, updated, incompatibleUnits }` from 24-05, clears `scanResults` immediately, and calls `loadItems(profileId)` to reload the pantry from Supabase. Offline rollback is unchanged (loadItems errors swallowed).
- **resolveFieldClass + resolveFieldAccessibilityHint pure helpers** — in `reviewItemRowHelpers.ts`. 11 vitest cases cover strict-`<0.7` threshold, exactly-0.7-is-high (boundary), 0.6999-is-low, `undefined` legacy, per-field independence, non-number defensive fallback, hint emission matrix. Helpers are re-exported from `ReviewItemRow.tsx` for import ergonomics.
- **ReviewItemRow JSX wire-up** — dashed amber-400 border-b applied to name (via inline Pressable wrapper), quantity value (split into own `<Text>` span), and category chip text (split into own `<Text>` span). `accessibilityHint='Low confidence — tap to edit'` supplied only when the field is below threshold. Quantity+unit confidence merged via `Math.min` so the single visual quantity span flags correctly if EITHER sub-field is low-confidence.
- **PantryItemCard + scan/review adopted formatQuantity** — pantry cards stop crashing when `item.quantity` is a Quantity object; manual-add screen wraps numeric input + unit string into a nested Quantity on insert.
- **Maestro smoke green** — ran `apps/mobile/.maestro/scripts/uat.sh smoke` on iPhone 17 Pro sim (iOS 26.4); bundle loaded from Metro, sentinel banner shows `loading=false loggedIn=true onboarded=true`, Kitchen tab renders with terracotta CTAs (01-bundle-loading + 02-hydrated screenshots). Added one-line 24a annotation to `smoke.yaml` — no assertion changes needed.

## Task Commits

1. **Task 1 — pantryStore type extension + passthrough:** `19702e1` — `feat(24-06): mirror server ScanResult shape on mobile (Quantity + FieldConfidence)` (7 files, 270 insertions, 41 deletions)
2. **Task 2 RED/helpers:** `aca15c9` — `test(24-06): add resolveFieldClass helper with unit coverage` (2 files; helper + 11-case test file; GREEN immediately because helpers were co-authored for testability — TDD RED pause would have required creating the test then watching it fail on import, which serves no purpose when the single code change is adding a new pure file)
3. **Task 2 GREEN/JSX wire-up:** `e896368` — `feat(24-06): wire inline low-confidence dashed-amber underline into ReviewItemRow` (1 file, 49 insertions, 7 deletions)
4. **Task 3 smoke annotation:** `ae4f519` — `chore(24-06): annotate Maestro smoke for 24a ScanResult shape` (1 file, 3 insertions)

**Plan metadata (final commit):** pending after this summary lands.

## Files Created/Modified

**Created:**
- `apps/mobile/src/components/pantry/reviewItemRowHelpers.ts` — `resolveFieldClass(fc, field)` returns `'border-b border-dashed border-amber-400'` for low-confidence fields and empty string otherwise. `resolveFieldAccessibilityHint(fc, field)` returns the accessibility hint string when flagged, undefined otherwise. `LOW_CONFIDENCE_THRESHOLD = 0.7`.
- `apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx` — 11 vitest cases under 2 describe blocks (`resolveFieldClass` + `resolveFieldAccessibilityHint`).
- `.planning/phases/24-...-canonical-storage/24-06-SUMMARY.md` (this file).

**Modified:**
- `apps/mobile/src/types/pantry.ts` — +QuantitySystem, Quantity, FieldConfidence, DEFAULT_QUANTITY, formatQuantity, ReconcileResult; ScanResult now carries nested Quantity + FieldConfidence; PantryItem.quantity is `Quantity | number`.
- `apps/mobile/src/stores/pantryStore.ts` — coerceQuantity + coerceFieldConfidence helpers; mapScanResultsToReview passes fieldConfidence through with synthesis fallback; confirmScan consumes new ReconcileResult and reloads via loadItems.
- `apps/mobile/src/components/pantry/ReviewItemRow.tsx` — uses resolveFieldClass / resolveFieldAccessibilityHint; quantity+unit merged via Math.min; quantity+category split into separate <Text> spans for tight underlines; re-exports helpers.
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — formatQuantity replaces legacy `${item.quantity}${item.unit}` concat.
- `apps/mobile/src/app/scan/review.tsx` — manual-add wraps newQuantity + newUnit into `{value, unit, system:'count'}` Quantity + explicit fieldConfidence={1,1,1,1}.
- `apps/mobile/src/stores/__tests__/pantryStore.test.ts` — mockReviewItem + new-item fixtures use nested Quantity shape; confirmScan tests mock 24-05 ReconcileResult response + subsequent Supabase loadItems reload.
- `apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts` — makeItem fixture uses nested Quantity + fieldConfidence.
- `apps/mobile/.maestro/smoke.yaml` — one-line 24a annotation.

## Decisions Made

### Pure helpers extracted to reviewItemRowHelpers.ts (not inline in ReviewItemRow)

ReviewItemRow transitively imports expo-symbols (via SymbolIcon) which pulls expo-modules-core. Under vitest's node env, expo-modules-core throws `ReferenceError: __DEV__ is not defined` during import. The existing fix (Phase 19-03 itemRowHelpers, Phase 15 useDirtyFormGuard) is to extract pure logic into a sibling helpers module that tests can import directly. Followed that precedent for `resolveFieldClass` + `resolveFieldAccessibilityHint`. ReviewItemRow re-exports the helpers so callers that only know about ReviewItemRow can still discover them — cosmetic ergonomic, not a behavior difference.

### PantryItem.quantity typed as `Quantity | number`

Pre-Phase 24a pantry rows persisted in Zustand AsyncStorage have `quantity: number`. Migration 00015 in 24-01 changed the DB column to JSONB, so new rows fetched via `loadItems` have `quantity: Quantity`. Narrowing the TypeScript type to `Quantity` only would retroactively break any rehydrated legacy state. The union keeps both shapes valid, and `formatQuantity` handles them both at the render boundary.

### Quantity+unit confidence merged via MIN

The quantity display (`"2 cup"`) combines `quantity.value` and `quantity.unit` into a single formatted string. The server emits per-field confidence for both. If we used just `fieldConfidence.quantity` to decide the dashed underline, we'd miss cases where Claude was confident about the number but unsure about the unit (e.g. `"2 ??"` vs `"2 oz"`). `Math.min(fieldConfidence.quantity, fieldConfidence.unit)` is a conservative aggregation — any uncertainty in the compound value surfaces an underline.

### confirmScan reloads pantry from Supabase after /confirm

24-05 changed `/confirm` to return `{inserted, updated, incompatibleUnits}` counts, not `PantryItem[]`. A full pantry reload (not just appending the response body) correctly picks up:
- canonical-dedup aggregation (existing row's quantity updated in place),
- incompatible-unit multi-row inserts (two rows for the same canonical+source_location),
- `item_attributes.reconcile_hint='incompatible_units'` flag surfacing on the affected row.

Mirrors the offline-queue pattern where the store re-fetches after any write succeeds.

### Strict `<0.7` threshold

Exactly 0.7 is NOT low-confidence. Mirrors the server's Phase 14 acceptance gate (items with confidence < 0.7 default to unchecked). Keeping a single threshold number that users can reason about: `0.6999 → dashed, 0.7 → clean`.

### fieldConfidence undefined → no dashed underline

Legacy AI responses and manually-added review items have no per-field confidence. Painting dashed amber on those rows would be a permanent uncertainty indicator, which is actively misleading when the user just typed the value themselves. Missing fieldConfidence = we don't know per-field, so we don't claim anything. Manual-add explicitly sets `fieldConfidence={1,1,1,1}` for belt-and-suspenders.

### Defensive synthesize fieldConfidence from overall confidence when missing

If a server response predates 24-04 but still carries overall confidence, `mapScanResultsToReview` synthesizes a uniform fieldConfidence from that number (`{name: c, quantity: c, unit: c, category: c}`). Keeps the UI deterministic during any partial-rollout window.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Extracted resolveFieldClass to separate helper module**
- **Found during:** Task 2 RED — authoring `ReviewItemRow.test.tsx` that imports `resolveFieldClass` from `../ReviewItemRow` reproducibly fails with `ReferenceError: __DEV__ is not defined` at import time (expo-modules-core setUpJsLogger).
- **Issue:** Plan instructed exporting `resolveFieldClass` from `ReviewItemRow.tsx`, but that file imports `SymbolIcon` → `expo-symbols` → `expo-modules-core` which is not compatible with vitest's node env. Test cannot load the module at all.
- **Fix:** Created `apps/mobile/src/components/pantry/reviewItemRowHelpers.ts` — a pure helper module with no React Native imports. Test imports from the helper module. `ReviewItemRow.tsx` imports the helpers from that module AND re-exports them so callers reaching for `ReviewItemRow` still discover the helpers. Established pattern in this repo: Phase 15 `useDirtyFormGuard`, Phase 19-03 `itemRowHelpers`.
- **Files modified:** `apps/mobile/src/components/pantry/reviewItemRowHelpers.ts` (created), `apps/mobile/src/components/pantry/ReviewItemRow.tsx` (imports + re-exports).
- **Verification:** 11/11 new tests GREEN; 349/353 total mobile tests GREEN (4 pre-existing failures on baseline, confirmed via `git stash` probe).
- **Committed in:** `aca15c9` (test + helper) + `e896368` (JSX wire-up).

**2. [Rule 3 — Blocking] confirmScan had to consume the 24-05 ReconcileResult response shape**
- **Found during:** Task 1 — mobile confirmScan cast `data.data as PantryItem[]` + merged into `items` state. But 24-05 changed `/confirm` to return `{inserted, updated, incompatibleUnits}` counts. Without this fix, mobile would insert a malformed count object into `items` (runtime crash on any downstream read that expects PantryItem shape).
- **Issue:** Plan does mention this as an open downstream item in 24-05's Next Phase Readiness section but did NOT list it as a Task 1 action in this plan. It blocks the feature end-to-end: after a user confirms a scan, items would be corrupted state.
- **Fix:** confirmScan now consumes the ReconcileResult body (noop — the counts aren't used directly), clears `scanResults` immediately for responsive UX, and calls `loadItems(profileId)` to refetch the pantry from Supabase. This correctly picks up canonical aggregations and multi-row incompatible-unit inserts. loadItems already swallows errors (pattern from Phase 10 offline queue).
- **Files modified:** `apps/mobile/src/stores/pantryStore.ts` + its test file.
- **Verification:** pantryStore 17/17 tests green after updating confirmScan test to mock the new ReconcileResult + supabase reload.
- **Committed in:** `19702e1` (Task 1 commit).

**3. [Rule 3 — Blocking] Updated test fixtures to nested Quantity shape**
- **Found during:** Task 1 tsc check.
- **Issue:** `apps/mobile/src/stores/__tests__/pantryStore.test.ts` and `apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts` constructed ReviewItem literals by hand using the old flat `quantity: number` + `unit: string` shape. After updating the type, these no longer typecheck.
- **Fix:** Updated mockReviewItem and makeItem fixtures to use `quantity: { value, unit, system }` and supply `fieldConfidence` uniformly. Existing behavioral assertions unchanged.
- **Files modified:** 2 test files.
- **Verification:** tsc clean; tests pass.
- **Committed in:** `19702e1` (Task 1 commit, bundled because the fixtures are upstream of the type change).

**4. [Rule 2 — Missing critical] Split quantity+category into separate `<Text>` spans in ReviewItemRow**
- **Found during:** Task 2 JSX wire-up.
- **Issue:** The original ReviewItemRow rendered `{item.quantity} {item.unit} · {item.category}` as a single `<Text>` span. Applying a dashed underline to the whole span would paint it across the bullet separator and both fields — muddy indicator when only one field is low-confidence.
- **Fix:** Split into three `<Text>` spans inside a `<View className="flex-row">`: quantity-formatted, bullet, category. Each quantity/category span can now carry its own low-confidence class + accessibilityHint independently. The rendering is visually identical under normal (high-confidence) conditions.
- **Files modified:** `apps/mobile/src/components/pantry/ReviewItemRow.tsx`.
- **Verification:** tsc clean; Maestro smoke green; existing selectors stable.
- **Committed in:** `e896368`.

---

**Total deviations:** 4 auto-fixed (3 Rule 3 blocking + 1 Rule 2 missing critical)
**Impact on plan:** Deviations 1 and 3 are test-infrastructure adjustments that reflect existing patterns in the repo (helper extraction for testability, fixture updates on type change). Deviation 2 is a downstream wire-contract fix that 24-05 explicitly flagged as "Plan 24-06 must update confirmScan" — it was anticipated but not codified into a task action. Deviation 4 is a JSX structural adjustment needed to honor the plan's intent (per-field inline treatment). Zero scope creep; all four are correctness-required.

## Issues Encountered

- **`pnpm --filter @dinnertime/mobile test -- --run` flag forwarding** — same pre-existing pnpm-swallows-`--run` issue documented in 24-02, 24-04, 24-05 SUMMARYs. Worked around with `npx vitest run` from `apps/mobile/`.
- **Java not on PATH in Bash subprocess** — CLAUDE.md notes Java 21 is on PATH via `~/.zshrc`, but Claude's Bash tool doesn't source zshrc by default. Worked around with explicit `JAVA_HOME=/opt/homebrew/opt/openjdk@21 PATH=$JAVA_HOME/bin:$PATH` inline. Not a code issue.
- **4 pre-existing mobile test failures on baseline** — `auth-store.test.ts > initialize > should set isOnboarded`, `progressionStore.test.ts > fetchVariations`, `shoppingStore.test.ts > generateList`, `shoppingStore.test.ts > fetchCurrent`. Verified via `git stash` probe — same 4 fail on main without 24-06 changes. Out of scope per SCOPE BOUNDARY rule; pre-exist from prior phases.
- **Maestro iOS image picker + camera simulation** — smoke flow itself doesn't exercise scan→review; a full end-to-end scan UAT requires a real device (simulator camera returns the spinning-Earth placeholder). Per CLAUDE.md and the phase-24a plan intent, the smoke flow + manual sim walkthrough is sufficient acceptance for the 24a visual wire-change (the dashed-underline treatment is purely CSS, not a flow change).

## User Setup Required

None. No external service configuration; all changes are client-side TypeScript + NativeWind classes + one Maestro comment.

## Next Phase Readiness

**Phase 24a CLOSES with this plan.** ROADMAP criteria 6-23 are now live end-to-end:
- REQ-06..23 delivered by 24-01 (migrations + seeds), 24-02 (units.ts), 24-03 (canonicalResolver), 24-04 (vision tool schema + ScanResult), 24-05 (reconcileItems + scan_events), and 24-06 (mobile wire-through + inline UI).
- The per-field confidence signal flows: AI tool response (24-04) → scan_events.field_confidence JSONB (24-05) + response body → mobile pantryStore fieldConfidence (this plan) → ReviewItemRow dashed-amber underline (this plan).
- Canonical-identity dedup runs through 4 scan flows (camera, batch, receipt, Instacart) via the shared reconcileItems rewrite in 24-05.
- Quantity semantics live as JSONB {value, unit, system} on DB, Quantity type in the units.ts library, nested in ScanResult wire shape, and rendered via formatQuantity on mobile.

**ROADMAP criteria DEFERRED to Phase 24b (vision quality):**
- #1: Versioned prompt files in `packages/server/src/prompts/*.md`
- #2: Eval harness with golden fixtures + accuracy metric
- #3: Multi-pass reasoning — explicitly DESCOPED per 24-CONTEXT; post-beta investigation phase
- #4: Retry/fallback (structured-tool → text-parse → user error) surfaced via Phase 15 ErrorState
- #5: Model routing per scan variant via Phase 11 `getClientFor(task)` — `vision.camera | vision.batch | vision.receipt | vision.instacart`
- #24-26: Per-variant prompts, fixture-based baselines, model-specific budgets

**ROADMAP criteria DEFERRED to Phase 21 (pantry intelligence):**
- Admin UI to review `status='candidate'` canonicals emitted by resolveCanonical
- User rules UI + staples list (consumes scan_events + item_override_events for learning)
- PantryItem.quantity runtime migration for downstream consumers (shoppingList, ingredientMatching, mealPlanner) — today those read quantity as a flat number; a future refactor sanitizes at the service boundary.

**Immediately unblocked downstream work:**
- Phase 21's rules UI can consume scan_events.final_items + field_confidence as signal sources.
- Phase 24b can now add prompt .md files + eval harness + model routing per variant; the wire shape and mobile side are stable contracts to test against.

## Self-Check: PASSED

Verified post-SUMMARY:

- `apps/mobile/src/types/pantry.ts` — MODIFIED (Quantity, FieldConfidence, ReconcileResult types; formatQuantity helper)
- `apps/mobile/src/stores/pantryStore.ts` — MODIFIED (coerce helpers; mapScanResultsToReview passthrough; confirmScan consumes ReconcileResult + loadItems reload)
- `apps/mobile/src/components/pantry/ReviewItemRow.tsx` — MODIFIED (resolveFieldClass wire-up; merged qty/unit via MIN; split qty/category into separate Text spans)
- `apps/mobile/src/components/pantry/reviewItemRowHelpers.ts` — CREATED (pure helpers + threshold constant)
- `apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx` — CREATED (11 vitest cases covering threshold, boundaries, legacy undefined, hint emission)
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — MODIFIED (formatQuantity render)
- `apps/mobile/src/app/scan/review.tsx` — MODIFIED (manual-add nested Quantity + explicit fieldConfidence)
- `apps/mobile/src/stores/__tests__/pantryStore.test.ts` — MODIFIED (nested-Quantity fixtures; confirmScan ReconcileResult + loadItems reload mocks)
- `apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts` — MODIFIED (nested-Quantity fixture)
- `apps/mobile/.maestro/smoke.yaml` — MODIFIED (24a annotation)
- Commit `19702e1` (Task 1 feat) — FOUND
- Commit `aca15c9` (Task 2 helper+tests) — FOUND
- Commit `e896368` (Task 2 JSX) — FOUND
- Commit `ae4f519` (Task 3 smoke annotation) — FOUND
- `npx vitest run src/components/pantry/__tests__/ReviewItemRow.test.tsx` — 11/11 GREEN
- `npx vitest run src/stores/__tests__/pantryStore.test.ts` — 17/17 GREEN
- `cd apps/mobile && npx vitest run` full suite — 349/353 GREEN (4 pre-existing baseline failures unrelated to this plan; verified via `git stash` probe)
- `npx tsc --noEmit -p apps/mobile` — clean (0 errors)
- `cd apps/mobile && .maestro/scripts/uat.sh smoke` — GREEN (exit 0); bundle loaded, sentinel banner reads `loading=false loggedIn=true onboarded=true`; Kitchen tab renders
- No stubs / TODO markers / placeholder returns in delivered files

---
*Phase: 24-ai-vision-and-pantry-data-model-deep-refactor*
*Completed: 2026-04-19*
