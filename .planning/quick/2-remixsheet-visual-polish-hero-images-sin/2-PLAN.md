---
phase: quick-2-remixsheet-visual-polish
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/components/recipes/RemixSheet.tsx
autonomous: false
requirements:
  - REMIX-VIS-01  # Hero images on every variation card (non-blocking render)
  - REMIX-VIS-02  # Single primary Cook-now CTA + overflow ActionSheet for secondary actions

must_haves:
  truths:
    - "Each variation card renders a hero image area at the top (rounded top corners) before any text."
    - "While Gemini is generating, the hero area shows a keyword-matched Unsplash fallback — NOT a blank box or spinner placeholder."
    - "When Gemini returns a URL, the card swaps to the generated image without remounting the card or flashing."
    - "If Gemini returns null (failure), the keyword fallback stays visible — no broken image icon, no empty box."
    - "The action area has exactly ONE visually dominant button: a full-width flame-orange 'Cook now' CTA (48–52pt tall, 16pt/800 label, inline flame icon)."
    - "A 'More actions' trigger sits directly beneath the Cook-now button and, when tapped, opens the iOS native ActionSheet."
    - "The ActionSheet lists options in this exact order: 'Expand preview', 'Save as new recipe', 'Modify existing' (saved source only), 'Cancel' (always last). cancelButtonIndex is the last index."
    - "Picking an ActionSheet option dispatches to the existing handleExpand / handleSaveAsNew / handleModifyExisting handlers — behavior is unchanged."
    - "The existing saved-row / modified-row short-circuits still work: after save, the 'Saved to library' row replaces the action area; after modify, the 'Existing recipe updated' row replaces it."
    - "The [i + 1] number badge remains visible in each card header."
    - "The Cook now button shows an ActivityIndicator spinner while `workingIdx === i && workingAction === 'cook'`; the More-actions trigger is disabled during any in-flight action on this card."
  artifacts:
    - path: "apps/mobile/src/components/recipes/RemixSheet.tsx"
      provides: "RemixSheet with VariationCard subcomponent (hero image + primary CTA + ActionSheet overflow)"
      contains: "function VariationCard"
      contains_also: "ActionSheetIOS"
      contains_also_2: "from 'expo-image'"
  key_links:
    - from: "VariationCard"
      to: "useGeneratedRecipeImage"
      via: "hook call at top level of VariationCard, title + description only (NO ingredients — RemixVariation has no ingredients field)"
      pattern: "useGeneratedRecipeImage\\(\\s*v\\.title"
    - from: "VariationCard"
      to: "getRecipeImage"
      via: "keyword fallback resolution — called with (seed, generatedUri, v.title) so while generatedUri is null the category fallback wins, and when it resolves it takes priority"
      pattern: "getRecipeImage\\("
    - from: "VariationCard Cook-now button"
      to: "handleCookNow(i, v)"
      via: "onPress dispatch, unchanged handler signature"
      pattern: "handleCookNow\\(\\s*i\\s*,\\s*v\\s*\\)"
    - from: "More actions Pressable"
      to: "ActionSheetIOS.showActionSheetWithOptions"
      via: "showActionSheetWithOptions callback → switch on buttonIndex → calls handleExpand / handleSaveAsNew / handleModifyExisting"
      pattern: "ActionSheetIOS\\.showActionSheetWithOptions"
---

<objective>
RemixSheet variation cards are currently text-only with four equal-weight action buttons, which (a) makes the 3 variations visually indistinguishable at a glance and (b) buries "Cook now" — the intended primary action — in a sea of peers. This plan delivers two coordinated visual changes to ONE component: add hero images atop each variation card (keyword fallback → Gemini swap, non-blocking), and collapse the action row to a single dominant Cook-now CTA with an iOS-native ActionSheet overflow for Expand / Save / Modify.

Purpose: Elevate "Cook now" as the obvious primary action, give each variation a visual identity, and reduce choice friction in the remix flow.

Output: Modified `apps/mobile/src/components/recipes/RemixSheet.tsx`. No other files touched. No new deps (expo-image and ActionSheetIOS already available).
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@apps/mobile/src/components/recipes/RemixSheet.tsx
@apps/mobile/src/hooks/useGeneratedRecipeImage.ts
@apps/mobile/src/constants/foodImages.ts
@apps/mobile/src/stores/progressionStore.ts
@apps/mobile/src/design/tokens.ts

<interfaces>
<!-- CRITICAL CONTRACTS — extracted verbatim from the codebase. -->
<!-- Do not guess. Do not pass fields that do not exist on the types below. -->

From apps/mobile/src/stores/progressionStore.ts:
```typescript
// RemixVariation is ONLY {title, description} — it does NOT carry ingredients.
// The planning-context hint that suggested `variation.ingredients` was wrong
// for THIS type (RemixVariationPreview uses `full: ParsedRecipe`, which does
// carry ingredients — different shape, different call site). In VariationCard,
// pass `undefined` for ingredients (or omit the key entirely).
export interface RemixVariation {
  title: string;
  description: string;
}
```

From apps/mobile/src/hooks/useGeneratedRecipeImage.ts:
```typescript
interface HookOptions {
  skip?: boolean;
  description?: string | null;
  ingredients?: ParsedIngredient[] | null;  // optional — omit for RemixVariation
}
export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options?: HookOptions,
): string | null;
// Returns null while loading and on failure. Never throws. Safe to chain.
// Deduplicates across cards with same title+ingredient fingerprint in-session.
```

From apps/mobile/src/constants/foodImages.ts:
```typescript
// Priority: imageUrl > title keyword match > recipeId hash fallback.
// When imageUrl is null/undefined, title-based category picking wins.
export function getRecipeImage(
  recipeId: string,
  imageUrl?: string | null,
  title?: string | null,
): string;  // always returns a URL (never null)
```

From react-native (built-in, already resolved in this project):
```typescript
import { ActionSheetIOS } from 'react-native';
// ActionSheetIOS.showActionSheetWithOptions(
//   { options: string[]; cancelButtonIndex?: number; destructiveButtonIndex?: number; title?: string },
//   (buttonIndex: number) => void,
// );
```

From expo-image (already in Expo SDK 55 stack per CLAUDE.md):
```typescript
import { Image } from 'expo-image';
// <Image source={{ uri }} style={{...}} contentFit="cover" transition={200} />
// Supports caching and smooth crossfade via `transition`.
```

Existing styles already in the file (REUSE, don't duplicate):
- `styles.actionBtnCook` — backgroundColor: '#B85C2E'  (flame accent)
- `styles.variationCard` — white card with shadow + 16px radius
- `styles.variationNum` / `styles.variationNumText` — the [i+1] number badge
- `styles.variationTitle` / `styles.variationDescription` — keep as-is
- `styles.savedRow` / `styles.modifiedRow` / `styles.statusRow` — keep as-is
- `styles.actionBtn` / `styles.actionBtnPrimary` / `styles.actionBtnOutline` — will be mostly superseded; leave in place in case of diff minimization (OK to remove `actionBtnPrimary`/`actionBtnOutline` if unused after refactor).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extract VariationCard + add hero image (react hook at component top-level)</name>
  <files>apps/mobile/src/components/recipes/RemixSheet.tsx</files>
  <behavior>
    Pull the existing `variations.map((v, i) => { ... })` render body (currently at ~lines 433–574) into a new component `VariationCard` declared in the SAME file (below RemixSheet, alongside RemixVariationPreview).

    VariationCard props (derived from parent closures):
      - `variation: RemixVariation`
      - `index: number`           // for the [i+1] badge + seed
      - `saved: boolean`
      - `modified: boolean`
      - `isWorking: boolean`      // workingIdx === i
      - `isExpanding: boolean`
      - `isSaving: boolean`
      - `isModifying: boolean`
      - `isCooking: boolean`
      - `disabled: boolean`       // workingIdx !== null && workingIdx !== i
      - `canModifyExisting: boolean`  // source.kind === 'saved'
      - `onExpand: () => void`
      - `onCook: () => void`
      - `onSaveAsNew: () => void`
      - `onModifyExisting: () => void`
      - `onOpenSaved: () => void`
      - `onOpenModified: () => void`

    Inside VariationCard, at component top-level:
      1. Call `const generatedUri = useGeneratedRecipeImage(variation.title, { description: variation.description });`
         DO NOT pass `ingredients` — RemixVariation has no such field. TypeScript will error if you try `variation.ingredients`.
      2. Compute `const heroUri = getRecipeImage(\`remix-card-${index}-${variation.title}\`, generatedUri, variation.title);`
         Because generatedUri starts null, the first render picks a keyword-matched Unsplash image (soup/pasta/chicken/etc.). When the hook resolves, heroUri flips to the Gemini URL — expo-image crossfades.

    Render structure of the card:
      <View style={styles.variationCard} /* existing — DO NOT add padding conflict */>
        <Image
          source={{ uri: heroUri }}
          style={styles.variationHero}      // NEW style — see below
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <View style={styles.variationBody}>  {/* NEW wrapper for padding, because card's padding:16 was around the old text — now the image goes edge-to-edge */}
          <View style={styles.variationHeader}>
            <View style={styles.variationNum}>
              <Text style={styles.variationNumText}>{index + 1}</Text>
            </View>
            <Text style={styles.variationTitle}>{variation.title}</Text>
          </View>
          <Text style={styles.variationDescription}>{variation.description}</Text>
          {/* saved-row / modified-row / action area — unchanged branching from Task 2 */}
        </View>
      </View>

    Styles to add (append to the existing StyleSheet.create block):
      variationCard — REMOVE the existing `padding: 16` from this style (pad the body instead). Keep radius/shadow. Add `overflow: 'hidden'` so the image clips to the 16px radius on the top corners.
      variationHero: { width: '100%', height: 170, backgroundColor: '#F1EAE0' }  // 170 sits in the 160–180 window
      variationBody: { padding: 16 }
      (The 16px radius on the card naturally rounds the image's top corners because of overflow:hidden.)

    Wire in the parent:
      Replace the `{variations.map((v, i) => { ... })}` block with:
        {variations.map((v, i) => (
          <VariationCard
            key={i}
            variation={v}
            index={i}
            saved={savedIdxs.has(i)}
            modified={modifiedIdxs.has(i)}
            isWorking={workingIdx === i}
            isExpanding={workingIdx === i && workingAction === 'expand'}
            isSaving={workingIdx === i && workingAction === 'save'}
            isModifying={workingIdx === i && workingAction === 'modify'}
            isCooking={workingIdx === i && workingAction === 'cook'}
            disabled={workingIdx !== null && workingIdx !== i}
            canModifyExisting={source.kind === 'saved'}
            onExpand={() => handleExpand(i, v)}
            onCook={() => handleCookNow(i, v)}
            onSaveAsNew={() => handleSaveAsNew(i, v)}
            onModifyExisting={() => handleModifyExisting(i, v)}
            onOpenSaved={handleOpenSaved}
            onOpenModified={handleOpenModified}
          />
        ))}

    Imports to add at the top of the file:
      - `import { Image } from 'expo-image';`  (NEW — expo-image is the project's canonical cached image component per CLAUDE.md)
      - Add `ActionSheetIOS` to the existing `react-native` import list (used in Task 2).

    Why hooks-at-top-level matters: the current map-inside-render pattern can't call `useGeneratedRecipeImage` because React hooks rules forbid hook calls in loops / conditionally-rendered callbacks. Extracting to VariationCard is what makes the image feature legal.

    Parallelism note: three cards mount simultaneously → three parallel Gemini fetches. `useGeneratedRecipeImage` dedupes by title+ingredient-fingerprint in a module-level cache, so duplicate titles across cards share one fetch. No additional concurrency guard needed.

    For this task: implement ONLY the extraction + hero image. The action area INSIDE VariationCard for now should be the EXISTING four-button row (copied verbatim from the current code) so the card compiles and behaves identically after refactor. Task 2 replaces the action row.
  </behavior>
  <action>
    1. Open `apps/mobile/src/components/recipes/RemixSheet.tsx`.
    2. Add imports: `ActionSheetIOS` to the react-native import, and a new `import { Image } from 'expo-image';`.
    3. Remove `padding: 16` from `styles.variationCard`; add `overflow: 'hidden'` to it. Append two new styles: `variationHero` (height 170, backgroundColor '#F1EAE0') and `variationBody` (padding 16).
    4. Create a new function component `VariationCard({...})` below `RemixVariationPreview`. Signature per <behavior>. Inside, call `useGeneratedRecipeImage(variation.title, { description: variation.description })` — NO ingredients argument. Compute heroUri via `getRecipeImage(seed, generatedUri, variation.title)` where seed is `` `remix-card-${index}-${variation.title}` ``.
    5. Render: `<View style={styles.variationCard}>` wrapping `<Image />` hero + `<View style={styles.variationBody}>` with header/description/action-area inside. Copy the existing saved-row, modified-row, and 4-button actionRow verbatim from lines ~452–570 into the body wrapper. All handler callbacks come from props (onExpand, onCook, onSaveAsNew, onModifyExisting, onOpenSaved, onOpenModified).
    6. In the parent, replace the `{variations.map((v, i) => { return (<View...>) })}` block (lines ~433–574) with the `<VariationCard .../>` render shown in <behavior>.
    7. Typecheck: `cd apps/mobile && npx tsc --noEmit`. There must be zero new errors from this file.
    8. Do NOT touch `RemixVariationPreview`. Do NOT touch styles unrelated to variationCard/Hero/Body.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && npx tsc --noEmit 2>&1 | grep -E "RemixSheet\\.tsx" || echo "TYPECHECK CLEAN for RemixSheet.tsx"</automated>
  </verify>
  <done>
    - File compiles with zero new TS errors.
    - VariationCard is a top-level declared component in the same file.
    - `useGeneratedRecipeImage` is called at VariationCard top-level with (title, {description}) — no `ingredients` access on RemixVariation anywhere.
    - `import { Image } from 'expo-image'` present.
    - `ActionSheetIOS` is in the react-native import list (used by Task 2).
    - Card renders hero image area (170pt) with rounded top corners.
    - Header badge [i+1], title, description, saved-row, modified-row, and the existing 4-button action row all still function (action row untouched in this task).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Collapse action row to single Cook-now CTA + ActionSheet overflow</name>
  <files>apps/mobile/src/components/recipes/RemixSheet.tsx</files>
  <behavior>
    Inside `VariationCard` (created in Task 1), replace the 4-button `actionRow` with:

    A) Full-width "Cook now" primary button:
       - Uses existing `styles.actionBtnCook` backgroundColor ('#B85C2E').
       - Full card-body width (width: '100%').
       - Height 50 (within 48–52pt window).
       - Label "Cook now" at 16pt / fontWeight '800'.
       - Inline `<SymbolIcon name="flame.fill" size={16} tintColor="#FFFFFF" />` to the left of the label, 8pt gap.
       - Shows `<ActivityIndicator size="small" color="#FFFFFF" />` when `isCooking`.
       - `onPress={onCook}`, `disabled={disabled || isWorking}`.
       - Pressable opacity 0.85 when pressed.

    B) "More actions" trigger directly below Cook-now, 12pt top margin:
       - A centered text Pressable: "More actions" label, 14pt, fontWeight '700', color '#7A6651' (muted).
       - `disabled={disabled || isWorking}` (dim to 0.5 opacity when disabled).
       - onPress opens the ActionSheet.

    C) ActionSheet wiring — a handler `openOverflow` declared inside VariationCard:
       ```
       const openOverflow = () => {
         const options: string[] = ['Expand preview', 'Save as new recipe'];
         if (canModifyExisting) options.push('Modify existing');
         options.push('Cancel');
         const cancelButtonIndex = options.length - 1;
         ActionSheetIOS.showActionSheetWithOptions(
           { options, cancelButtonIndex },
           (buttonIndex) => {
             if (buttonIndex === 0) onExpand();
             else if (buttonIndex === 1) onSaveAsNew();
             else if (canModifyExisting && buttonIndex === 2) onModifyExisting();
             // cancel index → no-op
           },
         );
       };
       ```
       NO `destructiveButtonIndex` is set. Options order matches the cancel-last invariant.

    D) Short-circuit preservation:
       - If `saved === true`, render the existing saved-row Pressable (onPress → onOpenSaved) and RETURN before the action area. The Cook-now button MUST NOT render in the saved state.
       - If `modified === true`, render the existing modified-row Pressable (onPress → onOpenModified) and RETURN before the action area.
       - Only when `!saved && !modified` do the Cook-now button + More-actions trigger render.

    E) Style additions (append to StyleSheet.create):
       - `actionBtnCookFull`: { backgroundColor: '#B85C2E', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, width: '100%' }
       - `actionBtnCookFullText`: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' }
       - `moreActionsBtn`: { alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginTop: 12 }
       - `moreActionsText`: { fontSize: 14, fontWeight: '700', color: '#7A6651' }
       (Reusing the existing `styles.actionBtnCook` color value via the new full-bleed style is fine; the old `styles.actionBtn`, `styles.actionBtnPrimary`, `styles.actionBtnOutline`, `styles.actionBtnPrimaryText`, `styles.actionBtnOutlineText` can be left in place or removed. Prefer removal ONLY if they have zero remaining references after Task 1 + Task 2 — search the file to confirm.)

    F) The old `actionRow` style with `flexWrap` and `flexBasis: '30%'` is no longer used by VariationCard; remove it unless referenced elsewhere (search the file — if no other reference, delete it).

    TypeScript: confirm `ActionSheetIOS` is imported from 'react-native' (added in Task 1). Confirm `buttonIndex` is typed as number in the callback.

    DO NOT touch `RemixVariationPreview` or `PreviewSheet`. DO NOT change `handleCookNow`, `handleExpand`, `handleSaveAsNew`, `handleModifyExisting`, or any parent state logic.
  </behavior>
  <action>
    1. In `VariationCard`, delete the existing 4-button `actionRow` block (the View containing the four Pressables).
    2. Replace with: the full-width Cook-now Pressable + the More-actions Pressable + the `openOverflow` handler defined above.
    3. Add the 4 new styles (actionBtnCookFull, actionBtnCookFullText, moreActionsBtn, moreActionsText) to the StyleSheet.create block.
    4. Search the file for remaining references to the now-unused styles (actionBtn, actionBtnPrimary, actionBtnPrimaryText, actionBtnOutline, actionBtnOutlineText, actionRow). Remove any style entry that has zero remaining references. Keep `actionBtnCook` only if still referenced — after this task the new full-bleed style replaces it, so remove it if unreferenced.
    5. Typecheck: `cd apps/mobile && npx tsc --noEmit`. Zero new errors.
    6. Run the existing mobile lint if configured (`pnpm --filter mobile lint` OR `cd apps/mobile && npx biome check src/components/recipes/RemixSheet.tsx`). Zero new errors/warnings introduced by this file.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && npx tsc --noEmit 2>&1 | grep -E "RemixSheet\\.tsx" || echo "TYPECHECK CLEAN"; npx biome check src/components/recipes/RemixSheet.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>
    - VariationCard renders: hero image (170pt) → header with [i+1] badge + title → description → (saved-row OR modified-row OR [Cook-now + More-actions]).
    - Cook now button is the single most prominent action: full-width, 50pt, '#B85C2E', 16pt/800 label, flame icon inline.
    - More actions Pressable opens ActionSheetIOS with options in order [Expand preview, Save as new recipe, (Modify existing if saved source), Cancel].
    - cancelButtonIndex is the last index. No destructiveButtonIndex set.
    - ActionSheet dispatches to unchanged handleExpand / handleSaveAsNew / handleModifyExisting through props.
    - Saved-row and modified-row short-circuits still function (they render instead of the action area).
    - Typecheck clean. Biome clean (or no new violations vs baseline) for this file.
    - Unused old action-row styles removed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    RemixSheet variation cards with hero images and collapsed action area (Cook-now primary CTA + iOS ActionSheet overflow).
  </what-built>
  <how-to-verify>
    ## Simulator UAT (required)

    1. Boot the iOS sim and install the prebuilt dev client:
       ```
       cd /Users/patrickrichards/DinnerTime/apps/mobile
       xcrun simctl boot "iPhone 17 Pro" || true
       open -a Simulator
       xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
       ```
    2. Start the backend + Metro (in two terminals):
       ```
       cd /Users/patrickrichards/DinnerTime && set -a && source .env && set +a && cd packages/server && pnpm dev
       ```
       ```
       cd /Users/patrickrichards/DinnerTime/apps/mobile && npx expo start --dev-client --lan --clear
       ```
    3. Launch the app in the simulator (dev client auto-connects to Metro on localhost).
    4. Log in, navigate to a saved recipe (or a Discover/Home suggestion), open the Remix sheet.
    5. Pick "Surprise me". Wait for the 3 variations to render.
    6. Capture a screenshot of the variation list:
       ```
       xcrun simctl io booted screenshot /tmp/remix-hero-cards.png
       open /tmp/remix-hero-cards.png
       ```

    ## Pass criteria (all must hold)

    - [ ] Each of the 3 variation cards shows a hero image at the top, ~170pt tall, corners rounded to match the card.
    - [ ] On first render, images appear as keyword-matched Unsplash fallbacks (soup/pasta/chicken/etc. based on the variation title) — NOT blank placeholders.
    - [ ] Within a few seconds (once Gemini returns), the images swap in smoothly (no card remount / no jarring flash — expo-image `transition={200}` handles the crossfade). On Gemini failure, the fallback simply stays.
    - [ ] The [1] / [2] / [3] number badges are still visible in the card header.
    - [ ] Each card has exactly ONE big orange/red button labeled "Cook now" with a flame icon, full card width, ~50pt tall, clearly the dominant action.
    - [ ] Below Cook-now is a muted-text "More actions" trigger.
    - [ ] Tap "More actions" → iOS ActionSheet slides up from bottom with options in order:
      1. "Expand preview"
      2. "Save as new recipe"
      3. "Modify existing" (ONLY if you opened from a saved recipe, not from a Home/Discover suggestion)
      4. "Cancel"
    - [ ] Tapping "Expand preview" opens the existing PreviewSheet (same behavior as before).
    - [ ] Tapping "Save as new recipe" → card flips to the green "Saved to library" row.
    - [ ] Tapping "Modify existing" (saved-source only) → card flips to the blue "Existing recipe updated" row.
    - [ ] Tapping "Cook now" → spinner appears on the Cook-now button, then the sheet closes and the app navigates to the cooking flow for the correct recipe.
    - [ ] During any in-flight action, the other two variation cards' buttons are dimmed (disabled).

    ## If anything fails

    - Hero image blank → inspect Metro logs; confirm `useGeneratedRecipeImage` is being called (add a `console.log` if needed) and that `getRecipeImage(..., null, v.title)` is returning an Unsplash URL on first render.
    - TS error about `variation.ingredients` → this means the executor ignored the interface contract. Delete that access; `RemixVariation` has no ingredients field.
    - ActionSheet doesn't appear → confirm `ActionSheetIOS` is imported from 'react-native' and you're on iOS (ActionSheetIOS is iOS-only — acceptable since the app is iOS-first per CLAUDE.md).
    - Card clips the image into a square instead of a rounded rectangle → confirm `overflow: 'hidden'` was added to `variationCard` and `padding: 16` was removed from it (padding now on `variationBody`).

    Reply "approved" once the screenshot shows all pass criteria, or describe the specific issue.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cd apps/mobile && npx tsc --noEmit` — zero new errors introduced in RemixSheet.tsx.
- `cd apps/mobile && npx biome check src/components/recipes/RemixSheet.tsx` — zero new violations vs baseline.
- Simulator screenshot (saved to `/tmp/remix-hero-cards.png`) shows: hero images, single dominant Cook-now CTA, More-actions trigger. ActionSheet opens with the documented option order on tap.
- Existing smoke.yaml still passes (no regressions in unrelated flows): `apps/mobile/.maestro/scripts/uat.sh smoke` if practical. NOT a blocker — the Maestro suite doesn't cover RemixSheet today.
</verification>

<success_criteria>
- All pass criteria in the Task 3 checkpoint hold.
- No other files modified (confirm via `git diff --stat` — expect ONLY `apps/mobile/src/components/recipes/RemixSheet.tsx`).
- No new dependencies added to any package.json.
- `handleExpand`, `handleSaveAsNew`, `handleModifyExisting`, `handleCookNow` signatures unchanged.
- `RemixVariationPreview`, `PreviewSheet`, `recipeImageGen.ts`, design tokens — all untouched.
- `git diff apps/mobile/src/components/recipes/RemixSheet.tsx` shows: new import (expo-image Image, ActionSheetIOS added to RN import), new `VariationCard` component below `RemixVariationPreview`, parent map simplified to `<VariationCard .../>`, new styles (variationHero, variationBody, actionBtnCookFull, actionBtnCookFullText, moreActionsBtn, moreActionsText), removal of `padding: 16` from `variationCard` + addition of `overflow: 'hidden'`, removal of now-unused action-row styles.
</success_criteria>

<output>
After completion, create `.planning/quick/2-remixsheet-visual-polish-hero-images-sin/2-SUMMARY.md` documenting:
- Final line count of RemixSheet.tsx (starting point: 884).
- Whether any auxiliary styles were removed (actionBtn / actionBtnPrimary / actionBtnOutline / actionRow) — list them.
- Path to the sim screenshot attached to the checkpoint.
- Any deviations from the plan (there should be none — if there are, justify).
</output>
