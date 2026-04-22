---
phase: 12-combine-home-recipes
plan: 01
subsystem: ui
tags: [expo-router, react-native, collapsing-header, segmented-control, zustand]

# Dependency graph
requires:
  - phase: post-v1-polish
    provides: useCollapsingHeader hook + HeroImage + SuggestionList + RecipeFilterSheet + SuggestedForYou primitives
provides:
  - Unified Kitchen tab screen merging Home (Suggestions) and Recipes (Library) into a single segmented screen
  - 4-tab bar layout (Kitchen → Plan → Pantry → Shopping) with Kitchen as redirect-resolution target
  - display:none dual-mount pattern for segments — preserves scroll/search/filter state across toggles
  - Maestro stub 20-kitchen-segment-toggle.yaml scaffolded for Wave 3
affects: [12-02 (route call-site migration), 12-03 (Maestro real assertions), 15-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Custom-Pressable segmented control (no native dep) — style-twin of pantry FILTER_TABS but in rounded rectangles"
    - "Dual-list display:none mount — FlatList state preservation without Zustand mirroring"
    - "Two independent useCollapsingHeader instances — one per segment (per 12-RESEARCH Pitfall 5)"
    - "Route param ?segment consumed via useLocalSearchParams for post-save deep links (Plan 02 consumer)"

key-files:
  created:
    - apps/mobile/src/app/(tabs)/kitchen.tsx
    - apps/mobile/.maestro/20-kitchen-segment-toggle.yaml
  modified:
    - apps/mobile/src/app/(tabs)/_layout.tsx
  deleted:
    - apps/mobile/src/app/(tabs)/index.tsx
    - apps/mobile/src/app/(tabs)/recipes.tsx

key-decisions:
  - "Custom Pressable segmented control over @react-native-segmented-control/segmented-control to avoid dev-client rebuild"
  - "display:none dual-mount (not conditional render) so Library scroll + search + filter state survives Suggestions toggle"
  - "Two independent useCollapsingHeader instances — sharing one scrollY across two lists was Research Pitfall 5"
  - "RegenerateFab calls useSuggestionsStore.getState().fetchSuggestions() — CONTEXT.md referenced a non-existent refreshSuggestions"
  - "Library FlatList large title reads 'Kitchen' (not 'Recipes') so compact header stays stable across segments"
  - "Initial segment param read via useLocalSearchParams; defaults to 'suggestions' per CONTEXT lock"

patterns-established:
  - "Segmented tab with state preservation: mount both children, toggle via display:none + pointerEvents, drive active compact-header opacity off the visible segment's scrollY"
  - "Atomic layout swap: rewrite _layout.tsx + delete old screens in the same task so /(tabs) redirect never resolves to a stale file"

requirements-completed:
  - UI rationalization (post-v1)

# Metrics
duration: 2 min
completed: 2026-04-18
---

# Phase 12 Plan 01: Combine Home + Recipes Summary

**Unified Kitchen tab with Suggestions/Library segmented control, dual-mounted lists preserving scroll and filter state, and 4-tab bar with Kitchen leftmost.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-18T05:17:21Z
- **Completed:** 2026-04-18T05:20:08Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 1 modified, 2 deleted, +1 Maestro stub)

## Accomplishments

- New `apps/mobile/src/app/(tabs)/kitchen.tsx` (548 lines) composes existing primitives — no new logic, pure UI rationalization
- Tab bar dropped from 5 to 4 tabs (Kitchen → Plan → Pantry → Shopping); Home and Recipes tabs removed
- Segment toggle preserves Library state across switches via `display:none` dual-mount
- RegenerateFab (sparkles icon) on Suggestions wired to the real `fetchSuggestions` store action (not the non-existent `refreshSuggestions` referenced in CONTEXT.md)
- Maestro stub file in place so Plan 03 can add real assertions

## Task Commits

1. **Task 1: Create Maestro segment-toggle flow stub** — `a71f773` (test)
2. **Task 2: Create kitchen.tsx with segmented control, dual lists, and FABs** — `2902401` (feat)
3. **Task 3: Update _layout.tsx, delete old tab files** — `4a06b37` (feat)

**Plan metadata:** (final commit after this SUMMARY)

## Files Created/Modified

- `apps/mobile/src/app/(tabs)/kitchen.tsx` — **Created.** Unified Kitchen screen with `segment: 'suggestions' | 'library'` local state, two `useCollapsingHeader()` instances, dual-mounted `SuggestionList` + `Animated.FlatList<Recipe>` via `display:none`, segmented Pressable pair, swapping FABs (ImportFab/RegenerateFab), settings gear + library-only search/filter/discover action buttons, initial segment from `useLocalSearchParams().segment`.
- `apps/mobile/src/app/(tabs)/_layout.tsx` — **Modified.** Replaced Home + Recipes `Tabs.Screen` entries with a single `<Tabs.Screen name="kitchen" />` as the FIRST child; kitchen uses `restaurant`/`restaurant-outline` icons. Plan/Pantry/Shopping entries unchanged in content, but re-ordered to come after Kitchen. screenOptions (orange active tint, warmWhite bar) preserved verbatim.
- `apps/mobile/src/app/(tabs)/index.tsx` — **Deleted.** Content migrated into `kitchen.tsx` SuggestionsHeader + SuggestionList.
- `apps/mobile/src/app/(tabs)/recipes.tsx` — **Deleted.** Content migrated into `kitchen.tsx` Library branch.
- `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml` — **Created (stub).** Flow scaffolded with `_ensure-logged-in` prerequisite, `tapOn: Kitchen`, and a TODO for Plan 03 to replace with real segment-toggle assertions.

## Decisions Made

- **Custom Pressable segmented control, not native.** `@react-native-segmented-control/segmented-control` would force a dev-client rebuild; a style-twin of pantry's `FILTER_TABS` achieves the iOS feel without new native deps (per 12-RESEARCH Pattern 2 + CONTEXT note).
- **display:none dual-mount, not conditional render.** Conditional rendering would unmount the Library `Animated.FlatList` on segment toggle and drop scroll position + search + filter state. `display:none` keeps both lists resident; `pointerEvents` on the inactive one prevents phantom touches (12-RESEARCH Pitfall 5 + Anti-Pattern).
- **Two independent `useCollapsingHeader()` instances.** Sharing one `scrollY` across two FlatLists would cause the header to collapse when the background list scrolled programmatically. The active segment drives the compact-header opacity (ternary).
- **Used `fetchSuggestions`, not `refreshSuggestions`.** CONTEXT.md referenced `refreshSuggestions`, which does not exist in `suggestionsStore`. The correct action is `fetchSuggestions`, confirmed by grepping the store surface. Plan's `<interfaces>` block flagged this ahead of time.
- **Library large title says "Kitchen", subtitle "{N} recipes".** Compact header reads "Kitchen" on both segments so the top-bar title doesn't swap when the user toggles — feels more like one screen, less like two pages wearing a trench coat.
- **`description ?? ''` normalization on search match.** Copied verbatim from `recipes.tsx`; no behavior change.
- **Initial segment via `useLocalSearchParams<{ segment? }>()`.** Any value other than `'library'` falls back to `'suggestions'` (CONTEXT lock). Prepares surface area for Plan 02's post-save `router.replace('/(tabs)/kitchen?segment=library')` pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SuggestionsHeader `displayName` prop type rejected `null`**
- **Found during:** Task 2 (kitchen.tsx initial typecheck)
- **Issue:** `useAuthStore((s) => s.profile?.display_name)` returns `string | null | undefined`, but the prop type on my local `SuggestionsHeader` subcomponent was `string | undefined`. TS2322 at the prop passthrough.
- **Fix:** Widened `displayName` prop type to `string | null | undefined`. The `titleText` fallback (`displayName ? ... : 'Kitchen'`) already handled all three cases correctly.
- **Files modified:** `apps/mobile/src/app/(tabs)/kitchen.tsx`
- **Verification:** `npx tsc --noEmit` — kitchen.tsx errors cleared.
- **Committed in:** `2902401` (Task 2)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Mechanical typing fix caught by `tsc`. No scope creep, no architectural decisions, no user interaction required.

## Issues Encountered

None during planned work. All three verification gates passed on first post-fix attempt.

**Residual typecheck errors (expected, scoped to Plan 02):** 8 errors in route call sites pointing at `/(tabs)` or `/(tabs)/recipes` — `apps/mobile/src/app/(auth)/_layout.tsx`, `src/app/index.tsx`, `src/app/onboarding/index.tsx`, `src/app/recipes/import-url.tsx`, `src/app/recipes/review.tsx` (3 sites), `src/app/scan/review.tsx`. Plan 01's scope ends at `_layout.tsx` and `kitchen.tsx`; these call sites are explicitly assigned to Plan 02.

## User Setup Required

None — no external service configuration touched by this plan.

## Next Phase Readiness

- **Ready for Plan 02:** Route call-site migration. Plan 02 will sweep the 8 residual typecheck errors by rewriting `/(tabs)` → `/(tabs)/kitchen` and `/(tabs)/recipes` → `/(tabs)/kitchen?segment=library`. Kitchen's `useLocalSearchParams().segment` consumer is already in place to receive those deep links.
- **Metro restart required** for any running dev server — expo-router's typed-routes manifest regenerates on next bundle. Clean rebuild not needed.
- **No blockers.** Typecheck is deterministic; all remaining errors are bounded and known.

## Self-Check

- [x] `apps/mobile/src/app/(tabs)/kitchen.tsx` exists
- [x] `apps/mobile/src/app/(tabs)/_layout.tsx` exists with `name="kitchen"` as first Tabs.Screen
- [x] `apps/mobile/src/app/(tabs)/index.tsx` deleted
- [x] `apps/mobile/src/app/(tabs)/recipes.tsx` deleted
- [x] `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml` exists
- [x] `git log --oneline --all` contains `a71f773`, `2902401`, `4a06b37`
- [x] `kitchen.tsx` uses `fetchSuggestions` (not `refreshSuggestions`)
- [x] `kitchen.tsx` uses `display: 'none'` (not conditional render) for segment toggle

## Self-Check: PASSED

---
*Phase: 12-combine-home-recipes*
*Completed: 2026-04-18*
