---
phase: quick-3
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/components/recipes/RemixSheet.tsx
  - apps/mobile/src/components/suggestions/SomethingNewResults.tsx
  - apps/mobile/src/stores/suggestionsStore.ts
autonomous: false
requirements:
  - QUICK-3-A  # RemixSheet mode picker redesign (2x2 SF Symbol grid + title wrap + helper typography)
  - QUICK-3-B  # VariationCard polish (ingredient-seeded image, pill More actions, 2-line description clamp)
  - QUICK-3-C  # Something New image parity + Show-me-more-ideas append

must_haves:
  truths:
    - "Opening RemixSheet shows a 2x2 grid of SF Symbol mode cards (no emoji, no chevron)"
    - "Long recipe titles in the RemixSheet header wrap to 2 lines instead of ellipsizing"
    - "Variation cards in RemixSheet show a pill-shaped 'More actions' button (not plain text link)"
    - "Variation card descriptions clamp at 2 lines so cards have uniform height"
    - "Variation card hero images reflect the BASE recipe's ingredients, not just the variation title+description"
    - "Saving or cooking a Something New card persists the resolved Gemini image_url to the library"
    - "Tapping 'Show me more ideas' in Something New APPENDS additional cards below (does not replace, does not show the skeleton)"
    - "The 'Show me more ideas' button is hidden when searchResults is empty"
  artifacts:
    - path: "apps/mobile/src/components/recipes/RemixSheet.tsx"
      provides: "Redesigned mode picker (2x2 SF Symbol grid) + polished VariationCard (pill More actions, 2-line clamp, ingredient-fed image)"
      contains: "sparkles, flame.fill, leaf.fill, bolt.fill, numberOfLines={2}"
    - path: "apps/mobile/src/components/suggestions/SomethingNewResults.tsx"
      provides: "Image parity on save/cook + append-mode Show more ideas button"
      contains: "image_url: heroUri, appendSearchResults, Show me more ideas"
    - path: "apps/mobile/src/stores/suggestionsStore.ts"
      provides: "appendSearchResults action with isAppending flag (keeps isLoading off so skeleton never shows)"
      contains: "appendSearchResults, isAppending"
  key_links:
    - from: "RemixSheet VariationCard"
      to: "useGeneratedRecipeImage"
      via: "ingredients prop sourced from baseForSave.ingredients (mapped to ParsedIngredient[])"
      pattern: "ingredients:\\s*(mapped|baseIngredientsForHook|normalizedIngredients)"
    - from: "SomethingNewResults handleSave / handleCookNow"
      to: "useRecipeStore.saveRecipe"
      via: "spread with image_url: heroUri"
      pattern: "image_url:\\s*heroUri"
    - from: "SomethingNewResults 'Show me more ideas' Pressable"
      to: "suggestionsStore.appendSearchResults"
      via: "calls appendSearchResults(lastQuery, { pantryOnly }) on press"
      pattern: "appendSearchResults\\("
    - from: "suggestionsStore.appendSearchResults"
      to: "searchResults state"
      via: "concat, not replace — `[...state.searchResults, ...(data ?? [])]`"
      pattern: "\\.\\.\\.state\\.searchResults,\\s*\\.\\.\\.\\("
---

<objective>
Coordinated UX polish pass across RemixSheet and the Something New tab.

Purpose: Three pre-existing rough edges surfaced in beta testing — (1) the RemixSheet mode picker feels like a legacy list rather than a modern tile picker, (2) Something New cards look great until you save them and the pretty Gemini image is dropped on the way to the library, and (3) there's no way to ask for more ideas without nuking the existing grid. This plan fixes all three in one coherent pass while only touching 3 files.

Output: Redesigned RemixSheet mode picker (2x2 SF Symbol grid), polished VariationCard (ingredient-anchored images, pill-shaped overflow button, clamped description), and a true append-mode "Show me more ideas" affordance in Something New that does not blow away the current results.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@apps/mobile/src/components/recipes/RemixSheet.tsx
@apps/mobile/src/components/suggestions/SomethingNewResults.tsx
@apps/mobile/src/stores/suggestionsStore.ts
@apps/mobile/src/hooks/useGeneratedRecipeImage.ts
@apps/mobile/src/design/tokens.ts
@apps/mobile/src/components/ui/SymbolIcon.tsx

<interfaces>
<!-- Confirmed by Read during planning — executor should not re-explore -->

From apps/mobile/src/design/tokens.ts:
```typescript
export const colors = {
  brand: '#C65D3A',
  // ...
  success: '#16A34A',   // PRESENT — use colors.success for the veggies tint
  textPrimary: '#1C1917',
  textSecondary: '#5C4D3D',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1EAE0',
  border: '#E5D9CA',
  borderSubtle: '#F1EAE0',
  // ...
} as const;
```

From apps/mobile/src/components/ui/SymbolIcon.tsx:
```typescript
// SymbolIcon props: { name, size?: 'body'|'title'|'largeTitle'|number, weight?, tintColor?, ...rest }
// tintColor MUST be passed as a prop (NativeWind cannot color SF Symbols).
// For the 2x2 grid card chips, pass `size={26}` as a raw pixel number.
```

From apps/mobile/src/hooks/useGeneratedRecipeImage.ts:
```typescript
interface HookOptions {
  skip?: boolean;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;   // <-- typed shape expected
}
export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options: HookOptions = {},
): string | null;
```

From apps/mobile/src/types/recipe.ts:
```typescript
export interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
}
```

From apps/mobile/src/components/recipes/RemixSheet.tsx (BaseIngredient — loose, for baseForSave):
```typescript
interface BaseIngredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}
// baseForSave.ingredients is Array<string | BaseIngredient>
```

From apps/mobile/src/stores/suggestionsStore.ts (existing searchRecipes to mirror for append):
```typescript
// POST /api/v1/recipes/search with body: { query, pantryOnly }
// Response: { data: ParsedRecipe[] }
// Errors: non-OK -> set({ error, isLoading: false })
// Success: set({ searchResults, recentQueries, isLoading, error })
//
// For append: MUST NOT set isLoading (skeleton would show). Use `isAppending` flag instead.
// On error: surface via `error` but DO NOT clear searchResults.
// No-op when lastQuery is null.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: RemixSheet — 2x2 SF Symbol mode picker + title wrap + helper bump</name>
  <files>apps/mobile/src/components/recipes/RemixSheet.tsx</files>
  <action>
Three edits scoped to the RemixSheet mode-picker UI and header. Do NOT modify VariationCard in this task (that is Task 2).

1. **Update the MODES data structure** (around lines 73-85). Replace the `emoji` field with two new fields: `symbol` (SF Symbol name) and `tint` (hex/token color for the chip + symbol):
   ```typescript
   interface ModeOption {
     mode: RemixMode;
     label: string;
     sub: string;
     symbol: string;  // SF Symbol name
     tint: string;    // chip background + symbol tint color
   }

   const MODES: ModeOption[] = [
     { mode: 'surprise', label: 'Surprise me',     sub: 'A bold creative twist',       symbol: 'sparkles',  tint: colors.brand },
     { mode: 'protein',  label: 'Swap protein',    sub: 'Keep the dish, change the star', symbol: 'flame.fill', tint: colors.brand },
     { mode: 'veggies',  label: 'Swap veggies',    sub: 'Different flavor profile',    symbol: 'leaf.fill', tint: colors.success },
     { mode: 'quicker',  label: 'Make it quicker', sub: 'Shortcut the cook time',      symbol: 'bolt.fill', tint: colors.brand },
   ];
   ```
   Note: `colors.success` (#16A34A) is already defined in tokens.ts — use it directly, no #4A7A4A fallback needed.

2. **Update the mode picker render block** (currently around lines 384-408). Replace the vertical-list ScrollView with a 2x2 grid. The outer container stays a ScrollView (in case we ever add a 3rd row), but children lay out via flexWrap:
   - Keep the existing `helperText` Text, but restyle per step 4 below.
   - Each card: square-ish ~160pt tall, `colors.surface` (white) background, 16pt rounded corners, existing shadow pattern from `styles.modeCard`.
   - Card internal layout (top to bottom, centered):
     - 48pt circular chip, backgroundColor = `m.tint + '1F'` (hex-alpha ~12%) or an explicit rgba — use `${m.tint}1A` for a lightweight tinted halo. Holds a `<SymbolIcon name={m.symbol} size={26} tintColor={m.tint} weight="semibold" />`.
     - Label below chip: 16pt / weight '800' / color textPrimary.
     - Sub-caption below label: 13pt / regular / color textSecondary.
   - **Remove the chevron.forward icon entirely** from the card.
   - Two cards per row with 12pt gap between them. Use `flexDirection: 'row'`, `flexWrap: 'wrap'`, `justifyContent: 'space-between'`; each card `width: '48%'` with `marginBottom: 12`.

   Replace the JSX inside `{!selectedMode && (...)}` — it should look roughly like:
   ```tsx
   <ScrollView contentContainerStyle={styles.modesContainer}>
     <Text style={styles.helperText}>How do you want to shake it up?</Text>
     <View style={styles.modeGrid}>
       {MODES.map((m) => (
         <Pressable
           key={m.mode}
           onPress={() => handleMode(m.mode)}
           style={({ pressed }) => [
             styles.modeCard,
             pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
           ]}
         >
           <View style={[styles.modeChip, { backgroundColor: `${m.tint}1A` }]}>
             <SymbolIcon name={m.symbol as any} size={26} tintColor={m.tint} weight="semibold" />
           </View>
           <Text style={styles.modeLabel}>{m.label}</Text>
           <Text style={styles.modeSub}>{m.sub}</Text>
         </Pressable>
       ))}
     </View>
   </ScrollView>
   ```

3. **Update the results-label emoji-echo** (line ~432) which currently does `{MODES.find(...).emoji} {label}`. The MODES entries no longer have `emoji`. Drop the emoji prefix and render just the label (this is a secondary header, not the main picker — the symbol-card identity lives in the mode picker itself):
   ```tsx
   <Text style={styles.resultsLabel}>
     {MODES.find((m) => m.mode === selectedMode)?.label}
   </Text>
   ```

4. **Update the header title to wrap on two lines** (line 375). Change `numberOfLines={1}` to `numberOfLines={2}` on the `styles.title` Text. No other style changes needed — React Native will grow vertically on wrap.

5. **Update the helperText style** (currently lines ~761-765). Bump to 20pt / weight '900' / textPrimary / centered / `marginBottom: 20`:
   ```typescript
   helperText: {
     fontSize: 20,
     fontWeight: '900',
     color: colors.textPrimary,
     textAlign: 'center',
     marginBottom: 20,
   },
   ```
   Tighten the `modesContainer` top padding from 20 to 16 so the helper doesn't drift too far from the header divider.

6. **Update styles for the new grid structure.** Replace the existing `modeCard` block with the new grid-card shape, and ADD `modeGrid` and `modeChip`. DELETE the now-unused `modeEmoji` style:
   ```typescript
   modeGrid: {
     flexDirection: 'row',
     flexWrap: 'wrap',
     justifyContent: 'space-between',
   },
   modeCard: {
     width: '48%',
     minHeight: 160,
     alignItems: 'center',
     justifyContent: 'center',
     backgroundColor: colors.surface,     // '#FFFFFF'
     borderRadius: 16,
     paddingVertical: 20,
     paddingHorizontal: 12,
     marginBottom: 12,
     shadowColor: '#7A6651',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.08,
     shadowRadius: 6,
     elevation: 2,
   },
   modeChip: {
     width: 48,
     height: 48,
     borderRadius: 24,
     alignItems: 'center',
     justifyContent: 'center',
     marginBottom: 12,
   },
   modeLabel: {
     fontSize: 16,
     fontWeight: '800',
     color: colors.textPrimary,
     textAlign: 'center',
     marginBottom: 2,
   },
   modeSub: {
     fontSize: 13,
     color: colors.textSecondary,
     textAlign: 'center',
   },
   ```

Do NOT touch VariationCard, the expanded-preview nested Modal, the results container, loading/error states, or any handler logic. The only behavior change is the mode card's visual shell — `handleMode(m.mode)` still fires on press exactly as before.
  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v "^$" | head -40</automated>
    <!-- No NEW type errors introduced beyond whatever pre-existed on main. -->
  </verify>
  <done>
- MODES array has `symbol` + `tint` fields (no `emoji`), all 4 entries present.
- Mode picker JSX renders a 2x2 grid with SymbolIcon in tinted 48pt chips, no chevron icons.
- `recipeTitle` Text uses `numberOfLines={2}`.
- `helperText` style is 20pt/'900'/textPrimary/centered.
- `modesContainer` top padding is 16.
- `modeGrid` and `modeChip` styles exist; `modeEmoji` style is deleted.
- Results-label echo no longer references `.emoji`.
- `npx tsc --noEmit` from apps/mobile introduces zero new errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: RemixSheet VariationCard — ingredient-fed image + pill More actions + 2-line description</name>
  <files>apps/mobile/src/components/recipes/RemixSheet.tsx</files>
  <action>
Scoped to the `VariationCard` subcomponent (roughly lines 559-720 after Task 1) and its associated styles. Do NOT modify the mode picker (Task 1 owns that), the nested expanded-preview (RemixVariationPreview), or any handler wiring in the RemixSheet parent.

**Context:** The existing VariationCard has an explicit comment block (lines 607-610) warning NOT to pass `ingredients` to `useGeneratedRecipeImage` because RemixVariation doesn't carry ingredients. That warning is correct for `variation.ingredients` (which doesn't exist), but the base recipe IS available via the `baseForSave` prop passed down from the parent. Feeding base ingredients produces a much better visual prompt (e.g. "Spicy Shrimp Tacos" with shrimp + tortillas + cabbage anchored from the base → variation image actually looks like shrimp tacos).

1. **Plumb `baseForSave` through VariationCard.** Update the parent's `<VariationCard ... />` invocation (inside the results ScrollView, around line 436) to pass `baseIngredients={baseForSave?.ingredients}`. Type the prop loosely to match RemixSheet's local `BaseIngredient` shape:
   ```tsx
   <VariationCard
     // ... existing props
     baseIngredients={baseForSave?.ingredients}
     // ... existing props
   />
   ```

2. **Extend `VariationCardProps`** with the new optional field:
   ```typescript
   interface VariationCardProps {
     // ... existing fields
     baseIngredients?: Array<string | BaseIngredient>;
   }
   ```

3. **Normalize baseIngredients to ParsedIngredient[]** inside VariationCard before passing to the hook. Strings become `{name, quantity: null, unit: null, notes: null}`; objects get their optional-null fields filled. Add this as a top-of-body `useMemo` (import `useMemo` from 'react' — already imported? If not, add). Put it BEFORE the `useGeneratedRecipeImage` call:
   ```typescript
   const normalizedBaseIngredients = React.useMemo(() => {
     if (!baseIngredients || baseIngredients.length === 0) return null;
     return baseIngredients.map((i) =>
       typeof i === 'string'
         ? { name: i, quantity: null, unit: null, notes: null }
         : {
             name: i.name,
             quantity: i.quantity ?? null,
             unit: i.unit ?? null,
             notes: i.notes ?? null,
           },
     );
   }, [baseIngredients]);
   ```
   (React is already imported at the top of the file. If `useMemo` isn't in the named imports, add it to the existing `import React, { useEffect, useState } from 'react';` line — change to `import React, { useEffect, useMemo, useState } from 'react';` and use `useMemo` directly.)

4. **Pass ingredients into `useGeneratedRecipeImage`.** Update the existing hook call (line ~611) AND delete the stale warning comment block (lines ~607-610) that says "Do NOT pass ingredients":
   ```typescript
   const generatedUri = useGeneratedRecipeImage(variation.title, {
     description: variation.description,
     ingredients: normalizedBaseIngredients,
   });
   ```
   Replace the old NO-ingredients comment with a one-line note: `// Hero image uses base-recipe ingredients as visual anchors so Gemini renders the actual dish family (e.g. tacos for a taco remix), not just the variation's title keyword.`

5. **Clamp the variation description to 2 lines.** Add `numberOfLines={2}` to the `variationDescription` Text (around line 658):
   ```tsx
   <Text style={styles.variationDescription} numberOfLines={2}>
     {variation.description}
   </Text>
   ```

6. **Replace the "More actions" plain-text link with a pill-shaped button.** The current JSX (lines ~704-714) is:
   ```tsx
   <Pressable onPress={openOverflow} ... style={styles.moreActionsBtn}>
     <Text style={styles.moreActionsText}>More actions</Text>
   </Pressable>
   ```
   Replace with a pill layout that has `ellipsis` SymbolIcon + label:
   ```tsx
   <Pressable
     onPress={openOverflow}
     disabled={disabled || isWorking}
     style={({ pressed }) => [
       styles.moreActionsPill,
       pressed && !(disabled || isWorking) ? { opacity: 0.7 } : null,
       (disabled || isWorking) ? { opacity: 0.5 } : null,
     ]}
   >
     <SymbolIcon name="ellipsis" size={16} tintColor={colors.textSecondary} />
     <Text style={styles.moreActionsText}>More actions</Text>
   </Pressable>
   ```
   The ActionSheetIOS handler (`openOverflow`) stays exactly as-is — DO NOT touch its options list, callback indexing, or cancelButtonIndex. Only the visual shell of the button changes.

7. **Update styles.** Remove `moreActionsBtn` and replace with `moreActionsPill`. Update `moreActionsText` to pair properly with the icon:
   ```typescript
   moreActionsPill: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     gap: 6,
     height: 40,
     width: '100%',
     borderRadius: 20,
     borderWidth: 1,
     borderColor: '#F1EAE0',       // matches existing header bottom border color
     backgroundColor: 'transparent',
     marginTop: 12,
   },
   moreActionsText: {
     fontSize: 14,
     fontWeight: '700',
     color: colors.textSecondary,
   },
   ```

**Guardrails:**
- Preserve all saved/modified/working-state conditional rendering (the `saved`, `modified`, `!saved && !modified` branches around lines 660-716 stay identical in structure — only the More actions button JSX inside the third branch changes).
- DO NOT change the Cook now button, the saved/modified status rows, or any handler wiring.
- DO NOT touch RemixVariationPreview (separate component, uses a different hero image path via its own useGeneratedRecipeImage call with full.ingredients already).
  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v "^$" | head -40</automated>
  </verify>
  <done>
- VariationCardProps has optional `baseIngredients` field.
- Parent passes `baseForSave?.ingredients` to VariationCard.
- `normalizedBaseIngredients` memo converts mixed string/object ingredients into ParsedIngredient[] shape (or null).
- `useGeneratedRecipeImage` receives `ingredients: normalizedBaseIngredients`.
- `variationDescription` Text has `numberOfLines={2}`.
- "More actions" is a pill (flex-row, icon + label, 40pt tall, rounded 20pt, transparent bg, border #F1EAE0).
- `moreActionsBtn` style deleted, `moreActionsPill` style added.
- ActionSheetIOS options/callback logic untouched.
- `npx tsc --noEmit` from apps/mobile introduces zero new errors.
  </done>
</task>

<task type="auto">
  <name>Task 3: Something New — image parity + appendSearchResults action + Show-me-more-ideas button</name>
  <files>apps/mobile/src/stores/suggestionsStore.ts, apps/mobile/src/components/suggestions/SomethingNewResults.tsx</files>
  <action>
Two-file change: new store action + new UI button + two one-line save-call fixes.

**3a. suggestionsStore.ts — add `appendSearchResults`.**

i. Extend the `SuggestionsState` interface (lines 15-34). Add `isAppending: boolean` and `appendSearchResults: (query: string, options: SearchOptions) => Promise<void>`:
   ```typescript
   // Phase 17 additions (P17-02, P17-03, P17-06)
   searchResults: ParsedRecipe[];
   recentQueries: string[];
   lastQuery: string | null;
   pantryOnly: boolean;
   isAppending: boolean;                                                         // NEW
   searchRecipes: (query: string, options: SearchOptions) => Promise<void>;
   appendSearchResults: (query: string, options: SearchOptions) => Promise<void>; // NEW
   clearHistory: () => void;
   ```

ii. Initial state — add `isAppending: false` alongside the other Phase 17 initial values (after line 63 `pantryOnly: false,`):
   ```typescript
   isAppending: false,
   ```

iii. Implement `appendSearchResults` immediately AFTER `searchRecipes` (before `clearHistory`). Mirror `searchRecipes` POST shape but differ in three ways: (1) use `isAppending` not `isLoading`, (2) no-op when lastQuery is null, (3) concat result rather than replace, (4) on error keep existing searchResults:
   ```typescript
   appendSearchResults: async (query, options) => {
     // Guard: no base query to append against. /api/v1/recipes/search needs a query.
     if (!query || query.trim().length === 0) return;

     set({ isAppending: true, error: null });
     try {
       const token = await getAuthToken();
       const response = await fetch(
         `${getApiBaseUrl()}/api/v1/recipes/search`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             Authorization: `Bearer ${token}`,
           },
           body: JSON.stringify({ query, pantryOnly: options.pantryOnly }),
         }
       );

       if (!response.ok) {
         const err = await response.json().catch(() => ({}));
         // Surface the error but KEEP existing searchResults — user's current grid is preserved.
         set({
           error: err.error ?? 'Failed to load more ideas',
           isAppending: false,
         });
         return;
       }

       const { data } = await response.json();
       set((s) => ({
         searchResults: [...s.searchResults, ...((data ?? []) as ParsedRecipe[])],
         isAppending: false,
         error: null,
       }));
     } catch (err) {
       set({
         error: err instanceof Error ? err.message : 'Failed to load more ideas',
         isAppending: false,
       });
     }
   },
   ```
   NB: The server's `discoverRecipes` already passes the user's library titles as AVOID hints, and server-side generation respects that. Client-side we merge via concat; downstream rendering is keyed by `${recipe.title}-${idx}` so even if a title accidentally repeats, React won't crash — just shows twice. That's acceptable for this quick pass.

iv. `clearHistory` — also reset `isAppending` for cleanliness (add one line):
   ```typescript
   clearHistory: () => {
     set({
       recentQueries: [],
       searchResults: [],
       lastQuery: null,
       isAppending: false,
     });
   },
   ```

v. Partialize — do NOT persist `isAppending` (transient runtime flag, same reasoning as `isLoading`). The existing `partialize` already excludes everything not listed — leave it as-is (do not add `isAppending` to it).

**3b. SomethingNewResults.tsx — image parity fix (2 call sites).**

In `PreviewRecipeCard` (lines 219-327):

- `handleSave` (around line 250-263): `saveRecipe({ ...recipe, source_type: 'ai' })` → `saveRecipe({ ...recipe, image_url: heroUri, source_type: 'ai' })`.
- `handleCookNow` (around line 268-287): same change on the saveRecipe call (line ~274).

`heroUri` is already in scope (`const heroUri = recipe.image_url ?? generatedUri ?? null;`). This ensures the resolved Gemini image_url (or any recipe.image_url that was already set) persists to the library instead of being dropped on the way through saveRecipe.

**3c. SomethingNewResults.tsx — Show me more ideas button.**

i. Pull the new action + appending flag from the store. Add two `useSuggestionsStore` selectors at the top of `SomethingNewResults` (after the existing selectors, ~line 57):
   ```typescript
   const appendSearchResults = useSuggestionsStore((s) => s.appendSearchResults);
   const isAppending = useSuggestionsStore((s) => s.isAppending);
   ```

ii. Add the button inside the ScrollView, AFTER the `.map()` that renders cards and BEFORE the `</ScrollView>` close (around line 174). Hide when searchResults is empty (the outer early-return at line 89 already handles the fully-empty case, but belt-and-suspenders here makes the JSX self-describing):
   ```tsx
   {searchResults.length > 0 && (
     <Pressable
       onPress={() => {
         if (!lastQuery) return;
         void appendSearchResults(lastQuery, { pantryOnly });
       }}
       disabled={isAppending || !lastQuery}
       style={({ pressed }) => [
         styles.loadMoreBtn,
         pressed && !isAppending ? { opacity: 0.7 } : null,
         (isAppending || !lastQuery) ? { opacity: 0.5 } : null,
       ]}
       accessibilityLabel="Show me more ideas"
     >
       {isAppending ? (
         <>
           <ActivityIndicator size="small" color={colors.brand} />
           <Text style={styles.loadMoreText}>Finding more...</Text>
         </>
       ) : (
         <>
           <SymbolIcon name="plus.circle" size={18} tintColor={colors.brand} weight="semibold" />
           <Text style={styles.loadMoreText}>Show me more ideas</Text>
         </>
       )}
     </Pressable>
   )}
   ```
   Import `ActivityIndicator` from 'react-native' — check the existing top-of-file imports (line 21-30). `ActivityIndicator` is NOT currently imported there (only View, Text, Pressable, ScrollView, StyleSheet, RefreshControl, Alert) — add it to the named imports list.

iii. Add styles at the bottom of `StyleSheet.create({...})` (after `iconBtnPressed`):
   ```typescript
   loadMoreBtn: {
     flexDirection: 'row',
     alignItems: 'center',
     justifyContent: 'center',
     gap: 8,
     height: 48,
     borderRadius: 24,
     borderWidth: 1,
     borderColor: colors.border,
     backgroundColor: colors.surface,
     marginHorizontal: 20,
     marginTop: 8,
     marginBottom: 16,
   },
   loadMoreText: {
     fontSize: 15,
     fontWeight: '700',
     color: colors.brand,
   },
   ```

**Guardrails:**
- DO NOT touch `searchRecipes`, `clearSuggestions`, `fetchSuggestions`, the D-10 legacy path, or the persist/partialize config (other than verifying nothing about it changed).
- DO NOT modify the RecipeCard invocation or the nested RemixSheet invocation in PreviewRecipeCard.
- DO NOT touch the resultsToolbar refresh/clear buttons — they stay as-is.
- The LoadingMessage / SuggestionSkeleton branch must still trigger on `isLoading` only (not `isAppending`). That invariant is preserved because we never set `isLoading: true` in `appendSearchResults`.
  </action>
  <verify>
    <automated>cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v "^$" | head -40</automated>
  </verify>
  <done>
- `SuggestionsState` interface has `isAppending: boolean` and `appendSearchResults: ...` function signature.
- `isAppending: false` in initial state.
- `appendSearchResults` action implemented: guards null/empty query, POSTs to /api/v1/recipes/search, concats result on success, preserves searchResults on error, never flips `isLoading`.
- `clearHistory` resets `isAppending: false`.
- `partialize` unchanged (isAppending NOT persisted).
- `handleSave` and `handleCookNow` in SomethingNewResults both spread `image_url: heroUri` into the saveRecipe payload.
- "Show me more ideas" Pressable rendered after the .map() inside the ScrollView, shows ActivityIndicator + "Finding more..." while isAppending, calls appendSearchResults(lastQuery, {pantryOnly}) on press.
- Button is hidden when searchResults.length === 0 (via the guard condition — the outer early-return at the top of the component also still fires).
- `ActivityIndicator` added to react-native imports.
- `loadMoreBtn` + `loadMoreText` styles added to StyleSheet.
- `npx tsc --noEmit` from apps/mobile introduces zero new errors.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: UAT — iOS simulator screenshots for all three surfaces</name>
  <files>.planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/remix-mode-picker.png, .planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/remix-variation-card.png, .planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/something-new-append.png</files>
  <what-built>
Three UI changes across Remix and Something New:
- RemixSheet mode picker: 2x2 SF Symbol grid (sparkles/flame/leaf/bolt), title wraps on long recipes, bigger centered helper prompt.
- RemixSheet variation cards: ingredient-anchored Gemini hero, 2-line clamped description, pill-shaped "More actions" button.
- Something New: save/cook persists the Gemini image_url; "Show me more ideas" appends additional cards without triggering the skeleton.
  </what-built>
  <action>Boot the iOS simulator per the "how-to-verify" block below, drive the three flows manually (or via ad-hoc Maestro), capture the three screenshots, and stash them under `.planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/`. Do not modify any source files in this task — code work is already done in Tasks 1-3. This task exists solely to gate completion on visual parity.</action>
  <how-to-verify>
Per CLAUDE.md UAT section. Executor should run these commands and capture screenshots:

```bash
# Terminal 1 — backend
cd /Users/patrickrichards/DinnerTime && set -a && source .env && set +a && cd packages/server && pnpm dev

# Terminal 2 — metro
cd /Users/patrickrichards/DinnerTime/apps/mobile && npx expo start --dev-client --lan --clear

# Terminal 3 — simulator (only if not already running)
xcrun simctl boot "iPhone 17 Pro" || true
open -a Simulator
xcrun simctl install booted /Users/patrickrichards/DinnerTime/apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app

# Optionally run existing smoke flow first to validate hydration
cd /Users/patrickrichards/DinnerTime/apps/mobile && maestro test .maestro/smoke.yaml
```

Then manually drive the three flows (or write a short maestro flow) and save screenshots to `.planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/`:

1. **remix-mode-picker.png** — Open any saved recipe with a long-ish title, tap "Remix". Expect:
   - 2x2 grid of cards (Surprise me / Swap protein / Swap veggies / Make it quicker)
   - Each card has a tinted circular chip with an SF Symbol (NOT an emoji)
   - Leaf icon for "Swap veggies" is green (colors.success #16A34A)
   - Other three icons are brand orange (#C65D3A)
   - No chevron icons on cards
   - Long recipe title in header wraps to 2 lines
   - Helper text "How do you want to shake it up?" is large, bold, centered above the grid

2. **remix-variation-card.png** — Tap any mode; wait for variations to load. Expect:
   - Hero image visually relates to the BASE recipe's ingredients (not just the variation title)
   - Variation description is clamped to 2 lines (cards same height)
   - "More actions" is a pill-shaped button with an ellipsis icon + label (NOT a plain text link)
   - Tapping "More actions" still opens ActionSheetIOS with Expand/Save/Modify/Cancel

3. **something-new-append.png** — Go to Kitchen → Something New tab. Search for something that returns results (e.g. "quick chicken dinners"). Verify initial results render. Scroll to bottom, tap "Show me more ideas". Expect:
   - Inline ActivityIndicator + "Finding more..." appears on the button (NOT a full-screen skeleton)
   - Existing cards stay on screen throughout
   - After ~2-5s, new cards APPEND below (final count is original + N, not N)
   - Save or Cook Now on one of the new cards should — on return to the Recipes tab — show the AI-generated Gemini image, not the stock fallback

Also verify the negative case: with no searchResults, "Show me more ideas" should NOT be visible (the outer empty-state already covers this).
  </how-to-verify>
  <verify>
    <automated>MISSING — checkpoint task; human verification via screenshots stored under .planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/</automated>
  </verify>
  <done>Three screenshots captured (remix-mode-picker.png, remix-variation-card.png, something-new-append.png) showing: (a) 2x2 SF Symbol mode grid with green leaf icon, (b) variation card with pill More actions + 2-line description + ingredient-accurate hero, (c) Something New with appended cards (NOT full-screen skeleton) after tapping Show me more ideas. User types "approved".</done>
  <resume-signal>Type "approved" (plus save the three screenshots) or describe any deviation.</resume-signal>
</task>

</tasks>

<verification>
After all tasks:

```bash
cd /Users/patrickrichards/DinnerTime/apps/mobile && npx tsc --noEmit 2>&1 | tail -20
```
Expect: zero new errors beyond anything pre-existing on main.

Visual parity check (human):
- Mode picker visually reads as a 2x2 tile picker, not a vertical list.
- Variation card description always clamps to 2 lines regardless of server output length.
- Something New append flow never shows SuggestionSkeleton.

No server, RecipeCard, PreviewSheet, RemixVariationPreview, progressionStore, or design-token changes. Only the three files in `files_modified`.
</verification>

<success_criteria>
- `apps/mobile/src/components/recipes/RemixSheet.tsx` modified: 2x2 SF Symbol mode grid, 2-line title header, bumped helper text, VariationCard passes normalized base ingredients to useGeneratedRecipeImage, 2-line description clamp, pill More actions button.
- `apps/mobile/src/components/suggestions/SomethingNewResults.tsx` modified: save/cook spread image_url: heroUri, "Show me more ideas" pill with isAppending state handling.
- `apps/mobile/src/stores/suggestionsStore.ts` modified: isAppending flag + appendSearchResults action added; searchRecipes / legacy path untouched.
- `npx tsc --noEmit` from apps/mobile introduces no new errors.
- Three UAT screenshots captured and saved under `.planning/quick/3-remixsheet-mode-picker-redesign-variatio/screenshots/`.
- Human checkpoint approved.
</success_criteria>

<output>
After completion, create `.planning/quick/3-remixsheet-mode-picker-redesign-variatio/3-SUMMARY.md` documenting:
- The three changes shipped (one paragraph each)
- Any surprises encountered (e.g. ingredient mapping edge cases, Metro cache required a --clear, server AVOID logic double-confirmed)
- Screenshots captured + where they live
- Any follow-ups surfaced but deliberately deferred (e.g. hex-to-token refactor, RecipeCard polish)
</output>
