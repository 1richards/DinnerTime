---
phase: 18-ai-auto-location-for-pantry-imports-remove-forced-fridge-pantry-freezer-choice
plan: 03
subsystem: mobile-review-chip + store-signatures + override-telemetry
tags: [react-native, zustand, tdd, vitest, sf-symbols, bottom-sheet, fire-and-forget]

# Dependency graph
requires:
  - phase: 18-02
    provides: "Per-item source_location on ScanResult; /scan*, /confirm, /override-events routes stripped/added"
  - phase: 19
    provides: "Chip (kind='display', tone='default', leadingIcon) primitive reused by LocationChip"
  - phase: 15
    provides: "SF Symbol mapping (snowflake for fridge+freezer, archivebox for pantry); component-as-function vitest pattern"
  - phase: 13-02
    provides: "BulkImportSheet Modal+backdrop template — structural clone for LocationChoiceSheet"
provides:
  - "apps/mobile/src/components/pantry/LocationChip.tsx — Pressable-wrapped Chip kind='display' with SF Symbol + label"
  - "apps/mobile/src/components/pantry/LocationChoiceSheet.tsx — 3-option bottom sheet with border-2 border-brand ring on current value"
  - "apps/mobile/src/components/pantry/locationSymbols.ts — shared LOCATION_SYMBOLS + LOCATION_LABELS + FALLBACK_LOCATION_SYMBOL; single source of truth (PantryItemCard + LocationChip both import)"
  - "apps/mobile/src/lib/logOverrideEvent.ts — fire-and-forget POST /api/v1/pantry/override-events with 4 non-throw guards (empty array, missing token, network error, !ok)"
  - "apps/mobile/src/app/scan/reviewHelpers.ts — pure deriveOverrideEvents filter (userEdited && aiLocation && mismatch)"
  - "apps/mobile/src/types/pantry.ts — ScanResult.source_location required; ReviewItem.aiLocation optional"
  - "apps/mobile/src/stores/pantryStore.ts — startScan/startBatchScan/startReceiptScan/confirmScan dropped sourceLocation param; mapScanResultsToReview seeds aiLocation; confirmScan fires logOverrideEvents(void)"
  - "apps/mobile/src/components/pantry/ReviewItemRow.tsx — optional onLocationPress(itemId); renders LocationChip below subtitle"
  - "apps/mobile/src/app/scan/review.tsx — openSheetItemId state; mounts LocationChoiceSheet; drops sourceLocation route param"
affects:
  - phase-18-04-uat-locationpicker-removal
  - phase-21-pantry-intelligence (override-events consumer)
  - phase-24-canonical-ingredients

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Component-as-function vitest pattern (call component, traverse tree by .type identity) — 12 tests for LocationChip + LocationChoiceSheet with zero renderer dependency (inherits Phase 15-01)"
    - "Fire-and-forget telemetry: void logOverrideEvents(...) — user sees 'Pantry Updated' without awaiting a telemetry POST; 4 non-throw guards ensure network failure can never surface as a confirm error"
    - "Leaf symbol module (locationSymbols.ts) shared by LocationChip + PantryItemCard — no forked icon map"
    - "getAuthTokenOrNull wrapper (try/catch returning null) for non-critical POSTs that must not surface mid-session sign-outs"
    - "aiLocation preservation at mapScanResultsToReview time — original server prediction survives every user edit so override detection is pure-pass on ReviewItem[]"
    - "Pure deriveOverrideEvents helper (no store coupling) — testable in 6 unit tests, consumed by confirmScan"

key-files:
  created:
    - apps/mobile/src/components/pantry/LocationChip.tsx
    - apps/mobile/src/components/pantry/LocationChoiceSheet.tsx
    - apps/mobile/src/components/pantry/locationSymbols.ts
    - apps/mobile/src/components/pantry/__tests__/LocationChip.test.ts
    - apps/mobile/src/components/pantry/__tests__/LocationChoiceSheet.test.ts
    - apps/mobile/src/lib/logOverrideEvent.ts
    - apps/mobile/src/lib/__tests__/logOverrideEvent.test.ts
    - apps/mobile/src/app/scan/reviewHelpers.ts
    - apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts
  modified:
    - apps/mobile/src/types/pantry.ts
    - apps/mobile/src/components/pantry/PantryItemCard.tsx
    - apps/mobile/src/components/pantry/ReviewItemRow.tsx
    - apps/mobile/src/stores/pantryStore.ts
    - apps/mobile/src/stores/__tests__/pantryStore.test.ts
    - apps/mobile/src/app/scan/index.tsx
    - apps/mobile/src/app/scan/receipt.tsx
    - apps/mobile/src/app/scan/review.tsx
    - .planning/phases/18-ai-auto-location-for-pantry-imports-remove-forced-fridge-pantry-freezer-choice/deferred-items.md

key-decisions:
  - "Extracted LOCATION_SYMBOLS to apps/mobile/src/components/pantry/locationSymbols.ts (not a plain re-export from PantryItemCard) so the map has one canonical owner. PantryItemCard now imports from the shared module; LocationChip imports from the same place. Follows the plan's 'don't fork the map' rule."
  - "mapScanResultsToReview seeds aiLocation alongside source_location on every scan response. This means ANY item that passed through AI (camera / batch / receipt / Instacart) carries its original prediction — no per-flow wiring needed. Manual-add items (in review.tsx) intentionally omit aiLocation so deriveOverrideEvents never reports them as overrides."
  - "confirmScan calls logOverrideEvents via `void` (not awaited). Even the order of operations matters: deriveOverrideEvents runs BEFORE scanResults is cleared in set(), so the override payload captures the final user-edited state. Telemetry POST kicks off before the UI transitions to 'Pantry Updated!'."
  - "getAuthTokenOrNull wrapper exists specifically because logOverrideEvents is fire-and-forget — if the user signed out mid-confirm, the primary /confirm already failed. Surfacing a second auth throw from telemetry would noise up error handling. Returning null + warn is the correct shape."
  - "Per-item source_location defensively narrowed in mapScanResultsToReview: only 'fridge' | 'pantry' | 'freezer' are accepted; anything else falls back to 'pantry'. Server (Phase 18-02) already validates + normalizes, but a mobile-side guard is cheap insurance against wire-format drift."
  - "Review-only bookkeeping (id, accepted, userEdited, aiLocation, probableDupe) stripped from /confirm payload via destructure-and-spread. aiLocation is EXPLICITLY stripped so the server doesn't see client-only provenance leaking into the persistence layer."
  - "review.tsx drops the sourceLocation route param AND the LocationPicker on scan entry points stays mounted. The two-step is intentional: Plan 18-03 ships the chip + sheet with zero route-param coupling; Plan 18-04 atomically removes LocationPicker + the now-dead nav params. Keeps each commit atomic and reviewable."
  - "LocationChip renders the chip inline on its own line below the subtitle (mt-1 flex-row) — matches RESEARCH Q8 'cleanest visually, no width competition' over placing it beside the confidence badge."

patterns-established:
  - "Shared icon/label map pattern: when two components need the same enum→glyph mapping, extract to a sibling module in components/<feature>/ — import from both rather than duplicate or pick a winner"
  - "Telemetry-POST wrapper contract: (events, getAuthToken, getApiBaseUrl) as a 3-arg pure function — testable with plain vi.fn() mocks, zero module patching; zustand store composes it with getAuthTokenOrNull + getApiBaseUrl"

requirements-completed:
  - "Pantry UX improvement (post-v1) — mobile-side per-item location UX shipped; Plan 18-04 closes the loop by removing the now-vestigial LocationPicker"

# Metrics
duration: 9min
completed: 2026-04-19
---

# Phase 18 Plan 03: Mobile Review Chip + Override Telemetry Summary

**Mobile now renders a per-item location chip on every scan review row, opens a 3-choice sheet on tap, and fires fire-and-forget override telemetry when the user corrects an AI prediction. Store signatures no longer take sourceLocation — each scan item carries its own.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-19T04:24:40Z
- **Completed:** 2026-04-19T04:33:30Z
- **Tasks:** 3 (all TDD — RED + GREEN commits each)
- **Files created:** 9
- **Files modified:** 9

## Accomplishments

- **LocationChip** primitive (`components/pantry/LocationChip.tsx`): Pressable-wrapped `<Chip kind="display" tone="default">` with SF Symbol (`snowflake` for fridge/freezer, `archivebox` for pantry) + label. `accessibilityLabel="Location: <label> — tap to change"`. 6 tests pin value→label/icon/kind/tone resolution, onPress propagation, accessibility contract, shared-map invariant.
- **LocationChoiceSheet** primitive (`components/pantry/LocationChoiceSheet.tsx`): Modal + slide animation cloned from `BulkImportSheet`, three option rows (fridge / pantry / freezer) each with SF Symbol badge + label + subtitle ("Dairy, fresh meat, produce" / "Shelf-stable, canned, dried" / "Frozen items, ice cream"). Current value gets `border-2 border-brand` ring; onSelect fires the chosen value AND closes the sheet; backdrop Pressable closes without a selection. 6 tests cover all paths.
- **Shared location symbol module** (`components/pantry/locationSymbols.ts`): extracted `LOCATION_SYMBOLS`, `LOCATION_LABELS`, `FALLBACK_LOCATION_SYMBOL` so LocationChip + PantryItemCard both import from one source. PantryItemCard's forked map was deleted per the plan's "don't fork the map" rule.
- **logOverrideEvents** helper (`lib/logOverrideEvent.ts`): 3-arg fire-and-forget POST. Empty array short-circuits (no fetch). Missing token warns + skips. Fetch throw is swallowed via console.warn. Non-2xx response warns + returns. 5 unit tests pin every non-throw guard.
- **deriveOverrideEvents** pure helper (`app/scan/reviewHelpers.ts`): filters `userEdited && aiLocation && source_location !== aiLocation`, maps to `{ item_name (lowercased+trimmed), ai_location, user_location }`. 6 tests cover no-edits, no-userEdited, no-aiLocation, no-op edits, field mapping, multi-item fan-out.
- **pantryStore signatures** updated: `startScan(base64)`, `startBatchScan(base64s)`, `startReceiptScan(base64)`, `confirmScan(profileId)` all drop the `sourceLocation` parameter. `mapScanResultsToReview` now copies server `source_location` into BOTH `source_location` and `aiLocation` on the ReviewItem so user edits later can be detected. `confirmScan` strips review-only bookkeeping from the /confirm payload (id, accepted, userEdited, aiLocation, probableDupe) and fires `void logOverrideEvents(deriveOverrideEvents(accepted), getAuthTokenOrNull, getApiBaseUrl)` fire-and-forget.
- **ReviewItemRow** integration: new `onLocationPress?(itemId)` prop; renders `<LocationChip value={item.source_location} onPress={() => onLocationPress?.(item.id)} />` below the quantity/category subtitle (mt-1 flex-row). All existing checkbox, name-edit, confidence badge, and remove button affordances preserved.
- **review.tsx** wiring: drops `sourceLocation` route param consumption. Adds `openSheetItemId` state; passes `onLocationPress={setOpenSheetItemId}` to every row; derives `openSheetItem = scanResults.find(...)`. Mounts `<LocationChoiceSheet>` at screen bottom with `onSelect` calling `handleUpdateItem(id, { source_location: newLoc, userEdited: true })` so override telemetry fires on confirm. `confirmScan` call-site updated to single-arg.
- **tsc compile-fail discipline maintained**: scan/index.tsx and scan/receipt.tsx callers updated to drop the 2nd arg. LocationPicker + its local `sourceLocation`/`selectedLocation` state are intentionally left mounted — Plan 18-04 atomically removes the component + route params.

## Task Commits

Each task was committed atomically (TDD: RED + GREEN per task):

1. **Task 1 RED:** `7dae394` — failing tests for LocationChip + LocationChoiceSheet (12 tests red)
2. **Task 1 GREEN:** `367f69c` — LocationChip + LocationChoiceSheet primitives (12/12 green)
3. **Task 2 RED:** `a250ede` — failing tests for override-events + store signatures
4. **Task 2 GREEN:** `50fb796` — logOverrideEvents + deriveOverrideEvents + pantryStore signature drops + caller fixes (28/28 green)
5. **Task 3 (direct):** `0bca9e8` — ReviewItemRow LocationChip + review.tsx sheet wiring (no new test file per plan — coverage via Task 1 + Task 2 + Plan 04 Maestro)

_No refactor commits — GREEN implementations were clean and required no post-green cleanup._

## Files Created/Modified

### Created (9)
- `apps/mobile/src/components/pantry/LocationChip.tsx` — Pressable-wrapped display Chip
- `apps/mobile/src/components/pantry/LocationChoiceSheet.tsx` — 3-option bottom sheet
- `apps/mobile/src/components/pantry/locationSymbols.ts` — shared LOCATION_SYMBOLS / LABELS / FALLBACK
- `apps/mobile/src/components/pantry/__tests__/LocationChip.test.ts` — 6 tests
- `apps/mobile/src/components/pantry/__tests__/LocationChoiceSheet.test.ts` — 6 tests
- `apps/mobile/src/lib/logOverrideEvent.ts` — fire-and-forget POST helper
- `apps/mobile/src/lib/__tests__/logOverrideEvent.test.ts` — 5 tests
- `apps/mobile/src/app/scan/reviewHelpers.ts` — deriveOverrideEvents pure helper
- `apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts` — 6 tests

### Modified (9)
- `apps/mobile/src/types/pantry.ts` — ScanResult.source_location required; ReviewItem.aiLocation optional
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — import LOCATION_SYMBOLS from shared module; removed forked map
- `apps/mobile/src/components/pantry/ReviewItemRow.tsx` — onLocationPress prop; renders LocationChip below subtitle
- `apps/mobile/src/stores/pantryStore.ts` — 4 action signatures dropped sourceLocation; aiLocation seeding in mapScanResultsToReview; override-event dispatch in confirmScan; getAuthTokenOrNull helper
- `apps/mobile/src/stores/__tests__/pantryStore.test.ts` — fixtures updated for required source_location; rewrote receipt / instacart / confirm suites; new confirm tests for override dispatch (3 new: fire-and-forget event, no-edit skip, /confirm failure bubble)
- `apps/mobile/src/app/scan/index.tsx` — startBatchScan caller drops 2nd arg
- `apps/mobile/src/app/scan/receipt.tsx` — startReceiptScan caller drops 2nd arg
- `apps/mobile/src/app/scan/review.tsx` — drop sourceLocation route param; add openSheetItemId state; pass onLocationPress; mount LocationChoiceSheet
- `.planning/phases/18.../deferred-items.md` — log 4 pre-existing mobile test failures verified stash-and-rerun

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Seed aiLocation at scan-response time, not at first edit.** Every scan flow (camera / batch / receipt / Instacart) routes through `mapScanResultsToReview`, which copies the server's `source_location` into both `source_location` AND `aiLocation`. This means override detection is pure — no "first edit wins" state machine.
- **`void logOverrideEvents(...)` not `await logOverrideEvents(...)`.** The user's `Alert.alert('Pantry Updated!', ...)` fires immediately after the /confirm response. Telemetry is a fire-and-forget microtask. Even if the override POST takes 500ms, the user never sees it.
- **Strip aiLocation from /confirm payload.** aiLocation is mobile-only provenance used by deriveOverrideEvents. The server's `pantry_items` row doesn't need it (Phase 21 will consume via `item_override_events` instead). Explicit destructure-and-spread prevents field leakage.
- **Keep LocationPicker mounted.** Task 3 does NOT remove LocationPicker from scan/index.tsx, scan/receipt.tsx, or scan/instacart.tsx. That's Plan 18-04's atomic swap (remove component + remove now-dead route params + rebase Maestro). Mixing concerns would make each commit larger without any correctness benefit.

## Deviations from Plan

**Total: 0 auto-fixes. 1 scope-boundary log (pre-existing test failures).**

### Auto-fixed Issues

_None — the plan executed exactly as written._

### Scope-boundary items logged (not fixed)

Four pre-existing mobile test failures verified to be red **before** Phase 18-03 touched the store (stashed changes, re-ran suite, confirmed same 4 failures):

- `__tests__/auth-store.test.ts > Auth Store > initialize > should set isOnboarded based on profile.onboarding_complete`
- `src/stores/__tests__/progressionStore.test.ts > progressionStore > fetchVariations returns string[] on 200`
- `src/stores/__tests__/shoppingStore.test.ts > shoppingStore > generateList > POSTs meal_plan_id and populates currentList + items` — shape drift (`{list: {...}}` vs `{...}`)
- `src/stores/__tests__/shoppingStore.test.ts > shoppingStore > fetchCurrent > populates list + items on 200` — same shape drift

None touch pantryStore or the scan/review flow this plan owns. Logged in `deferred-items.md` alongside the 18-01/18-02 deferred items.

### Test count deltas

- **New test files (4):** LocationChip (6), LocationChoiceSheet (6), logOverrideEvent (5), reviewHelpers (6) = **23 new tests**
- **pantryStore.test.ts:** 13 → 17 tests (+4 for override dispatch, per-item source_location, confirm payload shape)
- **Plan 18-03 scope total: 40/40 green.** Full mobile suite: 338/342 green (4 pre-existing red, unrelated).

## Issues Encountered

- **tsc cross-task coupling.** Task 1's type changes (ScanResult.source_location required, ReviewItem.aiLocation optional) introduced tsc errors in files owned by Tasks 2 + 3 (pantryStore.ts, review.tsx, pantryStore.test.ts). Resolved by doing the minimum-viable fix inline during Task 1 (default pantry in mapScanResultsToReview, default pantry on manual-add, source_location: 'fridge' on test fixtures). This is standard per the plan's "compile-fail on callers passing one" note but noted here for future plans that add required fields to shared types: expect a bounded tsc cascade.
- **No renderer dependency, still works.** LocationChip + LocationChoiceSheet tests use the Phase 15-01 "component-as-function" pattern: invoke the exported function with props, traverse the returned React element tree via `.type` identity (react-native primitives are dummy function-components per vitest.setup.ts). The Modal test is the gnarliest — Modal is mocked as a pass-through, so `tree.props.visible` and `tree.props.children[0]` (the backdrop Pressable) are directly inspectable. Zero react-test-renderer / RNTL install required.

## User Setup Required

**None.** The `/api/v1/pantry/override-events` route landed in Plan 18-02 and is live; the two 18-01 migrations (`00009_item_attributes`, `00010_item_override_events`) must be applied to the live Supabase project before override telemetry actually persists to a row — but if they're not applied yet, the server route returns 500 and the mobile client swallows it via `console.warn` (fire-and-forget contract). No blocker.

## Next Phase Readiness

**Plan 18-04 (Wave 4 UAT) unblocked.** Plan 04 now has the green light to:

1. Delete `apps/mobile/src/components/pantry/LocationPicker.tsx`.
2. Strip LocationPicker JSX + `selectedLocation`/`sourceLocation` state from `scan/index.tsx`, `scan/receipt.tsx`.
3. Strip the now-dead `params: { sourceLocation }` from `scan/index.tsx`, `scan/receipt.tsx`, `scan/instacart.tsx` nav calls.
4. Rebase any Maestro flow that taps the LocationPicker (per RESEARCH Q14 inventory: flows 07/16/19 are the at-risk set — most don't actually touch the picker but the subtitle text change on scan/index.tsx cold-start should be verified).
5. Run `apps/mobile && pnpm test --run && npx tsc --noEmit -p .` as the full mobile gate + `maestro test apps/mobile/.maestro/smoke.yaml` as the acceptance gate.

No blockers for Plan 18-04. No stubs in code.

## Known Stubs

None. All data is wired end-to-end:
- LocationChip receives real `item.source_location` from the scan response.
- LocationChoiceSheet updates real item state via `handleUpdateItem`.
- Override telemetry fires real events derived from real userEdited state.
- No "coming soon" text, no hardcoded empty arrays flowing to UI, no placeholder components.

## Self-Check: PASSED

All claimed artifacts verified present on disk and committed:

- `apps/mobile/src/components/pantry/LocationChip.tsx` — FOUND
- `apps/mobile/src/components/pantry/LocationChoiceSheet.tsx` — FOUND
- `apps/mobile/src/components/pantry/locationSymbols.ts` — FOUND
- `apps/mobile/src/components/pantry/__tests__/LocationChip.test.ts` — FOUND (6 tests)
- `apps/mobile/src/components/pantry/__tests__/LocationChoiceSheet.test.ts` — FOUND (6 tests)
- `apps/mobile/src/lib/logOverrideEvent.ts` — FOUND
- `apps/mobile/src/lib/__tests__/logOverrideEvent.test.ts` — FOUND (5 tests)
- `apps/mobile/src/app/scan/reviewHelpers.ts` — FOUND
- `apps/mobile/src/app/scan/__tests__/reviewHelpers.test.ts` — FOUND (6 tests)
- Commit `7dae394` (Task 1 RED) — FOUND in git log
- Commit `367f69c` (Task 1 GREEN) — FOUND in git log
- Commit `a250ede` (Task 2 RED) — FOUND in git log
- Commit `50fb796` (Task 2 GREEN) — FOUND in git log
- Commit `0bca9e8` (Task 3) — FOUND in git log
- Test run: 40/40 Plan 18-03 scope green — VERIFIED
- tsc: clean under `npx tsc --noEmit -p .` — VERIFIED
- Grep for `sourceLocation` in pantryStore action signatures — 0 hits in interface block — VERIFIED

---
*Phase: 18-ai-auto-location-for-pantry-imports-remove-forced-fridge-pantry-freezer-choice*
*Completed: 2026-04-19*
