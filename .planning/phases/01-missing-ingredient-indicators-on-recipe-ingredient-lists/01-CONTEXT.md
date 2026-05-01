# Phase 1: Missing-ingredient indicators on recipe ingredient lists - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Show, on every surface that lists a recipe's ingredients, which of those ingredients the user does NOT have in their pantry — and let them tap a missing ingredient to add it to the shopping list inline. Reuses the same pantry-match heuristic already powering the Plan tab's "Pantry ready" chip and mirrors the trailing-chip pattern just landed on PantryItemCard for "In cart". Out of scope: surfacing pantry coverage on the Recipe Box card grid (already implied by the chip on the day row), and any redesign of the ingredient row layout itself.

</domain>

<decisions>
## Implementation Decisions

### Visual Style
- Trailing `cart.badge.plus` icon on missing ingredient rows (success-tone when added, brand-tone when missing)
- Ingredient text stays full color — no strikethrough; the row is still part of the recipe, the icon is the actionable affordance
- Mirrors the new `In cart` trailing chip pattern landed on `PantryItemCard.tsx` so the visual vocabulary is consistent across pantry ↔ recipe surfaces

### Coverage
- **Recipe Box detail modal** — PreviewSheet rendered from `kitchen.tsx > SavedRecipeDetail`
- **Discover preview modal** — PreviewSheet rendered from `recipes/discover.tsx`
- **Plan day modal** — PreviewSheet rendered from `(tabs)/plan.tsx > previewEntry` (the modal pinged by Week DayRow taps and the new Month-cell taps)
- **Cooking mode ingredient list** — `ScrollableRecipe` view inside `recipes/[id]/cook.tsx`

All four routes today render their ingredients via shared primitives, so the indicator wiring should land in one component change that propagates to every surface.

### Match Logic
- Reuse `computePantryReady`'s heuristic from `apps/mobile/src/components/plan/pantryReady.ts`:
  - Case-insensitive bidirectional substring (pantry `chicken` matches ingredient `chicken breast` AND vice versa)
  - Skip `PANTRY_STAPLES` (salt, oil, water, butter, sugar, flour, garlic powder, onion powder, etc.) — they're treated as always-have
  - Pure on-device, no server roundtrip
- Pantry source: `usePantryStore.items` filtered to `status === 'available'` (mirroring the Bug 3 fix from the pantry trifecta)

### Tap Action
- Tap a missing ingredient row → optimistic add to current shopping list via `useShoppingStore.addItem({ name, quantity, unit })`
- On success, trailing icon flips from `cart.badge.plus` (brand) to `cart.fill` (success) + a brief "Added" feedback (haptic + opacity pulse)
- On failure, surface via `Alert` (reuses the addItem-throws-on-failure contract from the pantry trifecta `4a61494`)

### Claude's Discretion
- Exact icon/spacing choices within the existing ingredient row layout
- Whether to extract a new `IngredientRow` shared component or inline the indicator into each existing renderer
- Test coverage approach (existing static-tree-walk pattern for the helper + a render assertion or two)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/src/components/plan/pantryReady.ts` — `computePantryReady` + `PANTRY_STAPLES` constant
- `apps/mobile/src/components/pantry/pantryItemCardHelpers.ts` — `isItemInShoppingCart` (bidirectional substring matcher) + `deriveTrailingChip` (priority resolver). Direct analog: write `isIngredientInPantry` mirror.
- `apps/mobile/src/stores/shoppingStore.ts` — `addItem({ name, quantity, unit })` now throws on `null` list / server failure (post-trifecta), so callers can `try/catch` reliably
- `apps/mobile/src/stores/pantryStore.ts` — `items` selector; filter by `status === 'available'` per Bug 3 contract
- `expo-symbols` — `cart.badge.plus`, `cart.fill`, `checkmark.circle.fill` already in use across cooking/pantry surfaces
- `colors.brand` / `colors.success` — design tokens used consistently for action / confirmation states

### Established Patterns
- Trailing-chip pattern on row primitives (`ItemRow`, pantry `PantryItemCard`) — chip lives on the trailing edge of the row, conveys state without disrupting layout
- Reactive store-derived state — read store via Zustand selector and compute derived properties at render (no useMemo cache races; pattern proven in trifecta + Discover dedup work today)
- Pressable+View wrapper for any branded background (the Surprise me / cooking Done / cart-pop fix from `29ad9e7`) — apply if a primary-colored element is needed; otherwise plain Pressable is fine

### Integration Points
- PreviewSheet (`apps/mobile/src/app/recipes/discover.tsx:276`) — single component renders ingredients in 3 of 4 surfaces (Recipe Box detail, Discover, Plan day). Wiring the indicator here covers all three at once.
- ScrollableRecipe (`apps/mobile/src/components/cooking/ScrollableRecipe.tsx`) — owns the cooking mode ingredient list; needs separate wiring (different layout: per-step ingredients).
- ScaledIngredientList — referenced inside PreviewSheet for serving-size scaling; the indicator should not interfere with scaling behavior.

</code_context>

<specifics>
## Specific Ideas

- "Mirror the In-cart chip pattern landed today" — keep visual vocabulary identical between pantry and recipe surfaces so the user doesn't have to learn a second affordance
- "Tap = add to shopping cart, no nav" — disruptive nav was explicitly rejected; user wants to stay in the recipe context

</specifics>

<deferred>
## Deferred Ideas

- Surfacing per-card pantry coverage on the Recipe Box GRID (e.g., "8 of 12 ingredients") — different scope, would need card-layout work
- Aggregate "Add all missing to cart" CTA — useful but a bigger UX decision (placement, batching semantics, undo)
- Quantity-aware coverage (pantry has 1 lb chicken, recipe needs 2 lb) — current heuristic is presence-only; quantity math lives in `subtractPantry` server-side and isn't worth replicating client-side for an indicator

</deferred>
