---
phase: 22-plan-experience-refactor
plan: 02
subsystem: ui
tags: [week-actions, action-sheet, ios, zustand, mealplan, telemetry, tdd, maestro]

# Dependency graph
requires:
  - phase: 22-plan-experience-refactor (plan 22-00)
    provides: POST /meal-plans/entries/assign body.date param + GET /meal-plans?from=&to= range endpoint + logPlanEvent + sanitizePayload (consumed by duplicateLastWeek + WeekActionSheet telemetry)
  - phase: 22-plan-experience-refactor (plan 22-01)
    provides: Plan tab HandoffSheet mount + handleShoppingHandoff (reused verbatim as onShoppingList)
  - phase: 07-meal-planning
    provides: useMealPlanStore fetchCurrent + generate + MealPlan shape (extended with shiftWeek + duplicateLastWeek actions)
provides:
  - apps/mobile/src/stores/mealPlanStore.ts — shiftWeek(deltaDays) and duplicateLastWeek() actions on MealPlanState + addDaysIso helper
  - apps/mobile/src/components/plan/WeekActionSheet.tsx — iOS ActionSheetIOS wrapper component with 5 week actions + Cancel (parent-owned visibility)
  - apps/mobile/src/app/(tabs)/plan.tsx — overflow ellipsis ('Week actions' accessibilityLabel) replaces inline regenerate icon; opens WeekActionSheet with wired handlers + telemetry
  - apps/mobile/.maestro/35-week-actions.yaml — flipped from red stub to green walk-through (3 screenshots)
affects: [22-03-month-view, 22-05-skill-progression, 22-06-info-density-swipe]

# Tech tracking
tech-stack:
  added: []  # no new deps — reuses Wave 0 telemetry + 22-01 handoff
  patterns:
    - "ActionSheet-as-effect: visibility prop is parent-owned; a single useEffect([visible]) opens ActionSheetIOS on false→true transitions. Component returns null — side effect only."
    - "Telemetry-per-action: each week-level action emits its own plan.* event with variant ('forward'|'backward') to disambiguate shift direction; all payloads sanitized through the 14-key whitelist before leaving the client."
    - "Store action composition: shiftWeek delegates to generate() with a shifted week_start — one place to mutate plans, uniform error/loading semantics."
    - "duplicateLastWeek as sequential POSTs: weeks are ≤7 entries, user is waiting, so sequential /entries/assign is simpler than Promise.all and preserves ordering for telemetry."
    - "Skipped-entry drop on duplicate: respects user intent from the previous week (22-RESEARCH Open Q3) — duplicating a skipped meal would restore work the user explicitly rejected."

key-files:
  created:
    - apps/mobile/src/components/plan/WeekActionSheet.tsx
    - apps/mobile/src/components/plan/WeekActionSheet.test.ts
  modified:
    - apps/mobile/src/stores/mealPlanStore.ts
    - apps/mobile/src/stores/__tests__/mealPlanStore.test.ts
    - apps/mobile/src/app/(tabs)/plan.tsx
    - apps/mobile/.maestro/35-week-actions.yaml

key-decisions:
  - "Preserved 'Shopping list for week' cart icon from 22-01 even though the sheet also exposes it. Two entry points, zero UX regression: existing Maestro flow 32 keeps its selector and users who've memorized the icon don't lose their muscle memory."
  - "Regenerate retains its existing Alert confirm inside the sheet path — destructive actions deserve a reconfirmation even when launched from a native sheet that already marks the row as red."
  - "Each week action fires a fresh session_id via crypto.randomUUID() (with epoch-ms fallback). Sessions are per-action, not per-sheet-open, so retries can be distinguished in analytics."
  - "addDaysIso constructed Date('YYYY-MM-DDT00:00:00Z') rather than parsing the ISO directly: UTC-safe math with no timezone drift on DST-crossing boundaries. Matches DatePickerSheet's toIso contract from 22-00."
  - "Soft no-op when duplicateLastWeek finds no previous plan: the user just hasn't been using the app long enough. Surfacing an error here would be a false negative — nothing is wrong, there's simply nothing to duplicate."

patterns-established:
  - "iOS ActionSheetIOS as an effect-only primitive: wrap showActionSheetWithOptions in useEffect([visible]), return null, let the parent own the visibility toggle. Cleaner than a Modal + custom UI and matches iOS conventions."
  - "Composed store actions: a new action that conceptually orchestrates an existing action (shiftWeek → generate) should delegate, not duplicate. Uniform loading/error surfaces automatically; future changes to generate() propagate for free."
  - "Sequential POSTs with fetchCurrent at the end for batch operations: simpler than Promise.all, preserves ordering for telemetry, and the final fetchCurrent gives the client a fresh server snapshot instead of client-derived state."

requirements-completed: [PLAN-X-05, PLAN-X-08]

# Metrics
duration: 6min
completed: 2026-04-22
---

# Phase 22 Plan 02: Week Actions Summary

**Single overflow-ellipsis icon on the Plan tab opens an iOS ActionSheet listing five week-level operations (Regenerate / Shift +1 / Shift -1 / Duplicate last week / Shopping list), backed by two new mealPlanStore actions (shiftWeek + duplicateLastWeek) shipped via TDD with 7 new test cases.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-22T07:31:00Z
- **Completed:** 2026-04-22T07:37:55Z
- **Tasks:** 2 (Task 1 was TDD: RED → GREEN)
- **Files created:** 2
- **Files modified:** 4
- **Tests added:** 15 new cases (7 mealPlanStore + 8 WeekActionSheet)

## Accomplishments

- **PLAN-X-08 closed.** `useMealPlanStore.shiftWeek(deltaDays)` and `useMealPlanStore.duplicateLastWeek()` shipped with full TDD coverage (RED commit → GREEN commit). `shiftWeek` delegates to the existing `generate(weekStart)` with `addDaysIso` applied, so loading/error state flows through the existing channels. `duplicateLastWeek` reads the previous week via `GET /meal-plans?from=&to=` (Wave 0 range endpoint), then sequentially POSTs `/meal-plans/entries/assign` with `date + recipe_id` preserved for each non-skipped entry; `status === 'skipped'` entries are dropped per 22-RESEARCH Open Q3.
- **PLAN-X-05 closed (preservation).** Week view remains the default — no new tab, no new route, no layout change. The only Plan-tab UI delta is replacing the single inline regenerate icon with an `ellipsis` icon labeled "Week actions".
- **WeekActionSheet primitive shipped.** Apple-style `ActionSheetIOS` wrapper with 5 options + Cancel. Uses the `HeaderEllipsis` pattern established in Phase 15 — parent owns `visible`, the component opens on the false→true transition via `useEffect([visible])` and returns `null`. Regenerate is flagged destructive; Cancel is index 5. Title reads "Week actions" for VoiceOver + visual clarity.
- **Plan tab wiring.** New `weekSheetVisible` state; ellipsis tap sets it to true; the sheet's `onDismiss` resets it. Each of the 5 action handlers (`handleRegenerateFromSheet`, `handleShiftForward`, `handleShiftBackward`, `handleDuplicateLastWeek`, the existing `handleShoppingHandoff` from 22-01) fires sanitized telemetry with `meal_plan_id + week_start` and — for shifts — `variant: 'forward'|'backward'`. Regenerate retains its pre-existing Alert confirm inside the wrapper for destructive-action safety.
- **Maestro flow 35 green.** Flipped from red stub to a walk-through producing 3 screenshots: plan loaded → action sheet visible with Shift option → cancel dismissed. Subsequent plans (22-03, 22-04) can extend without collision.

## Task Commits

1. **Task 1 RED: failing tests for shiftWeek + duplicateLastWeek** — `ed5e112` (test)
2. **Task 1 GREEN: implement shiftWeek + duplicateLastWeek** — `1157ff6` (feat)
3. **Task 2: WeekActionSheet + plan.tsx wiring + Maestro 35** — `51839d6` (feat)
4. **Task 1 typecheck fixup: relax tuple destructure in test** — `a266c75` (fix)

_Task 1 follows RED-GREEN TDD pattern per `tdd="true"` flag in the plan — one commit per phase. Task 2 ships as a single feat commit. The final fixup commit patches a TypeScript strict-mode issue discovered during Task 2's typecheck (not a behavior change)._

## Files Created

### `apps/mobile/src/components/plan/WeekActionSheet.tsx` (+81 lines)

Exports `WeekActionSheet(props: WeekActionSheetProps): null`. Props surface:
- `visible: boolean` (parent-owned)
- `onDismiss: () => void` (fired after any tap, even Cancel)
- `onRegenerate`, `onShiftForward`, `onShiftBackward`, `onDuplicateLastWeek`, `onShoppingList`: five action handlers

Implementation: `useEffect([visible])` calls `ActionSheetIOS.showActionSheetWithOptions({ options: [...5 labels, 'Cancel'], cancelButtonIndex: 5, destructiveButtonIndex: 0, title: 'Week actions' }, (idx) => { /* dispatch idx to handler */; onDismiss(); })`. No render body — returns `null`.

### `apps/mobile/src/components/plan/WeekActionSheet.test.ts` (+210 lines)

8 cases total. 6 callback-dispatch tests (one per idx 0..5), 1 module-shape test (function name + type), 1 options-contract test (exact options array + cancelButtonIndex=5 + destructiveButtonIndex=0 + title). Mocks `react-native.ActionSheetIOS.showActionSheetWithOptions` via `vi.mock`.

## Files Modified

### `apps/mobile/src/stores/mealPlanStore.ts` (+94 lines)

- Added `shiftWeek` + `duplicateLastWeek` to `MealPlanState` interface with JSDoc.
- Added `addDaysIso(iso, days)` helper (UTC-safe).
- Two new store actions per the `<interfaces>` block in the PLAN.

### `apps/mobile/src/stores/__tests__/mealPlanStore.test.ts` (+218 / -10 lines)

Added two new `describe` blocks:
- `shiftWeek`: 3 cases (+7 day, -7 day, null-plan no-op)
- `duplicateLastWeek`: 4 cases (happy-path POST per entry, skip-drop, empty-prev soft no-op, null-plan no-op)

Also relaxed tuple destructure types in 3 places (separate `fix` commit) — mock.calls is `any[][]` under vitest's types.

### `apps/mobile/src/app/(tabs)/plan.tsx` (+140 / -20 lines)

- Import `WeekActionSheet`.
- New state `weekSheetVisible`.
- 5 new handlers: `handleOpenWeekSheet`, `handleWeekSheetDismiss`, `handleShiftForward`, `handleShiftBackward`, `handleDuplicateLastWeek`, `handleRegenerateFromSheet` (replaces the old inline `handleRegenerate` which was removed).
- Action row: replaced `handleRegenerate` arrow.clockwise Pressable with `handleOpenWeekSheet` ellipsis Pressable (`accessibilityLabel="Week actions"`). Preserved the `handleShoppingHandoff` cart icon from 22-01.
- `<WeekActionSheet />` mounted at screen root as sibling of `SwapSheet / CookConfirm / HandoffSheet`.

### `apps/mobile/.maestro/35-week-actions.yaml` (+27 / -4 lines)

Flipped from red stub to: `_ensure-logged-in` → Plan tab → wait for week title → screenshot → tap "Week actions" → wait for "Shift" option → screenshot → tap Cancel → screenshot.

## Decisions Made

- **Preserved the cart icon + added ellipsis as a parallel entry point.** The PLAN says "Shopping list (already in 22-01 — surfaced here too)". Rather than remove the dedicated icon (would break Maestro flow 32's selector) I kept both: the ellipsis sheet includes "Shopping list for week" AND the top-row cart icon remains. Two entry points, one `handleShoppingHandoff` callback. No new UX states.
- **Regenerate keeps its Alert confirm inside the sheet path.** The existing destructive-action guard (Alert with Cancel / Regenerate) remains. Rationale: the native ActionSheet's red-highlight for index 0 is cosmetic; the Alert gives the user a second chance. Cost is one extra tap — worth it for a destructive action.
- **Per-action session IDs, not per-sheet-open.** Each of the 5 telemetry firings mints its own `crypto.randomUUID()` (with `wk-${Date.now()}` fallback for environments without the crypto global). This lets analytics distinguish "user opened the sheet, tapped Shift +1, then immediately tapped Shift -1" (two sessions) from "user opened, tapped, got an error, retried" (two sessions too — but with matching variant).
- **Chose useEffect([visible]) over prop-driven imperative open.** An alternative was exposing an `openSheet()` method via ref. useEffect is simpler, React-idiomatic, and works with the existing `useState` pattern. The component returns `null` — no render state to manage.
- **Removed the orphaned `handleRegenerate` callback entirely.** After wiring the sheet, the pre-existing `handleRegenerate` was no longer referenced. Kept it alive would have shipped dead code. `handleRegenerateFromSheet` supersedes it and adds telemetry on top.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<action>` blocks specified exact store signatures, exact ActionSheet option labels, exact telemetry event names, and exact test behaviors. All 5 action handlers wired, all 7 new mealPlanStore test cases green, all 8 new WeekActionSheet test cases green, flow 35 flipped from red stub to 3-screenshot walk-through, typecheck clean on all modified production files.

One test-harness typecheck fix (relaxing `[url]: [string]` tuple destructure to `call[0]` indexed access) was committed separately under `fix(22-02): ...` as a pure test-infra adjustment — no behavior change, just making the test suite strict-mode clean for future plans.

## Issues Encountered

None. The only discovery was the TypeScript strict-mode issue on vitest mock.calls tuple destructuring, which was trivially fixable by switching to indexed access. Pre-existing cooking-test + hook-test typecheck warnings (TS2578 Unused '@ts-expect-error') exist in the repo but are entirely out of scope for this plan and remain untouched.

## Next Phase Readiness

- **Plan 22-03 (Month view) unblocked.** The Plan tab's action row is stable: one cart icon + one ellipsis. 22-03 can add a Week/Month segmented control in the header without colliding with action-row space. The WeekActionSheet pattern (parent-owned visibility + ActionSheetIOS effect + null render) is ready to be re-used for MonthActionSheet.
- **Plan 22-04 (Day drill-down) unblocked.** `duplicateLastWeek` and `shiftWeek` don't touch DayRow.onPress — that surface remains owned by 22-01. 22-04 can push `/plan/[date]` without collision.
- **Plan 22-05 (Skill progression) unblocked.** Stretch-meal indicators are derived client-side per render; the new store actions don't mutate `entries[].is_stretch?` (which remains undefined on fetch and populated by stretchPicker). No migration needed.
- **Plan 22-06 (Info density + swipe) unblocked.** DayRow swipe gestures are orthogonal to the week-level sheet. Both can coexist; the sheet is only reachable via header ellipsis and the swipes are only reachable on row bodies.
- **Telemetry pipeline production-ready for 3 new events.** `plan.week_regenerated / plan.week_shifted / plan.week_duplicated` all use the 14-key whitelist (Phase 20 pattern, established in Wave 0). Analysts can now distinguish regenerate-from-ellipsis vs regenerate-from-previous-inline-icon (the latter no longer exists — which itself is a signal).

---

## Self-Check: PASSED

All 2 created artifacts exist on disk. All 4 task commits (`ed5e112`, `1157ff6`, `51839d6`, `a266c75`) resolvable via `git log`. Mobile test suite (4 relevant files: WeekActionSheet.test + mealPlanStore.test + DatePickerSheet.test + dayRowHelpers.test): 44/44 green. Typecheck on all modified production files (WeekActionSheet, plan.tsx, mealPlanStore.ts): clean.

---

*Phase: 22-plan-experience-refactor*
*Completed: 2026-04-22*
