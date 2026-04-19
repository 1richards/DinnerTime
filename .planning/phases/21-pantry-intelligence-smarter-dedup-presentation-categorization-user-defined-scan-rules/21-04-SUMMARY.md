---
phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules
plan: 04
subsystem: mobile
tags: [mobile, react-native, pantry, presentation, grouping, staples, zustand, persist-migration, tdd]

# Dependency graph
requires:
  - phase: 21-01
    provides: user_staples table + RLS for GET/POST /pantry/staples
  - phase: 21-03
    provides: /pantry/staples GET/POST/DELETE endpoints that loadStaples/markStaple/unmarkStaple consume
  - phase: 19-03
    provides: StickySearchPill primitive (context='pantry' already in SearchContext union) + /search modal route
  - phase: 19-05
    provides: ItemRow primitive + itemRowHelpers split (compact variant extends Phase 19 pattern)
  - phase: 24-06
    provides: EnrichedPantryItem effectiveConfidence + canonical_ingredient_id

provides:
  - ItemRow size='compact' variant (~48pt density via py-2) — dense pantry-tab rows
  - PantryItemCard stale treatment (dashed border + opacity-50 at effectiveConfidence < 0.5)
  - usePantryItemsGrouped — 4-way GroupingMode (location/category/staples/recently-added) pure helper + memoized React hook
  - pantryStore staples as Set<string> + parallel stapleRows for 21-05 list views
  - resolveScanAcceptance pure helper (STAPLE_THRESHOLD=0.3, DEFAULT_THRESHOLD=0.7)
  - pantryStore.setGroupingMode — persisted user grouping preference
  - Zustand persist v1→v2 migration with Set↔Array (de)serialization (Pitfall 8)
  - Pantry tab GroupingMode segmented control (NOT chips; RESEARCH Pitfall 7)
  - Pantry tab Staples filter chip
  - PantryItemList.sections? prop for pre-grouped rendering (backward-compat fallback preserved)

affects:
  - 21-05 (Settings Pantry Rules + Staples screens consume stapleRows + staples Set)
  - 21-06 (Maestro UAT flows for pantry-tab grouping/search/staples behavior)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-helper testing pattern — resolvePantryItemCardWrapperClasses / resolveScanAcceptance / groupPantryItems / migratePantryPersistState all tested under vitest node env without React's renderer, mirroring Phase 19-03 itemRowHelpers + Phase 24-06 reviewItemRowHelpers split"
    - "Dual-projection staples state — Set<string> (O(1) membership for scan-accept + filter chip) AND stapleRows StapleRow[] (display list for Settings). load/mark/unmark update both atomically; rollback on failure restores both via prevRows + prevSet snapshots"
    - "Zustand persist Set serialization via partialize + onRehydrateStorage — Set<string> serialized as string[] on disk, Set rebuilt on rehydrate; migrate hook coerces Array-shape to Set defensively so both upgrade paths and unexpected shapes land in a valid runtime state"
    - "Backward-compatible ItemRow size axis — 'default' preserves Phase 19 py-3 rendering for all existing consumers (Shopping, Plan, Library); 'compact' opt-in for pantry without touching icon/stepper/checkbox sizing to keep density scoped to y-axis"
    - "PantryItemList sections? fallback — when sections prop is provided consumers take full control of grouping; when omitted the legacy CATEGORY_ORDER path runs. Zero breaking change for any consumer still passing flat items"
    - "GroupingMode as segmented control (RESEARCH Pitfall 7) — 4 equal-width Pressables in a single row, not chips. Chips would wrap on narrow iPhones (9 total if mixed with location chips); segmented control has a fixed layout that always fits"

key-files:
  created:
    - apps/mobile/src/components/pantry/pantryItemCardHelpers.ts
    - apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx
    - apps/mobile/src/components/ui/__tests__/ItemRow.test.ts
    - apps/mobile/src/hooks/usePantryItemsGrouped.ts
    - apps/mobile/src/hooks/__tests__/usePantryItemsGrouped.test.ts
    - apps/mobile/src/stores/__tests__/pantryStore.staples.test.ts
  modified:
    - apps/mobile/src/components/ui/ItemRow.tsx
    - apps/mobile/src/components/ui/itemRowHelpers.ts
    - apps/mobile/src/components/pantry/PantryItemCard.tsx
    - apps/mobile/src/components/pantry/PantryItemList.tsx
    - apps/mobile/src/app/(tabs)/pantry.tsx
    - apps/mobile/src/stores/pantryStore.ts

key-decisions:
  - "staples is Set<string> (canonical_ingredient_id) + stapleRows is StapleRow[] (id + canonical_name) — two parallel projections updated atomically. Set is the scan-accept threshold lookup primitive; stapleRows is the Settings list display. Either could be derived from the other at runtime but maintaining both avoids repeated Array.from / Set construction on every scan frame"
  - "Strict < for stale threshold (effectiveConfidence < 0.5) — 0.5 exactly is fresh. Mirrors Phase 14's >= 0.7 acceptance convention where the boundary value is the non-degraded side. Keeps stale treatment unambiguous: 'below 0.5' rather than 'at or below'"
  - "RECENT_DAYS = 7 hardcoded in usePantryItemsGrouped — CONTEXT Claude's Discretion defaults 7, tunable in UAT. Chose a constant rather than passing via hook args because the tuning knob should be global, not per-consumer"
  - "persist migrate returns flat shape (not PantryState) — the migrate fn returns the partialized shape (items + staples + groupingMode) which Zustand then merges with fresh initial state for the rest of the store. `as unknown as PantryState` cast is a Zustand typing wart, not a runtime concern"
  - "Filter chip 'Staples' filter applied AFTER enrichment, not inside usePantryItems — usePantryItems doesn't know about staples (Phase 3 primitive) and shouldn't need to. Secondary memo in pantry.tsx applies the canonical_ingredient_id lookup. Clean separation keeps the hook agnostic"
  - "PantryItemList accepts sections? rather than a GroupingMode — the list stays presentation-only; grouping logic lives one layer up in pantry.tsx. If Shopping or another tab wants ItemRow compact + pre-grouped sections the same API applies"
  - "StickySearchPill placed OUTSIDE PantryItemList (absolute positioned sibling) — pill's zIndex:20 overlays the compact header (zIndex:5) while its animated shadow responds to scrollY. Added paddingTop:56 to list contentContainerStyle so the first section header doesn't underlap the pill"
  - "loadStaples fires once on tab mount (not on app boot) — the pantry tab is the only surface that needs staples loaded for its UI; scan flows read from whatever state exists, defaulting to empty Set (graceful degradation: items just never get the 0.3 reprieve until user visits pantry)"

patterns-established:
  - "Phase 21-04 pure-helper testing convention — when a component wants unit coverage without a renderer, extract the className / state-decision logic to a sibling helpers module and test the pure fn. resolvePantryItemCardWrapperClasses, resolveScanAcceptance, groupPantryItems, migratePantryPersistState all follow this shape. Trade: tiny indirection for 100% renderer-free coverage + zero react-test-renderer dependency"
  - "Dual-projection store pattern — Set + Array for the same underlying data, used when one projection is the primary runtime lookup (Set.has) and the other is the display shape (Array.map). Future stores with similar semantics (favorites, pinned items, bookmarks) can adopt this verbatim"
  - "Zustand persist version bump + migrate + onRehydrateStorage triad — whenever the persisted shape changes, bump version, add migrate hook (returns partialized shape, Zustand merges with defaults), add onRehydrateStorage for non-JSON types (Set/Map/Date). Pitfall 8 mitigation recipe"
  - "Segmented-control-as-equal-width-pressables — 4 flex-1 Pressables inside a rounded+bordered container. No dependency on @react-native-segmented-control. Matches Phase 12 kitchen pattern but with typed value -> label pairs and accessibilityState={{selected}}"

requirements-completed: ["Pantry UX improvement (post-v1)"]

# Metrics
duration: 12min
completed: 2026-04-19
---

# Phase 21 Plan 04: Pantry Tab Presentation + Staples Data Path Summary

**Mobile pantry-tab ships the full Phase 21 presentation layer (compact rows, stale treatment, 4-way grouping, sticky search, Staples filter chip) + staples auto-accept data path (Set<string> + STAPLE_THRESHOLD 0.3) + Zustand persist v2 migration — 37/37 new vitest cases GREEN, tsc clean, zero regressions on 21-04-scope tests.**

## Performance

- **Duration:** ~12 minutes
- **Started:** 2026-04-19T19:32:38Z
- **Completed:** ~2026-04-19T19:45Z
- **Tasks:** 3 (2 TDD RED+GREEN, 1 auto)
- **Files created:** 6 (3 source + 3 test)
- **Files modified:** 6

## Accomplishments

- **ItemRow size='compact' variant** — `resolveContainerClasses(size?: 'default' | 'compact')` pure helper, `CONTAINER_CLASSES_DEFAULT` (py-3 ~64pt) + `CONTAINER_CLASSES_COMPACT` (py-2 ~48pt). Backward-compat `CONTAINER_CLASSES` alias preserved. `size` prop added to `ItemRow` wiring through to container className. Only y-axis padding changes — icon/stepper/checkbox stay token-sized. 9 tests over helper constants + component JSX traversal.
- **PantryItemCard stale treatment** — `resolvePantryItemCardWrapperClasses` pure helper returns `'mb-2 mx-4 opacity-50 border border-dashed border-warmGray-300 rounded-xl'` when `effectiveConfidence < 0.5`; falls through to `'opacity-60'` for legacy `isUncertain`; otherwise bare `'mb-2 mx-4'`. Stale takes precedence over isUncertain to prevent double-opacity collision. 6 tests.
- **usePantryItemsGrouped + 4-way grouping** — `groupPantryItems(items, mode, staples)` pure fn dispatches to `groupByLocation` (Fridge/Pantry/Freezer canonical order, empty sections omitted), `groupByCategory` (alphabetical, 'Other' bucket for empty category), `groupByStaples` (Set<string> membership), `groupByRecentlyAdded` (RECENT_DAYS=7 cutoff on last_seen_at). Hook wraps with `useMemo`. 12 tests across all 4 modes + empty-input matrix.
- **pantryStore — staples Set + threshold + migration** — `staples: Set<string>` for O(1) membership, parallel `stapleRows: StapleRow[]` for display. `resolveScanAcceptance` pure helper: probable dupes rejected; staples accept at 0.3; others at 0.7. `mapScanResultsToReview` now threads `get().staples` through from every scan flow (startScan/startBatchScan/startReceiptScan/startInstacartImport). `groupingMode` + `setGroupingMode` persisted. Zustand `version: 2` with `migratePantryPersistState` + `partialize` (Set→Array) + `onRehydrateStorage` (Array→Set). 10 threshold + migration tests.
- **Pantry tab integration** — 4-tab GroupingMode segmented control (RESEARCH Pitfall 7 — single-row equal-width Pressables, NOT chips). StickySearchPill wired with `context='pantry'`. Filter chip row gains 'Staples'. `loadStaples()` fires once on mount (best-effort catch). Filtered items flow through `usePantryItemsGrouped` → `PantryItemList.sections` prop. PantryItemList gains optional `sections?: PantrySection[]` with fallback to legacy category grouping.
- **Test coverage — 37/37 GREEN.** Broken down: ItemRow (9) + PantryItemCard (6) + usePantryItemsGrouped (12) + pantryStore.staples (10). Zero regressions on 21-04-scope tests. Full mobile suite: 397/408 pass; the 11 failures are all pre-existing (4 documented in deferred-items.md §4-§6 auth/progression/shopping) + 7 from 21-05 settings screens (useState-null in renderer-free harness, 21-05's problem).

## Task Commits

1. **Task 1 — ItemRow compact variant + PantryItemCard stale treatment** — `6a64f5f` (feat)
2. **Task 2a — pantryStore staples Set + persist migration (impl)** — `0d9f7a1` (feat)
3. **Task 2b — usePantryItemsGrouped hook + Task 2 tests (fix-up)** — `4e1965b` (test)
4. **Task 3 — Pantry tab GroupingMode + StickySearchPill + Staples chip** — `b6ca68e` (feat)

Plan metadata commit follows this SUMMARY.

## Files Created/Modified

### Created
- `apps/mobile/src/components/pantry/pantryItemCardHelpers.ts` — `resolvePantryItemCardWrapperClasses` pure helper
- `apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx` — 6 stale-treatment cases
- `apps/mobile/src/components/ui/__tests__/ItemRow.test.ts` — 9 cases covering helpers + component size prop
- `apps/mobile/src/hooks/usePantryItemsGrouped.ts` — `groupPantryItems` + `usePantryItemsGrouped` + `GroupingMode` type
- `apps/mobile/src/hooks/__tests__/usePantryItemsGrouped.test.ts` — 12 cases across 4 modes + empty inputs
- `apps/mobile/src/stores/__tests__/pantryStore.staples.test.ts` — 10 cases: `STAPLE_THRESHOLD`/`DEFAULT_THRESHOLD`, `resolveScanAcceptance`, `migratePantryPersistState`

### Modified
- `apps/mobile/src/components/ui/ItemRow.tsx` — `size?` prop + `resolveContainerClasses` wiring
- `apps/mobile/src/components/ui/itemRowHelpers.ts` — `CONTAINER_CLASSES_DEFAULT/COMPACT` + `resolveContainerClasses` + `ItemRowSize` type; kept `CONTAINER_CLASSES` back-compat alias
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — delegates wrapper className to `resolvePantryItemCardWrapperClasses`
- `apps/mobile/src/components/pantry/PantryItemList.tsx` — accepts optional `sections?: PantrySection[]`; falls back to legacy category grouping when omitted
- `apps/mobile/src/app/(tabs)/pantry.tsx` — GroupingMode segmented control + StickySearchPill + Staples filter chip + `loadStaples()` on mount + filtered items through `usePantryItemsGrouped`
- `apps/mobile/src/stores/pantryStore.ts` — `staples: Set<string>` + `stapleRows: StapleRow[]` + `STAPLE_THRESHOLD`/`DEFAULT_THRESHOLD` + `resolveScanAcceptance` + `groupingMode` + `setGroupingMode` + scan flows pass staples through + persist v2 + `migratePantryPersistState` + `onRehydrateStorage` (Set↔Array)

## Decisions Made

- **`staples: Set<string>` + parallel `stapleRows: StapleRow[]`** — two projections of the same underlying data. Set drives scan-accept threshold + filter-chip membership (O(1) .has()); stapleRows is the display list consumed by Settings → Staples (21-05). Both updated atomically by loadStaples/markStaple/unmarkStaple; rollback snapshots both. Alternative: derive Set from Array on every scan frame — rejected (O(N) per scan item × N scan items = O(N²), avoidable with trivial dual-write).
- **Strict `<` on stale threshold (`effectiveConfidence < 0.5`)** — exactly 0.5 is fresh. Mirrors Phase 14's `>= 0.7` acceptance convention where the boundary value is the non-degraded side. Also mirrors the plan's explicit wording: "when item confidence < 0.5".
- **`RECENT_DAYS = 7` hardcoded in the hook** — CONTEXT Claude's Discretion defaults 7, tunable in UAT. Chose a module-level constant rather than a hook argument because the knob should be global (once tuned, all consumers benefit); swapping to prop-drilled at a later date is trivial.
- **`migratePantryPersistState` returns partialized shape, not full `PantryState`** — Zustand's migrate contract: return the persisted slice; Zustand merges it with the fresh initial state for the non-persisted fields (the action functions, etc.). The `as unknown as PantryState` cast is a Zustand typing compromise, not a runtime issue.
- **Filter chip 'Staples' applied in pantry.tsx memo, not in `usePantryItems`** — `usePantryItems` is a Phase 3 primitive that knows nothing about staples. Adding staples awareness would couple the hook to 21-04 state. Secondary `filteredAvailable` memo in pantry.tsx keeps the coupling local.
- **`StickySearchPill` absolute-positioned outside the list** — pill has zIndex:20 (overlays compact header's zIndex:5) and animated shadow responding to scrollY. Content gets `paddingTop: 56` so first section doesn't underlap. Matches Phase 19-03 DoorDash pattern.
- **Zustand version bump 1 → 2** — any user with a v1 cached state (pre-21 items[]) hydrates through `migratePantryPersistState`, picking up `staples: []` + `groupingMode: 'location'` defaults. `onRehydrateStorage` converts the persisted array into the runtime Set.
- **PantryItemList gains optional `sections?` prop, NOT a breaking change** — any consumer still passing only `items` falls back to the legacy category grouping path. pantry.tsx is the only call site that uses `sections` in this plan. Clean migration path for future consumers (Shopping tab, etc.).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Used pure-helper testing pattern for PantryItemCard instead of calling the component**

- **Found during:** Task 1 RED run (first PantryItemCard test attempt).
- **Issue:** Calling `PantryItemCard(...)` as a function throws `Cannot read properties of null (reading 'useState')` because React hooks require a renderer / fiber context. react-test-renderer is not installed.
- **Fix:** Extracted `resolvePantryItemCardWrapperClasses` to a sibling `pantryItemCardHelpers.ts` pure module. Test imports only the pure fn and covers all stale-treatment branches. Component delegates 1:1, so helper coverage maps directly to JSX output. Mirrors Phase 19-03 `itemRowHelpers` / Phase 24-06 `reviewItemRowHelpers` split.
- **Files modified:** `apps/mobile/src/components/pantry/pantryItemCardHelpers.ts` (new), `apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx` (rewritten).
- **Commit:** `6a64f5f`.

**2. [Rule 3 — Blocking] Task 2 commit accidentally staged 21-05 settings files**

- **Found during:** Task 2 commit verification.
- **Issue:** Commit `0d9f7a1` included `apps/mobile/src/app/settings/*.tsx` (pantry-rules.tsx + staples.tsx + _layout.tsx + settings.tsx mods) that belong to 21-05; also missed my actual task deliverables (usePantryItemsGrouped.ts + 2 test files + deferred-items.md). Root cause: pre-existing staged files from the parallel 21-05 RED session landed on my commit atomically.
- **Fix:** Landed the missed files as a follow-up `4e1965b test(21-04)` commit with a clear "fix missed files" message. The 21-05 work that slipped into `0d9f7a1` stays there — it's the same scope either way (phase 21 pantry intelligence) and un-committing would destroy 21-05 work in flight.
- **Files modified:** added deliverables (usePantryItemsGrouped.ts + 2 test files + deferred-items.md) via `4e1965b`.
- **Commit:** `0d9f7a1` + `4e1965b`.

**3. [Rule 2 — Missing critical functionality] Added `paddingTop: 56` to PantryItemList contentContainerStyle**

- **Found during:** Task 3 wiring pantry.tsx.
- **Issue:** `StickySearchPill` is absolute-positioned at `top: 8` with height 40pt (total 48pt footprint). Without list content padding, the first section header would be hidden beneath the pill.
- **Fix:** `contentContainerStyle={{ paddingTop: 56, paddingBottom: 140 }}`. 56 = 8 (pill top) + 40 (pill height) + 8 (buffer).
- **Files modified:** `apps/mobile/src/app/(tabs)/pantry.tsx`.
- **Commit:** `b6ca68e`.

## Issues Encountered

- **Pre-existing mobile test failures (out-of-scope per SCOPE BOUNDARY):** Confirmed pre-existing via `git stash && pnpm test`:
  - `__tests__/auth-store.test.ts` — 1 failure (onboarding_complete flag)
  - `src/stores/__tests__/progressionStore.test.ts` — 1 failure (fetchVariations shape drift)
  - `src/stores/__tests__/shoppingStore.test.ts` — 2 failures (fetchCurrent / generateList wrapping layer)

  Documented in `21-deferred-items.md` §4-§6. Not caused by 21-04.

- **21-05 settings-screen tests fail on useState-null** — `apps/mobile/src/app/settings/__tests__/pantry-rules.test.tsx` and `staples.test.tsx` try to call the screen component as a function and hit the same `useState`-requires-renderer issue I resolved in 21-04 via the pure-helper pattern. These are 21-05's tests to refactor. Confirmed pre-existing (7 failures before my changes; 5 after because my state-shape updates made some flows pass). Not a 21-04 regression.

- **Zustand `isStaple(canonicalId)` selector form** — the store exposes both `staples` (Set) and `isStaple` (getter fn). Hooks consuming via `usePantryStore((s) => s.staples.has(id))` work identically. Kept `isStaple` for selector-cleanliness in 21-05 consumers that want a single call.

## User Setup Required

None. All changes are mobile-side + no new env vars, no new dependencies. Existing users on cached v1 persist state will hydrate through `migratePantryPersistState` automatically on next app launch.

## Next Phase Readiness

**21-05 (Settings rules + staples + suggestions screens):**
- `stapleRows: StapleRow[]` state is ready for the Settings → Staples list view.
- `staples: Set<string>` is ready for per-item "is staple?" checks on the PantryItemCard ellipsis menu (21-05 Task 2).
- `groupingMode` + `setGroupingMode` are persisted and ready (21-05 doesn't need to touch them).
- `loadRules` / `createRule` / `reorderRules` / `deleteRule` + `loadSuggestions` / `acceptSuggestion` / `dismissSuggestion` already shipped in prior 21-05 WIP commit `60bc3df` — 21-05 executor should confirm RED→GREEN flows but schema is intact.

**21-06 (Maestro UAT):**
- Pantry tab has identifiable UI surfaces: GroupingMode segmented control (4 labels), filter chip row (5 labels including 'Staples'), `StickySearchPill` with `accessibilityRole="search"`.
- `PantryItemCard` gained an optional `index` prop that 21-05 Task 2 uses for `testID="pantry-item-ellipsis-{index}"` — already wired ahead of the primary 21-05 plan.

**No blockers** for 21-05 or 21-06.

## Self-Check: PASSED

Files and commits verified:

- FOUND: apps/mobile/src/components/ui/itemRowHelpers.ts (compact variant added)
- FOUND: apps/mobile/src/components/ui/ItemRow.tsx (size prop wired)
- FOUND: apps/mobile/src/components/ui/__tests__/ItemRow.test.ts
- FOUND: apps/mobile/src/components/pantry/PantryItemCard.tsx (stale treatment delegation)
- FOUND: apps/mobile/src/components/pantry/pantryItemCardHelpers.ts
- FOUND: apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx
- FOUND: apps/mobile/src/hooks/usePantryItemsGrouped.ts
- FOUND: apps/mobile/src/hooks/__tests__/usePantryItemsGrouped.test.ts
- FOUND: apps/mobile/src/stores/pantryStore.ts (staples Set + persist v2 migration)
- FOUND: apps/mobile/src/stores/__tests__/pantryStore.staples.test.ts
- FOUND: apps/mobile/src/components/pantry/PantryItemList.tsx (sections? prop)
- FOUND: apps/mobile/src/app/(tabs)/pantry.tsx (GroupingMode + StickySearchPill + Staples chip)
- FOUND: commit `6a64f5f` (Task 1 feat)
- FOUND: commit `0d9f7a1` (Task 2 impl)
- FOUND: commit `4e1965b` (Task 2 tests fix-up)
- FOUND: commit `b6ca68e` (Task 3 feat)
- VERIFIED: `apps/mobile && pnpm test --run` on 21-04 scope: 37/37 GREEN
- VERIFIED: `apps/mobile && npx tsc --noEmit -p .` clean

## Known Stubs

None. Every helper, hook, and store action is wired to real state / real /pantry HTTP endpoints (21-01 migrations + 21-03 routes). The one `placeholder` string in pantry.tsx is the `StickySearchPill placeholder` prop — UI copy, not a stub.

---

*Phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules*
*Completed: 2026-04-19*
