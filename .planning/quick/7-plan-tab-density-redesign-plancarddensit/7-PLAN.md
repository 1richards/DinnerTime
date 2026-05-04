---
phase: 7-plan-tab-density-redesign
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/stores/settingsStore.ts
  - apps/mobile/src/stores/__tests__/settingsStore.test.ts
  - apps/mobile/src/app/(tabs)/settings.tsx
  - apps/mobile/src/components/plan/dayRowHelpers.ts
  - apps/mobile/src/components/plan/dayRowHelpers.test.ts
  - apps/mobile/src/components/plan/HeroDayCard.tsx
  - apps/mobile/src/components/plan/HeroDayCard.test.ts
  - apps/mobile/src/components/plan/heroTargetPicker.ts
  - apps/mobile/src/components/plan/heroTargetPicker.test.ts
  - apps/mobile/src/app/(tabs)/plan.tsx
autonomous: true
requirements:
  - QT-7-01  # planCardDensity setting (compact | detailed) persisted
  - QT-7-02  # all-skills chip rendering (matched chip warm, others muted)
  - QT-7-03  # HeroDayCard for the active day in detailed mode
  - QT-7-04  # heroTargetPicker (today | next un-cooked planned | today fallback)
  - QT-7-05  # Settings → Plan card-density toggle
  - QT-7-06  # SwipeableDayRow swipe behavior + tap routing preserved on hero

must_haves:
  truths:
    - "User can toggle planCardDensity between 'compact' and 'detailed' in Settings → Plan and the choice persists across cold start."
    - "In detailed mode, today's day (or the next un-cooked future day if today is cooked/skipped) renders as a HeroDayCard at its position in the FlatList — NOT pinned to the top."
    - "Other days in detailed mode render as the existing SwipeableDayRow."
    - "In compact mode, every day (including today) renders as the existing SwipeableDayRow."
    - "Every day card in BOTH modes shows ALL practiced_skills as chips — the matching focus skill in 'warning' tone, others in 'default' tone."
    - "Tapping the HeroDayCard opens the same recipe-detail modal flow as DayRow (savedDetail vs previewEntry)."
    - "Swiping left on the HeroDayCard reveals the same Swap / Cooked / Clear actions as SwipeableDayRow."
  artifacts:
    - path: "apps/mobile/src/stores/settingsStore.ts"
      provides: "planCardDensity state ('compact'|'detailed', default 'detailed') + setPlanCardDensity action persisted in dinnertime-settings AsyncStorage blob"
      contains: "planCardDensity"
    - path: "apps/mobile/src/components/plan/dayRowHelpers.ts"
      provides: "deriveStatusChips emits ALL practiced_skills as chips with matched chip in warning tone first, others default in source order"
    - path: "apps/mobile/src/components/plan/heroTargetPicker.ts"
      provides: "pickHeroTargetIndex(entries, weekStart, todayIso) → 0..6 day index for the hero card"
      exports: ["pickHeroTargetIndex"]
    - path: "apps/mobile/src/components/plan/HeroDayCard.tsx"
      provides: "16:9 hero-image day card with title, all-skills chips + difficulty/time/servings + italic skill_note; wraps ReanimatedSwipeable for swipe actions"
      exports: ["HeroDayCard"]
    - path: "apps/mobile/src/app/(tabs)/settings.tsx"
      provides: "Plan section gains a 'Card density' Switch row (compact ↔ detailed)"
    - path: "apps/mobile/src/app/(tabs)/plan.tsx"
      provides: "renderItem branches on planCardDensity + heroTargetIdx — hero at target index in detailed mode, SwipeableDayRow elsewhere"
  key_links:
    - from: "apps/mobile/src/app/(tabs)/plan.tsx"
      to: "useSettingsStore.planCardDensity"
      via: "selector subscription"
      pattern: "useSettingsStore\\(.*planCardDensity"
    - from: "apps/mobile/src/app/(tabs)/plan.tsx"
      to: "pickHeroTargetIndex"
      via: "useMemo over currentPlan.entries + week_start + today"
      pattern: "pickHeroTargetIndex\\("
    - from: "apps/mobile/src/components/plan/HeroDayCard.tsx"
      to: "useGeneratedRecipeImage + getRecipeImage"
      via: "image fallback chain identical to DayRow"
      pattern: "useGeneratedRecipeImage|getRecipeImage"
    - from: "apps/mobile/src/components/plan/dayRowHelpers.ts"
      to: "all practiced_skills emitted as chips"
      via: "loop over args.practicedSkills (matched first, then others)"
      pattern: "practicedSkills.*forEach|practicedSkills.*map|for \\(const"
---

<objective>
Add a Settings-level density toggle for the Plan tab and ship a hero-card treatment for the active day in detailed mode, while making EVERY day card surface ALL of its `practiced_skills` chips (matched chip in warm tone, others muted).

Purpose: Quick-task 9 already added per-entry `practiced_skills` (1-3 keys) + `difficulty` + `skill_note` and surfaced exactly ONE matching-focus chip on day rows. The user wants the FULL skill set visible on every day, plus a glanceable "today's meal" hero so the Plan tab's information density scales with intent.

Output:
- `planCardDensity: 'compact' | 'detailed'` setting (default 'detailed', persisted)
- `pickHeroTargetIndex` pure helper + tests
- `HeroDayCard` component + render-tree tests
- `deriveStatusChips` change: emit ALL practiced_skills (matched first warning, rest default), drop the single-match-only branch
- Settings PLAN section gains a "Card density" Switch row
- `plan.tsx` FlatList renderItem branches on density + hero target index
- Existing 23 dayRowHelpers tests stay green; ~8 new cases added for the multi-chip rule
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/CLAUDE.md
</execution_context>

<context>
@apps/mobile/src/app/(tabs)/plan.tsx
@apps/mobile/src/components/plan/SwipeableDayRow.tsx
@apps/mobile/src/components/plan/DayRow.tsx
@apps/mobile/src/components/plan/dayRowHelpers.ts
@apps/mobile/src/components/plan/dayRowHelpers.test.ts
@apps/mobile/src/components/plan/FocusBanner.tsx
@apps/mobile/src/stores/settingsStore.ts
@apps/mobile/src/stores/__tests__/settingsStore.test.ts
@apps/mobile/src/app/(tabs)/settings.tsx
@apps/mobile/src/types/mealPlan.ts
@apps/mobile/src/types/recipe.ts
@apps/mobile/src/hooks/useGeneratedRecipeImage.ts
@apps/mobile/src/constants/foodImages.ts
@apps/mobile/src/components/ui/Chip.tsx
@apps/mobile/src/components/ui/HeroImage.tsx

<interfaces>
<!-- Key contracts the executor needs. Embedded so no codebase exploration. -->

From src/types/recipe.ts (canonical 8-key skill taxonomy — DO NOT INVENT NEW KEYS):
```typescript
export const PRACTICED_SKILLS = [
  'knife skills',
  'pan sauces',
  'braising',
  'stir-frying',
  'plant-forward',
  'pasta from scratch',
  'global flavors',
  'baking & breads',
] as const;
export type PracticedSkill = (typeof PRACTICED_SKILLS)[number];
```

From src/types/mealPlan.ts:
```typescript
export interface MealPlanEntry {
  id: string;
  meal_plan_id: string;
  day_of_week: number; // 0 = Monday
  recipe_id: string | null;
  title: string;
  description: string | null;
  ingredients: MealPlanIngredient[];
  steps: string[];
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  servings: number | null;
  estimated_time_minutes: number | null;
  difficulty: Difficulty | null; // 'easy' | 'medium' | 'hard' | null
  status: MealPlanEntryStatus;   // 'planned' | 'cooked' | 'skipped'
  is_stretch?: boolean;
  pantry_ready?: boolean;
  practiced_skills?: string[] | null;
  skill_note?: string | null;
  // image_url omitted from this typing block — present at runtime per
  // recent commit 626ce70 (entries are full recipes), use cast or extend.
}
export interface MealPlan {
  week_start: string; // ISO YYYY-MM-DD (Monday, UTC-anchored)
  entries: MealPlanEntry[];
  focus_theme?: string | null;
}
```

From src/stores/settingsStore.ts (existing precedent — mirror this shape exactly):
```typescript
// Existing: planFocusBannerEnabled (boolean, default true, persisted)
planFocusBannerEnabled: boolean;
setPlanFocusBannerEnabled: (enabled: boolean) => void;
// AND existing: shoppingHandoffMode ('draft_cart' | 'legacy', default 'draft_cart', persisted)
// Both share storage key 'dinnertime-settings'
```

From src/components/plan/dayRowHelpers.ts (current single-match logic — to be replaced):
```typescript
export interface StatusChipDescriptor {
  label: string;
  tone: ChipTone; // 'default' | 'success' | 'warning' | 'destructive'
  leadingIcon?: string;
}
export interface DeriveArgs {
  status: DayRowStatus;
  isStretch?: boolean;
  pantryReady?: boolean;
  entry?: ScoredEntry | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  practicedSkills?: string[] | null;
  focusTheme?: string | null;
}
// CURRENT: emits ONE chip when practicedSkills includes focusTheme (warning tone).
// NEW: when practicedSkills is non-empty, emit ONE chip per skill — matched chip
// first with tone='warning', others after in source order with tone='default'.
// All chips use leadingIcon: 'sparkles' and sentence-case label
// (e.g. 'pan sauces' → 'Pan sauces').
```

From src/components/ui/Chip.tsx (display chip primitive):
```typescript
// <Chip kind='display' tone='default'|'success'|'warning'|'destructive' label leadingIcon />
// Used by DayRow today; HeroDayCard reuses the same primitive.
```

From src/components/ui/HeroImage.tsx:
```typescript
// <HeroImage uri={string|null} height={number} borderRadius={number}
//   gradientDirection='bottom' children={ReactNode} />
// Use 16:9 → height = (cardWidth * 9 / 16). Card spans the SwipeableDayRow
// horizontal margins (mx-4 = 16pt each side).
```

From src/hooks/useGeneratedRecipeImage.ts:
```typescript
export function useGeneratedRecipeImage(
  title: string | null | undefined,
  options?: { skip?: boolean; description?: string | null; ingredients?: ParsedIngredient[] | null }
): { url: string | null; status: 'loading'|'resolved'|'failed' };
```

From src/components/plan/SwipeableDayRow.tsx:
```typescript
// Exports renderRightActionsFor({ entry, onSwap, onCook, onSkip }) — reuse
// inside HeroDayCard's ReanimatedSwipeable so swipe actions stay byte-identical
// (Swap brand / Cooked success / Clear warning). Telemetry fires inside that
// helper — no need to re-emit from HeroDayCard.
import { renderRightActionsFor } from './SwipeableDayRow';
```
</interfaces>

# Reference snippets

Hero target picker contract (pure function — pickHeroTargetIndex):

```typescript
// Returns the day_of_week index (0..6, Monday=0) that should render as the hero.
// Rules:
//   1. Compute todayIdx = days between weekStart and todayIso (UTC-anchored).
//      Clamp to [0, 6]. If today is OUTSIDE this week, fall back to 0.
//   2. Find entry at todayIdx. If status !== 'cooked' && !== 'skipped' → return todayIdx.
//   3. Otherwise scan entries from todayIdx+1..6 for the first with status === 'planned'
//      → return its day_of_week.
//   4. Fallback: return todayIdx (so the hero never disappears; cooked/skipped today
//      simply renders as the hero — better than no hero at all).
export function pickHeroTargetIndex(
  entries: MealPlanEntry[],
  weekStart: string,   // 'YYYY-MM-DD'
  todayIso: string,    // 'YYYY-MM-DD' — UTC-anchored midnight slice
): number;
```

UTC-day-diff helper (use existing addDaysIso pattern from plan.tsx):

```typescript
function diffDaysUtc(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00Z`).getTime();
  const b = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}
```

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Settings store + chip helper changes (TDD)</name>
  <files>
    apps/mobile/src/stores/settingsStore.ts,
    apps/mobile/src/stores/__tests__/settingsStore.test.ts,
    apps/mobile/src/components/plan/dayRowHelpers.ts,
    apps/mobile/src/components/plan/dayRowHelpers.test.ts
  </files>
  <behavior>
    SETTINGS STORE:
    - default planCardDensity === 'detailed'
    - setPlanCardDensity('compact') flips state; setPlanCardDensity('detailed') flips back
    - persists to AsyncStorage under existing 'dinnertime-settings' blob (state.planCardDensity)
    - rehydrates prior value from AsyncStorage on cold start

    DAYROWHELPERS — NEW MULTI-CHIP RULE (replaces current single-match-only branch):
    - practicedSkills=[], null, or undefined → NO skill chips (preserves the existing
      "practicedSkills=null → no matching chip" + "practicedSkills=[] → no matching chip"
      tests)
    - practicedSkills=['pan sauces'] + focusTheme='pan sauces' → exactly 1 chip
      { label: 'Pan sauces', tone: 'warning', leadingIcon: 'sparkles' }
    - practicedSkills=['pan sauces'] + focusTheme='knife skills' → 1 chip
      { label: 'Pan sauces', tone: 'default', leadingIcon: 'sparkles' }
      (NEW — previously this case emitted zero chips)
    - practicedSkills=['knife skills', 'pan sauces'] + focusTheme='pan sauces' →
      2 chips IN ORDER: matched first ('Pan sauces' warning), then others in source
      order ('Knife skills' default). Both use leadingIcon='sparkles'.
    - practicedSkills=['Pan Sauces'] + focusTheme='pan sauces' → 1 warning chip
      'Pan sauces' (case-insensitive match preserved)
    - focusTheme='  pan sauces  ' (whitespace-padded) + match → still warning chip
      (trim preserved)
    - practicedSkills=['knife skills','braising','pan sauces'] + focusTheme=null →
      3 chips, ALL default tone, in source order
    - Existing behavior preserved: difficulty chip still emitted; status chip still
      first; entry health chip rules unchanged; stretch + pantry-ready chips unchanged.
      All 23 existing dayRowHelpers tests stay green.

    Order in output: status chip (cooked/skipped) → stretch → pantry-ready →
    difficulty → SKILL CHIPS (matched first, then others in source order) → health.
    The skill chips replace the old "matching focus" insertion point exactly.
  </behavior>
  <action>
    1. settingsStore.ts: add planCardDensity state. Mirror planFocusBannerEnabled exactly.

       ```typescript
       export type PlanCardDensity = 'compact' | 'detailed';
       // Inside SettingsState interface:
       planCardDensity: PlanCardDensity;
       setPlanCardDensity: (density: PlanCardDensity) => void;
       // Inside the create() body:
       planCardDensity: 'detailed',
       setPlanCardDensity: (density) => set({ planCardDensity: density }),
       ```

       Add a JSDoc comment block matching planFocusBannerEnabled's shape, calling out
       quick-task 7 + default rationale (detailed = the new richer presentation; users
       opt down to compact).

    2. settingsStore.test.ts: add a new describe block 'planCardDensity' with 4 cases
       mirroring the planFocusBannerEnabled tests:
         - default planCardDensity is 'detailed'
         - setPlanCardDensity('compact') flips the value (round-trip back to 'detailed')
         - persists changes to AsyncStorage under 'dinnertime-settings' state.planCardDensity
         - rehydrates prior planCardDensity from AsyncStorage on cold start
       Reuse the existing asyncStorageMock + STORAGE_KEY + import-after-mock pattern
       byte-for-byte.

    3. dayRowHelpers.ts: REPLACE the existing matching-focus chip block (lines ~127-145
       of current file — the `if (args.practicedSkills && args.practicedSkills.length > 0
       && typeof args.focusTheme === 'string' && args.focusTheme.trim().length > 0)`
       block) with the new multi-chip emitter:

       ```typescript
       // Quick-task 7 — emit ALL practiced_skills as chips. The chip whose
       // lowercase value matches the (trimmed) focus theme renders in 'warning'
       // tone first; every other skill renders in 'default' tone in source order.
       // Drops the previous single-match-only branch so users see the full
       // skill payload of every meal at a glance.
       if (args.practicedSkills && args.practicedSkills.length > 0) {
         const themeLc =
           typeof args.focusTheme === 'string'
             ? args.focusTheme.trim().toLowerCase()
             : null;
         const sentenceCase = (s: string): string => {
           const lc = s.toLowerCase();
           return lc.length === 0 ? lc : lc[0]!.toUpperCase() + lc.slice(1);
         };
         // Partition: matched skill (if any) first, others preserve source order.
         const matched = themeLc
           ? args.practicedSkills.find((s) => s.toLowerCase() === themeLc) ?? null
           : null;
         if (matched) {
           out.push({
             label: sentenceCase(matched),
             tone: 'warning',
             leadingIcon: 'sparkles',
           });
         }
         for (const skill of args.practicedSkills) {
           if (matched && skill === matched) continue;
           out.push({
             label: sentenceCase(skill),
             tone: 'default',
             leadingIcon: 'sparkles',
           });
         }
       }
       ```

    4. dayRowHelpers.test.ts: extend the 'matching-focus chip' describe block
       (rename to 'practiced-skills chips' for clarity in a follow-up commit, but
       keep this PR's diff minimal — just add new `it` cases AT THE END of the
       existing block). Add ~8 cases:
         - 'practicedSkills=["pan sauces"], no focusTheme → 1 default chip "Pan sauces"'
         - 'practicedSkills=["pan sauces"], focusTheme="knife skills" (no match) → 1 default chip "Pan sauces"' (REGRESSION-CRITICAL — previously this returned 0)
         - 'practicedSkills=["knife skills","pan sauces"], focusTheme="pan sauces" → 2 chips, "Pan sauces" warning FIRST then "Knife skills" default'
         - 'practicedSkills=["knife skills","braising","pan sauces"], focusTheme=null → 3 chips ALL default in source order'
         - 'practicedSkills=["Pan Sauces"], focusTheme="pan sauces" → 1 warning chip "Pan sauces" (case-insensitive)'
         - 'whitespace-padded focusTheme still matches (trim preserved) → warning'
         - 'sentence-case label: "pan sauces" → "Pan sauces" (single capital)'
         - 'all skill chips use leadingIcon "sparkles"'

       UPDATE the 6 existing 'matching-focus chip' tests that expect ZERO chips when
       focus doesn't match — under the new rule they now expect 1+ default chips.
       Specifically:
         - 'practiced_skills does NOT include focus_theme → no matching chip' →
           change assertion to expect 1 default chip 'Pan sauces' (the practiced
           skill IS rendered, just not in warning tone)
         - 'focus_theme=null → no matching chip even with practiced_skills' → expect
           1 default chip 'Pan sauces'
         - 'practiced_skills=null → no matching chip' → unchanged (still 0 chips,
           array is null)
         - 'practiced_skills=[] (empty) → no matching chip' → unchanged (0 chips)
         - 'multiple practiced_skills with focus match → exactly ONE matching chip' →
           UPDATE: assert matched chip 'Pan sauces' present in WARNING tone AND
           non-matching 'Knife skills' present in DEFAULT tone (reflects the new
           "show all" rule)

       Run: `pnpm --filter mobile test --filter dayRowHelpers --filter settingsStore`
       and confirm green before moving on.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm test src/components/plan/dayRowHelpers.test.ts src/stores/__tests__/settingsStore.test.ts -- --run</automated>
  </verify>
  <done>
    - settingsStore exposes planCardDensity (default 'detailed') + setPlanCardDensity, persisted in 'dinnertime-settings'.
    - 4 new settingsStore tests green; all existing settingsStore tests still green.
    - dayRowHelpers emits ALL practiced_skills (matched warning first, others default in order) instead of the single-match-only chip.
    - All previously-green dayRowHelpers tests still green after assertion updates; ~8 new cases green covering the multi-chip rule.
    - Sentence-case + leadingIcon='sparkles' invariants hold for every skill chip.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: heroTargetPicker + HeroDayCard component (TDD)</name>
  <files>
    apps/mobile/src/components/plan/heroTargetPicker.ts,
    apps/mobile/src/components/plan/heroTargetPicker.test.ts,
    apps/mobile/src/components/plan/HeroDayCard.tsx,
    apps/mobile/src/components/plan/HeroDayCard.test.ts
  </files>
  <behavior>
    HERO TARGET PICKER (pure function, vitest-node):
    - todayIso === weekStart (Monday) + entries[0].status='planned' → returns 0
    - todayIso === weekStart+2 (Wed) + entries[2].status='planned' → returns 2
    - todayIso === weekStart (Mon) + entries[0].status='cooked' + entries[1].status='planned' → returns 1
    - todayIso === weekStart (Mon) + entries[0].status='skipped' + entries[1].status='planned' → returns 1
    - todayIso === weekStart (Mon) + entries[0].status='cooked' + entries[1].status='cooked' + entries[2].status='cooked' + entries[3].status='planned' → returns 3
    - All days status='cooked' → returns todayIdx (fallback — hero never disappears)
    - todayIso BEFORE weekStart (last week) → returns 0 (clamp to start, fallback)
    - todayIso AFTER weekStart+6 (next week) → returns 0 (clamp, fallback — caller will
      typically have moved on to a new plan, but the function shouldn't crash)
    - entries=[] (no entries) → returns clampedTodayIdx (still gives a valid index;
      the consumer handles the "no entry at that day" case by falling back to
      SwipeableDayRow's empty-state path naturally)
    - Missing entry at todayIdx (gap day) → treats it as 'planned' for the purpose of
      "is today actionable?" → returns todayIdx (a gap day with hero treatment becomes
      an "Add a meal" hero, which keeps the visual rhythm)

    HERODAYCARD COMPONENT (vitest-node tree-walk, mirrors SwipeableDayRow.test.ts):
    - Renders an Image-bearing wrapper at 16:9 aspect (height computed from card width).
    - Displays the entry title in the overlay region.
    - Renders ALL practiced_skills chips via deriveStatusChips (matched warning first,
      others default).
    - Renders difficulty + estimated_time + servings chips when present.
    - Renders skill_note as italic text below the title block when non-null.
    - Tap (onPress) fires the parent-supplied handler (no recipe-detail navigation
      logic in the component itself — same delegation contract as DayRow).
    - Swipe-revealed actions reuse renderRightActionsFor from SwipeableDayRow so
      Swap/Cooked/Clear remain byte-identical, including the plan.swipe_action telemetry.
    - When entry=null, the component returns null (caller renders SwipeableDayRow's
      empty placeholder for that day instead — keeps HeroDayCard non-empty).
  </behavior>
  <action>
    1. Create heroTargetPicker.ts with `pickHeroTargetIndex(entries, weekStart, todayIso)`.
       Use UTC-anchored date math (mirror plan.tsx's `addDaysIso` style — `new Date(`${iso}T00:00:00Z`)`).
       Clamp the computed dayIdx to [0,6]. Build a `Map<number, MealPlanEntry>` keyed
       by day_of_week (skipping status='skipped' the same way plan.tsx already does
       at the entriesByDay layer is NOT the right move here — the picker needs to see
       skipped status to advance past it; iterate the raw entries array directly).

    2. Create heroTargetPicker.test.ts with the 9 cases listed above. Use a small
       fixture builder helper:

       ```typescript
       const mkEntry = (
         d: number,
         status: 'planned'|'cooked'|'skipped' = 'planned',
       ): MealPlanEntry => ({
         id: `e-${d}`, meal_plan_id: 'p1', day_of_week: d,
         recipe_id: null, title: `Day ${d}`, description: null,
         ingredients: [], ingredients_needed: [], steps: [],
         prep_time_minutes: null, cook_time_minutes: null, servings: null,
         estimated_time_minutes: null, difficulty: null, kid_friendly: false,
         why_suggested: null, status, cooked_at: null,
         created_at: '2026-04-27T00:00:00Z',
       });
       ```

    3. Create HeroDayCard.tsx. Composition outline:

       ```typescript
       import React, { useMemo } from 'react';
       import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
       import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
       import { HeroImage } from '../ui/HeroImage';
       import { Chip } from '../ui/Chip';
       import { SymbolIcon } from '../ui/SymbolIcon';
       import { colors } from '../../design/tokens';
       import { useRecipeStore } from '../../stores/recipeStore';
       import { useGeneratedRecipeImage } from '../../hooks/useGeneratedRecipeImage';
       import { getRecipeImage } from '../../constants/foodImages';
       import { deriveStatusChips, type DayRowStatus } from './dayRowHelpers';
       import { renderRightActionsFor } from './SwipeableDayRow';
       import type { MealPlanEntry } from '../../types/mealPlan';

       export interface HeroDayCardProps {
         entry: MealPlanEntry;       // hero never receives null — caller branches
         dayLabel: string;           // 'MON'
         dateLabel?: string;         // '4/27'
         focusTheme?: string | null;
         onPress: () => void;
         onSwap: () => void;
         onCook: () => void;
         onSkip: () => void;
       }
       ```

       Image chain (identical to DayRow): `savedRecipe?.image_url ?? generatedUri ?? getRecipeImage('plan-hero-{id}-{title}', null, entry.title)`. Any non-null value is fine for HeroImage; null renders the beige skeleton.

       Layout:
       - Outer View with `marginHorizontal: 16, marginBottom: 8` (matches SwipeableDayRow tileWrap so adjacent rows align).
       - ReanimatedSwipeable with `renderRightActions={() => renderRightActionsFor({ entry, onSwap, onCook, onSkip })}`, `rightThreshold={80}`, `overshootRight={false}`.
       - Inner Pressable wrapping HeroImage with computed height `(cardWidth * 9) / 16` where `cardWidth = Dimensions.get('window').width - 32`.
       - HeroImage children:
         - Day label + date strip (white text, brand-tinted background pill OR plain white-on-gradient — match the FocusBanner/SwipeableDayRow visual rhythm; pick whichever reads cleaner under the bottom-gradient)
         - Title (text-2xl font-bold white, 2 lines)
       - Below the hero (inside the Pressable but OUTSIDE HeroImage), a chip row:
         - Difficulty chip (existing leadingIcon 'gauge.with.dots.needle.33percent')
         - Time chip (`leadingIcon: 'clock'`, label `${estimated_time_minutes ?? prep+cook}m`)
         - Servings chip (`leadingIcon: 'person.2.fill'`, label `${servings} servings`)
         - All skill chips via deriveStatusChips (matched warning first, others default)
       - Italic skill_note below the chip row when non-null.

       Re-render rule: `useGeneratedRecipeImage` is called UNCONDITIONALLY (Rules of Hooks). Skip via `options.skip = !!savedRecipe?.image_url`.

    4. Create HeroDayCard.test.ts. Mirror SwipeableDayRow.test.ts's findPressables tree-walk pattern. Test cases:
       - renders title text
       - renders ALL skill chips (matched warning first when focusTheme matches)
       - renders difficulty chip when difficulty='medium'
       - renders time chip when estimated_time_minutes=35
       - renders servings chip when servings=4
       - renders italic skill_note text when non-null
       - tap on outer Pressable invokes onPress
       - renderRightActionsFor wired with all three handlers — invoking each Pressable's onPress fires the matching parent prop (use the same shape as SwipeableDayRow.test.ts's exercise of renderRightActionsFor).

       Mock `useGeneratedRecipeImage` to return `{ url: null, status: 'resolved' }`
       so the test stays node-pure (vitest.setup.ts already mocks expo-image and
       the recipe store; reuse the existing mocks).
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm test src/components/plan/heroTargetPicker.test.ts src/components/plan/HeroDayCard.test.ts -- --run</automated>
  </verify>
  <done>
    - pickHeroTargetIndex covers all 9 listed cases with green tests.
    - HeroDayCard.tsx renders title, all-skills chips, difficulty/time/servings chips, italic skill_note, image hero, swipe actions wired to renderRightActionsFor (telemetry preserved).
    - HeroDayCard.test.ts tree-walk covers render contract + handler dispatch + swipe-action helpers.
    - Zero new typecheck errors introduced.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire density toggle into Settings + plan.tsx FlatList</name>
  <files>
    apps/mobile/src/app/(tabs)/settings.tsx,
    apps/mobile/src/app/(tabs)/plan.tsx
  </files>
  <action>
    1. settings.tsx — extend the existing PLAN section (the one currently containing
       Skill Tier + Weekly Skill Focus banner toggle) with a third row immediately
       below the Weekly Skill Focus banner toggle. Mirror the toggle's shape exactly:

       ```tsx
       <View
         className="flex-row items-center justify-between py-4 border-b border-border"
         accessibilityRole="switch"
         accessibilityState={{ checked: planCardDensity === 'detailed' }}
         accessibilityLabel="Plan card density"
       >
         <View className="flex-1 pr-4">
           <Text className="text-body text-text-primary">
             Detailed plan cards
           </Text>
           <Text className="text-body text-text-secondary">
             Hero card for today's meal with full skills + difficulty + time. Off = compact rows.
           </Text>
         </View>
         <Switch
           value={planCardDensity === 'detailed'}
           onValueChange={(v) => setPlanCardDensity(v ? 'detailed' : 'compact')}
         />
       </View>
       ```

       Wire selectors at the top of the component (next to the existing focus-banner
       selectors):

       ```typescript
       const planCardDensity = useSettingsStore((s) => s.planCardDensity);
       const setPlanCardDensity = useSettingsStore((s) => s.setPlanCardDensity);
       ```

       Why a Switch (not a segmented control): density is a binary, the existing PLAN
       section already uses Switches for its other toggle, and a Switch keeps the row
       height identical for clean visual rhythm. If a future quick-task adds a third
       density option ('ultra-compact'?), upgrade to a segmented control then.

    2. plan.tsx — add density-aware renderItem branch.

       Add imports:
       ```typescript
       import { HeroDayCard } from '../../components/plan/HeroDayCard';
       import { pickHeroTargetIndex } from '../../components/plan/heroTargetPicker';
       ```

       Add selector near the existing planFocusBannerEnabled selector (above the
       early returns to satisfy Rules of Hooks):
       ```typescript
       const planCardDensity = useSettingsStore((s) => s.planCardDensity);
       ```

       Compute heroTargetIdx via useMemo BEFORE the early returns (Rules of Hooks).
       Use UTC-anchored today-iso the same way currentMondayIso() does:

       ```typescript
       const todayIso = useMemo(() => {
         const now = new Date();
         return new Date(
           Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
         ).toISOString().slice(0, 10);
       }, []);
       const heroTargetIdx = useMemo(() => {
         if (!currentPlan) return null;
         return pickHeroTargetIndex(currentPlan.entries, currentPlan.week_start, todayIso);
       }, [currentPlan, todayIso]);
       ```

       In the DraggableFlatList renderItem callback, branch BEFORE returning the
       SwipeableDayRow:

       ```tsx
       renderItem={({ item, drag, isActive }) => {
         const isHero =
           planCardDensity === 'detailed' &&
           heroTargetIdx === item.day &&
           item.entry !== null;

         if (isHero && item.entry) {
           return (
             <HeroDayCard
               entry={item.entry}
               dayLabel={DAY_LABELS[item.day]!}
               dateLabel={shortDateForDay(currentPlan.week_start, item.day)}
               focusTheme={currentPlan.focus_theme ?? null}
               onSwap={() => setSwapTarget(item.day)}
               onCook={() => setCookTarget(item.day)}
               onSkip={() => setSkipTarget(item.day)}
               onPress={() => {
                 // Same routing as SwipeableDayRow's onPress — saved recipe →
                 // savedDetail modal; otherwise → previewEntry. Inline the
                 // SwipeableDayRow's onPress logic here verbatim (or extract
                 // a `handleEntryPress(entry)` helper above and call it from
                 // both renderers).
                 if (item.entry!.recipe_id) {
                   const cached = cachedRecipes.find(
                     (r) => r.id === item.entry!.recipe_id,
                   );
                   if (cached) { setSavedDetail(cached); return; }
                 }
                 setPreviewEntry(item.entry);
               }}
             />
           );
         }

         return (
           <SwipeableDayRow
             entry={item.entry}
             dayLabel={DAY_LABELS[item.day]!}
             dateLabel={shortDateForDay(currentPlan.week_start, item.day)}
             isSwapping={swappingDay === item.day}
             isCooking={cookingDay === item.day}
             focusTheme={currentPlan.focus_theme ?? null}
             onSwap={() => setSwapTarget(item.day)}
             onCook={() => setCookTarget(item.day)}
             onSkip={() => setSkipTarget(item.day)}
             onPress={() => { /* unchanged — existing onPress body */ }}
             onLongPress={item.entry ? drag : undefined}
             isDragActive={isActive}
           />
         );
       }}
       ```

       PREFER extracting the entry-tap handler into a `handleEntryPress` useCallback
       above the return so both HeroDayCard and SwipeableDayRow share the exact same
       routing (saved → savedDetail; ad-hoc → previewEntry; null → addMealIso). This
       keeps the diff small AND prevents drift if the routing rules change later.

    3. Drag-to-reorder: when a row IS the hero, `onLongPress` is intentionally NOT
       wired (HeroDayCard doesn't accept it). The user reorders by toggling to
       compact mode if they need to drag the hero day. Document this as a comment
       above the renderItem branch so future-Claude doesn't try to "fix" it.

    4. UAT (CLAUDE.md mandate): after the change compiles, run a quick Maestro
       sanity check from the simulator:
       ```
       cd /Users/patrickrichards/DinnerTime/apps/mobile
       maestro test .maestro/smoke.yaml
       ```
       The smoke flow already covers Plan tab navigation + screenshot. If it lands
       green, the wiring is solid. Skip if the simulator isn't booted — the
       automated unit-test verify below is the primary gate; the Maestro pass is
       a bonus regression check.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm test src/components/plan -- --run && pnpm tsc --noEmit -p . 2>&1 | grep -E "(plan\.tsx|settings\.tsx|HeroDayCard|heroTargetPicker)" | (grep -v "error" || true)</automated>
  </verify>
  <done>
    - Settings PLAN section gains a "Detailed plan cards" Switch row that flips planCardDensity.
    - plan.tsx renders HeroDayCard at heroTargetIdx in detailed mode (when entry is non-null) and SwipeableDayRow everywhere else.
    - Compact mode renders SwipeableDayRow for every day, including today.
    - Tap on hero opens the same recipe-detail modal flow as DayRow (savedDetail vs previewEntry).
    - Swipe on hero reveals Swap/Cooked/Clear with the same telemetry as SwipeableDayRow.
    - Drag-to-reorder still works on non-hero rows; hero is intentionally not draggable (documented).
    - No new typecheck errors in plan.tsx, settings.tsx, HeroDayCard.tsx, heroTargetPicker.ts.
    - All previously-green tests in apps/mobile/src/components/plan/ still pass.
  </done>
</task>

</tasks>

<verification>
- All quick-task 9 dayRowHelpers tests still green after the multi-chip rule lands (no regressions in the 23 existing cases — only assertion updates where the new rule legitimately changes the expected count).
- New tests added across heroTargetPicker, HeroDayCard, settingsStore (planCardDensity), and dayRowHelpers (multi-chip rule) all green.
- Settings → Plan section renders the new "Detailed plan cards" Switch row with description copy.
- Density toggle persists across cold start (verified via the rehydration test in Task 1).
- In detailed mode, today's day OR the next un-cooked future day renders as HeroDayCard at its position in the list (NOT pinned to top — keeps day-order rhythm intact).
- In compact mode, every day renders as the existing SwipeableDayRow.
- Tapping HeroDayCard → recipe-detail modal (saved or preview); swiping → Swap/Cooked/Clear with telemetry preserved.
- The 8-key practiced_skills taxonomy from types/recipe.ts is used unchanged. No new keys invented.
- Out of scope (per task_context): backend changes, Recipe detail tweaks, Month view changes, density-toggle telemetry, Maestro flow updates.
</verification>

<success_criteria>
- `useSettingsStore.getState().planCardDensity` defaults to 'detailed', flips via setPlanCardDensity, persists in 'dinnertime-settings' AsyncStorage blob, rehydrates on cold start.
- `deriveStatusChips({ practicedSkills: ['knife skills', 'pan sauces'], focusTheme: 'pan sauces', status: 'planned' })` returns a chip array containing both 'Pan sauces' (warning, sparkles) FIRST and 'Knife skills' (default, sparkles) AFTER, in that order.
- `pickHeroTargetIndex(entries, weekStart, todayIso)` returns the correct index across all 9 documented cases (today-uncooked, today-cooked-then-next-planned, all-cooked-fallback, today-out-of-week clamp, empty-entries, gap-day).
- HeroDayCard renders the hero image (16:9), title, all-skills chips with matched-warm-first, difficulty/time/servings chips, italic skill_note, and dispatches onPress + swipe handlers correctly.
- plan.tsx renderItem branches on planCardDensity + heroTargetIdx and matches the listed acceptance criteria for both modes.
- Test command `cd apps/mobile && pnpm test src/components/plan src/stores/__tests__/settingsStore.test.ts -- --run` passes.
- `pnpm tsc --noEmit` introduces no new errors in any of the files modified by this plan (pre-existing errors in unrelated test files are not in scope).
</success_criteria>

<output>
After completion, create `.planning/quick/7-plan-tab-density-redesign-plancarddensit/7-SUMMARY.md` documenting:
- What shipped (settingsStore field, multi-chip rule, hero target picker, HeroDayCard, plan.tsx wiring, settings.tsx toggle)
- Test counts (existing dayRowHelpers green, new tests added per file)
- Any deviations from this plan (with Rule classification per CLAUDE.md GSD pattern)
- Manual verification done (simulator boot? Maestro smoke? screenshot?)
- Out-of-scope items deferred (telemetry, Maestro flow update, backend)
</output>
