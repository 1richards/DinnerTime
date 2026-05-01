---
phase: 01-missing-ingredient-indicators-on-recipe-ingredient-lists
verified: 2026-04-29T19:14:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Open Recipe Box detail on a saved recipe that contains an ingredient you don't have in the pantry (e.g., bacon, salmon)."
    expected: "A trailing cart-add icon (cart.badge.plus, brand orange) appears next to that ingredient. Tapping it instantly flips the icon to a filled cart (cart.fill, success green). Pantry staples (salt, oil, butter) NEVER show the icon."
    why_human: "Visual placement, color tones, and tap-flip animation are perceptual; only a real device + Simulator can confirm icon rendering via expo-symbols (SF Symbols are macOS/iOS-rendered)."
  - test: "Open Discover, generate or pick a recipe with at least one ingredient you don't have, tap the card to open the PreviewSheet."
    expected: "Same trailing cart-add icon appears on the missing rows. Tapping adds the item to the active shopping list and flips the icon. Re-opening the same recipe (close + tap again) re-evaluates from pantry (icon returns to cart.badge.plus if not actually added — addedNames is per-sheet)."
    why_human: "Behavior verifies that addedNames lifecycle is bound to the sheet (not persisted) and that pantry reactivity flows through. Cannot be observed in vitest-node tests."
  - test: "On Plan tab, tap a planned meal to open the PreviewSheet (Plan day modal)."
    expected: "Same trailing cart-add icons on missing rows. Tap adds to shopping list with optimistic flip."
    why_human: "Plan day modal is the third surface using the same PreviewSheet; UAT confirms the wiring path covers it."
  - test: "Open cooking mode on any recipe (tap Cook Now from PreviewSheet or Plan)."
    expected: "Trailing cart-add icons appear on missing-ingredient rows in the cooking mode ingredient list. Tap adds to shopping list and flips icon. Existing checkbox toggle still works (tap the row body, not the trailing icon, to check/uncheck the ingredient)."
    why_human: "Two tap-targets in the same row (checkbox Pressable + trailing add Pressable). Hit-target separation needs human verification on a touch device."
  - test: "With NO active shopping list (or with backend offline), tap a missing-ingredient cart-add icon."
    expected: "An iOS Alert dialog surfaces with title 'Could not add to shopping list' and the error message. The icon rolls back from cart.fill to cart.badge.plus so the user can retry."
    why_human: "Error/rollback path requires backend failure or empty-list state; static analysis can't simulate the addItem throw on a real device."
  - test: "Edit your pantry: add an item like 'chicken' (status: available) while a PreviewSheet is open showing a recipe with 'chicken breast'."
    expected: "When you re-open the PreviewSheet (or it remounts), the cart-add icon next to 'chicken breast' is gone (bidirectional substring match: pantry 'chicken' covers ingredient 'chicken breast'). Pantry items with status='used' or 'depleted' do NOT count (Bug 3 contract)."
    why_human: "Reactivity through usePantryStore + status filter is observable only at runtime."
  - test: "Tap the cart-add icon on an ingredient that's already in your active shopping cart."
    expected: "Icon flips to cart.fill (success tone). The ingredient gets added to shopping list (no error). Re-opening the sheet later: addedNames is fresh per session, so if shoppingStore actually has the item, the icon shows cart.badge.plus again — this phase intentionally reads pantry only, not shopping cart, for the indicator state. Confirm this is acceptable UX."
    why_human: "Cross-store reactivity decision (whether shopping cart membership should also suppress the indicator) is a UX call deferred to user judgement."
---

# Phase 01: Missing-Ingredient Indicators Verification Report

**Phase Goal:** On every surface that lists a recipe's ingredients (Recipe Box detail, Discover preview, Plan day modal, Cooking mode), show which ingredients the user does not have in their pantry, and let them tap a missing ingredient to add it to the shopping list inline.
**Verified:** 2026-04-29T19:14:00Z
**Status:** human_needed (all automated checks pass; physical iPhone UAT pending)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                              | Status     | Evidence                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Recipe Box detail shows trailing cart-add icon on missing ingredients                                              | VERIFIED   | `kitchen.tsx:840` mounts `PreviewSheet`; `discover.tsx:455-488` passes `pantryNames`/`addedNames`/`onAddIngredient` to `ScaledIngredientList`; `ScaledIngredientList.tsx:109-123` renders `cart.badge.plus` Pressable.   |
| 2   | Discover preview shows trailing cart-add icon on missing ingredients                                               | VERIFIED   | `discover.tsx:276` mounts `PreviewSheet` with same wiring as Truth 1.                                                                                                                                                   |
| 3   | Plan day modal shows trailing cart-add icon on missing ingredients                                                 | VERIFIED   | `plan.tsx:1102` mounts `PreviewSheet` with same wiring as Truth 1.                                                                                                                                                      |
| 4   | Cooking-mode ingredient list shows trailing cart-add icon                                                          | VERIFIED   | `ScrollableRecipe.tsx:257-311` outer `ScrollableRecipeWithStores` subscribes to `usePantryStore`/`useShoppingStore`, computes `pantryNames`, injects per-row `inPantry`/`wasAdded`/`onAddToShoppingList` into each `IngredientRow`. |
| 5   | Pantry staples never render missing indicator                                                                      | VERIFIED   | `ingredientHelpers.ts:41` early-returns `true` for `PANTRY_STAPLES.has(target)`. Tested by `ingredientHelpers.test.ts:34-39` (Salt/olive oil/GARLIC POWDER all return true with empty pantry); `ScaledIngredientList.test.tsx:99-108` confirms staple ingredient renders zero trailing Pressables. |
| 6   | Tapping missing-indicator adds to shopping list and flips icon to cart.fill                                        | VERIFIED   | `discover.tsx:460-487` calls `useShoppingStore.addItem({ name, quantity, unit })` with optimistic `setAddedNames` flip. `ScrollableRecipe.tsx:273-300` mirrors. `ScaledIngredientList.test.tsx:111-131` asserts onAddIngredient called with the ingredient; `IngredientRow.test.tsx:139-155` asserts wasAdded=true renders non-pressable cart.fill marker. |
| 7   | When addItem throws, an Alert surfaces and icon rolls back                                                         | VERIFIED   | `discover.tsx:474-486` and `ScrollableRecipe.tsx:287-299` both: catch err, `setAddedNames`/`setAddedKeys` delete the key, `Alert.alert('Could not add to shopping list', ...)`. Mirrors `PantryItemCard.handleGetMore`. |

**Score:** 7/7 truths verified (programmatic). UAT items in frontmatter cover the perceptual + runtime-error paths that static analysis can't reach.

### Required Artifacts

| Artifact                                                                                | Expected                                                                  | Status     | Details                                                                                                       |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/recipes/ingredientHelpers.ts`                               | `isIngredientInPantry` pure helper, bidirectional + staple skip            | VERIFIED   | 50 lines. Exports `isIngredientInPantry`. Imports `PANTRY_STAPLES` from `../plan/pantryReady` (no redefinition). |
| `apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts`                | Unit tests covering staple-skip, bidirectional, case-insensitive, empty   | VERIFIED   | 9 vitest cases — all 7 plan-required behaviors covered. Pure (no React import).                                |
| `apps/mobile/src/components/recipes/ScaledIngredientList.tsx`                           | Trailing missing-indicator + tap handler, 3 new optional props             | VERIFIED   | Adds `pantryNames` / `addedNames` / `onAddIngredient`. `useMemo` dropped per Pitfall guard. Back-compat preserved (omit pantryNames → pre-Phase-01 render). |
| `apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx`            | Render assertion: missing rows expose trailing icon                        | VERIFIED   | 6 cases (back-compat + 5 plan-required). Static-tree-walk pattern.                                            |
| `apps/mobile/src/app/recipes/discover.tsx` (PreviewSheet)                                | Wires usePantryStore + useShoppingStore + try/catch+Alert                  | VERIFIED   | Lines 374-384 (subscriptions + filter), 455-488 (passing props + handler).                                    |
| `apps/mobile/src/components/cooking/IngredientRow.tsx`                                  | 3 new optional props + trailing column outside checkbox Pressable           | VERIFIED   | Lines 39-58 (props), 130-149 (trailing block). Outer View wraps existing checkbox Pressable.                  |
| `apps/mobile/src/components/cooking/ScrollableRecipe.tsx`                               | Outer/inner split; outer wires stores                                       | VERIFIED   | Inner `scrollableRecipeRender` (line 106) stays presentational; outer `ScrollableRecipeWithStores` (line 257-311) owns hooks + Alert rollback. |
| `apps/mobile/src/components/cooking/__tests__/IngredientRow.test.tsx`                    | 5 new cases under "missing-ingredient indicator" describe                  | VERIFIED   | Lines 93-190. Existing 3 checkbox cases also still present (regression guard).                                |
| `apps/mobile/src/components/cooking/__tests__/ScrollableRecipe.test.tsx`                 | Module-boundary mocks for pantryStore + shoppingStore                       | VERIFIED   | Lines 69-76 mock both stores via `vi.mock` so the supabase CJS chain doesn't trip vitest-node ESM resolution. |

### Key Link Verification

| From                         | To                                                  | Via                                                                | Status | Details                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discover.tsx > PreviewSheet`| `useShoppingStore.addItem`                          | Selector at line 375 + `await addToShoppingList(...)` at line 469  | WIRED  | Try/catch wraps the await; rollback `setAddedNames` + `Alert.alert` in catch.                                                                            |
| `discover.tsx > PreviewSheet`| `usePantryStore.items`                              | Selector at line 374; `.filter(p => p.status === 'available')` at 383 | WIRED  | Bug 3 contract: defensive re-filter at consumer despite `loadItems()` already restricting status.                                                        |
| `ScaledIngredientList`       | `ingredientHelpers.isIngredientInPantry`            | Import line 5; per-row call at line 90                              | WIRED  | Per-row computation; reads original `ing.name` (not scaled) per identity contract.                                                                       |
| `IngredientRow` (cooking)    | `useShoppingStore.addItem` + `usePantryStore.items` | Outer `ScrollableRecipeWithStores` injects via props                | WIRED  | Wrapper at `ScrollableRecipe.tsx:257` subscribes; inner `IngredientRow` receives `inPantry`/`wasAdded`/`onAddToShoppingList` per row.                    |
| `ScrollableRecipe outer`     | `ingredientHelpers.isIngredientInPantry`            | Import line 61; per-row call line 178                               | WIRED  | Same matcher as PreviewSheet — single helper; no parallel substring-loop reintroduced.                                                                   |

### Data-Flow Trace (Level 4)

| Artifact                       | Data Variable           | Source                                                                  | Produces Real Data | Status   |
| ------------------------------ | ----------------------- | ----------------------------------------------------------------------- | ------------------ | -------- |
| `ScaledIngredientList`         | `pantryNames` (prop)    | PreviewSheet → `usePantryStore((s) => s.items)` filtered to status==='available' | Yes — Zustand store hydrates from Supabase via `pantryStore.loadItems()` | FLOWING  |
| `ScaledIngredientList`         | `addedNames` (prop)     | PreviewSheet → `useState<Set<string>>(() => new Set())`, mutated on tap | Yes — mutable Set updated optimistically + on rollback | FLOWING  |
| `IngredientRow` (cooking)      | `inPantry` (prop)       | `ScrollableRecipeWithStores` → same `usePantryStore` + `isIngredientInPantry` | Yes | FLOWING  |
| `IngredientRow` (cooking)      | `wasAdded` (prop)       | `ScrollableRecipeWithStores` → `useState<Set<string>>(...)` of added keys | Yes | FLOWING  |
| Tap handler `addToShoppingList`| Network call            | `useShoppingStore((s) => s.addItem)` → POSTs to backend, throws on null currentList or network failure | Yes — store throws on failure (verified contract per CONTEXT.md Bug 3 trifecta) | FLOWING  |

### Behavioral Spot-Checks

| Behavior                                                                                  | Command                                                                                 | Result                                                              | Status |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| All phase 01 vitest specs pass                                                            | `npx vitest run src/components/recipes/__tests__/ingredientHelpers.test.ts ...`         | 4 files / 29 tests / all passing in 191ms                           | PASS   |
| Typecheck clean on changed files                                                          | `npx tsc --noEmit -p tsconfig.json` filtered to phase-01 paths                          | Empty output (zero errors)                                          | PASS   |
| `PANTRY_STAPLES` reused — no redefinition in `ingredientHelpers.ts`                        | grep `PANTRY_STAPLES` in helper                                                         | Single import from `../plan/pantryReady`; no `new Set([...])` redefinition | PASS   |
| Bidirectional substring matcher matches `pantryItemCardHelpers > isItemInShoppingCart`    | Inspect `ingredientHelpers.ts:45` — `cand === target \|\| cand.includes(target) \|\| target.includes(cand)` | Identical pattern; same trim+lowercase logic                        | PASS   |
| All 6 commits referenced in SUMMARY exist in `git log`                                    | `git log --oneline -20`                                                                 | All 6 SHAs (2378fe9, 1b4bdc0, 6a1cbc1, 5c3daaa, 717352b, 6ab6652) present | PASS   |

### Requirements Coverage

| Requirement                  | Source Plan | Description                                                                | Status     | Evidence                                                                       |
| ---------------------------- | ----------- | -------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| PHASE-01-INDICATOR-VISUAL    | 01-PLAN.md  | Trailing cart.badge.plus → cart.fill on add                                | SATISFIED  | `ScaledIngredientList.tsx:117` (cart.badge.plus, colors.brand) + `:103` (cart.fill, colors.success); `IngredientRow.tsx:138, 147` mirror. |
| PHASE-01-INDICATOR-COVERAGE  | 01-PLAN.md  | PreviewSheet (3 surfaces) + ScrollableRecipe                               | SATISFIED  | PreviewSheet mounted by `kitchen.tsx:840` (Recipe Box), `discover.tsx:276` (Discover), `plan.tsx:1102` (Plan); ScrollableRecipe mounted in cooking mode. |
| PHASE-01-INDICATOR-MATCH     | 01-PLAN.md  | Case-insensitive bidirectional substring; skip PANTRY_STAPLES; status filter | SATISFIED  | `ingredientHelpers.ts:41-48` (staple skip + bidirectional); `discover.tsx:383` and `ScrollableRecipe.tsx:270` both filter `status === 'available'`. |
| PHASE-01-INDICATOR-TAP       | 01-PLAN.md  | useShoppingStore.addItem with optimistic UI + Alert on failure              | SATISFIED  | `discover.tsx:469-486` and `ScrollableRecipe.tsx:282-299` both: optimistic flip, await, catch err, rollback, Alert.                              |
| PHASE-01-INDICATOR-TESTS     | 01-PLAN.md  | Helper unit tests + render assertion                                        | SATISFIED  | 4 test files / 29 cases all pass; render assertion in `ScaledIngredientList.test.tsx:69-85` and `IngredientRow.test.tsx:109-124`.                |

No orphaned requirements — all 5 declared in PLAN frontmatter map to verified evidence.

### Anti-Patterns Found

None. Scanned the 8 modified/created files for:
- TODO/FIXME/PLACEHOLDER comments — none present
- Empty implementations (`return null`, `=> {}`) — none in user-facing paths
- Hardcoded empty data flowing to render — none (pantry comes from real Zustand store; addedNames mutates on real tap)
- Console.log only handlers — none
- Hardcoded prop values like `pantryNames={[]}` at call sites — none (PreviewSheet derives from store; ScrollableRecipeWithStores derives from store)

### Human Verification Required

See frontmatter `human_verification` block above. Seven UAT scenarios listed for physical iPhone testing — they cover:
1. Recipe Box surface (saved recipe, real pantry)
2. Discover surface (live recipe with PreviewSheet)
3. Plan day surface (planned meal opens PreviewSheet)
4. Cooking mode surface (separate code path: ScrollableRecipe)
5. Error path (no active shopping list / network failure → Alert + rollback)
6. Reactivity (pantry edit while sheet is open)
7. Cross-store UX decision (in-cart-but-not-pantry behavior)

### Gaps Summary

None blocking. Every must-have artifact exists, is substantive, is wired, and traces to real reactive data sources. The vitest suite (29/29 green) covers the per-row indicator contract for both ScaledIngredientList and IngredientRow. The four surfaces declared in ROADMAP.md > Phase 1 all flow through one of two components (PreviewSheet or ScrollableRecipe outer wrapper), each independently verified.

The phase ships a clean reuse of `PANTRY_STAPLES` and the `isItemInShoppingCart` bidirectional matcher (mirrored as `isIngredientInPantry`) — no parallel matchers, no copy-paste of the staples list. The outer/inner split for `ScrollableRecipe` is a documented Rule 3 deviation that preserves regression-clean tests and is the right architectural call.

Status is `human_needed` rather than `passed` because:
- expo-symbols icons (cart.badge.plus, cart.fill) render natively via SF Symbols — vitest-node can't observe glyph rendering, only the string `name="cart.badge.plus"` we pass to `<SymbolIcon>`.
- The error-rollback path requires a runtime addItem failure (no active list / 5xx response) that can't be reliably simulated outside the iPhone.
- Cross-store UX (a tap-to-add icon while the item is already in the shopping cart) is a perceptual call best made by the user.

---

_Verified: 2026-04-29T19:14:00Z_
_Verifier: Claude (gsd-verifier)_
