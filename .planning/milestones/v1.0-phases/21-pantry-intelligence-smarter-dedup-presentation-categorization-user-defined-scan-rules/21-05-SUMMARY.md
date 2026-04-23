---
phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules
plan: 05
subsystem: mobile
tags: [typescript, react-native, expo-router, zustand, pantry, rules, staples, suggestions, settings, draggable-flatlist]

# Dependency graph
requires:
  - phase: 21-01
    provides: migrations 00016-00019 (user_staples, user_location_rules, suggested_rules, canonical_scan_counts + promote_candidate_canonicals RPC)
  - phase: 21-02
    provides: ruleEvaluator + suggestionAggregator + canonicalPromoter services
  - phase: 21-03
    provides: 12 Wave 2 endpoints on /pantry/* (staples, rules, suggestions, preview, category-override)
  - phase: 21-04
    provides: pantryStore.staples (Set<string>) + stapleRows + groupingMode + usePantryItemsGrouped hook + PantryItemCard stale treatment

provides:
  - react-native-draggable-flatlist@4.0.3 installed (JS-only, no native pod; Wave 0 gate)
  - pantryStore rules/suggestions actions — loadRules/createRule/deleteRule/reorderRules + loadSuggestions/acceptSuggestion/dismissSuggestion with optimistic rollback
  - Settings sub-route group `app/settings/` with nested Stack layout (card-presentation push per Phase 15-02)
  - Settings → Pantry Rules screen — draggable Active Rules, Name Mappings, Suggestions, 30-day preview, inline rule editor
  - Settings → Staples screen — staples list + canonical-search Add modal + remove
  - PantryItemCard ellipsis action — Mark as staple / Remove from staples via ActionSheetIOS with testID contract
  - Settings tab — new Pantry Rules + Staples navigation rows

affects:
  - 21-06 (Maestro UAT can now exercise the rules/staples surfaces; testIDs in place)

# Tech tracking
tech-stack:
  added: [react-native-draggable-flatlist@4.0.3]
  patterns:
    - "authedFetch helper inside pantryStore — mirrors mealPlanStore/shoppingStore convention; attaches bearer token + /api/v1 prefix; used by all 7 rules/suggestions actions + 3 staples actions"
    - "Optimistic reorder via pure reorderByIds helper — store action snapshots prev state, calls reorderByIds for deterministic local reorder, PATCHes /rules/reorder, rolls back on server error"
    - "isStaple(id) stable read API across pantryStore — 21-04 stores staples as Set<string> (O(1) lookup for auto-accept) + parallel stapleRows for display; both screens consume isStaple to avoid dependence on internal shape"
    - "Pure helper extraction for hook-heavy screens — renderSuggestionSummary pulled out of pantry-rules.tsx into pantryRulesHelpers.ts so vitest node env can cover it; matches Phase 21-04 PantryItemCard pattern (pure helper + source-level contract)"
    - "Source-level contract tests — readFileSync + assertion against screen source text locks load-bearing contract points (testIDs, store selectors, import graph) without needing a React renderer"
    - "ActionSheetIOS inline on PantryItemCard — HeaderEllipsis primitive is designed for navigation headers; a card-row overflow uses bare Pressable + ActionSheetIOS.showActionSheetWithOptions directly"

key-files:
  created:
    - apps/mobile/src/app/settings/_layout.tsx
    - apps/mobile/src/app/settings/pantry-rules.tsx
    - apps/mobile/src/app/settings/staples.tsx
    - apps/mobile/src/app/settings/pantryRulesHelpers.ts
    - apps/mobile/src/app/settings/__tests__/pantryRulesHelpers.test.ts
    - apps/mobile/src/app/settings/__tests__/pantry-rules.test.tsx
    - apps/mobile/src/app/settings/__tests__/staples.test.tsx
    - apps/mobile/src/stores/__tests__/pantryStore.rules.test.ts
  modified:
    - apps/mobile/package.json
    - apps/mobile/src/stores/pantryStore.ts
    - apps/mobile/src/app/(tabs)/settings.tsx
    - apps/mobile/src/components/pantry/PantryItemCard.tsx

key-decisions:
  - "react-native-draggable-flatlist@4.0.3 is JS-only (no podspec) — it's built on Reanimated + Gesture Handler which are already bundled with Expo SDK 55; `pod install` was NOT required; dev-client rebuild deferred to 21-06 UAT per plan Task 0"
  - "pantryStore.ts reconciliation — 21-04 landed concurrently with 21-05 and merged the staples data model into `staples: Set<string>` (O(1) scan-accept lookup) + `stapleRows: StapleRow[]` (display list). 21-05's UI consumes stapleRows for rendering and the isStaple(id) selector for membership, keeping callers decoupled from the persisted shape."
  - "Rule editor is an inline Modal (not a nested route) — simpler state management + re-open semantics; creation success reloads rules via the store's loadRules call"
  - "Canonical picker queries supabase directly — canonical_ingredients has `USING (true)` RLS on SELECT (Phase 24a migration 00011); no server endpoint needed for search, keeping this plan scoped"
  - "30-day preview panel fires on canonical pick (not on every keystroke) — target canonical is stable through the editor session, so one fetch per pick is the right granularity"
  - "DraggableFlatList height-capped at min(rules × 56, 320) — avoids nesting DFL's pan responder inside the outer ScrollView, which would steal long-press gestures; this sizing keeps the Active Rules section scrollable-in-place within a fixed viewport"
  - "Source-level contract tests for hook-heavy screens — component-as-function invocation fails on useState hooks (vitest node env lacks React's hook machinery); readFileSync + substring assertions lock the load-bearing contract (testIDs, store selectors) without needing RN renderer or testing-library"
  - "PantryItemCard ellipsis is a bare Pressable + ActionSheetIOS — not the HeaderEllipsis primitive (which expects the nav-header tintColor context); placement is card-row trailing with hitSlop=10 for 44pt touch target"
  - "testID contract for Maestro 21-06 — `add-rule-fab`, `rule-delete-{canonical_name|alias}`, `staple-remove-{name}`, `add-staple-fab`, `pantry-item-ellipsis-{index}` all wired per plan I2 revision"

patterns-established:
  - "Phase 21-05 authedFetch pattern for pantryStore — all 10 new actions (rules + suggestions + staples) route through a single authedFetch helper that adds /api/v1 prefix + Bearer token; future pantry store additions (e.g. category-override) should follow this shape"
  - "Source-level contract test pattern for hook-heavy screens — when useState/useEffect disallow component-as-function invocation under vitest node env, assert on readFileSync() of the screen's source text to lock testIDs, imports, and store selectors (mirrors Phase 21-04 PantryItemCard pattern)"

requirements-completed: ["Pantry UX improvement (post-v1)"]

# Metrics
duration: 13min
completed: 2026-04-19
---

# Phase 21 Plan 05: Settings Rules + Staples UI + PantryItemCard Ellipsis Summary

**Settings → Pantry Rules (draggable list + 30-day preview + suggestions) + Settings → Staples (list + canonical-search Add) + PantryItemCard "Mark as staple" ActionSheet + pantryStore rules/suggestions/staples actions — unlocks 21-06 Maestro UAT with every testID in place. 41/41 plan-scoped tests GREEN, typecheck clean.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-04-19T19:31:47Z
- **Completed:** 2026-04-19 (~19:45Z)
- **Tasks:** 4 (0, 1 TDD, 2, 3 TDD)
- **Files created:** 8 | **Files modified:** 4

## Accomplishments

- **Task 0 — Wave 0 compatibility gate.** Installed `react-native-draggable-flatlist@4.0.3`. Confirmed it's a JS-only library (no podspec → no native pod; relies on Reanimated + Gesture Handler which Expo SDK 55 already bundles). `require.resolve` GREEN, typecheck clean. Dev-client rebuild + runtime Maestro smoke deferred to 21-06 UAT where the user's rebuild session naturally absorbs the cost.
- **Task 1 — pantryStore rules/suggestions + pantryRulesHelpers.** Added `reorderByIds` pure helper (filters missing ids, rewrites precedence 0..N-1, 2 tests). Added 7 rules/suggestions actions on pantryStore via a new `authedFetch` helper: loadRules/createRule/deleteRule/reorderRules + loadSuggestions/acceptSuggestion/dismissSuggestion. All mutations are optimistic with rollback; acceptSuggestion reloads rules on success so newly-created rules surface immediately. 9 store tests + 2 helper tests = 11/11 GREEN. Also includes a minimum staples surface (loadStaples/markStaple/unmarkStaple/isStaple) that later got reconciled with 21-04's Set<string> projection into a dual-projection (Set + stapleRows array) design.
- **Task 2 — Settings sub-routes + tab entries + PantryItemCard ellipsis.** Created `app/settings/_layout.tsx` (nested Stack, card-presentation push per Phase 15-02), `app/settings/pantry-rules.tsx` (~370 lines: ACTIVE RULES draggable list + NAME MAPPINGS list + SUGGESTIONS section with Accept/Dismiss + Add Rule FAB → inline modal editor with canonical search via supabase direct + 30-day preview panel via GET /preview), `app/settings/staples.tsx` (~190 lines: staples list with remove + Add Staple modal with canonical search via supabase direct). Extended `(tabs)/settings.tsx` with two new navigation rows (Pantry Rules + Staples). Extended `PantryItemCard.tsx` with an ellipsis trigger (`testID="pantry-item-ellipsis-{index}"`) opening ActionSheetIOS with "Mark as staple" / "Remove from staples" + Mark used / Mark gone actions.
- **Task 3 — Screen-level contract coverage.** Extracted `renderSuggestionSummary` into pantryRulesHelpers.ts so vitest node env can cover it (3 tests). Added source-level contract tests: pantry-rules.test.tsx asserts presence of `add-rule-fab`, `rule-delete-`, `DraggableFlatList` import, helper usage (4 tests). staples.test.tsx asserts `add-staple-fab`, `staple-remove-`, `stapleRows` selector, `No staples yet` empty state, `markStaple(row.id, row.canonical_name)` wiring, `loadStaples()` mount call (6 tests). 13/13 new tests GREEN across the two screens. Pattern mirrors Phase 21-04 PantryItemCard.test.tsx (pure helper + class-contract) since hook-heavy screens can't be component-as-function invoked under vitest node env.
- **testID contract for Maestro 21-06** — every testID the plan's I2 revision called for is wired: `add-rule-fab`, `rule-delete-{canonical_name|alias}`, `staple-remove-{name}`, `add-staple-fab`, `pantry-item-ellipsis-{index}`.

## Task Commits

1. **Task 0 — install react-native-draggable-flatlist@4.0.3** — `3b462bf` (chore)
2. **Task 1 RED — add failing tests for pantryStore rules/suggestions + pantryRulesHelpers** — `b50799d` (test)
3. **Task 1 GREEN — pantryStore rules/suggestions/staples actions** — `60bc3df` (feat)
4. **Task 2 — Settings sub-routes + tab entries + PantryItemCard ellipsis** — landed as part of `0d9f7a1` (feat) alongside concurrent 21-04 work; files in scope include `apps/mobile/src/app/settings/_layout.tsx`, `pantry-rules.tsx`, `staples.tsx`, `apps/mobile/src/app/(tabs)/settings.tsx`, and the PantryItemCard ellipsis additions
5. **Task 3 — snapshot/contract tests + extract renderSuggestionSummary helper** — `833aaea` (test)

Plan metadata commit appended after SUMMARY creation.

## Files Created/Modified

- `apps/mobile/package.json` — added `react-native-draggable-flatlist@^4.0.3` dependency.
- `apps/mobile/src/stores/pantryStore.ts` — added authedFetch helper + RulesState/SuggestedRule/CreateRuleInput types + 7 rules/suggestions actions + 4 staples actions + reorderByIds import. Post-reconciliation with 21-04, staples is Set<string> (O(1) scan-accept lookup) + stapleRows (display) with atomic dual-projection updates.
- `apps/mobile/src/app/settings/_layout.tsx` — new Stack layout for nested settings routes (card-presentation push per Phase 15-02).
- `apps/mobile/src/app/settings/pantry-rules.tsx` — new screen: Active Rules draggable list + Name Mappings + Suggestions + Add Rule FAB + inline RuleEditorModal (rule-type picker, canonical search via supabase direct, location picker, 30-day preview panel via GET /pantry/preview).
- `apps/mobile/src/app/settings/staples.tsx` — new screen: staples list + remove + Add Staple modal with canonical search via supabase direct.
- `apps/mobile/src/app/settings/pantryRulesHelpers.ts` — new: reorderByIds pure helper + renderSuggestionSummary pure helper (extracted from pantry-rules.tsx for vitest coverage).
- `apps/mobile/src/app/(tabs)/settings.tsx` — added two navigation rows: Pantry Rules → /settings/pantry-rules, Staples → /settings/staples.
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — added ellipsis trigger with ActionSheetIOS menu (Mark as staple / Remove from staples / Mark used / Mark gone). `testID="pantry-item-ellipsis-{index}"` for 21-06 Maestro.
- `apps/mobile/src/stores/__tests__/pantryStore.rules.test.ts` — 9 new tests covering all rules/suggestions actions + optimistic rollback.
- `apps/mobile/src/app/settings/__tests__/pantryRulesHelpers.test.ts` — 2 tests for reorderByIds + 3 tests for renderSuggestionSummary.
- `apps/mobile/src/app/settings/__tests__/pantry-rules.test.tsx` — 3 helper tests + 4 source-level contract checks.
- `apps/mobile/src/app/settings/__tests__/staples.test.tsx` — 6 source-level contract checks.

## Decisions Made

- **JS-only library, no pod install** — `react-native-draggable-flatlist@4.0.3` ships no podspec; it's pure JS built on Reanimated + Gesture Handler (both already bundled with Expo SDK 55). `pod install` was therefore a no-op. Typecheck GREEN. Dev-client rebuild + runtime Maestro smoke deferred to 21-06 UAT where the user's rebuild session already absorbs that cost.
- **pantryStore 21-04/21-05 reconciliation** — 21-04 landed its pantryStore changes concurrent with 21-05, arriving at a dual-projection state: `staples: Set<string>` (O(1) membership for scan-accept threshold + pantry-tab filter chip) and `stapleRows: StapleRow[]` (display list for Settings → Staples). 21-05 UI consumes `stapleRows` for rendering and `isStaple(id)` for membership checks, insulating callers from the internal Set/Array split.
- **Canonical picker via supabase direct** — `canonical_ingredients` has publicly-readable RLS (`USING (true)` on SELECT per Phase 24a migration 00011), so the mobile modal can query directly with `.ilike('canonical_name', '%…%').limit(10)`. No new server endpoint needed, keeping this plan scoped.
- **Inline Modal rule editor** — simpler than a nested route; open/close state lives on the PantryRulesScreen, reset on each visible→true transition. Creation success triggers `loadRules()` so the new rule surfaces without a full refetch round-trip.
- **DraggableFlatList sizing** — capped at `min(rules × 56, 320)` so the draggable gesture responder doesn't nest inside the outer ScrollView's (which would steal long-press). Keeps Active Rules scrollable-in-place within a fixed viewport.
- **Source-level contract tests** — hook-heavy screens (useState/useEffect) can't be component-as-function invoked under vitest node env because React's hook machinery isn't threaded through. Rather than install testing-library or the React renderer, assert on `readFileSync(source)` substrings to lock testIDs, imports, store selectors. Mirrors Phase 21-04 PantryItemCard.test.tsx pattern (pure helper + class-contract only).
- **PantryItemCard ellipsis is a bare Pressable + ActionSheetIOS** — HeaderEllipsis primitive (Phase 15-04) is tuned for nav-header usage with its own tintColor/accessibility defaults; inline on a card row, a plain Pressable with `hitSlop={10}` gives us a 44pt touch target without fighting the primitive's defaults. Action menu shape matches HeaderEllipsis (labels + cancel + optional destructiveButtonIndex).
- **acceptSuggestion reloads rules after success** — the aggregator-written suggestion becomes an ingredient_aliases row (name_mapping) or user_location_rules row (location_mapping) on accept. Without reload the UI would show the suggestion disappear but the new rule wouldn't materialize until next screen visit. loadRules() after accept closes that gap.
- **testID contract for Maestro I2** — every testID the plan's I2 revision called for is wired: `add-rule-fab` (FAB), `rule-delete-{canonical_name|alias}` (both location + name mapping delete buttons), `staple-remove-{name}` (staples row trash), `add-staple-fab` (staples FAB), `pantry-item-ellipsis-{index}` (PantryItemCard ellipsis trigger, index-scoped).

## Deviations from Plan

Two small Rule 3 (blocking) deviations; one Rule 2 (missing critical functionality); documented inline below. None changes plan scope.

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Add minimum staples actions in pantryStore**

- **Found during:** Task 2 preparation. Plan 21-05 Task 2 calls for `loadStaples/markStaple/unmarkStaple/isStaple` on pantryStore, which the plan frontmatter says 21-04 owns. But 21-04 had not yet landed at Task 1 start.
- **Issue:** Without staples actions, the Staples screen + PantryItemCard ellipsis can't wire up.
- **Fix:** Added a minimum staples surface (loadStaples/markStaple/unmarkStaple/isStaple) in Task 1 with `staples: StapleRow[]` shape. Post-21-04 landing concurrent, the store reconciled to the dual-projection design (Set<string> + StapleRow[]) where isStaple(id) remains the stable read API. No callers needed revision.
- **Commits:** `60bc3df` (initial staples actions), later reconciled in `0d9f7a1` (21-04's landing).

**2. [Rule 3 - Blocking] pantryRulesHelpers.reorderByIds precedence-renumber bug**

- **Found during:** Task 1 RED.
- **Issue:** Initial implementation used `forEach`'s index when renumbering precedence, producing gaps when ids were missing from the source list (e.g. `[b, ghost, a]` → precedences `[0, 2]` instead of `[0, 1]`).
- **Fix:** Switched to a classic `for...of` loop tracking `out.length` as the new precedence counter; missing-id robustness test now GREEN.
- **Commit:** Test went RED in `b50799d`, helper fix folded into the same commit's follow-up.

**3. [Rule 3 - Blocking] Hook-heavy screens can't be invoked as plain functions**

- **Found during:** Task 3 initial test authoring.
- **Issue:** Tried component-as-function pattern (like Phase 15-01 ItemRow/PantryItemCard.test patterns) but PantryRulesScreen + StaplesScreen use `useState`/`useEffect` which require React's hook machinery that vitest node env doesn't thread through. Tests errored with `Cannot read properties of null (reading 'useState')`.
- **Fix:** Two-pronged: (a) extract `renderSuggestionSummary` as a pure helper in pantryRulesHelpers.ts (the only piece of rendering logic that warrants unit coverage); (b) write source-level contract tests that `readFileSync` the screen source and assert on substrings for testIDs, imports, store selectors. Matches the Phase 21-04 PantryItemCard.test.tsx pattern (pure helper tests + class-contract only, no component invocation).
- **Commit:** `833aaea`.

## Issues Encountered

- **Pre-existing out-of-scope test failures (4 tests, all stable baseline):** auth-store.test.ts (isOnboarded initialization), progressionStore.test.ts (fetchVariations 200 path), shoppingStore.test.ts (generateList + fetchCurrent currentList shape). Confirmed pre-existing via `git stash` + `pnpm test --run` showing 4 same failures on the Phase 21-04 baseline. Not regressions from 21-05. Logged to deferred-items.md by prior plans.
- **Concurrent 21-04 execution merged changes mid-plan** — my Task 1's `pantryStore.ts` edits were reconciled with 21-04's Set<string> + persist version bump + groupingMode work in commit `0d9f7a1`. My Task 2 screen files landed in that same commit alongside 21-04's `usePantryItemsGrouped` + related test files (the commit message attributes everything to 21-04, but scope-wise the Settings screens + ellipsis are 21-05 work). No functional impact — the reconciled store shape is self-consistent and all 41 plan-scoped tests GREEN.

## User Setup Required

None for the autonomous portion. **At 21-06 UAT:** the dev client must be rebuilt (`xcodebuild` + `xcrun simctl install booted`) so the simulator picks up the new `react-native-draggable-flatlist` package at runtime. Although the library is JS-only (no pod), the Metro bundler needs a fresh start with `--clear` to pick up the new dependency. If the dev client crashes on the Pantry Rules screen with a "module not found" for draggable-flatlist, that's the indicator — rebuild the dev client.

## Next Phase Readiness

**21-06 (Maestro UAT):** fully unblocked. All testIDs plan I2 calls for are wired:
- `add-rule-fab` — Pantry Rules screen FAB
- `rule-delete-{canonical_name|alias}` — per-rule delete buttons (location + name mapping)
- `add-staple-fab` — Staples screen FAB
- `staple-remove-{name}` — per-staple remove buttons
- `pantry-item-ellipsis-{index}` — PantryItemCard ellipsis trigger (index-scoped to preserve flow determinism)

Maestro flow 26-pantry-rules.yaml can now exercise: Settings tab → Pantry Rules row → FAB → rule editor → canonical pick → preview → save → reorder → delete.
Maestro flow 24-pantry-staples.yaml can exercise: Pantry tab → item ellipsis → Mark as staple → Settings → Staples → verify row → remove.

**No blockers** for 21-06.

## Self-Check: PASSED

Files and commits verified:

- FOUND: apps/mobile/src/app/settings/_layout.tsx (new)
- FOUND: apps/mobile/src/app/settings/pantry-rules.tsx (new)
- FOUND: apps/mobile/src/app/settings/staples.tsx (new)
- FOUND: apps/mobile/src/app/settings/pantryRulesHelpers.ts (new)
- FOUND: apps/mobile/src/app/settings/__tests__/pantryRulesHelpers.test.ts (new)
- FOUND: apps/mobile/src/app/settings/__tests__/pantry-rules.test.tsx (new)
- FOUND: apps/mobile/src/app/settings/__tests__/staples.test.tsx (new)
- FOUND: apps/mobile/src/stores/__tests__/pantryStore.rules.test.ts (new)
- FOUND: apps/mobile/package.json (modified — react-native-draggable-flatlist@^4.0.3)
- FOUND: apps/mobile/src/stores/pantryStore.ts (modified — 10 new actions + authedFetch helper)
- FOUND: apps/mobile/src/app/(tabs)/settings.tsx (modified — 2 new navigation rows)
- FOUND: apps/mobile/src/components/pantry/PantryItemCard.tsx (modified — ellipsis ActionSheet)
- FOUND: commit `3b462bf` (Task 0)
- FOUND: commit `b50799d` (Task 1 RED)
- FOUND: commit `60bc3df` (Task 1 GREEN)
- FOUND: commit `0d9f7a1` (Task 2 — bundled with concurrent 21-04)
- FOUND: commit `833aaea` (Task 3)
- VERIFIED: `pnpm test --run src/stores/__tests__/pantryStore.rules.test.ts src/stores/__tests__/pantryStore.test.ts src/app/settings/__tests__/` → 41/41 GREEN
- VERIFIED: `npx tsc --noEmit -p .` clean
- VERIFIED: full suite — 410/414 tests GREEN (4 failures all pre-existing, out-of-scope: auth-store, progressionStore, shoppingStore)

## Known Stubs

None. All 10 new pantryStore actions hit real endpoints on packages/server (21-03 shipped) and real Supabase tables (21-01 migrations 00016-00019). Both Settings screens render real store data and real canonical_ingredients search results via supabase direct. PantryItemCard ellipsis wires directly to markStaple/unmarkStaple → POST/DELETE /staples. Zero hardcoded empty values, zero placeholders, zero TODOs flowing to UI.

The only "approximate" behavior documented explicitly: GET /pantry/preview uses normalized-name match for scan_events rows written pre-/confirm (which lack canonical_ingredient_id on their items) — this is a design choice per RESEARCH Open Q1, not a stub.

---

*Phase: 21-pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules*
*Completed: 2026-04-19*
