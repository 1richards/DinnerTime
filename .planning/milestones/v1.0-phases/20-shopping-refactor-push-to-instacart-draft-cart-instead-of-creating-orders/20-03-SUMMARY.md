---
phase: 20-shopping-refactor-push-to-instacart-draft-cart-instead-of-creating-orders
plan: 03
subsystem: ui
tags: [react-native, nativewind, handoff-sheet, modal, discriminated-union, instacart, sf-symbols, phase-19-tokens]

# Dependency graph
requires:
  - phase: 20-01
    provides: "openInstacartCart helper + classifyHandoffError variant discriminator (consumed by parent shopping.tsx, not by HandoffSheet itself)"
  - phase: 20-00
    provides: "Wave 0 HandoffSheet.test.tsx red test contract + HandoffSheet stub file"
  - phase: 19-02
    provides: "variantStyles map (primary/ghost container + text classes) reused for inline CTA Pressable+Text primitives"
provides:
  - "HandoffSheet component — modal bottom-sheet rendering 4-kind discriminated-union states (idle/sending/success/error)"
  - "Re-exported HandoffState type — consumed by 20-04 shopping.tsx + handoffs.tsx for local useState"
  - "Pattern: static-tree-friendly CTAs as Pressable+Text primitives reusing Phase 19-02 variantStyles (preserves tokens, enables introspection tests without @testing-library/react-native)"
affects: [20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling backdrop-Pressable + sheet-View under Modal: avoids wrapping CTAs inside a dismiss-Pressable whose onPress would be found first by static tree-walk tests"
    - "Pressable+Text CTAs using imported variantStyles.primary / variantStyles.ghost — token parity with Button component without the component boundary that opaque-ifies it to static introspection"

key-files:
  created: []
  modified:
    - apps/mobile/src/components/shopping/HandoffSheet.tsx

key-decisions:
  - "CTAs rendered as raw Pressable+Text (not <Button/>) — Wave 0 test flattens the element tree statically; a Button component reference would have no children for the test's pressable-by-label search. Reusing variantStyles keeps design tokens single-sourced."
  - "Dismiss backdrop is a sibling Pressable overlay behind the sheet, NOT a Pressable that wraps the sheet content — keeps the first tree-walk match for 'pressable whose subtree contains label X' as the actual CTA, not the backdrop."
  - "Backdrop tap disabled while kind='sending' (no-op) so the user can't dismiss before the server replies. Close-button (X) is also only rendered for success/error. onRequestClose respects dismissable."
  - "Phase 19 token exception: `rgba(0,0,0,0.3)` backdrop color written as a literal on StyleSheet.absoluteFillObject.backgroundColor — NativeWind `bg-black/30` would require the Pressable to accept className in a way that composes with absoluteFillObject; documented inline with `phase-19-token` comment."

patterns-established:
  - "Static-tree-introspection testing: component returned by pure function call must NOT wrap CTAs inside a higher-order Pressable (e.g., backdrop) — otherwise `find(el => el.props.onPress && childText.matches(label))` finds the wrapper first."
  - "Modal sheets reusing Button design: inline <Pressable className={variantStyles[v].container}><Text className={variantStyles[v].text}>{label}</Text></Pressable> over <Button title={label} variant={v}/> when the host test does static tree traversal. Both render identically at runtime."

requirements-completed: [SHOP-DC-01, SHOP-DC-02, SHOP-DC-06]

# Metrics
duration: 10min
completed: 2026-04-22
---

# Phase 20 Plan 03: HandoffSheet Apple-Pay-style Instacart Cart Handoff Summary

**Three-state discriminated-union modal sheet (sending / success / error) replacing Phase 8's inline ActivityIndicator + WebBrowser flow — pure consumer component wired from parent via onOpenCart/onRetry/onDismiss props.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-22T05:48:52Z (session start after 20-02 complete)
- **Completed:** 2026-04-22T05:58:46Z
- **Tasks:** 1 (single-task plan)
- **Files modified:** 1 (`apps/mobile/src/components/shopping/HandoffSheet.tsx`)

## Accomplishments

- Shipped the Phase 20 centerpiece UX primitive — an Apple-Pay-style modal bottom-sheet with three visible states driven by a 4-kind discriminated union (`idle | sending | success | error`).
- Flipped the Wave 0 contract test green — `apps/mobile/src/components/shopping/__tests__/HandoffSheet.test.tsx` went from 9/9 red → 9/9 green in one pass.
- Wired variant-specific copy for the three error paths (`network | instacart_api | auth`) — each with distinct title, subtitle, and the same "Try again" retry CTA (SHOP-DC-06).
- Reused Phase 19-02 `variantStyles.primary` / `variantStyles.ghost` class maps directly on inline Pressable+Text primitives — keeping design tokens single-sourced without depending on the Button component's wrapper (which the static-tree test cannot introspect).
- Tagged all SF Symbol tints against `colors.brand` / `colors.textTertiary` from `design/tokens.ts` — zero raw hex except one documented `rgba(0,0,0,0.3)` backdrop literal.

## Task Commits

Each task was committed atomically:

1. **Task 1: Build HandoffSheet with 4-state discriminated union** — `b84c69e` (feat)

_Single-task plan, no TDD split — the Wave 0 test was already authored in 20-00, so this plan's role was the GREEN phase of an externally-authored RED test._

## Files Created/Modified

- `apps/mobile/src/components/shopping/HandoffSheet.tsx` — Replaced Wave 0 stub (46 lines) with the real three-state implementation (304 lines). Exports `HandoffSheet` component + `HandoffState` discriminated-union type + `HandoffSheetProps` interface. Consumes `SymbolIcon`, `variantStyles` (from `components/ui/buttonStyles`), `colors` tokens, and re-types `HandoffErrorVariant` from `../../shopping/classifyHandoffError`.

## Decisions Made

- **CTAs use Pressable+Text primitives, not the Button component.** Plan's `action` block prescribed `<Button title="..." variant="primary" />`. This conflicts with the Wave 0 test contract: the test calls `HandoffSheet()` as a pure function (no React renderer) and flattens the returned element tree. A `<Button>` element is opaque to this traversal — its `title` is a prop, not a children text node, so `findText(tree, /Open in Instacart/i)` returns undefined. Switched to inline `<Pressable className={variantStyles.primary.container}><Text className={variantStyles.primary.text}>...</Text></Pressable>` so the tree-walk finds both the label Text AND the pressable that owns it. Token parity preserved — both render identically at runtime since Button internally renders the same structure with the same classes.

- **Sibling-backdrop pattern instead of wrapping-backdrop.** Initial scaffold wrapped the sheet body inside the dismiss Pressable (classic AddItemSheet pattern). Wave 0 test then found the backdrop as the FIRST pressable matching "`onPress` is a function AND descendants include label X" — because flatten() walks parents before children. Fix: outer Modal child is a plain View; dismiss Pressable is a sibling overlay sitting behind the sheet via `StyleSheet.absoluteFillObject`. Now the first pressable matched for any CTA label is the CTA itself.

- **Close button (X) is top-right only for success / error.** Sending state has no close button: the handoff is in-flight and users shouldn't be able to dismiss before knowing the outcome. `onRequestClose={dismissable ? handleDismiss : noop}` enforces this at the RN Modal level for the hardware back button too.

- **Error variant copy:** chose `"Can't reach Instacart"` / `"Instacart is temporarily unavailable"` / `"You need to sign in again"` for `network` / `instacart_api` / `auth` respectively. Each pairs with a one-sentence subtitle explaining the root cause in user-speak. The test asserts auth copy matches `/sign in|auth|log in|login/i` and API copy matches `/Instacart|unavailable|try|temporar/i` — both satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's <Button/> usage for CTAs blocked the Wave 0 test**
- **Found during:** Task 1 verification (running `HandoffSheet.test.tsx`)
- **Issue:** Plan's `action` specified `<Button title="Open in Instacart" variant="primary" onPress={onOpenCart} />` etc. for all four CTAs. The Wave 0 test (authored in plan 20-00, treated by the 20-03 plan's `done` criteria as the authoritative GREEN target) walks a static element tree via `function flatten(node) { return [el, ...flatten(el.props.children)] }` and searches for pressables by their children-text content. A `<Button/>` component reference has `{title: 'Open in Instacart'}` as a prop but `children: undefined`, so `findText(tree, /Open in Instacart/i)` returned undefined and `expect(pressable).toBeDefined()` failed.
- **Fix:** Replaced all four `<Button/>` usages with inline `<Pressable className={variantStyles[v].container}><Text className={variantStyles[v].text}>{label}</Text></Pressable>`. Imported `variantStyles` directly from `components/ui/buttonStyles` (the pure token map split out in 19-02 specifically for non-React-renderer consumers per that plan's docstring). Token parity is preserved — the DOM/RN output is identical, the only thing missing vs `<Button/>` is the automatic loading/disabled affordance (not needed here; parent owns `state` transitions).
- **Files modified:** apps/mobile/src/components/shopping/HandoffSheet.tsx
- **Verification:** All 4 previously-failing Button-related assertions now pass (`findText(/Open in Instacart/i)`, `findText(/View shopping list/i)`, primary-CTA invocation, and Try-again invocation).
- **Committed in:** b84c69e

**2. [Rule 1 - Bug] Wrapping backdrop Pressable ate CTA onPress invocations**
- **Found during:** Task 1 verification (second vitest run)
- **Issue:** Initial scaffold followed AddItemSheet's pattern — a backdrop `<Pressable onPress={dismiss}>` wrapped the entire sheet body including the CTAs. Wave 0 test then found the backdrop Pressable as the FIRST match of `typeof el.props.onPress === 'function' && flatten(el.props.children).some(c => /Open in Instacart/.test(c))` because flatten() walks parents before children. The test invoked `pressable.props.onPress()` which called `handleDismiss`, NOT `onOpenCart` — hence "expected vi.fn() called 1 times, got 0".
- **Fix:** Restructured Modal's child from `<Pressable backdrop><Pressable sheet>...</Pressable></Pressable>` to `<View container><Pressable backdrop-overlay/><View sheet>...</View></View>`. The dismiss affordance moved to an absolutely-positioned sibling Pressable sitting behind the sheet via `StyleSheet.absoluteFillObject`. Now the first pressable matched for any CTA label is the CTA itself.
- **Files modified:** apps/mobile/src/components/shopping/HandoffSheet.tsx
- **Verification:** All 9/9 HandoffSheet.test.tsx assertions green. Visual/touch semantics preserved: tapping outside the sheet still dismisses (the backdrop-overlay Pressable is still touchable), tapping inside the sheet no longer needs an inner Pressable to absorb bubbling (sibling architecture means the backdrop is not an ancestor).
- **Committed in:** b84c69e

**3. [Rule 1 - Bug] JSX expression rendered itemCount as array children**
- **Found during:** Task 1 verification
- **Issue:** `<Text>{state.itemCount} items ready</Text>` renders children as array `[4, " items ready"]`. Wave 0 `findText` helper tests `Array.isArray(c) && c.some(p => typeof p === 'string' && pattern.test(p))` — the number `4` fails `typeof === 'string'` and the string `" items ready"` alone doesn't match `/4 items ready/`.
- **Fix:** Template-literal wrap → `<Text>{`${state.itemCount} items ready`}</Text>` renders children as a single string `"4 items ready"` matching `/4 items ready/i`.
- **Files modified:** apps/mobile/src/components/shopping/HandoffSheet.tsx
- **Verification:** `findText(/4 items ready/i)` returns the Text element.
- **Committed in:** b84c69e

---

**Total deviations:** 3 auto-fixed (3× Rule 1 - Bug)
**Impact on plan:** All three fixes necessary to satisfy the plan's own `done` criterion ("HandoffSheet.test.tsx flips green"). The deviations are mechanical — runtime visual output and all Phase 19 token rules are preserved. No scope creep.

## Issues Encountered

- Conflict between plan's `action` scaffold (`<Button/>` CTAs) and plan's `done` criterion (9/9 Wave 0 tests pass). Resolved by honoring the `done` criterion — the test is the contract, the scaffold is a starting point. See Deviations #1 and #2 above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **20-04 (consumer wiring) ready:** `HandoffSheet` + `HandoffState` type export satisfies the interface 20-04 needs. Parent component (`app/(tabs)/shopping.tsx` + `app/shopping/handoffs.tsx`) will:
  - Hold `const [handoffState, setHandoffState] = useState<HandoffState>({ kind: 'idle' })`.
  - Transition `idle → sending` on order tap, `sending → success | error` on server response, `* → idle` on dismiss.
  - Wire `onOpenCart = () => openInstacartCart(state.url, {...})` (from 20-01).
  - Wire `onRetry = () => retry the last createOrder`.
  - Wire `onDismiss = () => setHandoffState({ kind: 'idle' })`.
  - Gate the draft-cart branch on `useSettingsStore.getState().shoppingHandoffMode === 'draft_cart'` (from 20-00), falling through to the Phase 8 inline `WebBrowser.openBrowserAsync` when `'legacy'`.
- **Zero blockers** for 20-04.
- **20-05 (Maestro UAT) ready:** HandoffSheet renders with visible `accessibilityLabel` values (`Instacart handoff ${state.kind}`, `Open in Instacart`, `Try again`, `Dismiss`) — Maestro can drive the flow by label. Flow 24 design from 20-RESEARCH maps 1:1 against this surface.

## Self-Check: PASSED

- File `apps/mobile/src/components/shopping/HandoffSheet.tsx` exists (304 lines).
- Commit `b84c69e` present in `git log --oneline`.
- `pnpm -C apps/mobile test --run src/components/shopping/__tests__/HandoffSheet.test.tsx` → 9/9 passing.
- TypeScript: `tsc --noEmit` reports zero errors referencing HandoffSheet.tsx (pre-existing unrelated errors in cooking test files and shopping/telemetry.test.ts remain — documented in deferred-items.md).
- Full mobile suite: 552/556 passing — 4 remaining failures are pre-existing shoppingStore.test.ts cases unchanged by this plan (verified via git stash comparison: 13 failures on HEAD→main before this change, 4 after).

---
*Phase: 20-shopping-refactor-push-to-instacart-draft-cart-instead-of-creating-orders*
*Completed: 2026-04-22*
