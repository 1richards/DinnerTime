---
phase: 20-shopping-refactor-push-to-instacart-draft-cart-instead-of-creating-orders
plan: 04
subsystem: ui
tags: [react-native, expo-router, zustand, feature-flag, telemetry, instacart, handoff]

# Dependency graph
requires:
  - phase: 20-00
    provides: settingsStore.shoppingHandoffMode feature flag + persisted rollback toggle
  - phase: 20-01
    provides: logShoppingEvent + sanitizePayload telemetry pipeline, openInstacartCart deep-link helper, classifyHandoffError discriminator
  - phase: 20-02
    provides: Settings ShoppingHandoffSection UI that toggles the feature flag
  - phase: 20-03
    provides: HandoffSheet three-state discriminated-union modal (idle/sending/success/error)
provides:
  - Shopping tab wired to HandoffSheet flow with feature-flag-gated rollback to Phase 8 inline WebBrowser
  - Per-tap session_id + 4 lifecycle telemetry events (started/succeeded/failed/dismissed) + 2 open-channel events via openInstacartCart
  - Renamed /shopping/orders → /shopping/handoffs (UI-only; DB table shopping_orders unchanged)
  - Renamed /shopping/order/[id] → /shopping/handoff/[id] with 'Handoff details' / 'Resend to Instacart' copy
  - Redirect stubs on both old routes so Maestro flow 12 + any saved deep links continue to resolve
  - Maestro flow 12 rebased: 'Instacart cart' + 'View Instacart carts' label assertions (filename preserved per CLAUDE.md UAT rule)
affects:
  - 20-05 (UAT happy-path Maestro flow 29 will exercise this wiring end-to-end)
  - Future shopping features — any screen surfacing cart history should adopt the 'Instacart cart' vocabulary

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feature flag read at tap time (not module load) — Settings toggle flips next tap immediately without remount"
    - "Per-handoff session_id via crypto.randomUUID with Date.now() fallback — ties draft_cart_started/succeeded/failed/dismissed + handoff_opened_{app|web} into a single client-side correlation window"
    - "Route-rename via Redirect stub — `<Redirect href=...>` on legacy path preserves deep links and Maestro flow history while UI migrates"
    - "UI-only vocabulary migration — DB table + store types stay on 'order' nouns; only screen copy + accessibilityLabels + route segments flip to 'handoff'/'cart'"

key-files:
  created:
    - apps/mobile/src/app/shopping/handoffs.tsx
    - apps/mobile/src/app/shopping/handoff/[id].tsx
  modified:
    - apps/mobile/src/app/(tabs)/shopping.tsx
    - apps/mobile/src/app/shopping/orders.tsx (→ Redirect stub)
    - apps/mobile/src/app/shopping/order/[id].tsx (→ Redirect stub)
    - apps/mobile/.maestro/12-shopping-orders.yaml

key-decisions:
  - "Read shoppingHandoffMode at tap time inside handleOrder (not at module load) so Settings flips land on the very next tap — per 20-RESEARCH.md Pitfall 4"
  - "Both legacy and draft_cart paths set handoffState.kind='sending' so the Button's loading spinner behaves identically regardless of mode — consistent UX for users on rollback"
  - "Render HandoffSheet at the bottom of the SafeAreaView (sibling to AddItemSheet) — both are Modals so logical stacking is handled by React Native's Modal system"
  - "Do NOT auto-reissue the Instacart call on retry — the 'Try again' CTA merely resets sheet state to idle; user re-taps the Order button to retry. Prevents the 'calling Instacart twice' anti-pattern from 20-RESEARCH.md"
  - "Keep Maestro flow filename 12-shopping-orders.yaml (not renamed to 12-shopping-handoffs.yaml) per CLAUDE.md UAT guidance — renaming flow files invalidates history"
  - "Old /shopping/orders path preserved as Redirect stub (not deleted) so saved navigation state, deep links, and the existing Maestro flow 12 tap-sequence continue to resolve"

patterns-established:
  - "Feature-flag gated rollback: `if (mode === 'legacy') { ...phase-8 code path... return; }` — unchanged previous flow stays as a drop-in fallback, flag flips via Settings UI from 20-02, default stays on the new flow"
  - "Handoff telemetry session-id pattern: generate once per tap, thread through all downstream events, never persist — short-lived correlation ID"

requirements-completed:
  - SHOP-DC-01
  - SHOP-DC-02
  - SHOP-DC-03
  - SHOP-DC-04
  - SHOP-DC-05

# Metrics
duration: 5min
completed: 2026-04-22
---

# Phase 20 Plan 04: Shopping tab integration + orders→handoffs rename Summary

**Shopping tab now opens HandoffSheet (3-state discriminated-union modal) on 'Order on Instacart' tap with feature-flag-gated rollback to Phase 8 WebBrowser inline flow; /shopping/orders → /shopping/handoffs UI rename with redirect stubs preserving legacy deep links and Maestro flow 12.**

## Performance

- **Duration:** 5min
- **Started:** 2026-04-22T06:02:49Z
- **Completed:** 2026-04-22T06:07:33Z
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- Rewired `apps/mobile/src/app/(tabs)/shopping.tsx` to mount HandoffSheet, read `settingsStore.shoppingHandoffMode` at tap time, emit four distinct draft-cart lifecycle telemetry events, and preserve Phase 8 behavior verbatim under the `'legacy'` mode branch
- `handleOpenCart` CTA handler invokes `openInstacartCart(url, { sessionId })` which itself emits `handoff_opened_app` or `handoff_opened_web` depending on deep-link resolution — completes the 6-event handoff telemetry funnel
- Renamed the past-orders surface to past-Instacart-carts: created `handoffs.tsx` + `handoff/[id].tsx` with 'Instacart cart' / 'No Instacart carts yet' / 'Handoff details' / 'Resend to Instacart' copy; left the DB table `shopping_orders` and the `ShoppingOrder` type unchanged per 20-RESEARCH.md D-07
- Converted old route files (`orders.tsx`, `order/[id].tsx`) to `<Redirect>` stubs so any saved navigation state, deep links, or Maestro flow 12 taps continue to resolve
- Rebased Maestro flow 12 to assert 'Instacart cart' vocabulary and switched its tap selector to `id: "View Instacart carts"` (falls back to the legacy `.*Orders.*` text matcher for older simulator builds); filename kept at `12-shopping-orders.yaml` per CLAUDE.md UAT history-preservation rule

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire shopping.tsx handleOrder — HandoffSheet + feature flag + telemetry** — `d5254d4` (feat)
2. **Task 2: Rename orders.tsx → handoffs.tsx + order/[id].tsx → handoff/[id].tsx with redirect stubs + Maestro rebase** — `21f1b24` (feat)

**Plan metadata:** _(to be added in final docs commit)_

## Files Created/Modified

- `apps/mobile/src/app/(tabs)/shopping.tsx` — Rewrote handleOrder with feature-flag branch, 4 telemetry events, fresh session UUID per tap; added handleOpenCart/handleRetry/handleDismiss handlers; mounted HandoffSheet; rerouted action-row Pressable to /shopping/handoffs and updated accessibilityLabel
- `apps/mobile/src/app/shopping/handoffs.tsx` — NEW. Past Instacart carts list with 'Instacart cart' copy and EmptyState 'No Instacart carts yet'. Navigates to `/shopping/handoff/${id}` on row tap
- `apps/mobile/src/app/shopping/handoff/[id].tsx` — NEW. Per-cart detail with 'Handoff details' / 'Sent {date}' / 'Resend to Instacart' copy; all shoppingStore wiring (orders find, reorder, fetchVariations) unchanged
- `apps/mobile/src/app/shopping/orders.tsx` — Replaced with `<Redirect href="/shopping/handoffs" />` stub
- `apps/mobile/src/app/shopping/order/[id].tsx` — Replaced with `<Redirect href={\`/shopping/handoff/${id}\`} />` stub preserving the id route param
- `apps/mobile/.maestro/12-shopping-orders.yaml` — Updated text assertions + comment header; added `id: "View Instacart carts"` primary selector with legacy text fallback; renamed flow title to "shopping carts: navigate to Instacart cart history screen"

## Decisions Made

- **Feature-flag read at tap time, not module load.** `useSettingsStore.getState().shoppingHandoffMode` is called inside `handleOrder`'s `useCallback` body on each tap. Alternative considered: destructure at component render and memoize — rejected because Zustand's `getState()` on a persisted store always returns the current value without subscribing, which is exactly what we want (no re-renders on flag flip, just a read on next tap).
- **Both paths set sending state.** The legacy branch sets `handoffState.kind='sending'` at entry even though it doesn't render the HandoffSheet — this keeps the Order button's loading spinner behavior identical across modes and avoids UX drift between flag states.
- **Retry CTA resets sheet state only.** User re-taps the Order button to actually retry the Instacart call. Auto-reissuing on retry was considered and rejected per 20-RESEARCH.md "Calling Instacart twice" anti-pattern — a double-invoke risks duplicate shopping_orders rows.
- **Redirect stubs over deleting old files.** `orders.tsx` + `order/[id].tsx` now export `<Redirect>` components. Alternative considered: delete the files and rely on expo-router's 404. Rejected because Maestro flow 12 has historical tap sequences that hit the old path directly, and some saved navigation state in AsyncStorage may reference `/shopping/orders`.
- **Kept Maestro flow filename `12-shopping-orders.yaml`.** Per CLAUDE.md UAT section: "renaming Maestro files invalidates flow history; copy-existing rather than rename."
- **DB table `shopping_orders` intentionally NOT renamed.** 20-RESEARCH.md D-07 explicitly locked this — pure UI vocabulary migration. Avoids a migration + type rename cascade that would touch shoppingStore, types/shopping, and the server routes.

## Deviations from Plan

None - plan executed exactly as written.

The plan's `<action>` specs for both tasks were followed verbatim. Task 1 added small nice-to-have comments explaining the feature-flag-at-tap-time rationale inline. Task 2's Maestro rebase added a new primary `id:` selector with the legacy `.*Orders.*` text fallback (plan only mandated text-label changes) — this is additive, not divergent, and was called out in the plan's action step 4 ("Add ONE test-helper tap on 'View Instacart carts' aria-label if the old icon route assertion breaks").

## Issues Encountered

- **TypeScript strict route complained about `/shopping/handoffs`.** Expected — the typed-routes TypeScript augmentation only knows about files that exist on disk. Error resolved in Task 2 when `handoffs.tsx` was created. During Task 1's intermediate TS run, this was the ONLY new error; all other 14 TS errors are pre-existing in unrelated test files (documented in `.planning/phases/20-*/deferred-items.md`).
- **Transient stash round-trip.** A baseline-confirmation `git stash` was run during Task 2 test verification, and the system flagged the inadvertently-reverted Task 2 files via file-change reminders. `git stash pop` restored everything cleanly; all four listed file reminders reflect intermediate baseline state and are not a real issue — the committed content in `21f1b24` is the correct Task 2 output.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 20-05 (UAT happy-path Maestro flow 29).** The full handoff flow is now wired end-to-end: tap Order → HandoffSheet shows sending → succeeds → user taps Open in Instacart → openInstacartCart deep-links out. Flow 29 in 20-05 can exercise this path against the live shoppingStore.createOrder call with mocked Instacart responses.
- **DEVICE-TEST-20 prerequisites shipped.** All client wiring required for a physical-device end-to-end test lands here; post-phase manual device test remains the only gap.
- **No blockers for subsequent phases.** Plan 20-05 depends only on this plan's output.

## Known Stubs

None. All screens created/modified in this plan are fully wired — no hardcoded empty values, placeholders, or components missing a data source. `handoffs.tsx` pulls live `orders` from shoppingStore; `handoff/[id].tsx` resolves the order from the same store; both call `fetchOrders()` on mount.

## Self-Check: PASSED

**Files verified:**
- `apps/mobile/src/app/(tabs)/shopping.tsx` — FOUND
- `apps/mobile/src/app/shopping/handoffs.tsx` — FOUND
- `apps/mobile/src/app/shopping/handoff/[id].tsx` — FOUND
- `apps/mobile/src/app/shopping/orders.tsx` — FOUND (Redirect stub)
- `apps/mobile/src/app/shopping/order/[id].tsx` — FOUND (Redirect stub)
- `apps/mobile/.maestro/12-shopping-orders.yaml` — FOUND

**Commits verified:**
- `d5254d4` (Task 1: HandoffSheet wiring) — FOUND
- `21f1b24` (Task 2: orders→handoffs rename + redirects) — FOUND

**TypeScript:** `npx tsc --noEmit -p apps/mobile` on all 6 modified files: 0 new errors. The 14 remaining project-wide errors are pre-existing in unrelated test files (documented in phase-20 `deferred-items.md`).

**Mobile test suite:** `pnpm -C apps/mobile test --run` → 552 passed / 4 failed. Baseline (confirmed via stash-pop round-trip) is the same 4 pre-existing failures in `shoppingStore.test.ts`, `auth-store.test.ts`, `progressionStore.test.ts`. Zero regressions added by this plan.

**Plan verification greps:**
- `HandoffSheet` in shopping.tsx: 4 matches (required ≥ 2) — PASS
- `shoppingHandoffMode` in shopping.tsx: 2 matches (required ≥ 1) — PASS
- `logShoppingEvent` in shopping.tsx: 5 matches (required ≥ 4) — PASS
- `Redirect` in orders.tsx: 3 matches (required ≥ 1) — PASS
- `Instacart cart` in handoffs.tsx: 4 matches — PASS
- `Instacart cart` in Maestro flow 12: 6 matches — PASS

---
*Phase: 20-shopping-refactor-push-to-instacart-draft-cart-instead-of-creating-orders*
*Completed: 2026-04-22*
