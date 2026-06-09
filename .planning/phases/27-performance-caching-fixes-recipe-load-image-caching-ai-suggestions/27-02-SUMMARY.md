---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
plan: 02
subsystem: recipes-mobile
tags: [performance, flatlist-windowing, react-memo, image-caching, ui-cleanup]
requires:
  - "POST /generate-image accepts recipeId and persists image_url (Plan 27-01)"
provides:
  - "Recipe Box FlatList windows to a small visible set, bounding generate-image fan-out on mount"
  - "RecipeCard is React.memo'd with a render-affecting comparator (no parent-driven re-render storms)"
  - "Saved cards forward recipeId to useGeneratedRecipeImage → POST /generate-image, enabling 27-01's write-back"
  - "Source-type/cuisine corner badge removed from every recipe card"
affects:
  - apps/mobile/src/app/(tabs)/kitchen.tsx
  - apps/mobile/src/components/recipes/RecipeCard.tsx
  - apps/mobile/src/hooks/useGeneratedRecipeImage.ts
tech-stack:
  added: []
  patterns:
    - "FlatList windowing tuple: initialNumToRender=6 / maxToRenderPerBatch=6 / windowSize=5 / removeClippedSubviews on long recipe lists"
    - "Hoist FlatList renderItem to a stable useCallback so React.memo'd cells actually skip re-render"
    - "React.memo with an explicit field comparator on the render-affecting props of a list cell"
key-files:
  created: []
  modified:
    - apps/mobile/src/app/(tabs)/kitchen.tsx
    - apps/mobile/src/components/recipes/RecipeCard.tsx
    - apps/mobile/src/hooks/useGeneratedRecipeImage.ts
decisions:
  - "[27-02] Kept the cuisineLabel prop in RecipeCardProps (SuggestionList.tsx passes item.cuisine_type) but stopped rendering it — removing the prop would have broken that caller's JSX with an excess-property error. Decision 7 only mandates the badge stop rendering, not removing the API."
  - "[27-02] useCallback(renderRecipeCard) dep array is [handleCardPress] only — router is a stable module-level expo-router import, not a hook value, so it needs no dep."
  - "[27-02] React.memo comparator keys on recipe.id, recipe.image_url, recipe.is_favorite, mode, pantryMatchCount — the only props that change the rendered output for a given card."
metrics:
  duration: 4min
  completed: 2026-06-09
---

# Phase 27 Plan 02: Recipe Box Rendering + UI Fixes Summary

Windowed the Recipe Box FlatList so off-screen cards no longer mount and fan out `generate-image` on scroll, memoized `RecipeCard` so a parent re-render (search/filter state) doesn't re-render every mounted card, removed the source-type/cuisine corner badge entirely (Decision 7), and forwarded `recipeId` from saved cards through `useGeneratedRecipeImage` to the `POST /generate-image` body so Plan 27-01's server write-back actually fires for saved recipes. Mobile-only — no server route or cache touched.

## What Changed

### Task 1 — FlatList windowing + useCallback renderItem in kitchen.tsx (commit 1c940d1)
- Added the Decision 3 windowing tuple to the Recipe Box `<Animated.FlatList>`: `initialNumToRender={6}`, `maxToRenderPerBatch={6}`, `windowSize={5}`, `removeClippedSubviews`. Default `windowSize=21` mounted ~10 screens of cards; each off-screen card fired `generate-image` on mount. Windowing bounds the mounted set to roughly the visible window.
- Hoisted the inline `renderItem` closure into a stable `renderRecipeCard = useCallback(({ item }) => <RecipeCard … />, [handleCardPress])`, set `renderItem={renderRecipeCard}`. Without a stable renderItem, Task 2's `React.memo` would be defeated by a fresh closure each parent render.
- Imported `useCallback` from `react`.

### Task 2 — Memoize RecipeCard, remove badge, forward recipeId (commit 0509929)
- **(A) Badge removed (Decision 7):** Deleted the `SOURCE_LABELS` map, the `<View style={styles.sourceBadge}>…</View>` block over the hero, and the `sourceBadge`/`sourceBadgeText` StyleSheet entries. No AI/URL/cuisine corner label renders on any card now. The `cuisineLabel` prop stays in the interface (SuggestionList passes `item.cuisine_type`) but is no longer destructured or rendered — documented as accepted-but-ignored.
- **(B) recipeId forwarded (Decision 1 / P0 wiring):** `RecipeCard` now passes `recipeId: recipe.id ?? undefined` to `useGeneratedRecipeImage`. Threaded `recipeId` through `HookOptions` → `ImageRequest` → the `POST /generate-image` JSON body (and the `prefetchGeneratedRecipeImage` twin path). Saved recipes now tell the server which row to persist the URL to; unsaved "Something New" previews carry no id → `null` → server skips the write (matches 27-01's guard).
- **(C) Memoized (Decision 4 / P2):** Renamed the function to `RecipeCardBase` and exported `RecipeCard = React.memo(RecipeCardBase, comparator)`, where the comparator returns "skip render" unless `recipe.id`, `recipe.image_url`, `recipe.is_favorite`, `mode`, or `pantryMatchCount` changed. Preserved the `export type { RecipeCardMode }` surface.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — no errors in `kitchen.tsx`, `RecipeCard.tsx`, `useGeneratedRecipeImage.ts`, or the downstream caller `SuggestionList.tsx`. Baseline for these files was already clean, so zero new errors introduced.
- `grep` confirms: `SOURCE_LABELS` count = 0 and `sourceBadge` count = 0 in RecipeCard.tsx; `React.memo` and `recipeId: recipe.id` both present; `windowSize={5}`, `initialNumToRender={6}`, `maxToRenderPerBatch={6}`, `removeClippedSubviews`, `renderRecipeCard` all present in kitchen.tsx.
- `pnpm vitest run` (full mobile suite) → 108 files / 910 tests passed, no regressions.

## Deviations from Plan

### Auto-decisions (within plan latitude)

**1. [Rule 3 - Blocking] Kept `cuisineLabel` prop instead of removing it.**
- **Found during:** Task 2(A). The plan said to remove the `cuisineLabel` prop "if its sole use was the badge." A grep showed `SuggestionList.tsx:219` passes `cuisineLabel={item.cuisine_type}`.
- **Resolution:** Removing the prop from `RecipeCardProps` would have produced a TS excess-property error at that JSX call site. Per the plan's own guard ("if zero other uses remain… remove"), a use remains, so the prop stayed in the interface; only the rendering was removed. Documented the prop as accepted-but-ignored in its doc comment and the destructure comment.
- **Files modified:** apps/mobile/src/components/recipes/RecipeCard.tsx
- **Commit:** 0509929

**2. [Threading] Added `recipeId` to `prefetchGeneratedRecipeImage` as well.**
- The plan only called out the hook's request body, but the file has a twin prefetch path sharing `HookOptions`/`ImageRequest`. Threaded `recipeId` through it too so a prefetched saved-recipe image also persists, keeping the two paths consistent. No behavior change for callers that don't pass `recipeId`.
- **Files modified:** apps/mobile/src/hooks/useGeneratedRecipeImage.ts
- **Commit:** 0509929

## Known Stubs

None. No hardcoded empty values, placeholder text, or unwired data sources introduced.

## Self-Check: PASSED
- FOUND: apps/mobile/src/app/(tabs)/kitchen.tsx (windowSize={5}, renderRecipeCard)
- FOUND: apps/mobile/src/components/recipes/RecipeCard.tsx (React.memo, recipeId: recipe.id, no SOURCE_LABELS/sourceBadge)
- FOUND: apps/mobile/src/hooks/useGeneratedRecipeImage.ts (recipeId in HookOptions + POST body)
- FOUND commit: 1c940d1 (Task 1 — FlatList windowing)
- FOUND commit: 0509929 (Task 2 — memoize + badge removal + recipeId)
