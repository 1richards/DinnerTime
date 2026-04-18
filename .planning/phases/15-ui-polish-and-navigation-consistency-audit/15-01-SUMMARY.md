---
phase: 15-ui-polish-and-navigation-consistency-audit
plan: 01
subsystem: ui
tags: [expo-symbols, react-navigation, expo-image, nativewind, vitest, sf-symbols]

# Dependency graph
requires:
  - phase: 14
    provides: collapsing-header pattern, FOOD_IMAGES constants (reused by EmptyState image variant)
provides:
  - SymbolIcon primitive (body/title/largeTitle size tokens → 17/22/34px)
  - EmptyState primitive (image OR SF Symbol discriminated union)
  - LoadingState primitive (spinner default, skeleton variant)
  - ErrorState primitive (full / banner variants with optional retry)
  - useDirtyFormGuard hook (usePreventRemove + Alert with navigation.dispatch on Discard)
  - EMPTY_STATE_IMAGES constant map (scanReady / emptyPantry / shoppingListEmpty / planEmpty → FOOD_IMAGES URIs)
  - 3 purity grep scripts (verify-no-ionicons.sh, verify-no-decorative-emoji.sh, verify-headers.sh)
  - Global react-native vitest mock enabling component-as-function tests under node env
affects: [15-02-navigation-migration, 15-03-icon-sweep, 15-04-maestro-rebaseline, 19-design-professionalization]

# Tech tracking
tech-stack:
  added: []  # No new deps — expo-symbols/@react-navigation/native/expo-image already installed
  patterns:
    - "SymbolIcon wrapper: token-to-pixel size map (body=17, title=22, largeTitle=34) enforces SF Pro alignment"
    - "EmptyState discriminated-union visual prop — { kind: 'image', uri } | { kind: 'symbol', name }"
    - "useDirtyFormGuard dispatches NavigationAction via navigation.dispatch(data.action) on Discard (not data.action() — that was an early interface sketch before verifying React Navigation 7 types)"
    - "Component-as-function vitest pattern: mock native modules with vi.hoisted sentinels, call component as plain function, traverse element tree by .type identity"
    - "Global react-native mock in vitest.setup.ts so any future primitive test runs without Flow-parse errors"

key-files:
  created:
    - apps/mobile/src/components/ui/SymbolIcon.tsx
    - apps/mobile/src/components/ui/EmptyState.tsx
    - apps/mobile/src/components/ui/LoadingState.tsx
    - apps/mobile/src/components/ui/ErrorState.tsx
    - apps/mobile/src/components/ui/useDirtyFormGuard.ts
    - apps/mobile/src/constants/emptyStateImages.ts
    - apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx
    - apps/mobile/src/components/ui/__tests__/EmptyState.test.tsx
    - apps/mobile/src/components/ui/__tests__/LoadingState.test.tsx
    - apps/mobile/src/components/ui/__tests__/ErrorState.test.tsx
    - apps/mobile/src/components/ui/__tests__/useDirtyFormGuard.test.tsx
    - apps/mobile/scripts/verify-no-ionicons.sh
    - apps/mobile/scripts/verify-no-decorative-emoji.sh
    - apps/mobile/scripts/verify-headers.sh
  modified:
    - apps/mobile/vitest.config.ts (included src/components/ui/__tests__; narrowed components/** exclusion)
    - apps/mobile/vitest.setup.ts (added global react-native primitive mocks)

key-decisions:
  - "useDirtyFormGuard dispatches the blocked NavigationAction via useNavigation().dispatch(data.action) — the plan's interface sketch showed data.action() as a function but React Navigation 7's NavigationAction is an object that must be dispatched"
  - "vitest.config narrowed exclusion from 'src/components/**' to 'src/components/!(ui)/**' rather than adding a new test.include path — minimally-invasive per plan guidance"
  - "Global react-native mock in vitest.setup.ts rather than per-file mocks — react-native's Flow annotations can't be parsed by rolldown under node env, and every current/future primitive test needs the same stub surface"
  - "Component-as-function test pattern (call EmptyState(props), traverse returned React element tree) over installing @testing-library/react-native — repo has never installed a renderer; TDD tests stay node-env pure-logic"
  - "EmptyState symbol variant uses size={56} as a raw pixel escape hatch — the decorative empty-state glyph is intentionally outside the body/title/largeTitle type scale"

patterns-established:
  - "Pattern 1 (SymbolIcon size tokens): SIZE_MAP with body/title/largeTitle → 17/22/34, raw number escape hatch for rare cases"
  - "Pattern 2 (EmptyState discriminated union): Visual = { kind: 'image', uri } | { kind: 'symbol', name } — consuming screens pick one mode, not both"
  - "Pattern 3 (Dirty-form navigation guard): Call useDirtyFormGuard(draft !== original) at top of any screen; Alert with 'Keep editing' (cancel) + 'Discard' (destructive) is standard"
  - "Pattern 4 (Purity grep scripts): bash -euo pipefail + explicit || true on grep, then test string for match content, echo 'FAIL:' and exit 1 — no -P (BSD grep on Darwin), perl -CSD for unicode"
  - "Pattern 5 (Component-as-function Vitest): vi.hoisted() for mock refs → vi.mock('native-module', () => ({ ... })) → import component → call directly → inspect .type and .props of returned element"

requirements-completed:
  - "UI quality (post-v1)"

# Metrics
duration: ~5min
completed: 2026-04-18
---

# Phase 15 Plan 01: Shared Primitives & Purity Gates Summary

**SymbolIcon (body/title/largeTitle→17/22/34px) + EmptyState/LoadingState/ErrorState primitives + useDirtyFormGuard (usePreventRemove wrapper) — all backed by 34 node-env Vitest tests; 3 purity grep scripts scaffolded with baseline counts (37 Ionicons files, 7 decorative emoji in src/app, 1 hand-rolled back Pressable — all at documented budgets).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-18T21:23:00Z
- **Completed:** 2026-04-18T21:30:00Z
- **Tasks:** 2 completed
- **Files created:** 14
- **Files modified:** 2

## Accomplishments

- 5 shared UI primitives compiled, typechecked, and unit-tested (SymbolIcon, EmptyState, LoadingState, ErrorState, useDirtyFormGuard)
- 1 constants file mapping the four Phase 15 empty-state keys to existing FOOD_IMAGES URIs (zero new assets)
- 34 Vitest tests green under the mobile app's node environment, no new test-library dependency installed
- vitest.config/setup rewired so primitive tests run cleanly without breaking existing pure-logic test suites
- 3 purity grep scripts (verify-no-ionicons.sh, verify-no-decorative-emoji.sh, verify-headers.sh) scaffolded with executable bits, bash-parse-clean, and recorded baseline violation counts for Waves 2/3 to drive to zero

## Task Commits

1. **Task 1: Primitives + Vitest coverage** — `ca03e37` (feat)
2. **Task 2: Purity grep scripts** — `afd9eed` (chore)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified

### Primitives
- `apps/mobile/src/components/ui/SymbolIcon.tsx` — SymbolView wrapper with SIZE_MAP{body:17,title:22,largeTitle:34} and exported `resolveSymbolSize` helper for unit testing
- `apps/mobile/src/components/ui/EmptyState.tsx` — Discriminated-union visual (image via expo-image OR SF Symbol via SymbolIcon) + title + optional subtitle + optional action button
- `apps/mobile/src/components/ui/LoadingState.tsx` — ActivityIndicator (orange tint) for 'spinner' variant; `bg-warmGray-100 rounded-lg` block for 'skeleton' variant; optional caption
- `apps/mobile/src/components/ui/ErrorState.tsx` — SF Symbol 'exclamationmark.triangle' + title + optional message + optional retry; 'banner' variant capped at maxHeight=80
- `apps/mobile/src/components/ui/useDirtyFormGuard.ts` — usePreventRemove(isDirty, cb) + Alert('Unsaved changes', 'Keep editing' cancel / 'Discard' destructive → navigation.dispatch(data.action))

### Constants
- `apps/mobile/src/constants/emptyStateImages.ts` — EMPTY_STATE_IMAGES map: scanReady/emptyPantry→hero[1], shoppingListEmpty→hero[0], planEmpty→hero[2]

### Tests (34 passing)
- `apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx` — 13 tests (size mapping, token defaults, tintColor prop forwarding)
- `apps/mobile/src/components/ui/__tests__/EmptyState.test.tsx` — 5 tests (image vs symbol variant, subtitle optionality, action press)
- `apps/mobile/src/components/ui/__tests__/LoadingState.test.tsx` — 5 tests (spinner default, skeleton variant, label conditional)
- `apps/mobile/src/components/ui/__tests__/ErrorState.test.tsx` — 6 tests (title presence, retry optionality + onPress, banner height cap, SF Symbol rendering)
- `apps/mobile/src/components/ui/__tests__/useDirtyFormGuard.test.tsx` — 5 tests (isDirty pass-through, Alert shape, button semantics, navigation.dispatch on Discard)

### Purity scripts
- `apps/mobile/scripts/verify-no-ionicons.sh` — greps for `from '@expo/vector-icons'` under src; exits 1 on match
- `apps/mobile/scripts/verify-no-decorative-emoji.sh` — perl -CSD scan of src/app for U+1F300-U+1F9FF; exits 1 on match (macOS BSD grep has no -P)
- `apps/mobile/scripts/verify-headers.sh` — counts Pressable/TouchableOpacity with `onPress={...router.back()}`; exits 1 if >1 (recipes/[id]/index hero is the sole exception)

### Modified
- `apps/mobile/vitest.config.ts` — explicit `test.include` for `src/components/ui/__tests__/**`; narrowed `exclude` from `src/components/**` to `src/components/!(ui)/**` so primitive tests run while leaving non-UI component tests excluded
- `apps/mobile/vitest.setup.ts` — global vi.mock for `react-native` providing View/Text/Pressable/Image/ActivityIndicator/ScrollView/FlatList/Modal/TextInput/Alert/Platform/StyleSheet/Dimensions/Animated as plain sentinel components (react-native ships Flow-annotated source that rolldown cannot parse; this keeps every test under the current node env)

## Baseline Counts for Purity Scripts (recorded for Plan 02/03 gate)

| Script | Baseline | Target (end of Wave 3) |
|--------|----------|------------------------|
| verify-no-ionicons.sh | 37 files importing @expo/vector-icons under src | 0 |
| verify-no-decorative-emoji.sh | 7 decorative emojis under src/app (📸×2 scan/index, 🧾 scan/receipt, 🛒 scan/instacart + (tabs)/shopping, 📦 shopping/orders, 📷 recipes/import-photo) | 0 |
| verify-headers.sh | 1 hand-rolled back Pressable (recipes/[id]/index hero) | 1 (exception preserved) |

Note: the RESEARCH doc predicted "~13 decorative emojis" based on a prior emoji inventory that included leaf components. The grep script is scoped to `src/app` only (as specified in the plan) — leaf components like `RecipeFilterSheet` and `RemixSheet` contain filter/remix chip emojis that RESEARCH explicitly defers to Phase 19's chip rewrite, so they are not part of this baseline.

## Decisions Made

- **useDirtyFormGuard uses `navigation.dispatch(data.action)` not `data.action()`.** The plan's `<interfaces>` block showed `data.action()` as a call expression, but React Navigation 7's `NavigationAction` is an object (e.g., `{ type: 'GO_BACK' }`) that must be dispatched through the navigator. Verified against `node_modules/@react-navigation/core/lib/typescript/src/usePreventRemove.d.ts`. The test assertion was updated to `expect(dispatchSpy).toHaveBeenCalledWith(navAction)` to match.
- **vitest.config narrowed exclusion rather than adding include.** Per plan guidance ("prefer minimally-invasive narrowing"), changed `'src/components/**'` → `'src/components/!(ui)/**'` and added an explicit `test.include` for `src/components/ui/__tests__/**/*.test.{ts,tsx}`. Non-UI components remain excluded as before.
- **Global react-native mock over per-file mocks.** Attempted per-file mocks first; every file that imported anything from react-native failed with `Flow is not supported` under rolldown. Adding a global mock in `vitest.setup.ts` covers every future primitive test and keeps the per-file mock surface minimal (only expo-symbols, expo-image, @react-navigation/native need per-file overrides).
- **Component-as-function tests over installing @testing-library/react-native.** The repo has never pulled in a React Native renderer, and existing tests (cooking/, stores/) all exercise pure logic. Functional components are just functions — call them with props, traverse the returned element tree by `.type === ComponentRef`, assert on `.props`. Zero new dev dependency, zero renderer boot cost, correctly identifies the discriminated-union render paths.
- **EmptyState symbol glyph uses raw `size={56}` not a token.** The empty-state glyph is decorative (no surrounding body text to match), so it sits outside the body/title/largeTitle scale that SymbolIcon defines for in-line iconography. Commented the intent inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] useDirtyFormGuard interface mismatch with React Navigation 7**
- **Found during:** Task 1 typecheck
- **Issue:** Plan's interface block showed `data.action()` as a callable — TypeScript error `TS2349: This expression is not callable. Type 'Readonly<{ type: string; payload?: object; ... }>' has no call signatures.`
- **Fix:** Added `const navigation = useNavigation()` and changed discard handler to `navigation.dispatch(data.action)`. Updated useDirtyFormGuard test to assert against `dispatchSpy` instead of a captured action function.
- **Files modified:** `apps/mobile/src/components/ui/useDirtyFormGuard.ts`, `apps/mobile/src/components/ui/__tests__/useDirtyFormGuard.test.tsx`
- **Verification:** `npx tsc --noEmit -p .` clean; `pnpm test --run src/components/ui/__tests__/useDirtyFormGuard.test.tsx` 5/5 passing
- **Committed in:** `ca03e37` (Task 1 commit)

**2. [Rule 3 — Blocking] vitest unable to parse react-native under node env**
- **Found during:** Task 1 first test run (`pnpm test --run src/components/ui/__tests__/`)
- **Issue:** `RolldownError: Parse failure: Flow is not supported` when any primitive test imported from `react-native`. Neither per-file mocks nor the existing test env could load the Flow-annotated `react-native/index.js`.
- **Fix:** Added a global `vi.mock('react-native', ...)` in `vitest.setup.ts` providing sentinel function components for View/Text/Pressable/Image/ActivityIndicator/etc. This keeps every primitive test (and any future ones) running under the current `environment: 'node'` without introducing a renderer dependency.
- **Files modified:** `apps/mobile/vitest.setup.ts`
- **Verification:** Full `pnpm test --run` confirms no regressions in existing suites (the 4 failures observed — `shoppingStore` × 2, `progressionStore`, `auth-store` — pre-date this plan; verified via `git stash` + rerun. Out of scope per deviation-rule scope boundary.)
- **Committed in:** `ca03e37` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes were necessary to meet the `<done>` criteria of Task 1 (typecheck clean + all 5 primitive tests green). No scope creep — neither touched Button/ChipToggle/Input, introduced tokens, or changed the orange #F97316 palette.

## Issues Encountered

- **Pre-existing test failures detected, left untouched.** 4 tests fail on `main` independent of this plan's changes: `__tests__/auth-store.test.ts` (isOnboarded initialization), `src/stores/__tests__/progressionStore.test.ts` (fetchVariations expectation), `src/stores/__tests__/shoppingStore.test.ts` ×2 (generateList + fetchCurrent list shape). Verified via `git stash` + `pnpm test --run` that these failures exist on the prior commit. Deferred per scope-boundary rule — not caused by this plan.

## Next Phase Readiness

- **Plan 02 unblocked (navigation migration)**: SymbolIcon, useDirtyFormGuard, and verify-headers.sh available for the native-stack header sweep
- **Plan 03 unblocked (icon sweep)**: SymbolIcon + EmptyState + EMPTY_STATE_IMAGES available for all 37 Ionicons replacement sites and the 7 decorative emoji sites; verify-no-ionicons.sh and verify-no-decorative-emoji.sh ready to drive baselines to 0
- **Plan 04 unblocked (dirty-form guards + Maestro re-baseline)**: useDirtyFormGuard available for recipes/[id]/edit, recipes/review, and scan/review; purity scripts ready to be wired into the phase gate
- **Phase 19 boundary held**: zero design tokens, zero Button/Chip/SearchBar edits, orange #F97316 preserved, warmGray-* palette preserved

## Self-Check: PASSED

Verified all claims:
- `apps/mobile/src/components/ui/SymbolIcon.tsx` FOUND
- `apps/mobile/src/components/ui/EmptyState.tsx` FOUND
- `apps/mobile/src/components/ui/LoadingState.tsx` FOUND
- `apps/mobile/src/components/ui/ErrorState.tsx` FOUND
- `apps/mobile/src/components/ui/useDirtyFormGuard.ts` FOUND
- `apps/mobile/src/constants/emptyStateImages.ts` FOUND
- 5 test files under `apps/mobile/src/components/ui/__tests__/` FOUND (34 tests passing)
- `apps/mobile/scripts/verify-no-ionicons.sh` FOUND (executable, exit 1 on 37 violations)
- `apps/mobile/scripts/verify-no-decorative-emoji.sh` FOUND (executable, exit 1 on 7 violations)
- `apps/mobile/scripts/verify-headers.sh` FOUND (executable, exit 0 at 1/1 budget)
- Commit `ca03e37` FOUND in git log
- Commit `afd9eed` FOUND in git log

---
*Phase: 15-ui-polish-and-navigation-consistency-audit*
*Completed: 2026-04-18*
