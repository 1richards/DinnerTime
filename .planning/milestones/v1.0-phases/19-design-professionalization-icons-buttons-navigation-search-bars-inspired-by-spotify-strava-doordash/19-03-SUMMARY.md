---
phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
plan: 03
subsystem: ui
tags: [searchbar, sticky-pill, doordash, item-row, modal-route, vitest, tdd]

requires:
  - phase: 19
    plan: 01
    provides: "Design tokens (colors, typography, iconPropsForText) + rounded-button + bg-brand/bg-surface/border-border-subtle NativeWind classes"
provides:
  - "StickySearchPill component (src/components/ui/SearchBar.tsx) — DoorDash-style pill with scroll-driven shadow, navigates to /search?context=<ctx> modal"
  - "Legacy SearchBar inline input export — preserved on same file for call sites that migrate in Plan 19-05"
  - "Pure helpers buildSearchHref + shadowOpacityConfig — testable without RN renderer"
  - "ItemRow primitive (src/components/ui/ItemRow.tsx) with 3 leading variants (checkbox/stepper/icon) + struck + trailingChip + onPress/onLongPress"
  - "itemRowHelpers.ts — pure className resolvers (resolveTitleClasses, resolveCheckboxBoxClasses, CONTAINER_CLASSES, STEPPER_BUTTON_CLASSES) with full Nyquist unit coverage"
  - "src/app/search.tsx — modal route placeholder reading ?context (Phase 17 ships real surface)"
  - "Stack.Screen name='search' with presentation: 'modal' registered in src/app/_layout.tsx"
  - "ChipTone type exported from ItemRow.tsx — mirrors Plan 19-02's planned Chip API so the sweep migration is a drop-in"
affects: [19-04-searchbar-cards, 19-05-token-sweep, 19-06-visual-verify]

tech-stack:
  added: []
  patterns:
    - "StickySearchPill mounts as absolute-positioned sibling above collapsing header (zIndex: 20) — shadowOpacity scrollY.interpolate([0,40]→[0.05,0.18], extrapolate clamp) — matches DoorDash elevation-on-scroll idiom"
    - "buildSearchHref / shadowOpacityConfig extracted as pure helpers so SearchBar.test.ts runs in vitest node env with expo-symbols + expo-router mocked inline at file scope"
    - "ItemRow className derivation lives in itemRowHelpers.ts — component imports CONTAINER_CLASSES + resolveTitleClasses + resolveCheckboxBoxClasses + STEPPER_BUTTON_CLASSES rather than inlining string literals, so every variant is independently unit-assertable"
    - "ChipTone type co-located in ItemRow.tsx (inline trailing chip) instead of importing from Chip.tsx — Plan 19-02 had not landed when 19-03 executed; Plan 19-05's sweep swaps the inline chip for <Chip /> once Chip.tsx exists. Inline rendering uses tokenized classes (bg-success/15, text-success, etc.) so visual parity holds."

key-files:
  created:
    - apps/mobile/src/components/ui/SearchBar.tsx
    - apps/mobile/src/components/ui/SearchBar.test.ts
    - apps/mobile/src/components/ui/ItemRow.tsx
    - apps/mobile/src/components/ui/itemRowHelpers.ts
    - apps/mobile/src/components/ui/ItemRow.test.ts
    - apps/mobile/src/app/search.tsx
  modified:
    - apps/mobile/src/app/_layout.tsx

key-decisions:
  - "Modal search route chosen over inline expansion (19-RESEARCH Open Question 5) — matches Phase 15 modal=task convention; Phase 17 will ship full search surface inside the modal"
  - "Shadow interp config extracted as pure shadowOpacityConfig() helper, not inlined — assertable without RN Animated.Value instance"
  - "expo-router typed Href: buildSearchHref returns string, cast to `/search?${string}` at call site inside StickySearchPill — keeps the helper pure-string for test purposes and opts into the Href union exactly once"
  - "Inline trailing chip in ItemRow (Rule 3 deviation) — Chip.tsx from Plan 19-02 not yet landed; inline rendering preserves visual language via tokenized classes. ChipTone type exported locally so the eventual swap is a symbol-level rename"
  - "Test file lives at src/components/ui/SearchBar.test.ts (not __tests__/) — vitest.config include glob 'src/**/*.test.ts' matches; exclude 'src/components/!(ui)/**' does not apply to ui/ subtree"
  - "vitest setup globally mocks react-native but not expo-symbols / expo-router — tests mock those at file scope via vi.mock(), following the SymbolIcon.test.tsx pattern"

patterns-established:
  - "Pure-helper-plus-component split: any Phase 19 primitive that does conditional styling OR imperative navigation extracts pure helpers into a sibling *.ts file so vitest node env can assert them without rendering"
  - "SearchBar.tsx is the canonical location for both the new sticky pill AND the legacy inline input — consumers migrate at their own pace; Plan 19-05 removes the last inline import"

requirements-completed: ["Design quality (post-v1)"]

duration: 3min
completed: 2026-04-18
---

# Phase 19 Plan 03: Sticky-pill SearchBar + ItemRow Primitive Summary

**DoorDash-style sticky search pill (scroll-driven shadow, navigates to /search?context=<ctx> modal) + shared ItemRow primitive (checkbox | stepper | icon leading variants, struck + trailingChip support) — both Wave 2 primitives that Plan 19-05's sweep consumes to migrate ShoppingItemRow + PantryItemCard to one visual language.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-18T22:24:06Z
- **Completed:** 2026-04-18T22:27:30Z (approx)
- **Tasks:** 2 (both TDD, RED → GREEN)
- **Files created:** 6
- **Files modified:** 1 (`_layout.tsx`)

## Accomplishments

- **StickySearchPill** mounts above the collapsing header via `position: absolute` + `zIndex: 20` (layers above `collapsingHeaderStyles.compactHeader` at `zIndex: 5/10` per 19-RESEARCH.md Pattern 2). Tap dispatches `router.push('/search?context=<ctx>')` by default; `onPress` override slot preserved for bespoke call sites.
- **Scroll-driven elevation** via `scrollY.interpolate({ inputRange: [0, 40], outputRange: [0.05, 0.18], extrapolate: 'clamp' })` — the pill feels subtly lifted as the user scrolls past the large-title threshold. Consumers pass `scrollY` from `useCollapsingHeader()` so there's one scroll listener per tab (no jank).
- **Legacy `SearchBar`** (`value` / `onChange` / `placeholder` API) preserved as a second named export from the same file. The old inline call site on Library keeps working until Plan 19-05 migrates it to StickySearchPill.
- **`/search` modal route** registered with `presentation: 'modal'` in the root Stack. Placeholder screen echoes the `?context` query param so every tab that mounts a pill can be visually verified end-to-end.
- **Shared `ItemRow`** primitive with discriminated `leading` prop covers shopping (checkbox + strike), pantry (stepper showing quantity + unit), and generic (icon) variants in one component file. `trailingChip` + `struck` + `onPress/onLongPress` + `subtitle` round out the API; 56pt min row height keeps tap targets iOS-standard.
- **Pure className helpers** (`resolveTitleClasses`, `resolveCheckboxBoxClasses`, `CONTAINER_CLASSES`, `STEPPER_BUTTON_CLASSES`) extracted to `itemRowHelpers.ts` — ItemRow composes them in JSX, tests assert them directly. 9/9 ItemRow + 3/3 SearchBar assertions green.

## Task Commits

1. **Task 1 RED:** `331da40` — `test(19-03): add failing test for StickySearchPill helpers`
2. **Task 1 GREEN:** `85939b1` — `feat(19-03): StickySearchPill + /search modal route`
3. **Task 2 RED:** `2c2b033` — `test(19-03): add failing test for ItemRow className helpers`
4. **Task 2 GREEN:** `aabbbd4` — `feat(19-03): shared ItemRow primitive with three leading variants`

## How Plan 19-05 wires the sticky pill

Consumer screens on tab roots (Library inside kitchen.tsx, Something New in Phase 17, future Pantry search in Phase 21) mount the pill alongside the collapsing header:

```tsx
import { StickySearchPill } from '@/components/ui/SearchBar';
import { useCollapsingHeader } from '@/components/ui/useCollapsingHeader';

const { scrollY, onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } =
  useCollapsingHeader();

return (
  <View className="flex-1 bg-bg">
    <Animated.FlatList onScroll={onScroll} /* ... */ />
    {/* Collapsing header pieces as before */}
    <StickySearchPill
      placeholder="Search recipes"
      context="library"
      scrollY={scrollY}
    />
  </View>
);
```

The pill is additive — Phase 14's collapsing large-title pattern + Phase 15's compact-header on scroll both remain. The Phase 14-era "SearchBar collapsing under large title" pattern is what Plan 19-05 retires.

## ItemRow expected call sites (Plan 19-05)

| Target | Leading variant | Struck? | Trailing chip? |
|--------|-----------------|---------|----------------|
| `ShoppingItemRow.tsx` | `checkbox` | yes (when checked) | occasionally (category or note) |
| `PantryItemCard.tsx` | `stepper` | never | staleness / low-confidence chip with `warning` or `destructive` tone |
| Future generic rows | `icon` | never | contextual |

`ChipTone` union exported from `ItemRow.tsx` — Plan 19-02's `Chip` component will export the same `ChipTone` shape, so swapping the inline trailing chip for `<Chip kind="display" tone={...} />` in Plan 19-05 is a symbol-level rename.

## Modal route decision (19-RESEARCH Open Question 5)

**Chose modal over inline expansion.** Rationale:

- Matches Phase 15's modal=task convention — search is a discrete task, back-swipe/X close is the same affordance users learn for Scan, Import, Edit.
- Phase 17 (Something New) ships the full search surface; building it inside a modal means the Phase 17 surface just renders into this route, no extra wrapper work.
- Inline spring expansion is prettier but duplicates state (pill vs expanded) + animation work that a modal route handles natively.
- `presentation: 'modal'` (not `'transparentModal'`) — Pitfall 4 in 19-RESEARCH.md: transparent modal would let the pill flash above the dismiss animation.

## Known Maestro risk (Plan 19-06 owns)

- Flow `20-kitchen-segment-toggle.yaml` may assert on Library's `"Search recipes"` placeholder text. StickySearchPill still renders that string as the pill placeholder today, but Plan 19-05's sweep may rename to "Find a recipe" or similar.
- Flow `18-recipe-search-favorite.yaml` interacts with the old inline SearchBar (tap + type). Plan 19-05's migration moves tap-to-open into the modal — the flow needs a rewrite to tap the pill, land on `/search?context=library`, and type there.
- Flow `08-home-suggestions.yaml` — lower risk; no direct search bar interaction, but any screenshot assertions may shift visually.

None of these are broken by Plan 19-03 (the old components are still in place and still mounted on Library). The risk lands in Plan 19-05. Documented here so Plan 19-06's UAT sweep includes Maestro-flow rewrites.

## Decisions Made

- **Modal route over inline expansion** — matches Phase 15 convention; Phase 17 reuses the modal surface (documented in 19-RESEARCH Open Question 5).
- **Inline trailing chip in ItemRow** — Plan 19-02 not yet executed; inline rendering with tokenized classes preserves visual language. Plan 19-05's sweep swaps to `<Chip />` once Chip.tsx lands. `ChipTone` union co-located here mirrors Plan 19-02's planned export so the swap is mechanical.
- **Pure helper pattern** — every new primitive exports a sibling `*Helpers.ts` or inline pure function for className/navigation math so tests run under vitest's node env without RNTL. Follows Plan 19-01's established pattern (`tokens.ts` parity tests) and Plan 19-02's planned pattern (`buttonStyles.ts`, `chipStyles.ts`).
- **Test file location `src/components/ui/SearchBar.test.ts`** (sibling to source, not under `__tests__/`) — vitest.config include glob `src/**/*.test.ts` matches; exclude `src/components/!(ui)/**` doesn't apply to the `ui/` subtree. Simpler for colocation.

## Deviations from Plan

### Rule 3 (Blocking) — Inline trailing chip in ItemRow

- **Found during:** Task 2 implementation.
- **Issue:** Plan specified `import { Chip, type ChipTone } from './Chip'` and `<Chip label=... kind="display" tone=... />` for the trailing chip. But Plan 19-02 (which creates `Chip.tsx`) has not yet executed — both 19-02 and 19-03 are wave 2 with `depends_on: [19-01]`, and 19-03 ran first. Import would have been a red ref.
- **Fix:** Inlined a minimal `InlineTrailingChip` subcomponent using tokenized classes (`bg-success/15`, `text-success`, etc.) that visually matches what Plan 19-02's `Chip` will render. Exported `ChipTone` from `ItemRow.tsx` so the type is shared with downstream consumers. Plan 19-05's sweep will remove `InlineTrailingChip` and replace with `<Chip kind="display" tone={...} />` once Chip.tsx lands.
- **Files modified:** `apps/mobile/src/components/ui/ItemRow.tsx`
- **Commit:** `aabbbd4`
- **Scope note:** Documented in the inline-chip section of `patterns-established`. The visual output is identical today; migration is a symbol-level rename.

### Rule 3 (Blocking) — Href typing on expo-router.push

- **Found during:** Task 1 `npx tsc --noEmit -p .`
- **Issue:** expo-router 55 types `router.push(href)` with a strict Href union (`/search?${string}` | ...). A plain `string` return from `buildSearchHref` doesn't assign.
- **Fix:** Kept `buildSearchHref` as a pure `(ctx: string) => string` (easily testable) and cast to `/search?${string}` at the single call site inside StickySearchPill. Zero test impact.
- **Files modified:** `apps/mobile/src/components/ui/SearchBar.tsx`
- **Commit:** `85939b1` (same commit as GREEN)

### Rule 3 (Blocking) — Inline vi.mock for expo-symbols + expo-router in test file

- **Found during:** Task 1 first `pnpm test` run (module resolution failure importing expo-symbols in node env).
- **Issue:** Global `vitest.setup.ts` mocks `react-native` and native cooking-mode modules, but not `expo-symbols` or `expo-router`. SearchBar.tsx imports both.
- **Fix:** Added `vi.mock('expo-symbols', ...)` and `vi.mock('expo-router', ...)` at the top of `SearchBar.test.ts` — follows the same pattern as the existing `SymbolIcon.test.tsx`.
- **Files modified:** `apps/mobile/src/components/ui/SearchBar.test.ts`
- **Commit:** (folded into `85939b1` GREEN commit; original RED file was updated before GREEN commit)

No other deviations.

## Issues Encountered

**Pre-existing mobile test failures persist (NOT caused by Plan 19-03).**

- 4 failures across 3 files (auth-store.test.ts, shoppingStore.test.ts x2, progressionStore.test.ts) — identical to the baseline documented in 19-01-SUMMARY.md and `deferred-items.md`.
- Baseline before 19-03: 4 failed / 262 passed.
- After 19-03: 4 failed / 301 passed. Net: +39 passing tests (12 new from this plan: 3 SearchBar + 9 ItemRow; rest are re-runs including prior test additions).
- Zero regressions introduced.
- Out of scope per SCOPE BOUNDARY rule — Phase 23 (Settings, Auth & NFRs) is the natural owner.

## Next Plan Readiness

Plan 19-04 (card rewrites: RecipeCard grid/list, DayRow) can proceed. No blockers from 19-03 — StickySearchPill is the Wave 2 deliverable it will consume if it wants a search affordance on any new card surface.

Plan 19-02 (Button/Chip/Input rewrite) should run before Plan 19-05 so the Chip swap in ItemRow can complete. Plan 19-05 itself is the atomic orange→terracotta sweep + call-site migrations for ShoppingItemRow + PantryItemCard + Library SearchBar.

Plan 19-06 (Maestro + UAT) will need:
- Re-baseline screenshots on any screen where StickySearchPill now renders.
- Maestro flow rewrites noted in "Known Maestro risk" above — deferred to 19-06 not 19-05 since 19-05 is code-only.

## Self-Check: PASSED

- `apps/mobile/src/components/ui/SearchBar.tsx` — FOUND
- `apps/mobile/src/components/ui/SearchBar.test.ts` — FOUND
- `apps/mobile/src/components/ui/ItemRow.tsx` — FOUND
- `apps/mobile/src/components/ui/ItemRow.test.ts` — FOUND
- `apps/mobile/src/components/ui/itemRowHelpers.ts` — FOUND
- `apps/mobile/src/app/search.tsx` — FOUND
- `apps/mobile/src/app/_layout.tsx` — FOUND (modified)
- Commit `331da40` (Task 1 RED) — FOUND
- Commit `85939b1` (Task 1 GREEN) — FOUND
- Commit `2c2b033` (Task 2 RED) — FOUND
- Commit `aabbbd4` (Task 2 GREEN) — FOUND
- `pnpm test src/components/ui/SearchBar.test.ts --run` → 3/3 green
- `pnpm test src/components/ui/ItemRow.test.ts --run` → 9/9 green
- Full `pnpm test --run` → 301 passed (same 4 pre-existing failures as baseline)
- `npx tsc --noEmit -p .` → clean
- Grep for `orange-|F97316` in SearchBar.tsx / ItemRow.tsx / search.tsx → zero matches

---

*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Completed: 2026-04-18*
