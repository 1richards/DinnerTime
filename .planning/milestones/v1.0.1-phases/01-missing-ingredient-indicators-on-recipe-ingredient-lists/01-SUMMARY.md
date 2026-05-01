---
phase: 01-missing-ingredient-indicators-on-recipe-ingredient-lists
plan: 01
subsystem: ui
tags: [pantry, shopping-list, recipes, cooking-mode, expo-symbols, native-wind]

# Dependency graph
requires:
  - phase: 22-meal-planning-week-month
    provides: "PANTRY_STAPLES Set + computePantryReady bidirectional substring matcher in apps/mobile/src/components/plan/pantryReady.ts (mirrored, not re-aggregated)"
  - phase: pantry-trifecta
    provides: "shoppingStore.addItem now throws on null currentList AND server failure (commit 4a61494) — enabling reliable try/catch+Alert at consumers; pantryItemCardHelpers.isItemInShoppingCart bidirectional substring matcher (line-for-line analog mirrored as isIngredientInPantry)"
provides:
  - "isIngredientInPantry pure helper — per-ingredient bidirectional substring match against pantry names, skipping PANTRY_STAPLES (always-have)"
  - "ScaledIngredientList trailing missing-indicator + tap-to-add wiring (covers Recipe Box detail / Discover preview / Plan day modal via PreviewSheet)"
  - "Cooking IngredientRow trailing missing-indicator + tap-to-add wiring (cooking mode via ScrollableRecipe outer wrapper)"
  - "Outer/inner split for ScrollableRecipe — store wiring lives in the new ScrollableRecipeWithStores wrapper; the inner scrollableRecipeRender stays presentational + pure"
affects: [recipe-detail-modals, discover-preview, plan-day-modal, cooking-mode, future-shopping-flow-additions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-ingredient indicator helper extracted from aggregate pantry-ready helper (same matcher, different aggregation)"
    - "Outer-with-stores / inner-presentational component split to keep static-tree-walk vitest tests viable when adding store subscriptions to a component that previously had none"
    - "Optimistic flip + rollback + Alert (mirrors PantryItemCard.handleGetMore) for shoppingStore.addItem at all three consumer sites: PreviewSheet, ScrollableRecipe wrapper"

key-files:
  created:
    - "apps/mobile/src/components/recipes/ingredientHelpers.ts"
    - "apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts"
    - "apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx"
  modified:
    - "apps/mobile/src/components/recipes/ScaledIngredientList.tsx"
    - "apps/mobile/src/app/recipes/discover.tsx"
    - "apps/mobile/src/components/cooking/IngredientRow.tsx"
    - "apps/mobile/src/components/cooking/ScrollableRecipe.tsx"
    - "apps/mobile/src/components/cooking/__tests__/IngredientRow.test.tsx"
    - "apps/mobile/src/components/cooking/__tests__/ScrollableRecipe.test.tsx"

key-decisions:
  - "Drop useMemo in ScaledIngredientList — vitest-node static-tree-walk pattern (used today) calls components as plain functions; useMemo trips Invalid hook call. scaleIngredient is fast (single Fraction.mul per row)."
  - "Split ScrollableRecipe into outer-with-stores wrapper + inner presentational render fn — keeps the existing 16-04 tests (which invoke scrollableRecipeRender directly) regression-clean by avoiding store imports / useState in the inner fn."
  - "Mock pantryStore + shoppingStore at module boundary in ScrollableRecipe.test.tsx — prevents the supabase.ts → react-native-get-random-values CJS import chain from tripping vitest-node's ESM runner."
  - "Identity (pantry match + addedNames lookup) reads the ORIGINAL ingredient name, not the scaled label — quantity scaling is render-only and must not affect pantry-coverage decisions."

patterns-established:
  - "Helper-mirror pattern: when an aggregate helper (computePantryReady) needs per-row exposure, extract a peer pure helper (isIngredientInPantry) sharing the matcher but exposing a single boolean per item — don't run the aggregator N times."
  - "indicatorEnabled = pantryNames !== undefined gate — opt-in behavior on existing components so back-compat callers get pre-Phase-01 render shape exactly."

requirements-completed:
  - PHASE-01-INDICATOR-VISUAL
  - PHASE-01-INDICATOR-COVERAGE
  - PHASE-01-INDICATOR-MATCH
  - PHASE-01-INDICATOR-TAP
  - PHASE-01-INDICATOR-TESTS

# Metrics
duration: 8min
completed: 2026-05-01
---

# Phase 01 Plan 01: Missing-ingredient indicators on recipe ingredient lists Summary

**Per-row trailing cart-add indicator on every ingredient list surface (Recipe Box detail / Discover preview / Plan day modal / Cooking mode) backed by a single isIngredientInPantry helper that mirrors PANTRY_STAPLES + the bidirectional-substring matcher already powering Plan's "Pantry ready" chip.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-01T02:02:37Z
- **Completed:** 2026-05-01T02:09:54Z
- **Tasks:** 3 (all TDD)
- **Files modified:** 9 (3 created, 6 modified — including the test files)

## Accomplishments

- `isIngredientInPantry(name, pantryNames)` pure helper exported from `apps/mobile/src/components/recipes/ingredientHelpers.ts` — bidirectional substring + PANTRY_STAPLES skip, mirrors `isItemInShoppingCart` (line-for-line analog inverted for the recipe → pantry direction).
- `ScaledIngredientList` extended with three optional props (`pantryNames`, `addedNames`, `onAddIngredient`) — when provided, every non-staple, non-pantry-covered row exposes a trailing `cart.badge.plus` Pressable; once tapped, the row flips to a non-pressable `cart.fill` (success tone) marker; staples never show the indicator.
- `PreviewSheet` (single component used by Recipe Box detail, Discover preview, **and** Plan day modal) wires `usePantryStore` + `useShoppingStore` with optimistic flip + try/catch + Alert rollback (mirrors `PantryItemCard.handleGetMore`).
- `IngredientRow` (cooking mode) extended with `inPantry` / `wasAdded` / `onAddToShoppingList` props following the same pattern; existing checkbox tap-target unchanged.
- `ScrollableRecipe` split: inner `scrollableRecipeRender` stays presentational + pure (so the existing 16-04 static-walk tests continue to invoke it directly without store imports), new outer `ScrollableRecipeWithStores` wrapper owns the pantry/shopping subscriptions + per-session `addedKeys` set + Alert rollback.

## Task Commits

Each task was committed atomically using the TDD red→green pattern.

1. **Task 1: isIngredientInPantry helper + tests**
   - Test (RED): `2378fe9` — 9 failing cases (module missing)
   - Impl (GREEN): `1b4bdc0` — 9/9 pass
2. **Task 2: ScaledIngredientList + PreviewSheet wiring**
   - Test (RED): `6a1cbc1` — 6 failing cases
   - Impl (GREEN): `5c3daaa` — 6/6 pass; PreviewSheet (covers 3 surfaces in one diff)
3. **Task 3: cooking IngredientRow + ScrollableRecipe wiring**
   - Test (RED): `717352b` — 5 new cases (3 fail RED; 2 + 5 existing tests pass throughout — regression guard intact)
   - Impl (GREEN): `6ab6652` — 8/8 IngredientRow + 6/6 ScrollableRecipe pass

## Files Created/Modified

### Created
- `apps/mobile/src/components/recipes/ingredientHelpers.ts` — `isIngredientInPantry` pure helper (50 lines).
- `apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts` — 9 unit tests (empty / staple / case / bidirectional / no-overlap / empty-pantry-row / trim).
- `apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx` — 6 static-walk render tests (back-compat / empty pantry / suppression / staple / tap / Added marker).

### Modified
- `apps/mobile/src/components/recipes/ScaledIngredientList.tsx` — added `pantryNames` / `addedNames` / `onAddIngredient` props; trailing icon column logic; dropped useMemo per Pitfall guard.
- `apps/mobile/src/app/recipes/discover.tsx` (PreviewSheet) — added `usePantryStore` + `useShoppingStore` imports; pantry/shopping wiring inside `PreviewSheet` with optimistic flip + Alert rollback.
- `apps/mobile/src/components/cooking/IngredientRow.tsx` — added `inPantry` / `wasAdded` / `onAddToShoppingList` props; restructured outer View wraps existing checkbox Pressable + new trailing column.
- `apps/mobile/src/components/cooking/ScrollableRecipe.tsx` — outer/inner split; new `ScrollableRecipeWithStores` wrapper owns hooks + Alert rollback; inner `scrollableRecipeRender` stays pure.
- `apps/mobile/src/components/cooking/__tests__/IngredientRow.test.tsx` — added 5 new cases under a "missing-ingredient indicator" describe block.
- `apps/mobile/src/components/cooking/__tests__/ScrollableRecipe.test.tsx` — added module-boundary mocks for `pantryStore` + `shoppingStore` so vitest-node ESM resolution stays clean.

## Coverage Map

| Surface              | Mounting component        | Wiring location                                              | Covered? |
| -------------------- | ------------------------- | ------------------------------------------------------------ | :------: |
| Recipe Box detail    | `PreviewSheet`            | `apps/mobile/src/app/recipes/discover.tsx > PreviewSheet`    | YES      |
| Discover preview     | `PreviewSheet`            | same as above                                                | YES      |
| Plan day modal       | `PreviewSheet`            | same as above                                                | YES      |
| Cooking mode         | `ScrollableRecipe` outer  | `apps/mobile/src/components/cooking/ScrollableRecipe.tsx`    | YES      |

All four surfaces declared in 01-CONTEXT.md > Coverage land in two files (PreviewSheet + ScrollableRecipe outer wrapper). The pantry/shopping subscription pattern is identical at both sites for future maintainability.

## isIngredientInPantry Contract (so future plans don't reinvent it)

```typescript
export function isIngredientInPantry(
  ingredientName: string,
  pantryNames: readonly string[],
): boolean;
```

Decision rule (in order):
1. Empty / whitespace-only `ingredientName` → `false`.
2. `ingredientName` (trimmed + lowercased) is in `PANTRY_STAPLES` (imported from `../plan/pantryReady`) → `true`.
3. Otherwise: bidirectional substring match against any pantry name (case-insensitive, trimmed) — `cand === target || cand.includes(target) || target.includes(cand)`. Empty/whitespace pantry rows are skipped.

Pantry list MUST already be filtered to `status === 'available'` by the caller (Bug 3 contract from the pantry trifecta). The caller responsibility — not this helper's — for two reasons: (a) defensive re-filtering at the consumer is the documented contract, and (b) accepting a `PantryItem[]` here would force the helper to import the type, blocking its vitest-node parity with `isItemInShoppingCart`.

## Decisions Made

- **Drop useMemo in ScaledIngredientList.** vitest-node static-tree-walk tests call components as plain functions; `useMemo` outside a renderer throws "Invalid hook call". `scaleIngredient` is a single `Fraction.mul` per row — premature memo. Plan's Pitfall guard explicitly authorized this.
- **Split ScrollableRecipe into outer + inner components.** Adding `useState` and `usePantryStore` directly to `scrollableRecipeRender` would have broken the existing 16-04 ScrollableRecipe.test.tsx (which invokes the inner fn directly). The split keeps the inner fn pure + presentational and isolates store wiring to the outer wrapper. cook.tsx's existing `useRef<ScrollableRecipeHandle>` API still works because the outer wrapper passes the ref straight through.
- **Mock stores at the test-module boundary.** `vi.mock('../../../stores/pantryStore')` + `vi.mock('../../../stores/shoppingStore')` in `ScrollableRecipe.test.tsx` keep `react-native-get-random-values` (CJS) out of the vitest-node ESM resolution chain. Cleaner than monkey-patching globals or restructuring the production import graph.
- **Identity reads original ingredient name, not the scaled label.** Quantity scaling is render-only — pantry coverage decisions reference `ing.name`, not `scaled.name` (which is the same string, but the principle is documented so future scaling work doesn't accidentally couple identity to display formatting).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ScrollableRecipe outer/inner split (architectural adjustment to honor existing tests)**

- **Found during:** Task 3 (cooking IngredientRow + ScrollableRecipe wiring)
- **Issue:** The plan called for adding `usePantryStore` + `useShoppingStore` + `useState` directly inside `scrollableRecipeRender` and explicitly said "DO NOT add tests for ScrollableRecipe's wiring — the existing ScrollableRecipe.test.tsx covers its render shape." But: (a) the imported `pantryStore.ts` transitively imports `supabase.ts` → `react-native-get-random-values` (CJS) which trips vitest-node's ESM runner at module load time, killing the existing tests; (b) `useState` outside a renderer throws "Invalid hook call" — the existing test calls `scrollableRecipeRender` as a plain function. Both effects break the regression guard the plan explicitly required.
- **Fix:** Split into inner `scrollableRecipeRender` (presentational, accepts injected `pantryNames` / `addedKeys` / `onAddIngredient` props) + outer `ScrollableRecipeWithStores` wrapper (owns hooks + store subscriptions). Test file gets module-boundary mocks for the two stores so the import chain stops at the mock and never reaches supabase.
- **Files modified:** `apps/mobile/src/components/cooking/ScrollableRecipe.tsx`, `apps/mobile/src/components/cooking/__tests__/ScrollableRecipe.test.tsx`
- **Verification:** All 6 existing ScrollableRecipe tests + all 8 IngredientRow tests + all 6 ScaledIngredientList tests + all 9 ingredientHelpers tests pass (29/29).
- **Committed in:** `6ab6652` (Task 3 GREEN commit)

This is Rule 3 (Blocking — the as-written approach made the tests literally un-runnable) rather than Rule 4 (Architectural — there's no new infrastructure, table, service layer, or framework swap; the same component just gains a parent wrapper, which is a minor structural refinement).

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for regression-clean test runs. No scope creep, no new tables, no new services, no behavior change at the consumer (cook.tsx still uses `<ScrollableRecipe ref={...} ... />` exactly as before).

## Issues Encountered

- The vitest-node + supabase CJS import chain bit at the inner test file (described above as Rule 3 deviation). Resolved by module-boundary mocks for the two stores.

## User Setup Required

None — no external service configuration required. The feature is fully on-device (pantry + shopping list reads + writes go through existing Supabase-backed stores).

## Known Stubs

None. Every surface declared in 01-CONTEXT.md > Coverage is wired live to real pantry + shopping data; no placeholder data, no "coming soon" copy, no unrendered hooks.

## Outstanding Follow-ups (explicitly deferred per 01-CONTEXT.md > Deferred Ideas)

1. **Per-card pantry coverage on the Recipe Box card grid** ("8 of 12 ingredients") — different scope; would need card-layout work. Out of scope for Phase 01.
2. **"Add all missing to cart" aggregate CTA** — bigger UX decision (placement, batching semantics, undo). Could land as a future Phase if user adoption of the per-row indicator suggests demand for it.
3. **Quantity-aware coverage** (pantry has 1 lb chicken, recipe needs 2 lb) — the heuristic is presence-only. Quantity math lives in `subtractPantry` server-side and isn't worth replicating client-side just for an indicator.

## Next Phase Readiness

- The `isIngredientInPantry` contract is now stable and documented above. Future plans needing per-ingredient pantry coverage should import it from `apps/mobile/src/components/recipes/ingredientHelpers.ts` rather than re-inventing.
- The `ScrollableRecipe` outer/inner split establishes a clean pattern for any future cooking-mode props that need store subscriptions (subscribe in the wrapper, inject as props into the inner render fn).
- The `indicatorEnabled = pantryNames !== undefined` opt-in gate on `ScaledIngredientList` means any caller that does NOT want the indicator (e.g., a hypothetical print/share view) can omit the prop and get the pre-Phase-01 render exactly. Back-compat preserved.

## Self-Check: PASSED

Verified:
- `apps/mobile/src/components/recipes/ingredientHelpers.ts` — FOUND
- `apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts` — FOUND
- `apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx` — FOUND
- Commits `2378fe9`, `1b4bdc0`, `6a1cbc1`, `5c3daaa`, `717352b`, `6ab6652` — ALL FOUND in `git log`.
- All 4 plan-relevant test files — 29/29 pass via vitest.
- Typecheck of changed files — zero new errors (`npx tsc --noEmit -p tsconfig.json` filtered to changed paths returns empty).
- Reuse audit — `ingredientHelpers.ts` is the single bidirectional matcher; no parallel substring loop reintroduced elsewhere.

---
*Phase: 01-missing-ingredient-indicators-on-recipe-ingredient-lists*
*Completed: 2026-05-01*
