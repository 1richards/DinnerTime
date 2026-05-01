---
phase: 01-missing-ingredient-indicators-on-recipe-ingredient-lists
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/components/recipes/ingredientHelpers.ts
  - apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts
  - apps/mobile/src/components/recipes/ScaledIngredientList.tsx
  - apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx
  - apps/mobile/src/app/recipes/discover.tsx
  - apps/mobile/src/components/cooking/IngredientRow.tsx
  - apps/mobile/src/components/cooking/ScrollableRecipe.tsx
  - apps/mobile/src/components/cooking/__tests__/IngredientRow.test.tsx
autonomous: true
requirements:
  - PHASE-01-INDICATOR-VISUAL
  - PHASE-01-INDICATOR-COVERAGE
  - PHASE-01-INDICATOR-MATCH
  - PHASE-01-INDICATOR-TAP
  - PHASE-01-INDICATOR-TESTS

must_haves:
  truths:
    - "When viewing a recipe in the Recipe Box detail modal, ingredients the user does not have show a trailing cart-add icon."
    - "When viewing a recipe in the Discover preview modal, ingredients the user does not have show a trailing cart-add icon."
    - "When viewing a recipe from the Plan day modal, ingredients the user does not have show a trailing cart-add icon."
    - "When viewing the cooking-mode ingredient list, ingredients the user does not have show a trailing cart-add icon."
    - "Pantry staples (salt, oil, water, butter, sugar, flour, garlic powder, onion powder, etc.) NEVER render the missing indicator, even when not in pantry."
    - "Tapping a missing-indicator icon adds the ingredient to the current shopping list and the icon flips to a success-tone cart-fill."
    - "When addItem throws (no active list / network failure), an Alert surfaces the error to the user."
  artifacts:
    - path: "apps/mobile/src/components/recipes/ingredientHelpers.ts"
      provides: "isIngredientInPantry pure helper — bidirectional substring match against pantry names, skipping PANTRY_STAPLES"
      exports: ["isIngredientInPantry"]
    - path: "apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts"
      provides: "Unit tests for isIngredientInPantry covering staple-skip, bidirectional match, case-insensitive, empty-name fallthrough"
      contains: "isIngredientInPantry"
    - path: "apps/mobile/src/components/recipes/ScaledIngredientList.tsx"
      provides: "Ingredient list with optional trailing missing-indicator icon + tap-to-add handler"
      exports: ["ScaledIngredientList"]
    - path: "apps/mobile/src/components/cooking/IngredientRow.tsx"
      provides: "Cooking-mode row with optional trailing missing-indicator icon + tap-to-add handler"
      exports: ["IngredientRow", "IngredientRowProps"]
  key_links:
    - from: "apps/mobile/src/components/recipes/ScaledIngredientList.tsx"
      to: "apps/mobile/src/stores/shoppingStore.ts (addItem)"
      via: "useShoppingStore selector + try/catch around addItem"
      pattern: "useShoppingStore.*addItem"
    - from: "apps/mobile/src/components/recipes/ScaledIngredientList.tsx"
      to: "apps/mobile/src/stores/pantryStore.ts (items)"
      via: "usePantryStore selector filtered to status === 'available'"
      pattern: "usePantryStore.*items"
    - from: "apps/mobile/src/components/recipes/ScaledIngredientList.tsx"
      to: "apps/mobile/src/components/recipes/ingredientHelpers.ts (isIngredientInPantry)"
      via: "import + per-row computation"
      pattern: "isIngredientInPantry"
    - from: "apps/mobile/src/components/cooking/IngredientRow.tsx"
      to: "apps/mobile/src/stores/shoppingStore.ts + apps/mobile/src/stores/pantryStore.ts"
      via: "ScrollableRecipe passes pantryNames + onAddToShoppingList per row"
      pattern: "onAddToShoppingList"
---

<objective>
Show, on every surface that lists a recipe's ingredients, which ingredients the user does NOT have in their pantry — and let them tap a missing ingredient to add it to the shopping list inline. One helper covers all four surfaces (Recipe Box detail, Discover preview, Plan day modal, Cooking mode) by wiring through two shared primitives: `ScaledIngredientList` (3 surfaces via `PreviewSheet`) and the cooking `IngredientRow` (1 surface via `ScrollableRecipe`).

Purpose: Close the "what do I need to buy?" loop without leaving the recipe context. Mirrors the trailing-chip vocabulary the pantry tab already uses (`isItemInShoppingCart` + `cart.fill` chip on `PantryItemCard`) so users learn one affordance, not two.

Output: A pure `isIngredientInPantry` helper + tests, two updated ingredient list components with optional missing-indicator + tap-to-add, and a render-assertion test confirming missing rows expose the trailing icon.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/01-missing-ingredient-indicators-on-recipe-ingredient-lists/01-CONTEXT.md
@apps/mobile/src/components/plan/pantryReady.ts
@apps/mobile/src/components/pantry/pantryItemCardHelpers.ts
@apps/mobile/src/components/pantry/PantryItemCard.tsx
@apps/mobile/src/components/recipes/ScaledIngredientList.tsx
@apps/mobile/src/components/cooking/IngredientRow.tsx
@apps/mobile/src/components/cooking/ScrollableRecipe.tsx
@apps/mobile/src/app/recipes/discover.tsx
@apps/mobile/src/stores/shoppingStore.ts
@apps/mobile/src/stores/pantryStore.ts
@apps/mobile/src/components/cooking/__tests__/StepNavButtons.test.tsx

<interfaces>
<!-- Key types and contracts the executor needs. Use these directly — no codebase exploration required. -->

From apps/mobile/src/types/recipe.ts:
```typescript
export interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}
```

From apps/mobile/src/types/pantry.ts:
```typescript
export type PantryItemStatus = 'available' | 'used' | 'depleted';
// PantryItem has: { id, name, quantity, unit, status, ... }
```

From apps/mobile/src/components/plan/pantryReady.ts (REUSE — DO NOT REDEFINE):
```typescript
export const PANTRY_STAPLES: ReadonlySet<string>; // 11 entries: salt, pepper, water, oil, olive oil, vegetable oil, butter, sugar, flour, garlic powder, onion powder
```

From apps/mobile/src/components/pantry/pantryItemCardHelpers.ts (PATTERN TO MIRROR — bidirectional substring matcher):
```typescript
export function isItemInShoppingCart(
  itemName: string,
  shoppingNames: readonly string[],
): boolean;
// Implementation: trim+lowercase, return true on cand === target || cand.includes(target) || target.includes(cand)
```

From apps/mobile/src/stores/shoppingStore.ts (consumers MUST try/catch — addItem throws):
```typescript
addItem: (input: { name: string; quantity?: number | null; unit?: string | null }) => Promise<void>;
// Throws on null currentList ('No active shopping list') and on POST failure.
```

From apps/mobile/src/stores/pantryStore.ts:
```typescript
// Selector: usePantryStore((s) => s.items)
// items is already filtered to status === 'available' by loadItems(), but defensive
// re-filter at the consumer is the Bug 3 contract per CONTEXT.md.
```

From apps/mobile/src/components/recipes/ScaledIngredientList.tsx (CURRENT shape — extend, don't rewrite):
```typescript
interface ScaledIngredientListProps {
  ingredients: ParsedIngredient[];
  multiplier: number;
}
```

From apps/mobile/src/components/cooking/IngredientRow.tsx (CURRENT shape — extend, don't rewrite):
```typescript
export interface IngredientRowProps {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  checked: boolean;
  onToggle: (id: string) => void;
}
```

From apps/mobile/src/components/cooking/ScrollableRecipe.tsx:
```typescript
// ScrollableRecipe maps recipe.ingredients to <IngredientRow ... /> at lines 129-142.
// This is where pantry/shopping store wiring lands for cooking mode.
```

From apps/mobile/src/design/tokens.ts:
```typescript
colors.brand    // '#C65D3A' — missing-indicator icon tint
colors.success  // '#16A34A' — added (cart.fill) tint
```

Pattern reference — Pressable + try/catch + Alert (from PantryItemCard.tsx handleGetMore):
```typescript
try {
  await addItem({ name, quantity, unit });
} catch (err) {
  Alert.alert(
    'Could not add to shopping list',
    err instanceof Error ? err.message : 'Please try again.',
  );
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create isIngredientInPantry helper + unit tests</name>
  <files>
    apps/mobile/src/components/recipes/ingredientHelpers.ts,
    apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts
  </files>
  <behavior>
    - Test: returns false for empty/whitespace ingredient name (no false positives on bad data)
    - Test: returns true when ingredient name is in PANTRY_STAPLES (e.g., 'Salt' → true even with empty pantry; staples are always-have per D-MATCH)
    - Test: case-insensitive match — pantry 'Chicken' matches ingredient 'chicken breast'
    - Test: bidirectional substring — pantry 'chicken' matches ingredient 'chicken breast' AND pantry 'brown rice' matches ingredient 'rice'
    - Test: returns false when no pantry name overlaps the non-staple ingredient
    - Test: ignores empty pantry names (e.g., trimmed-blank pantry rows do NOT match every ingredient)
    - Test: trims + lowercases both sides before comparing (e.g., '  CHICKEN  ' matches 'chicken')
  </behavior>
  <action>
    Create `apps/mobile/src/components/recipes/ingredientHelpers.ts` exporting a single pure function:

    ```typescript
    import { PANTRY_STAPLES } from '../plan/pantryReady';

    /**
     * True iff a recipe ingredient is "covered" by the user's pantry.
     *
     * Coverage rule (mirrors computePantryReady's per-ingredient match — extracted
     * here so PreviewSheet + ScrollableRecipe can render a per-row indicator
     * without re-running the 80% threshold logic):
     *
     *   1. Empty / whitespace-only name → false (don't render indicator on bad data).
     *   2. Name (trimmed + lowercased) is in PANTRY_STAPLES → true (always-have).
     *   3. Otherwise: bidirectional substring match against any pantry name —
     *      pantry name contains ingredient OR ingredient contains pantry name.
     *      Case-insensitive, trimmed.
     *
     * Pantry list MUST already be filtered to status === 'available' by the caller
     * (Bug 3 contract — see 01-CONTEXT.md > Match Logic).
     *
     * Mirror of `isItemInShoppingCart` in pantryItemCardHelpers.ts (same bidirectional
     * matcher). Pure: no React, no stores, runs under vitest-node without RN renderer.
     */
    export function isIngredientInPantry(
      ingredientName: string,
      pantryNames: readonly string[],
    ): boolean {
      const target = ingredientName.trim().toLowerCase();
      if (!target) return false;
      if (PANTRY_STAPLES.has(target)) return true;
      for (const raw of pantryNames) {
        const cand = raw.trim().toLowerCase();
        if (!cand) continue;
        if (cand === target || cand.includes(target) || target.includes(cand)) {
          return true;
        }
      }
      return false;
    }
    ```

    Create `apps/mobile/src/components/recipes/__tests__/ingredientHelpers.test.ts` using the same vitest pattern as `pantryReady.test.ts` and `pantryItemCardHelpers.test.ts` (pure unit tests, no JSX). Cover all 7 cases listed in <behavior>. No React import.

    Why a per-ingredient helper instead of reusing computePantryReady directly: computePantryReady returns a single boolean for the whole recipe (with an 80% threshold). The indicator is per-row — every individual non-staple ingredient that doesn't match should show the icon. Same matcher, different aggregation.
  </action>
  <verify>
    <automated>cd apps/mobile && npx vitest run src/components/recipes/__tests__/ingredientHelpers.test.ts</automated>
  </verify>
  <done>
    isIngredientInPantry exported from ingredientHelpers.ts; all 7 test cases pass; helper is pure (no React, no store imports).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire missing indicator + tap-to-add into ScaledIngredientList (covers PreviewSheet → 3 surfaces)</name>
  <files>
    apps/mobile/src/components/recipes/ScaledIngredientList.tsx,
    apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx
  </files>
  <behavior>
    - Test: with empty pantry + non-staple ingredients, every non-staple row exposes a trailing Pressable with `accessibilityLabel` matching `/Add .* to shopping list/`
    - Test: pantry containing 'chicken' suppresses the indicator on a 'chicken breast' row (bidirectional match working)
    - Test: a 'salt' ingredient row never exposes the trailing Pressable (PANTRY_STAPLES skip)
    - Test: tapping the trailing Pressable invokes a passed-in `onAddIngredient` handler with `{ name, quantity, unit }` derived from the ingredient
    - Test: when an ingredient is in the addedNames set (passed prop), its trailing icon flips to `cart.fill` (success tone) and `accessibilityLabel` becomes `/Added .* to shopping list/`
  </behavior>
  <action>
    Extend `ScaledIngredientList` to accept (per D-VISUAL + D-COVERAGE + D-TAP from CONTEXT.md):

    ```typescript
    interface ScaledIngredientListProps {
      ingredients: ParsedIngredient[];
      multiplier: number;
      // NEW — when omitted, component renders exactly as today (back-compat for any caller
      // that doesn't want the indicator). PreviewSheet will always pass these.
      pantryNames?: readonly string[];
      addedNames?: ReadonlySet<string>;       // ingredients the user just added this session
      onAddIngredient?: (ing: ParsedIngredient) => void;
    }
    ```

    Per-row rendering (only when `pantryNames` is provided):
    1. Compute `inPantry = isIngredientInPantry(ing.name, pantryNames)` for the ORIGINAL (unscaled) name. Quantity scaling does not affect identity.
    2. Compute `wasAdded = addedNames?.has(ing.name.trim().toLowerCase()) ?? false`.
    3. Render trailing icon column:
       - `inPantry === true && !wasAdded` → no icon (user already has it).
       - `inPantry === false && !wasAdded` → `cart.badge.plus` icon, tint `colors.brand`, wrapped in a Pressable with `onPress={() => onAddIngredient?.(ing)}`. accessibilityLabel: `Add ${ing.name} to shopping list`. Hit-slop 8.
       - `wasAdded === true` → `cart.fill` icon, tint `colors.success`, NOT pressable. accessibilityLabel: `Added ${ing.name} to shopping list`.
    4. Layout: trailing icon goes after the existing text (use `flexDirection: 'row'`, `alignItems: 'flex-start'`, gap with `marginLeft: 'auto'` on the icon container so the text can wrap to the bullet column without overlap). Do NOT change bullet styling. Do NOT alter the existing scaled-text computation.

    Wire `PreviewSheet` in `apps/mobile/src/app/recipes/discover.tsx` (around line 438):
    1. Inside `PreviewSheet`, add three hooks at the top:
       ```typescript
       const pantryItems = usePantryStore((s) => s.items);
       const addToShoppingList = useShoppingStore((s) => s.addItem);
       const [addedNames, setAddedNames] = useState<Set<string>>(() => new Set());
       ```
    2. Derive `pantryNames` inline (no useMemo — pattern proven in trifecta + Discover dedup):
       ```typescript
       const pantryNames = pantryItems
         .filter((p) => p.status === 'available')
         .map((p) => p.name);
       ```
       Note: Bug 3 contract per CONTEXT.md — even though `loadItems` already filters to 'available', re-filter defensively.
    3. Pass to `ScaledIngredientList`:
       ```typescript
       <ScaledIngredientList
         ingredients={recipe.ingredients}
         multiplier={multiplier}
         pantryNames={pantryNames}
         addedNames={addedNames}
         onAddIngredient={async (ing) => {
           const key = ing.name.trim().toLowerCase();
           setAddedNames((prev) => {
             const next = new Set(prev);
             next.add(key);
             return next;
           });
           try {
             await addToShoppingList({
               name: ing.name,
               quantity: ing.quantity,
               unit: ing.unit,
             });
           } catch (err) {
             // Roll back the optimistic flip so the icon returns to cart.badge.plus.
             setAddedNames((prev) => {
               const next = new Set(prev);
               next.delete(key);
               return next;
             });
             Alert.alert(
               'Could not add to shopping list',
               err instanceof Error ? err.message : 'Please try again.',
             );
           }
         }}
       />
       ```
    4. Add the React + RN imports if missing: `useState` from 'react', `Alert` from 'react-native' (already imported in this file — verify with grep before adding). Add `import { usePantryStore } from '../../stores/pantryStore';` if not present.

    Test file at `apps/mobile/src/components/recipes/__tests__/ScaledIngredientList.test.tsx` follows the static-tree-walk pattern from `StepNavButtons.test.tsx`. Use a `flatten` walker to find Pressables by `accessibilityLabel` regex match. Cover all 5 cases in <behavior>. The tests invoke `ScaledIngredientList({ ... })` as a plain function (vitest-node, no renderer).

    Pitfall guard: ScaledIngredientList currently uses `useMemo` for the scaled list — keep the call but make sure your additional per-row computations are inline (no nested hooks under a map callback — the test invokes the component as a plain function and React's useMemo should work fine in vitest-node since it just calls the factory; if it doesn't, drop the useMemo and compute scaled inline).
  </action>
  <verify>
    <automated>cd apps/mobile && npx vitest run src/components/recipes/__tests__/ScaledIngredientList.test.tsx && npx tsc -p tsconfig.json --noEmit src/components/recipes/ScaledIngredientList.tsx src/app/recipes/discover.tsx 2>&1 | head -30</automated>
  </verify>
  <done>
    ScaledIngredientList accepts the 3 new optional props; PreviewSheet passes them; missing rows expose `cart.badge.plus` Pressable; tap calls `useShoppingStore.addItem` with try/catch+Alert; success flips icon to `cart.fill` (success tone); pantry staples never show indicator; back-compat preserved (callers without the new props render exactly as today). All 5 test cases pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire missing indicator + tap-to-add into cooking IngredientRow + ScrollableRecipe</name>
  <files>
    apps/mobile/src/components/cooking/IngredientRow.tsx,
    apps/mobile/src/components/cooking/ScrollableRecipe.tsx,
    apps/mobile/src/components/cooking/__tests__/IngredientRow.test.tsx
  </files>
  <behavior>
    - Test: an IngredientRow with `inPantry=false` and `wasAdded=false` renders a trailing Pressable with `accessibilityLabel` matching `/Add .* to shopping list/`
    - Test: an IngredientRow with `inPantry=true` does NOT render the trailing Pressable
    - Test: an IngredientRow with `wasAdded=true` renders a non-pressable `cart.fill` icon with `accessibilityLabel` matching `/Added .* to shopping list/`
    - Test: tapping the trailing Pressable invokes `onAddToShoppingList` with the row's name/quantity/unit
    - Test: existing checkbox onToggle behavior still works (regression guard — do not break Phase 16-04 contract)
  </behavior>
  <action>
    Extend `IngredientRowProps` in `apps/mobile/src/components/cooking/IngredientRow.tsx`:

    ```typescript
    export interface IngredientRowProps {
      id: string;
      name: string;
      quantity?: number | null;
      unit?: string | null;
      checked: boolean;
      onToggle: (id: string) => void;
      // NEW — optional. When undefined, component renders exactly as today.
      inPantry?: boolean;
      wasAdded?: boolean;
      onAddToShoppingList?: () => void;
    }
    ```

    In the JSX (after the existing `<View className="flex-1 flex-row ml-3">…</View>`, BEFORE the closing `</Pressable>`), add a sibling trailing-icon block. CRITICAL: the trailing icon must be its OWN `<Pressable>` (NOT nested inside the outer row Pressable, since RN's nested-Pressable behavior is surprising). Restructure the row to:

    ```jsx
    <View className="flex-row items-center px-4 py-2 border-b border-border">
      <Pressable onPress={handlePress} accessibilityRole="checkbox" ... className="flex-row items-center flex-1">
        {/* existing icon + text content */}
      </Pressable>

      {/* NEW trailing block — only when the parent passes pantry-aware props */}
      {inPantry === false && !wasAdded && onAddToShoppingList ? (
        <Pressable
          onPress={onAddToShoppingList}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Add ${name} to shopping list`}
          className="ml-2"
        >
          <SymbolIcon name="cart.badge.plus" size={20} tintColor={colors.brand} />
        </Pressable>
      ) : null}

      {wasAdded ? (
        <View
          className="ml-2"
          accessibilityLabel={`Added ${name} to shopping list`}
        >
          <SymbolIcon name="cart.fill" size={20} tintColor={colors.success} />
        </View>
      ) : null}
    </View>
    ```

    The outer `<View>` wraps the existing content; the existing `<Pressable>` becomes the inner row body so the checkbox tap-target stays exactly where it is. Use Tailwind `flex-1` on the inner Pressable so the trailing icon doesn't squeeze the text.

    Wire `ScrollableRecipe` in `apps/mobile/src/components/cooking/ScrollableRecipe.tsx`:
    1. Add a `Set<string>` state for added-names + per-recipe pantry/shopping selectors:
       - The component is currently a pure render with no useState. Convert to support useState by adding `useState<Set<string>>(() => new Set())` for addedKeys.
       - Add `usePantryStore((s) => s.items)` and `useShoppingStore((s) => s.addItem)` selectors at the top of `scrollableRecipeRender`.
       - Compute `pantryNames` inline (filter status === 'available' + map name).
    2. In the existing `recipe.ingredients.map(...)` block (lines 129-142), pass the new props per row:
       ```jsx
       const key = ing.name.trim().toLowerCase();
       const inPantry = isIngredientInPantry(ing.name, pantryNames);
       const wasAdded = addedKeys.has(key);
       const onAddToShoppingList = async () => {
         setAddedKeys((prev) => {
           const next = new Set(prev);
           next.add(key);
           return next;
         });
         try {
           await addToShoppingList({ name: ing.name, quantity: ing.quantity, unit: ing.unit });
         } catch (err) {
           setAddedKeys((prev) => {
             const next = new Set(prev);
             next.delete(key);
             return next;
           });
           Alert.alert(
             'Could not add to shopping list',
             err instanceof Error ? err.message : 'Please try again.',
           );
         }
       };
       return (
         <IngredientRow
           key={id}
           id={id}
           name={ing.name}
           quantity={ing.quantity}
           unit={ing.unit}
           checked={!!checks[id]}
           onToggle={onToggle}
           inPantry={inPantry}
           wasAdded={wasAdded}
           onAddToShoppingList={onAddToShoppingList}
         />
       );
       ```
    3. Add imports: `useState` from 'react', `Alert` from 'react-native', `usePantryStore`, `useShoppingStore`, `isIngredientInPantry` from '../recipes/ingredientHelpers'.

    Test file at `apps/mobile/src/components/cooking/__tests__/IngredientRow.test.tsx` — extend the existing file (it already exists). Add a new describe block 'missing-ingredient indicator' covering the 5 cases above. Use the same `flatten`/findByLabel pattern from `StepNavButtons.test.tsx`. Match Pressables by `accessibilityLabel` regex.

    DO NOT add tests for ScrollableRecipe's wiring — the existing `ScrollableRecipe.test.tsx` covers its render shape, and adding store integration to those tests would require mocking Zustand (out of scope per "static-tree walk" pattern). The IngredientRow contract is what matters; ScrollableRecipe is just a consumer.
  </action>
  <verify>
    <automated>cd apps/mobile && npx vitest run src/components/cooking/__tests__/IngredientRow.test.tsx src/components/cooking/__tests__/ScrollableRecipe.test.tsx && npx tsc -p tsconfig.json --noEmit src/components/cooking/IngredientRow.tsx src/components/cooking/ScrollableRecipe.tsx 2>&1 | head -30</automated>
  </verify>
  <done>
    IngredientRowProps gains 3 optional props; cooking-mode rows render `cart.badge.plus` for missing non-staple ingredients and `cart.fill` after add; tap fires `onAddToShoppingList` which calls `useShoppingStore.addItem` with try/catch+Alert. Existing IngredientRow tests still pass (regression guard). ScrollableRecipe.test.tsx still passes (no contract change to its existing exports).
  </done>
</task>

</tasks>

<verification>
Phase-level checks (run after all tasks complete):

1. **Unit tests green:**
   ```
   cd apps/mobile && npx vitest run \
     src/components/recipes/__tests__/ingredientHelpers.test.ts \
     src/components/recipes/__tests__/ScaledIngredientList.test.tsx \
     src/components/cooking/__tests__/IngredientRow.test.tsx \
     src/components/cooking/__tests__/ScrollableRecipe.test.tsx
   ```
   All test files pass.

2. **Typecheck clean on changed files:**
   ```
   cd apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(ingredientHelpers|ScaledIngredientList|IngredientRow|ScrollableRecipe|recipes/discover)" || echo "no new errors"
   ```
   No new TypeScript errors introduced by these files (pre-existing errors elsewhere are out of scope).

3. **Reuse audit (must NOT have invented new pantry-match logic):**
   ```
   grep -rE "includes\(.*toLowerCase|toLowerCase.*includes" apps/mobile/src/components/recipes/ingredientHelpers.ts
   ```
   The helper should USE PANTRY_STAPLES + isIngredientInPantry pattern. No re-implementation of substring loops outside this one file.

4. **Spot-check coverage at runtime (optional human verify — orchestrator may skip):**
   - Boot simulator + dev client per CLAUDE.md UAT recipe.
   - Open Recipe Box detail on any saved recipe → confirm trailing icons appear next to non-pantry ingredients.
   - Open Discover → preview a recipe → confirm same.
   - Tap a Plan day → confirm same.
   - Open cooking mode on any recipe → confirm same.
   - Tap one missing icon → confirm icon flips to filled cart (success tone).
</verification>

<success_criteria>
Phase 1 complete when:
- [ ] `isIngredientInPantry(name, pantryNames)` is exported from `apps/mobile/src/components/recipes/ingredientHelpers.ts` and tested.
- [ ] `ScaledIngredientList` accepts optional `pantryNames`, `addedNames`, `onAddIngredient` props and renders the trailing indicator when provided.
- [ ] `PreviewSheet` (recipes/discover.tsx) passes those props and wires `useShoppingStore.addItem` with try/catch+Alert.
- [ ] `IngredientRow` (cooking) accepts optional `inPantry`, `wasAdded`, `onAddToShoppingList` props and renders the trailing indicator when provided.
- [ ] `ScrollableRecipe` derives pantryNames + per-row handlers and passes them to each `IngredientRow`.
- [ ] Pantry staples never render the indicator (verified by helper test + ScaledIngredientList test).
- [ ] Successful add flips icon `cart.badge.plus` → `cart.fill` (success tone); failed add rolls back the icon AND surfaces an Alert.
- [ ] Render-assertion test: missing rows expose a trailing Pressable matched by `accessibilityLabel /Add .* to shopping list/`.
- [ ] No new pantry-matching algorithm introduced — `PANTRY_STAPLES` reused from `pantryReady.ts`, bidirectional substring matcher mirrored from `pantryItemCardHelpers.ts`.
- [ ] Pre-existing tests in `IngredientRow.test.tsx` and `ScrollableRecipe.test.tsx` still pass (regression guard).
</success_criteria>

<output>
After completion, create `.planning/phases/01-missing-ingredient-indicators-on-recipe-ingredient-lists/01-SUMMARY.md` capturing:
- What shipped (per task, with commit SHAs)
- The exact `isIngredientInPantry` contract (so future plans know not to re-invent it)
- Coverage map: which surfaces now show the indicator, and which component each surface routes through
- Any deviations from this plan (Rule 1-4 classification)
- Outstanding follow-ups (e.g., Recipe Box card-grid coverage is explicitly deferred per CONTEXT.md > Deferred Ideas)
</output>
