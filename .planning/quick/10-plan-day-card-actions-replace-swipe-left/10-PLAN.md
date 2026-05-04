---
phase: 10-plan-day-card-actions-replace-swipe-left
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/components/plan/HeroDayCard.tsx
  - apps/mobile/src/components/plan/HeroDayCard.test.ts
  - apps/mobile/src/app/(tabs)/plan.tsx
autonomous: true
requirements:
  - QUICK-10-01  # Replace HeroDayCard swipe-left with floating overlay icon cluster (Swap / Cook Now / Remix / Cooked / Clear)
  - QUICK-10-02  # Wire onCookNow + onRemix from plan.tsx (Cook Now → router.push to /cook; Remix → new modal mounting RemixSheet directly)
  - QUICK-10-03  # Update HeroDayCard.test.ts: drop swipe-related assertions, add cluster Pressable assertions

must_haves:
  truths:
    - "HeroDayCard renders 5 tappable icons (Swap, Cook Now, Remix, Cooked, Clear) in a dark-capsule cluster on the bottom-right of the hero image"
    - "Tapping any cluster icon fires its handler WITHOUT triggering the card's onPress (preview/detail navigation)"
    - "Tapping Cook Now navigates to /recipes/{recipe_id}/cook when entry.recipe_id is set; the icon is visually disabled (opacity 0.4) when recipe_id is null"
    - "Tapping Remix opens RemixSheet directly (NOT through PlanEntryPreview), with the day's entry as inline source and onApplyToDay wired to applySwap on the day"
    - "HeroDayCard no longer wraps with ReanimatedSwipeable; swipe-left is removed from the detailed (hero) view"
    - "SwipeableDayRow (compact mode) keeps its swipe-left actions and renderRightActionsFor export — unchanged"
  artifacts:
    - path: "apps/mobile/src/components/plan/HeroDayCard.tsx"
      provides: "Detailed-mode hero card with floating icon cluster (Swap/CookNow/Remix/Cooked/Clear) replacing ReanimatedSwipeable"
      contains: "heroIconCluster"
    - path: "apps/mobile/src/app/(tabs)/plan.tsx"
      provides: "HeroDayCard call site wires onCookNow + onRemix; new remixEntry state + RemixSheet modal mount"
      contains: "remixEntry"
    - path: "apps/mobile/src/components/plan/HeroDayCard.test.ts"
      provides: "Tests covering cluster Pressables — swipe-related assertions removed"
      contains: "cluster"
  key_links:
    - from: "HeroDayCard.tsx cluster Pressables"
      to: "parent handlers (onSwap/onCook/onSkip/onCookNow/onRemix)"
      via: "stopPropagation + handler dispatch on each Pressable"
      pattern: "e\\.stopPropagation\\(\\)"
    - from: "plan.tsx onRemix"
      to: "RemixSheet"
      via: "remixEntry state + Modal mounting RemixSheet with kind:'inline' source built from entry"
      pattern: "remixEntry"
    - from: "plan.tsx onCookNow"
      to: "router.push(`/recipes/${entry.recipe_id}/cook`)"
      via: "guard on entry.recipe_id; disabled-icon path when null"
      pattern: "/cook"
---

<objective>
Replace the swipe-left gesture on HeroDayCard with a floating overlay icon cluster (5 SF Symbols on a semi-transparent dark capsule, bottom-right of the hero image) matching the SuggestionCard / RecipeCard precedent. Add Cook Now + Remix as new actions alongside the existing Swap / Cooked / Clear. Wire onCookNow (router push to /cook) and onRemix (opens RemixSheet directly via new plan.tsx modal state) from the plan tab.

Purpose: Make the most powerful day-level actions discoverable at a glance instead of behind a swipe gesture. The hero card already commands the visual real estate; adding the 5-icon cluster matches the established pattern from Something New / Recipe Box / Remix variation cards so users have ONE consistent affordance language across surfaces.

Output: HeroDayCard renders 5 tappable icons over the hero, swipe-left is removed from the hero (compact-mode SwipeableDayRow keeps it), and tapping Remix opens the RemixSheet directly with the day's entry as the inline source.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/CLAUDE.md
</execution_context>

<context>
@.planning/STATE.md
@apps/mobile/src/components/plan/HeroDayCard.tsx
@apps/mobile/src/components/plan/HeroDayCard.test.ts
@apps/mobile/src/components/plan/SwipeableDayRow.tsx
@apps/mobile/src/components/recipes/RecipeCard.tsx
@apps/mobile/src/components/suggestions/SuggestionCard.tsx
@apps/mobile/src/components/recipes/RemixSheet.tsx
@apps/mobile/src/app/(tabs)/plan.tsx
@apps/mobile/src/components/ui/SymbolIcon.tsx
@apps/mobile/src/design/tokens.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase. -->

From apps/mobile/src/components/plan/HeroDayCard.tsx (current signature):
```typescript
export interface HeroDayCardProps {
  entry: MealPlanEntry;        // never null — caller branches to SwipeableDayRow's empty placeholder
  dayLabel: string;            // 'MON'
  dateLabel?: string;          // '4/27'
  focusTheme?: string | null;
  onPress: () => void;
  onSwap: () => void;
  onCook: () => void;
  onSkip: () => void;
  // ADD:
  onCookNow: () => void;
  onRemix: () => void;
}
```

From apps/mobile/src/components/plan/SwipeableDayRow.tsx — KEEP unchanged:
```typescript
// Stays in SwipeableDayRow. HeroDayCard stops importing it.
export function renderRightActionsFor(props: {
  entry: MealPlanEntry;
  onSwap: () => void;
  onCook: () => void;
  onSkip: () => void;
}): React.ReactElement;
```

From apps/mobile/src/components/recipes/RemixSheet.tsx (already supports inline source + onApplyToDay):
```typescript
export type RemixSource =
  | { kind: 'saved'; recipeId: string }
  | { kind: 'inline'; context: VariationContext };

interface RemixSheetProps {
  visible: boolean;
  recipeTitle: string;
  source: RemixSource;
  baseForSave?: { title; description?; ingredients?; steps?; total_time_minutes? };
  onApplyToDay?: (full: ParsedRecipe) => Promise<void>;
  onClose: () => void;
}
```

From apps/mobile/src/components/ui/SymbolIcon.tsx:
```typescript
// Use raw pixel sizes inside hero overlay clusters per the
// "size escape hatch" doc — RecipeCard uses 24, this matches.
<SymbolIcon name="..." size={22} tintColor="#FFFFFF" />
```

From apps/mobile/src/design/tokens.ts:
```typescript
// Use raw rgba() for the overlay capsule (rgba over imagery is
// allowed per existing precedent in RecipeCard styles.actionBadge).
// Tints come from #FFFFFF or accent #FFE4B5 (the warm-off-white used by
// RecipeCard's sparkle/flame icons).
```

From apps/mobile/src/app/(tabs)/plan.tsx (current HeroDayCard call site, around line 943):
```typescript
<HeroDayCard
  entry={item.entry}
  dayLabel={DAY_LABELS[item.day]!}
  dateLabel={shortDateForDay(currentPlan.week_start, item.day)}
  focusTheme={currentPlan.focus_theme ?? null}
  onSwap={() => setSwapTarget(item.day)}
  onCook={() => setCookTarget(item.day)}
  onSkip={() => setSkipTarget(item.day)}
  onPress={handleEntryPress}
/>
// existing destructure provides applySwap from useMealPlanStore
```

Existing plan.tsx imports already include: router (expo-router), Modal (react-native), MealPlanEntry, applySwap, RemixSheet is NOT yet imported — must add.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace HeroDayCard swipe with floating icon cluster + add onCookNow/onRemix props</name>
  <files>apps/mobile/src/components/plan/HeroDayCard.tsx, apps/mobile/src/components/plan/HeroDayCard.test.ts</files>
  <behavior>
    Tests in HeroDayCard.test.ts (drop the swipe-related case at lines 327-360, replace with cluster cases):
    - Test: HeroDayCard renders 5 cluster Pressables with accessibilityLabels: 'Swap', 'Cook Now', 'Remix', 'Cooked', 'Clear'
    - Test: tapping each cluster Pressable fires its corresponding handler (onSwap / onCookNow / onRemix / onCook / onSkip respectively)
    - Test: each cluster Pressable's onPress receives a synthetic event arg and calls e.stopPropagation() — verify by passing a mock event with stopPropagation: vi.fn() and asserting it was called
    - Test: when entry.recipe_id is null, the Cook Now Pressable is `disabled` and its parent style includes opacity 0.4 (visual-disabled state); tapping it does NOT fire onCookNow
    - Test: when entry.recipe_id is set, the Cook Now Pressable is enabled and tapping fires onCookNow
    - KEEP existing tests for: title rendering, day/date labels, chip rendering, skill_note, outer Pressable onPress (test at lines 303-325)
    - DROP: import of `renderRightActionsFor` from './SwipeableDayRow' in the test file; remove the swipe-action test that imported it
    - DROP: the `vi.mock('react-native-gesture-handler/ReanimatedSwipeable', ...)` mock — no longer needed
    - DROP: the `vi.mock('../../plan/telemetry', ...)` mock — was only used by renderRightActionsFor; HeroDayCard itself emits no telemetry in this change
  </behavior>
  <action>
    Modify `apps/mobile/src/components/plan/HeroDayCard.tsx`:

    1. Remove imports no longer needed:
       - `import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';`
       - `import { renderRightActionsFor } from './SwipeableDayRow';`

    2. Extend `HeroDayCardProps` interface:
       ```typescript
       onCookNow: () => void;
       onRemix: () => void;
       ```
       Destructure both in the function signature.

    3. Remove the `<ReanimatedSwipeable>` wrapper entirely. The outer `<View style={styles.tileWrap}>` now wraps the `<Pressable>` directly (no swipe gesture layer).

    4. Inside the existing `<View style={styles.heroFrame}>`, AFTER the `<HeroDayCardImage>` and AFTER the existing `<View style={[styles.heroOverlayContent, ...]}>` block, add a new absolute-positioned cluster:

       ```tsx
       <View style={styles.heroIconCluster}>
         {/* Each Pressable: hitSlop=6, e.stopPropagation() on press, fires the appropriate handler */}
         <Pressable
           onPress={(e) => { e.stopPropagation(); onSwap(); }}
           hitSlop={6}
           accessibilityLabel="Swap"
           style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
         >
           <SymbolIcon name={'arrow.2.squarepath' as SymbolViewProps['name']} size={22} tintColor="#FFFFFF" />
         </Pressable>

         <Pressable
           onPress={(e) => { e.stopPropagation(); if (!entry.recipe_id) return; onCookNow(); }}
           hitSlop={6}
           disabled={!entry.recipe_id}
           accessibilityLabel="Cook Now"
           style={({ pressed }) => [styles.iconBtn, !entry.recipe_id && { opacity: 0.4 }, pressed && entry.recipe_id && { opacity: 0.6 }]}
         >
           <SymbolIcon name={'flame.fill' as SymbolViewProps['name']} size={22} tintColor="#FFE4B5" />
         </Pressable>

         <Pressable
           onPress={(e) => { e.stopPropagation(); onRemix(); }}
           hitSlop={6}
           accessibilityLabel="Remix"
           style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
         >
           <SymbolIcon name={'sparkles' as SymbolViewProps['name']} size={22} tintColor="#FFE4B5" />
         </Pressable>

         <Pressable
           onPress={(e) => { e.stopPropagation(); onCook(); }}
           hitSlop={6}
           accessibilityLabel="Cooked"
           style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
         >
           <SymbolIcon name={'checkmark.circle.fill' as SymbolViewProps['name']} size={22} tintColor="#FFFFFF" />
         </Pressable>

         <Pressable
           onPress={(e) => { e.stopPropagation(); onSkip(); }}
           hitSlop={6}
           accessibilityLabel="Clear"
           style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
         >
           <SymbolIcon name={'xmark.circle.fill' as SymbolViewProps['name']} size={22} tintColor="#FFFFFF" />
         </Pressable>
       </View>
       ```

    5. Add `heroIconCluster` + `iconBtn` styles to the StyleSheet:
       ```typescript
       heroIconCluster: {
         position: 'absolute',
         right: 12,
         bottom: 12,
         flexDirection: 'row',
         alignItems: 'center',
         backgroundColor: 'rgba(0,0,0,0.55)',
         borderRadius: 9999,
         paddingHorizontal: 8,
         paddingVertical: 6,
         gap: 8,
       },
       iconBtn: {
         alignItems: 'center',
         justifyContent: 'center',
         minWidth: 28,
         minHeight: 28,
       },
       ```

    Modify `apps/mobile/src/components/plan/HeroDayCard.test.ts` per the <behavior> block above. Specifically:
    - Drop the `vi.mock('react-native-gesture-handler/ReanimatedSwipeable', ...)` block (no longer imported by the component).
    - Drop the `vi.mock('../../plan/telemetry', ...)` block + the `loggedEvents` array + `beforeEach` reset of it.
    - Drop the import of `renderRightActionsFor` from './SwipeableDayRow'.
    - Replace the final test (`'renderRightActionsFor wired with handlers...'` at lines 327-360) with the new cluster tests outlined in <behavior>.
    - To assert stopPropagation: pass `{ stopPropagation: vi.fn() } as any` as the synthetic event arg to the cluster Pressable's onPress, then assert that mock was called.
    - To find cluster Pressables: filter tree for Pressables whose accessibilityLabel matches one of {'Swap','Cook Now','Remix','Cooked','Clear'}.

    NOTE: The existing tests at lines 148-325 already cover title, chips, day/date labels, skill_note, and outer onPress — keep them intact. Only the last (swipe) test changes, plus mock cleanup.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && npx vitest run src/components/plan/HeroDayCard.test.ts --reporter=verbose</automated>
  </verify>
  <done>
    - HeroDayCard.tsx no longer imports ReanimatedSwipeable or renderRightActionsFor
    - HeroDayCard renders 5 Pressables in a dark-capsule cluster bottom-right of heroFrame
    - All 5 cluster Pressables stopPropagation on press
    - Cook Now is visually disabled (opacity 0.4) and a no-op when entry.recipe_id is null
    - HeroDayCard.test.ts: all original passing tests still pass; renderRightActionsFor test replaced with cluster tests; ReanimatedSwipeable + telemetry mocks removed
    - vitest run passes for the test file
    - tsc clean on HeroDayCard.tsx (no new errors)
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire onCookNow + onRemix in plan.tsx — add remixEntry modal mounting RemixSheet directly</name>
  <files>apps/mobile/src/app/(tabs)/plan.tsx</files>
  <action>
    Modify `apps/mobile/src/app/(tabs)/plan.tsx`:

    1. Add import (near other recipe-related imports, e.g. after the SwapSheet import on line ~34):
       ```typescript
       import { RemixSheet } from '../../components/recipes/RemixSheet';
       ```

    2. Add new state (next to `previewEntry` state around line 137):
       ```typescript
       const [remixEntry, setRemixEntry] = useState<MealPlanEntry | null>(null);
       ```

    3. Update the HeroDayCard JSX call site (around line 943) to pass `onCookNow` and `onRemix`:
       ```tsx
       <HeroDayCard
         entry={item.entry}
         dayLabel={DAY_LABELS[item.day]!}
         dateLabel={shortDateForDay(currentPlan.week_start, item.day)}
         focusTheme={currentPlan.focus_theme ?? null}
         onSwap={() => setSwapTarget(item.day)}
         onCook={() => setCookTarget(item.day)}
         onSkip={() => setSkipTarget(item.day)}
         onCookNow={() => {
           if (item.entry?.recipe_id) {
             router.push(`/recipes/${item.entry.recipe_id}/cook`);
           }
           // No-op if no recipe_id — HeroDayCard already disables the icon visually.
         }}
         onRemix={() => setRemixEntry(item.entry)}
         onPress={handleEntryPress}
       />
       ```

    4. Mount the new RemixSheet modal at the same depth as the existing previewEntry/savedDetail Modals (after the savedDetail Modal closing tag, before `</SafeAreaView>` around line 1222):
       ```tsx
       {/* Direct Remix flow — opens RemixSheet for a plan-day's entry without
           routing through PlanEntryPreview. Mirrors the inline-source +
           onApplyToDay pattern used by PlanEntryPreview's Remix nested sheet. */}
       {remixEntry && (
         <RemixSheet
           visible={!!remixEntry}
           recipeTitle={remixEntry.title}
           source={{
             kind: 'inline',
             context: {
               title: remixEntry.title,
               description: remixEntry.description ?? null,
               ingredients: (remixEntry.ingredients ?? []).map((i) => ({
                 name: i.name,
                 quantity: i.quantity ?? null,
                 unit: i.unit ?? null,
                 notes: i.notes ?? null,
               })),
               total_time_minutes:
                 remixEntry.estimated_time_minutes ??
                 ((remixEntry.prep_time_minutes ?? 0) +
                   (remixEntry.cook_time_minutes ?? 0) || null),
             },
           }}
           baseForSave={{
             title: remixEntry.title,
             description: remixEntry.description ?? null,
             ingredients: (remixEntry.ingredients ?? []).map((i) => ({
               name: i.name,
               quantity: i.quantity ?? null,
               unit: i.unit ?? null,
               notes: i.notes ?? null,
             })),
             steps: remixEntry.steps ?? [],
             total_time_minutes:
               remixEntry.estimated_time_minutes ??
               ((remixEntry.prep_time_minutes ?? 0) +
                 (remixEntry.cook_time_minutes ?? 0) || null),
           }}
           onApplyToDay={async (full) => {
             if (!remixEntry) return;
             await applySwap(remixEntry.day_of_week, full);
             setRemixEntry(null);
           }}
           onClose={() => setRemixEntry(null)}
         />
       )}
       ```

       Note: `applySwap` is already destructured from `useMealPlanStore()` near the top of the component — verify the existing destructure at line ~128 includes it. No new store wiring needed.

       Note: `router` is already imported in plan.tsx — verify near top imports. If not, add `import { router } from 'expo-router';` (most files in the project import it).

    5. Verify VariationContext shape matches what's exported from progressionStore — the inline-context object above uses `{ title, description, ingredients, total_time_minutes }`, mirroring how PlanEntryPreview's RemixSheet wires its context (search the codebase for an existing call site if uncertain). RemixSheet itself accepts the context shape via the `RemixSource` discriminated union.

    No new tests required for plan.tsx in this task — it's pure JSX wiring of two existing patterns (Modal mount + state setter callback). Behavior is exercised at runtime via Maestro on the simulator (verify-step).
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(plan\.tsx|HeroDayCard\.tsx)" | grep -v "tests/" || echo "tsc clean on modified files"</automated>
  </verify>
  <done>
    - plan.tsx imports RemixSheet
    - remixEntry useState exists
    - HeroDayCard JSX call passes onCookNow (router.push to /cook guarded on recipe_id) and onRemix (setRemixEntry)
    - RemixSheet modal mount renders when remixEntry is non-null with kind:'inline' source built from entry, baseForSave from entry, onApplyToDay calling applySwap then clearing remixEntry, onClose clearing remixEntry
    - tsc clean on plan.tsx (no new errors introduced)
  </done>
</task>

</tasks>

<verification>
**Automated checks (run after both tasks):**

1. HeroDayCard tests: `cd apps/mobile && npx vitest run src/components/plan/HeroDayCard.test.ts` — all tests green (existing 10 pass + new cluster cases pass)
2. SwipeableDayRow tests still green (untouched, but sanity-check): `cd apps/mobile && npx vitest run src/components/plan/SwipeableDayRow.test.ts`
3. Typecheck the two modified files: `cd apps/mobile && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "(plan\.tsx|HeroDayCard\.tsx)"` — no new errors
4. Lint: `cd apps/mobile && npx biome check src/components/plan/HeroDayCard.tsx src/app/\(tabs\)/plan.tsx` — clean

**Manual UAT (Maestro on iOS Simulator) — REQUIRED before reporting complete per CLAUDE.md UAT section:**

```bash
cd /Users/patrickrichards/DinnerTime/apps/mobile
xcrun simctl boot "iPhone 17 Pro" || true
open -a Simulator
xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
# Backend in another shell: from repo root, set -a && source .env && set +a && cd packages/server && pnpm dev
npx expo start --dev-client --lan
# Then exercise the Plan tab manually:
# - Sign in, navigate to Plan tab (detailed mode is the default)
# - Verify cluster of 5 icons renders bottom-right of each day's hero image
# - Tap Swap → SwapSheet opens
# - Tap Cooked (checkmark.circle.fill) → CookConfirm flow opens
# - Tap Clear (xmark.circle.fill) → day skipped (entry status flips)
# - Tap Cook Now (flame.fill) on a recipe-backed day → routes to /recipes/{id}/cook
# - Tap Cook Now on an ad-hoc entry (recipe_id null) → no-op (icon at 40% opacity)
# - Tap Remix (sparkles) → RemixSheet opens directly with the day's title; no PlanEntryPreview interstitial
# - In RemixSheet pick a mode → variation appears → tap calendar.badge.checkmark on a variation → applies to the day, sheet closes
# - Tap card body (NOT an icon) → still opens PlanEntryPreview / SavedRecipeDetail (existing onPress unaffected)
# - Verify NO swipe gesture triggers actions on the hero card (swipe-left should be inert in detailed mode)
# - Toggle to compact mode in Settings → swipe-left on SwipeableDayRow STILL works (regression check)
```

Take screenshots at each tap to verify visuals match the SuggestionCard / RecipeCard cluster precedent (semi-transparent dark capsule, white SF Symbols, ~22pt glyphs).
</verification>

<success_criteria>
- HeroDayCard.tsx no longer imports `ReanimatedSwipeable` or `renderRightActionsFor` (grep -L confirms)
- HeroDayCard renders the 5-icon cluster bottom-right of the hero image, matching the SuggestionCard / RecipeCard visual pattern
- Tapping each cluster icon fires its handler AND stops propagation (card-level onPress does not fire)
- Cook Now icon is visually disabled (opacity 0.4) and inert when entry.recipe_id is null
- Tapping Remix opens RemixSheet directly with kind:'inline' source from the day's entry; tapping calendar.badge.checkmark on a variation applies it to the day via applySwap and closes the sheet
- HeroDayCard.test.ts: all tests green (the previous swipe-action test replaced with cluster Pressable assertions)
- SwipeableDayRow.test.ts: all tests still green (compact mode unchanged)
- tsc clean on the two modified files
- Maestro/manual UAT confirms tap behaviors + visual parity with SuggestionCard's cluster
</success_criteria>

<output>
After completion, create `.planning/quick/10-plan-day-card-actions-replace-swipe-left/10-SUMMARY.md` summarizing:
- Files modified + LOC delta
- Cluster tap behaviors verified (which handlers fired, which were disabled)
- Test counts (before/after) on HeroDayCard.test.ts
- Any deviations from the plan (e.g., naming, style adjustments)
- Maestro screenshots taken (paths under apps/mobile/.maestro/)
- Known follow-ups (e.g., compact-mode SwipeableDayRow redesign deferred per scope)
</output>
