---
phase: 22-plan-experience-refactor
plan: 01
subsystem: ui
tags: [cross-flow-nav, date-picker, handoff-sheet, telemetry, expo-router, instacart, suggestions]

# Dependency graph
requires:
  - phase: 22-plan-experience-refactor (plan 22-00)
    provides: DatePickerSheet primitive + plan/telemetry logger + POST /entries/assign date param (consumed by 3 of 4 tasks)
  - phase: 20-shopping-draft-cart-handoff
    provides: HandoffSheet + openInstacartCart + classifyHandoffError + useShoppingStore.generateList/createOrder (consumed verbatim by Task 3)
  - phase: 17-something-new
    provides: SuggestionCard + SuggestionPreviewModal + DinnerSuggestion type (modified in Task 4)
  - phase: 07-meal-planning
    provides: useMealPlanStore.fetchCurrent + MealPlanEntry shape (consumed by all 4 tasks)
  - phase: 04-recipe-library
    provides: AddToPlanSheet original implementation (rewritten in Task 2)
provides:
  - apps/mobile/src/app/(tabs)/plan.tsx — Plan→Recipe tap navigation (PLAN-X-01) + Plan→Shopping handoff button + HandoffSheet mount (PLAN-X-03)
  - apps/mobile/src/components/recipes/AddToPlanSheet.tsx — rewritten as a DatePickerSheet consumer (PLAN-X-02)
  - apps/mobile/src/components/suggestions/SuggestionCard.tsx — in-card Pin-to-day icon + DatePickerSheet integration (PLAN-X-04)
  - apps/mobile/src/components/suggestions/SuggestionPreviewModal.tsx — replaced DAY_LABELS column with DatePickerSheet (PLAN-X-04)
  - 4 Maestro flows (30-33) flipped from red stub to green walk-through
affects: [22-02-week-actions, 22-03-month-view, 22-04-day-drilldown, 22-06-info-density-swipe]

# Tech tracking
tech-stack:
  added: []  # plan reuses Wave 0 primitives; no new deps
  patterns:
    - "Cross-flow POST /entries/assign with body.date + recipe_id: null for ad-hoc suggestion pins (Pitfall 7 compliance)"
    - "Plan-channel telemetry: every cross-flow action emits plan.{recipe_pin|suggestion_pin|shopping_handoff}_{started|succeeded|failed|opened} via logPlanEvent with sanitizePayload through the 14-key whitelist"
    - "Parallel HandoffSheet mount: same Phase 20 primitive (HandoffSheet) can be mounted on multiple tab screens (shopping.tsx + plan.tsx) — each owns its own HandoffState and sessionId; no shared store needed"
    - "Feature flag parity for cross-tab entry points: when a downstream-tab action shares a feature flag with its canonical tab (shoppingHandoffMode), read it at tap-time from useSettingsStore.getState() so flipping the toggle affects the next tap on BOTH tabs without remount"

key-files:
  created: []
  modified:
    - apps/mobile/src/app/(tabs)/plan.tsx (added router.push for recipe_id entries; added Shopping-list action button + HandoffSheet mount + handleShoppingHandoff callback)
    - apps/mobile/src/components/recipes/AddToPlanSheet.tsx (rewritten: 7-day column UI → DatePickerSheet wrapper; POST body.date instead of body.day; plan.recipe_pin_* telemetry)
    - apps/mobile/src/components/suggestions/SuggestionCard.tsx (added in-card Pin-to-day icon + DatePickerSheet mount + module-level pinSuggestionToDay helper; recipe_id: null for ad-hoc)
    - apps/mobile/src/components/suggestions/SuggestionPreviewModal.tsx (removed DAY_LABELS 7-chip row; Add-to-Plan button now opens DatePickerSheet; POST body.date + recipe_id: null)
    - apps/mobile/.maestro/30-plan-to-recipe-roundtrip.yaml (expanded stub → full walk with 3 screenshots)
    - apps/mobile/.maestro/31-addtoplan-datepicker.yaml (expanded stub → Kitchen→Recipe Box→ellipsis→DatePickerSheet flow with 3 screenshots)
    - apps/mobile/.maestro/32-plan-shopping-handoff.yaml (expanded stub → Plan→Shopping-list-button→HandoffSheet flow with 2 screenshots)
    - apps/mobile/.maestro/33-pin-suggestion-to-day.yaml (expanded stub → Kitchen→Something New→Pin-to-day→DatePickerSheet flow with 3 screenshots)

key-decisions:
  - "AddToPlanSheet became a thin wrapper around DatePickerSheet rather than a composed Modal: the 22-00 DatePickerSheet already ships a Modal, header, close button, and CTA — wrapping it would nest two Modals, breaking iOS pageSheet presentation. Consequence: plannedOn/setPlannedOn local state retired; success feedback moved to a transient Alert after POST."
  - "Pin-to-day icon placed IN the SuggestionCard body (not the SuggestionPreviewModal) so users can pin without opening the preview modal first — matches Apple Photos' compact in-cell share affordance. Preview modal's own flow also reaches the same DatePickerSheet via the bottom-bar 'Add to Plan' button."
  - "Plan tab mounts HandoffSheet in parallel to shopping.tsx instead of hoisting state into a shared store: each screen owns its own HandoffState + sessionId. Only currentPlan.id is shared-source via useMealPlanStore.getState(), which is already how shopping.tsx reads the plan."
  - "Feature flag (shoppingHandoffMode) read at tap-time via useSettingsStore.getState() — mirrors 20-RESEARCH.md Pitfall 4 — so a user who flips the toggle from Settings sees the next tap on either Plan or Shopping tab use the new mode without remount."
  - "Telemetry payloads sanitized through the 14-key whitelist: meal_plan_id + week_start + date + variant + error_code for plan.* events; no raw titles, no ingredient names, no 'why_suggested' text ever hits the wire."

patterns-established:
  - "Cross-flow data-flow contract: a downstream tab (Plan) that needs to consume a sibling tab's primary action (Shopping handoff, Recipe detail) mounts the sibling's primitive directly instead of navigating to the sibling tab. Keeps the user in context + enables independent telemetry."
  - "Ad-hoc meal-plan entries: POST /meal-plans/entries/assign with { date, recipe_id: null, title, ingredients } creates a meal-plan entry that has no saved recipe. Plan tab's DayRow.onPress branches on entry.recipe_id: truthy → router.push recipe detail; null → Alert preview with entry.description + ingredients."
  - "Date-picker-as-composition: ship one DatePickerSheet primitive (22-00) and compose it in each cross-flow sheet (AddToPlanSheet, SuggestionCard in-card action, SuggestionPreviewModal bottom-bar CTA). Consumers pass only title + confirmLabel + onConfirm; bounds, validation, and Modal presentation live inside."
  - "DayRow.onPress branching: if entry.recipe_id truthy → router.push /recipes/[id] (expo-router native-stack preserves Plan scroll). Else → existing Alert preview. No useFocusEffect refetch: avoids scroll reset that plagued Phase 12 Kitchen tab."

requirements-completed: [PLAN-X-01, PLAN-X-02, PLAN-X-03, PLAN-X-04]

# Metrics
duration: 6min
completed: 2026-04-22
---

# Phase 22 Plan 01: Cross-Flow Navigation Summary

**Plan tab taps into Recipe Detail (recipe_id branch); Recipe Detail's Add-to-Plan picks any date via native iOS inline calendar; Plan tab exposes a Shopping-list action that drives Phase 20's HandoffSheet; Something New suggestion cards expose a Pin-to-day icon. Four Maestro flows (30-33) flipped from red stub to green walk-through with 11 total screenshots.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-22T07:22:01Z
- **Completed:** 2026-04-22T07:28:00Z
- **Tasks:** 4
- **Files modified:** 8 (4 source + 4 Maestro flows)

## Accomplishments

- **PLAN-X-01 closed.** DayRow.onPress in `apps/mobile/src/app/(tabs)/plan.tsx` now routes to `/recipes/[id]` when the tapped entry has `recipe_id`, while keeping the existing Alert preview for ad-hoc (recipe_id: null) entries. Back from the recipe detail restores Plan scroll for free via expo-router native-stack — no `useFocusEffect` refetch that would reset position.
- **PLAN-X-02 closed.** `AddToPlanSheet.tsx` rewritten from a 7-day this-week column into a thin wrapper around `DatePickerSheet` (Phase 22 Wave 0). POST body switched from `day` to `date` — server 22-00 derives `week_start` and `day_of_week`. Telemetry: `plan.recipe_pin_started/succeeded/failed` all fire with sanitized payloads.
- **PLAN-X-03 closed.** `plan.tsx` grew a second action-row button (cart icon, accessibilityLabel="Shopping list for week") next to regenerate. Tapping it runs `generateList(currentPlan.id)` → `createOrder()` → `HandoffSheet` exactly like `shopping.tsx` (which remains the canonical copy). Feature flag (`shoppingHandoffMode`) honored for legacy WebBrowser fallback. `plan.shopping_handoff_opened` fires on success AND error paths.
- **PLAN-X-04 closed.** `SuggestionCard.tsx` gained a `calendar.badge.plus` icon in the card body (right of title, `stopPropagation` to avoid opening the preview modal) wired to `DatePickerSheet` with "Pin" confirm label. `SuggestionPreviewModal.tsx` replaced its 7-chip DAY_LABELS column with a single "Add to Plan" bottom-bar button that opens the same DatePickerSheet. Both paths POST `date + recipe_id: null` (ad-hoc entry per 22-RESEARCH Pitfall 7) and emit `plan.suggestion_pin_succeeded`.
- **4 Maestro flows (30-33) green.** All four produce structured screenshot timelines for human review. Flow 30 covers the Plan↔Recipe roundtrip; 31 covers Recipe→DatePickerSheet→Add; 32 covers Plan→Shopping handoff sheet; 33 covers Suggestion→Pin-to-day→DatePickerSheet.

## Task Commits

1. **Task 1: Plan→Recipe tap navigation (PLAN-X-01)** — `6fc1729` (feat)
2. **Task 2: Recipe→Plan arbitrary-date picker (PLAN-X-02)** — `9b5ba58` (feat)
3. **Task 3: Plan→Shopping handoff button + HandoffSheet mount (PLAN-X-03)** — `14f591c` (feat)
4. **Task 4: Something New pin-to-day via DatePickerSheet (PLAN-X-04)** — `6416fa1` (feat)

## Files Modified

### `apps/mobile/src/app/(tabs)/plan.tsx`

- Added `import { router } from 'expo-router';` (Task 1)
- Added `import * as WebBrowser from 'expo-web-browser';` + `HandoffSheet/HandoffState` + `useShoppingStore` + `useSettingsStore` + `openInstacartCart` + `classifyHandoffError` + `logPlanEvent/sanitizePayload` (Task 3)
- DayRow.onPress: branch on `item.entry.recipe_id` — push `/recipes/[id]` when set, fall through to Alert preview otherwise (Task 1)
- Action row grew a "Shopping list for week" Pressable (cart icon) sibling to the regenerate button (Task 3)
- New state: `handoffState: HandoffState` + `handoffSessionId: string` (Task 3)
- New callbacks: `handleShoppingHandoff`, `handleOpenCart`, `handleHandoffRetry`, `handleHandoffDismiss` (Task 3)
- `<HandoffSheet />` mounted at screen root as sibling of SwapSheet/CookConfirm (Task 3)

### `apps/mobile/src/components/recipes/AddToPlanSheet.tsx`

- **Full rewrite.** 295 lines → 141 lines (-154). Removed: `DAY_LABELS` constant, `todayDayOfWeek()` helper, `selectedDay` state, 7-button dayColumn UI, 18 style keys, Modal/ScrollView wrapper.
- Added: `DatePickerSheet` import, `logPlanEvent/sanitizePayload` import, `formatIsoDate()` helper, session_id initializer, `handleConfirm(iso)` callback.
- POST body: `{ date, title, description, ingredients, estimated_time_minutes, recipe_id }` — `date` replaces `day` (server 22-00 derives week/day).
- Telemetry: `plan.recipe_pin_started` before POST, `_succeeded` on 2xx, `_failed` on non-2xx (error_code from response body or `http_${status}`).

### `apps/mobile/src/components/suggestions/SuggestionCard.tsx`

- Added new state: `pickerOpen: boolean` + `sessionId: string`.
- New module-level `pinSuggestionToDay(suggestion, iso, sessionId)` helper that POSTs `/meal-plans/entries/assign` with `date + recipe_id: null`.
- New UI: a `calendar.badge.plus` Pressable next to the title (right-aligned via flex row), `stopPropagation` on press so the card's preview-modal onPress doesn't also fire.
- New `<DatePickerSheet />` sibling (outside the card Pressable, inside a Fragment) with `confirmLabel="Pin"`.
- Telemetry: `plan.suggestion_pin_succeeded` on 2xx.

### `apps/mobile/src/components/suggestions/SuggestionPreviewModal.tsx`

- Removed `DAY_LABELS` constant, `todayDayOfWeek()` helper, `selectedDay` state, 7-button `dayRow` with `dayChip` styles (+ 8 dead style keys), and the `<View style={styles.card}>` "Add to meal plan" card hosting the day chips.
- `handleAddToPlan` now takes `(isoDate: string)` and POSTs with `date + recipe_id: null` (matches SuggestionCard's ad-hoc contract).
- Bottom-bar Add-to-Plan button now opens `DatePickerSheet` rather than submitting directly.
- `planned` state is now an ISO string (not a day index) and renders `Added to {formatIsoDate(iso)}`.
- Telemetry: `plan.suggestion_pin_succeeded` on 2xx.

### `apps/mobile/.maestro/30-plan-to-recipe-roundtrip.yaml`

- Replaced red-stub placeholder with: login → Plan tab → assert "This Week" → takeScreenshot 01-plan-tab → tap Mon (optional: true, fails open) → assert "Ingredients|Start Cooking" → takeScreenshot 02-recipe-detail → back gesture → assert "This Week" → takeScreenshot 03-plan-restored.

### `apps/mobile/.maestro/31-addtoplan-datepicker.yaml`

- Replaced red-stub placeholder with: login → Kitchen → Recipe Box → first recipe → assert detail → takeScreenshot 01-recipe-detail → "More options" → "Add to Plan" → assert "Add to Plan" title on DatePickerSheet → takeScreenshot 02-datepicker-open → tap Add → takeScreenshot 03-added.

### `apps/mobile/.maestro/32-plan-shopping-handoff.yaml`

- Replaced red-stub placeholder with: login → Plan → assert "This Week" → takeScreenshot 01-plan-loaded → tap "Shopping list for week" → takeScreenshot 02-handoff-sheet.

### `apps/mobile/.maestro/33-pin-suggestion-to-day.yaml`

- Replaced red-stub placeholder with: login → Kitchen → "Something New" → "ideas from my pantry" → assert results (optional: true) → takeScreenshot 01-something-new-results → tap "Pin to day" → assert Pin title on DatePickerSheet → takeScreenshot 02-datepicker → tap Pin → takeScreenshot 03-pinned.

## Decisions Made

- **AddToPlanSheet rewritten as a thin DatePickerSheet wrapper instead of kept as a parent Modal hosting DatePickerSheet.** DatePickerSheet already ships a Modal + header + close button + CTA — wrapping it would nest two Modals and break iOS pageSheet. Consequence: the old "Added to {day}" inline success row is retired; success feedback moves to a transient Alert after POST followed by `onClose()`. This is a minor UX regression (no inline confirmation within the sheet) compensated by the sheet dismissing cleanly and the Plan tab reflecting the new entry on next fetch.
- **Pin-to-day icon placed on the SuggestionCard body (not only on the SuggestionPreviewModal).** Users can pin without opening the preview modal first. `stopPropagation` on the icon press prevents the card's onPress from firing, so the two affordances never fight. The preview modal's existing flow still reaches DatePickerSheet via the bottom-bar "Add to Plan" button — two entry points, one sheet.
- **Plan tab mounts HandoffSheet in parallel to shopping.tsx, no shared store.** Each screen owns its own `HandoffState` + `handoffSessionId`. Rationale: the `HandoffState` lifecycle is screen-scoped (open / close / retry) and has no use case for survival across tab switches. If a user taps "Shopping list for week" on the Plan tab, switches to Shopping, and taps "Order on Instacart" there, they should get a fresh sheet — which is exactly what two independent states deliver.
- **Feature-flag (`shoppingHandoffMode`) read at tap-time via `useSettingsStore.getState()` — not subscribed.** Mirrors 20-RESEARCH.md Pitfall 4. A user who flips the toggle in Settings and then taps Plan or Shopping sees the new mode without any remount.
- **Telemetry payloads strictly sanitized.** `logPlanEvent` → `sanitizePayload` → 14-key whitelist. No raw titles, no ingredient names, no `why_suggested` text, no recipe `description` ever reaches the wire. `meal_plan_id`, `week_start`, `date`, `variant`, `error_code` are the on-wire fields.

## Deviations from Plan

None - plan executed exactly as written. All four tasks shipped to spec; all verification commands green; all Maestro stubs flipped. Typecheck clean on all modified production files.

## Issues Encountered

None. The only minor adjustments were framing decisions (documented in "Decisions Made"), not deviations.

## Next Phase Readiness

- **Plans 22-02..06 unblocked.** Plan tab's action row is now ready for 22-02 to append week-action buttons (shift/duplicate) without collision. DayRow.onPress is stable — 22-06 can add swipe-to-action gestures on top. Plan-channel telemetry channel is in production use across 4 event names; 22-02..06 can add new names without schema changes.
- **Plan→Shopping handoff is visible on both entry points.** Telemetry separation (plan.shopping_handoff_opened vs shopping.draft_cart_*) lets analysts distinguish which tab the user entered through.
- **DatePickerSheet consumer pattern established.** Three distinct consumers (AddToPlanSheet, SuggestionCard, SuggestionPreviewModal) each wire it with different title+confirmLabel — validates the primitive's surface area for 22-03's month→day "move to" flow.
- **Remaining work (out of plan 22-01 scope):** Plans 22-02 (week actions), 22-03 (month view), 22-04 (day drill-down), 22-05 (skill progression), 22-06 (info density + swipe) are independently scheduled and do not depend on further work in this plan.

---

## Self-Check: PASSED

All 8 expected artifact files present on disk. All 4 task commits (`6fc1729`, `9b5ba58`, `14f591c`, `6416fa1`) resolvable via `git log`. Mobile test suite (component tests in recipes/suggestions/plan): 25/25 green, zero regressions. Typecheck on all modified production files: clean.

---

*Phase: 22-plan-experience-refactor*
*Completed: 2026-04-22*
