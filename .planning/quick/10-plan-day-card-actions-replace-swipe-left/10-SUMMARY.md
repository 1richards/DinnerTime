---
phase: 10-plan-day-card-actions-replace-swipe-left
plan: 10
subsystem: plan-tab
tags: [plan, hero-card, ui, cluster, remix, cook-now, swipe-replacement]
requires:
  - apps/mobile/src/components/plan/HeroDayCard.tsx (Quick-7)
  - apps/mobile/src/components/recipes/RemixSheet.tsx (Phase 21)
  - apps/mobile/src/stores/mealPlanStore.ts applySwap (Phase 7)
provides:
  - HeroDayCard floating 5-icon cluster (Swap / Cook Now / Remix / Cooked / Clear)
  - Direct Remix entry-point on Plan tab (no PlanEntryPreview interstitial)
  - Cook Now routing into /recipes/{id}/cook from a plan day
affects:
  - apps/mobile/src/app/(tabs)/plan.tsx
  - apps/mobile/src/components/plan/HeroDayCard.tsx
  - apps/mobile/src/components/plan/HeroDayCard.test.ts
tech-stack:
  added: []
  patterns:
    - "Floating cluster overlay matching SuggestionCard / RecipeCard precedent (rgba(0,0,0,0.55) capsule, ~22pt SF Symbols, 8pt gap, stopPropagation per-icon)"
    - "Inline-source RemixSheet mount mirroring PlanEntryPreview's nested-Remix pattern"
key-files:
  created: []
  modified:
    - apps/mobile/src/components/plan/HeroDayCard.tsx
    - apps/mobile/src/components/plan/HeroDayCard.test.ts
    - apps/mobile/src/app/(tabs)/plan.tsx
decisions:
  - "Combined RED+GREEN into single Task-1 commit because the RED file referenced new prop names (onCookNow/onRemix) that the existing component did not declare — the test file would not parse until the component grew the props. Treated as a paired refactor commit rather than two split commits."
  - "Inline-source ingredients normalized to {name} only (matches VariationContext shape) — baseForSave still carries the full {name, quantity, unit, notes} shape so a save-as-recipe path retains fidelity."
  - "Cook Now uses BOTH the React Native disabled flag AND an in-handler guard (`if (!cookNowEnabled) return`). RN's disabled honors touch-suppression natively; the guard is defense-in-depth and gives the test suite a deterministic no-op assertion regardless of how vitest-node invokes the handler."
metrics:
  duration: "~5 min"
  completed: "2026-05-03T16:26Z"
---

# Quick Task 10: Plan Day Card Actions — Replace Swipe-Left Summary

**One-liner:** Replaced HeroDayCard swipe-left gesture with a floating 5-icon cluster (Swap / Cook Now / Remix / Cooked / Clear) bottom-right of the hero image, matching the SuggestionCard / RecipeCard cluster precedent, and wired Cook Now (router push to /cook) + Remix (direct RemixSheet modal mount) from plan.tsx.

## What Changed

### `apps/mobile/src/components/plan/HeroDayCard.tsx` (~+115 LOC, -7 LOC net)

- **Removed imports:** `ReanimatedSwipeable` from `react-native-gesture-handler/ReanimatedSwipeable`; `renderRightActionsFor` from `./SwipeableDayRow`. (`grep -c "ReanimatedSwipeable\|renderRightActionsFor" HeroDayCard.tsx` = 1, the surviving doc comment that explains compact-mode SwipeableDayRow keeps the swipe-left intact.)
- **Extended `HeroDayCardProps`:** added required `onCookNow: () => void` and `onRemix: () => void`.
- **Removed wrapper:** `<ReanimatedSwipeable renderRightActions={() => renderRightActionsFor(...)}>` is gone — the outer `<View style={styles.tileWrap}>` now wraps `<Pressable>` directly.
- **Added cluster:** new `<View style={styles.heroIconCluster}>` inside `heroFrame`, after `<HeroDayCardImage>` + `<View style={[styles.heroOverlayContent, ...]}>`. 5 Pressables in order: Swap (`arrow.2.squarepath`, white), Cook Now (`flame.fill`, warm `#FFE4B5`), Remix (`sparkles`, warm `#FFE4B5`), Cooked (`checkmark.circle.fill`, white), Clear (`xmark.circle.fill`, white). All at 22pt with `hitSlop=6`.
- **Stop propagation:** every cluster Pressable's `onPress` is `(e) => { e.stopPropagation(); handler(); }`. Cook Now also calls `if (!cookNowEnabled) return` before invoking `onCookNow()`.
- **Cook Now disabled state:** when `entry.recipe_id` is null, the Pressable carries `disabled={true}` AND its style array includes `{ opacity: 0.4 }` for visual treatment.
- **Added styles:** `heroIconCluster` (`position: absolute; right: 12; bottom: 12; flexDirection: row; backgroundColor: 'rgba(0,0,0,0.55)'; borderRadius: 9999; paddingHorizontal: 8; paddingVertical: 6; gap: 8`) + `iconBtn` (`alignItems: center; justifyContent: center; minWidth: 28; minHeight: 28`).

### `apps/mobile/src/components/plan/HeroDayCard.test.ts` (-3 mocks, +4 cluster cases, ~+50 LOC)

- **Dropped:** `vi.mock('react-native-gesture-handler/ReanimatedSwipeable', ...)` (component no longer imports it).
- **Dropped:** `vi.mock('../../plan/telemetry', ...)` + `loggedEvents` array + the `beforeEach(() => { loggedEvents.length = 0; })` reset (HeroDayCard emits no telemetry in this change).
- **Dropped:** `import { renderRightActionsFor } from './SwipeableDayRow'` (not exercised here).
- **Dropped:** the original swipe-actions test (lines 327–360 of the previous file, "renderRightActionsFor wired with handlers — tapping each fires the matching parent handler + plan.swipe_action telemetry").
- **Added helper:** `findClusterPressables(el)` tree-walks for Pressables whose `accessibilityLabel` is one of `{Swap, Cook Now, Remix, Cooked, Clear}`.
- **Added 4 cluster cases:**
  1. "renders 5 cluster Pressables" — labels match the expected set, count is exactly 5.
  2. "tapping each cluster Pressable fires its matching parent handler" — invokes each `onPress` with `{ stopPropagation: vi.fn() }` and asserts the right `onSwap / onCookNow / onRemix / onCook / onSkip` mock was called.
  3. "each cluster Pressable calls e.stopPropagation()" — for all 5, asserts the synthetic event's `stopPropagation` mock was invoked.
  4. "Cook Now disabled (opacity 0.4, no-op) when entry.recipe_id is null" + "Cook Now enabled and fires onCookNow when entry.recipe_id is set" — disabled prop, opacity 0.4 entry resolved from the function-style style, no-op confirmation, enabled-path confirmation.
- **Adjusted outer-Pressable test:** because the cluster Pressables now also live in the tree, the test disambiguates the outer card-body Pressable by `accessibilityLabel.startsWith('MON')` (the dayLabel-prefixed label set by the existing component).

### `apps/mobile/src/app/(tabs)/plan.tsx` (+63 LOC)

- **Import:** `import { RemixSheet } from '../../components/recipes/RemixSheet';` — added next to the other plan/recipe sheet imports (after `SwapSheet`).
- **State:** `const [remixEntry, setRemixEntry] = useState<MealPlanEntry | null>(null);` — added immediately below the existing `previewEntry` state.
- **HeroDayCard call site:** added `onCookNow={() => { if (item.entry?.recipe_id) router.push(`/recipes/${item.entry.recipe_id}/cook`); }}` and `onRemix={() => setRemixEntry(item.entry)}`. `router` was already imported from `expo-router`; `applySwap` was already destructured from `useMealPlanStore()`.
- **RemixSheet modal mount:** added at the same depth as the existing `previewEntry` / `savedDetail` Modals, just before `</SafeAreaView>`. Uses `kind: 'inline'` source built from the entry (title, description, ingredients-as-`{name}`, total_time_minutes derived from estimated_time_minutes ?? prep+cook). `baseForSave` carries the full `{name, quantity, unit, notes}` shape + steps + total_time_minutes for save-as-recipe expansion. `onApplyToDay` calls `applySwap(remixEntry.day_of_week, full)` then `setRemixEntry(null)`. `onClose` clears `remixEntry`.

## Cluster Tap Behaviors Verified

| Icon | accessibilityLabel | Glyph | Tint | Handler | stopPropagation | Disabled state |
| --- | --- | --- | --- | --- | --- | --- |
| Swap | "Swap" | `arrow.2.squarepath` | `#FFFFFF` | `onSwap` → `setSwapTarget(item.day)` | yes | n/a |
| Cook Now | "Cook Now" | `flame.fill` | `#FFE4B5` | `onCookNow` → `router.push(/recipes/{id}/cook)` (guarded on `entry.recipe_id`) | yes | `disabled` + `opacity: 0.4` when `recipe_id` is null |
| Remix | "Remix" | `sparkles` | `#FFE4B5` | `onRemix` → `setRemixEntry(item.entry)` → mounts `<RemixSheet>` | yes | n/a |
| Cooked | "Cooked" | `checkmark.circle.fill` | `#FFFFFF` | `onCook` → `setCookTarget(item.day)` | yes | n/a |
| Clear | "Clear" | `xmark.circle.fill` | `#FFFFFF` | `onSkip` → `setSkipTarget(item.day)` | yes | n/a |

## Test Counts (HeroDayCard.test.ts)

| State | Tests | Result |
| --- | --- | --- |
| Before (Quick-7 baseline) | 11 | 11 passed |
| After (Quick-10) | 15 | 15 passed |

Net delta: 11 → 15 (-1 swipe test removed, +5 cluster tests added). All previously-passing assertions for title / day+date labels / chip rendering / skill_note / outer onPress remain green.

### Adjacent regression check

- `apps/mobile/src/components/plan/SwipeableDayRow.test.ts`: 7/7 passed (unchanged file, sanity-check).
- All `apps/mobile/src/components/plan/` tests: 141/141 passed (10 test files).

## Verification Results

| Check | Command | Result |
| --- | --- | --- |
| HeroDayCard tests | `npx vitest run src/components/plan/HeroDayCard.test.ts` | 15/15 passed |
| SwipeableDayRow regression | `npx vitest run src/components/plan/SwipeableDayRow.test.ts` | 7/7 passed |
| Full plan-component sweep | `npx vitest run src/components/plan` | 141/141 passed |
| Typecheck modified files | `npx tsc --noEmit -p tsconfig.json 2>&1 \| grep -E "(plan\.tsx\|HeroDayCard\.tsx)"` | clean (zero output) |
| Lint modified files | `npx biome check src/components/plan/HeroDayCard.tsx 'src/app/(tabs)/plan.tsx'` | clean |
| Imports grep | `grep -E "ReanimatedSwipeable\|renderRightActionsFor" HeroDayCard.tsx` | doc comment only (no import) |

## Deviations from Plan

### None on Rules 1/2/4

No bugs encountered, no missing critical functionality, no architectural decisions required.

### Rule 3 (process adjustment, not blocking)

**1. Combined RED+GREEN into a single Task-1 commit.**
- **Found during:** Task 1 RED execution.
- **Issue:** The plan's TDD direction (RED commit first, then GREEN commit) would leave the repo in a state where the test file references prop names (`onCookNow`, `onRemix`) that the component does not yet declare. Vitest's TS transform fails-fast on unknown-prop errors, so the RED commit would not run as "fail with assertion errors" but as "fail to load."
- **Fix:** Wrote the component change first (added the props + cluster + style), then the test file, and committed both together as `refactor(quick-10): replace HeroDayCard swipe-left with floating icon cluster`. This is identical to how Quick-7 / Phase 22-04 handled the IngredientChecklist+helpers split — same project precedent.
- **Files modified:** `HeroDayCard.tsx`, `HeroDayCard.test.ts`.
- **Commit:** `3efc809`.

**2. Outer-Pressable test disambiguation.**
- **Found during:** Task 1 GREEN.
- **Issue:** The original `'tap on outer Pressable invokes onPress'` test relied on `pressables[0]` being the only Pressable in the tree. Now that the cluster adds 5 more Pressables, indexing by `[0]` is fragile.
- **Fix:** Changed the test to find the outer Pressable by `accessibilityLabel.startsWith('MON')` (the dayLabel-prefixed label that the existing component already sets). The cluster Pressables use `accessibilityLabel` of `'Swap'`, `'Cook Now'`, etc. — disambiguation is unambiguous.
- **Files modified:** `HeroDayCard.test.ts`.
- **Commit:** `3efc809`.

## Auth Gates

None encountered. Both tasks are pure UI / test changes; no Supabase or backend interaction required.

## Maestro UAT

**Not executed.** This plan's optional Maestro pass per CLAUDE.md UAT requires:
1. The dev client app installed in the simulator.
2. Backend running locally with the root `.env` sourced.
3. Metro running on `--lan` mode.

Within autonomous execution this plan kept verification automated only (vitest + tsc + biome). The plan's `<verification>` block lists the manual UAT walkthrough (cluster visibility, tap routing, swipe inertness, compact-mode regression) — recommend running it interactively against `iPhone 17 Pro` simulator before merge for full visual confirmation.

No Maestro screenshots were captured. Future follow-up: add `.maestro/41-hero-cluster-uat.yaml` walking through Swap/Cook Now/Remix/Cooked/Clear taps.

## Known Follow-ups

- **Compact-mode SwipeableDayRow:** intentionally left untouched per scope. `SwipeableDayRow.tsx` keeps its `renderRightActionsFor` export and `ReanimatedSwipeable` wrapper; compact-mode swipe-left still works.
- **Maestro UAT:** out-of-band visual verification recommended before App Store cut.
- **Cook Now ad-hoc message:** entries with `recipe_id === null` show a 40%-opacity flame icon. If user-confusion telemetry shows this needs more affordance, consider a tooltip / disabled-tap toast in a future quick task.

## Self-Check: PASSED

Files verified to exist:
- `apps/mobile/src/components/plan/HeroDayCard.tsx`
- `apps/mobile/src/components/plan/HeroDayCard.test.ts`
- `apps/mobile/src/app/(tabs)/plan.tsx`

Commits verified in `git log`:
- `3efc809` — Task 1: HeroDayCard swipe→cluster + tests
- `a530d5d` — Task 2: plan.tsx wires onCookNow + onRemix + RemixSheet mount
