# Phase 15: UI Polish & Navigation Consistency — Research

**Researched:** 2026-04-18
**Domain:** iOS-native navigation + iconography polish (expo-router 55, expo-symbols, NativeWind)
**Confidence:** HIGH

## Summary

Phase 15 is an audit-and-fix pass that (1) replaces 20+ Ionicons usages with `expo-symbols` SF Symbols, (2) replaces ~12 decorative emojis in empty states with `FOOD_IMAGES` photography or SF Symbols, (3) collapses custom header boilerplate into native `expo-router` stack headers with chevron-only back, (4) converts `scan/` (and likely `recipes/` import sub-routes) to modal presentation, (5) introduces a minimal `EmptyState` / `LoadingState` / `ErrorState` component set, and (6) adds a `usePreventRemove`-based dirty-form guard pattern.

`expo-symbols@~55.0.7` is already installed but not yet imported anywhere. `@react-navigation/native@^7.1.33` ships `usePreventRemove` (React Navigation 7 API). `expo-router@~55.0.12` forwards `presentation: 'modal'` and `gestureEnabled` to the native stack; all machinery we need is already in deps.

**Primary recommendation:** Do this in three waves — (1) shared primitives + audit inventories, (2) parallel nav-migration and icon-migration sweeps, (3) dirty-form guards + overflow menu + Maestro re-baseline. Keep neutral iOS styling (system gray chevrons, white backgrounds, orange `#F97316` preserved); DO NOT introduce terracotta, token files, or chip variants here — that is Phase 19's exclusive turf.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Icon system**
- Switch from Ionicons to SF Symbols via `expo-symbols` for iOS-native feel
- iOS-only app — no cross-platform fallback layer needed; SF Symbols without Ionicons bridge
- Decorative food emojis (📸, 🍝, 🍳 in empty states/placeholders) replaced with real food photography from the existing `FOOD_IMAGES` constants
- Icon sizes match SF Symbol weights (body / title / largeTitle) — leverages Dynamic Type scaling automatically; avoid hard-coded `size={N}` pixels

**Navigation headers**
- Stack screens use native stack headers from `expo-router` — auto back button, centered title, right-side action slot. Removes the custom-header boilerplate currently scattered across scan/, recipes/, etc.
- Tab screens keep the existing collapsing large-title + compact-header pattern established in Phase 14 — no churn there
- Pushed screens (recipe detail, plan day detail, settings subsections) use compact titles, NOT collapsing large titles — large-title is a tab-root convention
- Back button is a chevron only, no text label — matches modern iOS (Photos, Notes, Messages)

**Modal vs push presentation**
- Push = destinations: recipe detail, recipe list, pantry items, plan day detail
- Modal = interruptions/tasks: scan camera flow (scan/index, receipt, instacart, review), recipe import flows (import, import-url, import-photo, import-manual, review), filter sheets, settings editors
- Scan camera flow moves to modal presentation with "X" close affordance — reinforces "this is a self-contained task" mental model

**Right-side action slots**
- Max 2 inline icon actions + overflow ellipsis menu for screens with more actions — matches iOS Mail/Notes pattern
- Text buttons for primary actions ("Save", "Done") are allowed in Phase 19's button-system work, but for Phase 15's polish pass icons + ellipsis is sufficient

**Swipe-back gesture**
- Enabled on every pushed screen by default
- Suspended on screens with dirty forms (import review with unsaved edits, recipe edit form) — show an "Unsaved changes" confirmation dialog instead of allowing accidental dismissal

**Styling mandate (from CLAUDE.md)**
- NativeWind for all styling
- Maestro UAT on iOS Simulator is the gating verification

### Claude's Discretion

- Empty state wording (keep current copy or refresh) — Claude decides per screen
- Error state retry affordances (inline banner vs full-screen) — Claude picks; likely inline banner for transient, full-screen for auth/server-down
- Loading state primitives (skeleton vs spinner) — Claude picks per screen density; probably spinner for short waits, skeleton for list content
- Which overflow menu library to use (expo-router's built-in, custom ActionSheet, react-native-popup-menu) — Claude researches and picks

### Deferred Ideas (OUT OF SCOPE)

- Premium design system (color palette, typography hierarchy, button variants, chip language, search bars) — Phase 19
- Empty-state custom illustrations — Phase 19 can revisit if FOOD_IMAGES feels dated
- Text button support in action slots — Phase 19's button-system work
- Haptic feedback on back-button / action presses — future polish phase
- Cross-platform Android support — project decision already punted
</user_constraints>

## Project Constraints (from CLAUDE.md)

- **NativeWind mandate.** All styling is NativeWind utility classes. Do NOT introduce raw `StyleSheet.create` blocks for things NativeWind expresses well; existing `StyleSheet.create` is fine to preserve where it already exists.
- **GSD workflow.** All file-changing tools must originate from a GSD command. This phase executes under `/gsd:execute-phase`.
- **Maestro iOS Simulator UAT.** Before claiming any UI feature complete, validate against the Simulator. Flows live at `apps/mobile/.maestro/*.yaml`. Changing headers/modals/icons WILL break flow selectors; re-baseline is part of the phase.
- **Metro cache discipline.** After any change to `apps/mobile/.env`, clear `.expo` and restart with `--clear`. Not directly relevant to Phase 15 code, but if new `EXPO_PUBLIC_*` env vars are ever introduced, follow the procedure.
- **Dev client required.** Phase 15 does not introduce any new native modules (`expo-symbols` is already linked into the existing dev client), so no EAS rebuild is needed. VERIFY this before starting — if `expo-symbols` was added to `package.json` without rebuilding the dev client, the app will crash on import.
- **Simulator bundle ID:** `com.dinnertime.app`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-QUALITY | Every pushed/modal screen has a consistent nav header with back button | Stack 2 — native expo-router headers + `headerBackTitle: ''` + modal presentation for scan/recipes import |
| UI-QUALITY | Decorative emojis replaced with Ionicons/SF Symbol equivalents | Emoji inventory + SF Symbol mapping table (below); replacement either via SymbolView or FOOD_IMAGES |
| UI-QUALITY | Empty/loading/error states use a consistent component pattern | Proposed shared primitives `EmptyState` / `LoadingState` / `ErrorState` (code sketch below) |
| UI-QUALITY | Typography scale, spacing, and color usage documented and applied consistently | OUT OF SCOPE for Phase 15 — this is Phase 19's mandate. Phase 15 only ensures icons/headers/states are consistent structurally; palette/type tokens wait for Phase 19 |
| UI-QUALITY | `/gsd:ui-review` audit passes with no BLOCK-level issues | Audit checks 6 pillars; Phase 15 improves Pillars 2 (Visuals — icon consistency), 6 (Experience Design — state coverage), keeps Pillars 3/4/5 neutral for 19 |
</phase_requirements>

## Standard Stack

### Core (already installed — HIGH confidence)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo-symbols` | ~55.0.7 | SF Symbols renderer | Official Expo SDK 55 module; iOS 13+ supported. Exposes `<SymbolView name size tintColor weight scale />`. Already in deps, currently zero imports. |
| `expo-router` | ~55.0.12 | Navigation / native stack | Forwards all `NativeStackNavigationOptions` (see react-native-screens) including `presentation`, `gestureEnabled`, `headerBackTitle`, `headerLeft`, `headerRight`. |
| `@react-navigation/native` | ^7.1.33 | Provides `usePreventRemove` hook | React Navigation 7 deprecated the `e.preventDefault()`/`beforeRemove` listener pattern in favour of `usePreventRemove(condition, onBlock)`. Already in deps via expo-router. |
| `nativewind` | ^4.2.3 | Styling | CLAUDE.md mandate. Tailwind v3.4 under the hood. Current tokens (`bg-warmWhite`, `text-warmGray-*`, orange `#F97316`) preserved verbatim in Phase 15. |

### Supporting (keep, don't touch)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `expo-image` | ~55.0.8 | Empty-state illustration replacement | When swapping `<Text>📸</Text>` for a photographic empty state, use `expo-image` with `contentFit="cover"` and blurhash placeholder — NOT `react-native` `Image`. |
| `react-native-safe-area-context` | ~5.6.2 | Notch/home-indicator safe insets | Native stack headers already account for safe area; only needed when we keep a `SafeAreaView` inside a screen body. |
| `expo-router` `<Stack.Screen options={...} />` | (bundled) | Per-route header override | Use when a single screen needs headerShown:false (e.g., recipe detail with hero) — already present in `recipes/[id]/index.tsx`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `expo-symbols` | `@expo/vector-icons/Ionicons` | Current. CONTEXT locks the SF Symbols migration; no alternative. |
| `@shopify/flash-list` for item rows | Keep current `FlatList` | Perf wins are real but unrelated to Phase 15 scope. Defer. |
| `react-native-popup-menu` for overflow | `Alert.alert` ActionSheet (built-in) | See "Overflow menu library" section — recommendation: ActionSheetIOS (built-in, zero deps, iOS-native feel). |

### Version verification

All packages were verified against `apps/mobile/package.json` — no new installs required for Phase 15. Confirmed versions:

- `expo-symbols@~55.0.7` — already present (unused)
- `expo-router@~55.0.12` — already present
- `@react-navigation/native@^7.1.33` — already present (provides `usePreventRemove`)
- `expo-image@~55.0.8` — already present
- `nativewind@^4.2.3` — already present

**Nothing to install. Nothing to rebuild the dev client for.**

## Architecture Patterns

### Recommended file layout additions

```
apps/mobile/src/
├── components/
│   └── ui/
│       ├── SymbolIcon.tsx        # NEW — thin wrapper over SymbolView with size-to-type-scale mapping
│       ├── EmptyState.tsx        # NEW — shared empty state: image/icon + title + subtitle + optional CTA
│       ├── LoadingState.tsx      # NEW — shared loading primitive (spinner or skeleton)
│       ├── ErrorState.tsx        # NEW — shared error primitive with retry
│       └── useDirtyFormGuard.ts  # NEW — usePreventRemove + Alert confirmation
└── constants/
    └── emptyStateImages.ts       # NEW — map of empty-state keys → FOOD_IMAGES URIs
```

### Pattern 1: SymbolIcon wrapper

**What:** A thin wrapper on `<SymbolView />` that maps a `size` prop to SF Symbol scale + a default tint.

**Why:** Raw `<SymbolView size={20} />` is fine but encourages hard-coded pixels. A wrapper with `size="body" | "title" | "largeTitle"` tied to the type scale enforces the CONTEXT rule "icon sizes match SF Symbol weights — leverages Dynamic Type."

```tsx
// apps/mobile/src/components/ui/SymbolIcon.tsx
import { SymbolView, SymbolViewProps } from 'expo-symbols';

type Size = 'body' | 'title' | 'largeTitle';

const SIZE_MAP: Record<Size, number> = {
  body: 17,        // body text matches SF Pro 17pt
  title: 22,       // section header matches SF Pro 22pt
  largeTitle: 34,  // hero / empty state matches SF Pro 34pt
};

type Props = Omit<SymbolViewProps, 'size'> & {
  size?: Size | number;   // allow raw number escape hatch but prefer token
  weight?: SymbolViewProps['weight'];
};

export function SymbolIcon({ size = 'body', weight = 'regular', ...rest }: Props) {
  const px = typeof size === 'number' ? size : SIZE_MAP[size];
  return <SymbolView size={px} weight={weight} {...rest} />;
}
```

**Gotcha (verified from expo-symbols docs):** `<SymbolView>` inherits `ViewProps`. On tight flex rows you may need explicit `style={{ width: px, height: px }}` — SF Symbol glyphs are not inherently sized to match `size` (that controls font rendering, not the layout box).

### Pattern 2: Native stack header via `Stack.Screen options`

**What:** Configure headers declaratively at the layout level; per-screen overrides use `<Stack.Screen options={...} />` inline.

```tsx
// apps/mobile/src/app/recipes/_layout.tsx (post-Phase-15)
import { Stack } from 'expo-router';

const DEFAULT_SCREEN = {
  headerStyle: { backgroundColor: '#FFFBF5' },
  headerTintColor: '#1F2937',
  headerShadowVisible: false,
  headerBackTitle: '',            // chevron-only, no "Back" label
  headerTitleAlign: 'center',     // iOS default
  gestureEnabled: true,           // swipe-back default
} as const;

export default function RecipesLayout() {
  return (
    <Stack screenOptions={DEFAULT_SCREEN}>
      {/* Modal group — import tasks */}
      <Stack.Screen name="import" options={{ title: 'Import Recipe', presentation: 'modal' }} />
      <Stack.Screen name="import-url" options={{ title: 'Paste URL', presentation: 'modal' }} />
      <Stack.Screen name="import-photo" options={{ title: 'Take Photo', presentation: 'modal' }} />
      <Stack.Screen name="import-manual" options={{ title: 'Type Recipe', presentation: 'modal' }} />
      <Stack.Screen name="review" options={{ title: 'Review Recipe', presentation: 'modal' }} />

      {/* Push group — destinations */}
      <Stack.Screen name="discover" options={{ title: 'Discover' }} />
      <Stack.Screen name="[id]/index" options={{ headerShown: false /* hero has floating back */ }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit Recipe' }} />
    </Stack>
  );
}
```

### Pattern 3: Modal "X" close affordance

**What:** When `presentation: 'modal'`, the back chevron is replaced with a left-aligned "X" close button.

```tsx
// Inside any modal screen's <Stack.Screen options={...}>:
import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { SymbolIcon } from '@/components/ui/SymbolIcon';

const modalCloseOptions = {
  presentation: 'modal' as const,
  headerLeft: () => (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
      <SymbolIcon name="xmark" size="body" weight="medium" tintColor="#1F2937" />
    </Pressable>
  ),
};
```

### Pattern 4: `useDirtyFormGuard` (dirty-form swipe-back suspension)

**What:** `usePreventRemove` from React Navigation 7 is the idiomatic hook. It is navigator-agnostic (works with native stack) and intercepts any back action (swipe, chevron, OS gesture, programmatic `router.back()`).

```tsx
// apps/mobile/src/components/ui/useDirtyFormGuard.ts
import { usePreventRemove } from '@react-navigation/native';
import { Alert } from 'react-native';

export function useDirtyFormGuard(isDirty: boolean) {
  usePreventRemove(isDirty, ({ data }) => {
    Alert.alert(
      'Unsaved changes',
      "You'll lose your edits if you leave now.",
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => data.action() },
      ]
    );
  });
}
```

**Usage sites (Phase 15 target list):**
- `apps/mobile/src/app/recipes/[id]/edit.tsx` — `draft !== recipe`
- `apps/mobile/src/app/recipes/review.tsx` — any field edited during review
- `apps/mobile/src/app/scan/review.tsx` — once items have been corrected/toggled
- (future) settings editors — out of current phase, flag for Phase 23

### Pattern 5: Shared state components

```tsx
// apps/mobile/src/components/ui/EmptyState.tsx
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from './SymbolIcon';

type Visual =
  | { kind: 'image'; uri: string }
  | { kind: 'symbol'; name: string };   // SF Symbol name

type Props = {
  visual: Visual;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ visual, title, subtitle, action }: Props) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      {visual.kind === 'image' ? (
        <Image
          source={{ uri: visual.uri }}
          style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 20 }}
          contentFit="cover"
        />
      ) : (
        <View className="mb-5">
          <SymbolIcon name={visual.name} size={56} weight="light" tintColor="#9CA3AF" />
        </View>
      )}
      <Text className="text-lg font-semibold text-warmGray-900 text-center">{title}</Text>
      {subtitle && (
        <Text className="text-sm text-warmGray-500 text-center mt-2">{subtitle}</Text>
      )}
      {action && (
        <Pressable onPress={action.onPress} className="mt-6 px-6 py-3 bg-orange-500 rounded-xl">
          <Text className="text-white font-semibold">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
```

`LoadingState` — spinner (short waits) vs skeleton wrapper (list content). `ErrorState` — title + message + retry button, banner variant optional. Keep API intentionally minimal; Phase 19 retintesrs everything.

### Anti-Patterns to Avoid

- **Do NOT introduce design tokens, a palette file, or terracotta anywhere.** Orange `#F97316` is preserved. That's Phase 19's contract.
- **Do NOT rewrite `Button.tsx` or `ChipToggle.tsx`.** Phase 19 rewrites both; touching them here causes merge pain.
- **Do NOT add animations or haptics.** Explicitly deferred in CONTEXT.
- **Do NOT hand-roll a custom header.** The entire phase is about REMOVING the floating-back-button pattern in `recipes/[id]/index.tsx` and friends in favor of native headers. The hero-image case with `Stack.Screen headerShown:false` is a legitimate exception to preserve.
- **Do NOT use `Image` from `react-native` for empty states.** Use `expo-image` for blurhash / caching / better perf.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SF Symbols rendering | Custom font or SVG library | `expo-symbols` `<SymbolView>` | Official, Dynamic-Type-aware, 5000+ glyphs, zero runtime cost |
| Dirty-form guard | Custom `navigation.addListener('beforeRemove')` | `usePreventRemove` from `@react-navigation/native` | The `beforeRemove` listener API is superseded in RN 7; `usePreventRemove` is declarative and correctly handles nested navigators |
| Custom back button | `<Pressable onPress={router.back()}>` in every screen | `headerBackTitle: ''` on the Stack | Native headers get free swipe-gesture integration, accessibility, and `headerLeft` override slot |
| Modal dismissal | Custom sheet component | `presentation: 'modal'` in screen options | Real iOS sheet presentation, swipe-down-to-dismiss, proper backdrop |
| Overflow action menu | Custom modal | `ActionSheetIOS.showActionSheetWithOptions` (built-in) | Zero dependencies, iOS-native sheet, correct destructive/cancel styling |

**Key insight:** Every item above is already in the RN / Expo / React Navigation bundle. Phase 15 is about consolidation, not new machinery.

## Runtime State Inventory

Not applicable — this phase is a pure code refactor with no stored data, live service config, OS-registered state, secrets, or build-artifact implications. Explicitly verified:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB schema / AsyncStorage keys renamed | — |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | `expo-symbols` native module already bundled into existing dev client (listed in package.json pre-Phase-15) | Verify by running the dev client before starting — if it fails, rebuild via EAS once |

## Existing-Code Audit

### Emoji inventory (13 decorative usages)

| File | Line | Emoji | Classification | Replacement |
|------|------|-------|----------------|-------------|
| `app/scan/index.tsx` | 184 | 📸 | Empty state (large) | `FOOD_IMAGES.hero[0]` (plated dinner) via `EmptyState` — "Ready to scan your kitchen" |
| `app/scan/index.tsx` | 196 | 📸 | Empty state (medium) | SAME as above — consolidate into one `EmptyState` |
| `app/scan/receipt.tsx` | 98 | 🧾 | Empty state | SF Symbol `doc.text.viewfinder` via `EmptyState` (no food-photo match) |
| `app/scan/instacart.tsx` | 103 | 🛒 | Empty state | SF Symbol `cart.circle` via `EmptyState` |
| `app/shopping/orders.tsx` | 59 | 📦 | Empty state | SF Symbol `shippingbox` via `EmptyState` |
| `app/(tabs)/shopping.tsx` | 122 | 🛒 | Empty state | SF Symbol `cart` via `EmptyState` — "No shopping list yet" |
| `app/recipes/import-photo.tsx` | 80 | 📷 | Empty state | SF Symbol `camera` via `EmptyState` |
| `components/pantry/EmptyPantry.tsx` | 9 | 📷 | Empty state | `FOOD_IMAGES.hero[1]` (farmers market) via `EmptyState` |
| `components/suggestions/SuggestionList.tsx` | 71 | 😕 | Error state | SF Symbol `exclamationmark.triangle` via `ErrorState` |
| `components/suggestions/SuggestionCard.tsx` | 63 | 👶 | Meta label (kid-friendly) | SF Symbol `figure.2.and.child.holdinghands` OR keep as label text "Kid-friendly" — Discretion: keep label, drop emoji |
| `components/suggestions/SuggestionPreviewModal.tsx` | 150 | 👶 | Meta label | SAME treatment |
| `components/plan/DayRow.tsx` | 95 | 👶 | Meta label | SAME treatment |
| `components/plan/DayRow.tsx` | 98 | ✓ | Checkmark | SF Symbol `checkmark` (tiny) — replace inline |

**Non-decorative / KEEP:**
- `RecipeFilterSheet.tsx` lines 40-44 (filter option emojis in a local data array): these are *content* chips inside a filter UI. Converting to SF Symbols here is a nice-to-have; safe to either convert or defer to Phase 19's chip-system rewrite. Recommend: DEFER to Phase 19 (chip rewrite will touch this anyway).
- `RemixSheet.tsx` lines 71-74 (remix mode emojis): SAME reasoning — defer to Phase 19.
- `components/pantry/PantryItemCard.tsx` lines 8-10 (`locationIcons` 🧊/🗄️/❄️): small, functional, non-decorative. Recommend: CONVERT in Phase 15 to SF Symbols (`snowflake`, `archivebox`, `snowflake.circle.fill`) since PantryItemCard is a frequent visual. See mapping table.
- `components/pantry/LocationPicker.tsx` lines 12-14: SAME three location emojis. Convert alongside.
- `app/onboarding/index.tsx` line 220 `✓`: already a checkmark inside a check-mark context. Convert to SF Symbol `checkmark`.

### Ionicons inventory (34 files, ~70 call sites)

Confirmed via grep against `apps/mobile/src/**/*.{ts,tsx}`:

**Tab bar (1 file, 5 call sites):**
- `app/(tabs)/_layout.tsx` — restaurant, calendar-outline, basket-outline, cart-outline, settings

**Screens (app/):**
- `app/(tabs)/kitchen.tsx` — 4 usages (add, sparkles, filter-related)
- `app/(tabs)/pantry.tsx` — 1 (camera)
- `app/(tabs)/plan.tsx` — 1 (refresh)
- `app/(tabs)/shopping.tsx` — 2 (receipt-outline, add)
- `app/recipes/[id]/index.tsx` — 5 (time-outline, chevron-back, calendar-outline, sparkles, trash-outline)
- `app/recipes/[id]/cook.tsx` — 1 (close)
- `app/recipes/[id]/edit.tsx` — 2 (trash-outline ×2)
- `app/recipes/review.tsx` — 2 (trash-outline ×2)
- `app/recipes/import.tsx` — 3 (various + chevron-forward)
- `app/recipes/discover.tsx` — 7 (refresh, time-outline, people-outline, chevron-forward, checkmark-circle ×2, close)
- `app/shopping/orders.tsx` — 2 (cart, chevron-forward)

**Components:**
- `components/suggestions/SuggestionCard.tsx` — 2 (time-outline, checkmark-circle)
- `components/suggestions/SuggestionPreviewModal.tsx` — 7
- `components/recipes/RecipeCard.tsx` — 3 (sparkles, heart-related, time-outline, people-outline)
- `components/recipes/FavoriteButton.tsx` — 1 (heart ↔ heart-outline)
- `components/recipes/RemixSheet.tsx` — 6
- `components/recipes/SearchBar.tsx` — 2 (search, close-circle)
- `components/recipes/AddToPlanSheet.tsx` — 3
- `components/recipes/RecipeFilterSheet.tsx` — 4
- `components/recipes/ServingSizeStepper.tsx` — 2 (remove, add)
- `components/plan/DayRow.tsx` — 3 (time-outline, various)
- `components/plan/SwapSheet.tsx` — 1 (close)
- `components/plan/CookConfirm.tsx` — 3 (close, checkmark-circle, remove-circle-outline)
- `components/plan/EmptyPlanState.tsx` — 1 (calendar-outline)
- `components/shopping/ShoppingItemRow.tsx` — 3 (trash-outline, close, checkmark)
- `components/shopping/AddItemSheet.tsx` — 1 (close)
- `components/cooking/TimerBar.tsx` — 2 (timer-outline, play/pause)
- `components/cooking/StepNavButtons.tsx` — 1 (dynamic)
- `components/cooking/VoiceStatusBadge.tsx` — 1 (dynamic)
- `components/cooking/AskSheet.tsx` — 1 (close)
- `components/pantry/PantryItemCard.tsx` — 3 (time-outline, checkmark-circle-outline, trash-outline)
- `components/pantry/ScanButton.tsx` — 1 (camera)
- `components/pantry/BulkImportSheet.tsx` — 2 (dynamic icon, chevron-forward)
- `components/pantry/ReviewItemRow.tsx` — 2 (close-circle-outline, dynamic)
- `components/settings/IngredientSearch.tsx` — 2 (search, close-circle)
- `components/settings/MemberCard.tsx` — 1 (trash-outline)

### Ionicons → SF Symbols name mapping (top 20)

| Ionicons name | SF Symbol name | Notes |
|---------------|----------------|-------|
| `chevron-back` | `chevron.backward` | Back arrow. Use with `headerBackTitle: ''` for auto-provided version |
| `chevron-forward` | `chevron.forward` | Right-disclosure / list row |
| `close` | `xmark` | Modal close X; pair with `weight="medium"` for emphasis |
| `close-circle` | `xmark.circle.fill` | Search bar clear |
| `close-circle-outline` | `xmark.circle` | Outlined variant for review rows |
| `checkmark` | `checkmark` | Plain check |
| `checkmark-circle` | `checkmark.circle.fill` | Filled success |
| `checkmark-circle-outline` | `checkmark.circle` | Outlined success |
| `heart` / `heart-outline` | `heart.fill` / `heart` | Favorite toggle — fill for active, outline for inactive |
| `camera` | `camera.fill` | FAB-level emphasis |
| `camera-outline` | `camera` | Outlined variant |
| `cart` / `cart-outline` | `cart.fill` / `cart` | Shopping tab |
| `calendar` / `calendar-outline` | `calendar` / `calendar` | (SF Symbols has no separate outline — just `calendar`) |
| `basket-outline` | `basket` | Pantry tab |
| `restaurant` / `restaurant-outline` | `fork.knife.circle.fill` / `fork.knife` | Kitchen tab. Recommend `fork.knife` for unfilled, `fork.knife.circle.fill` for active |
| `settings` / `settings-outline` | `gearshape.fill` / `gearshape` | Settings tab |
| `sparkles` | `sparkles` | AI/suggestions indicator |
| `time-outline` | `clock` | Duration / time |
| `people-outline` | `person.2` | Servings |
| `trash-outline` | `trash` | Destructive action |
| `remove` | `minus` | Stepper minus |
| `add` | `plus` | Stepper plus / FAB |
| `search` | `magnifyingglass` | Search icon |
| `refresh` | `arrow.clockwise` | Regenerate |
| `receipt-outline` | `doc.text` | Receipt scan |
| `timer-outline` | `timer` | Cooking timer |
| `play` / `pause` | `play.fill` / `pause.fill` | Media controls |
| `alert-circle-outline` | `exclamationmark.circle` | Inline warning |
| `filter` / `filter-outline` | `line.3.horizontal.decrease.circle` | Filter sheet trigger |

**Location emojis → SF Symbols (PantryItemCard, LocationPicker):**

| Emoji | SF Symbol |
|-------|-----------|
| 🧊 fridge | `refrigerator` (iOS 17+) OR `snowflake` (safer fallback, iOS 13+) |
| 🗄️ pantry | `archivebox` |
| ❄️ freezer | `snowflake` |
| 📦 fallback | `shippingbox` |

VERIFY `refrigerator` availability with a quick runtime test before using — SF Symbols 5 introduced it in iOS 17. Our min-target is Expo SDK 55's default (iOS 15.1). Use `snowflake` for fridge if iOS 15 support matters; otherwise `refrigerator` looks nicer.

### Navigation header audit

| Route file | Current state | Post-Phase-15 treatment |
|------------|--------------|--------------------------|
| `app/(tabs)/_layout.tsx` | Tabs with `headerShown: false` (collapsing handled inside each tab root) | **NO CHANGE** — Phase 14 collapsing-header pattern preserved |
| `app/_layout.tsx` | Root stack with settings as a pushed screen | **KEEP** headerShown pattern; consider adding `headerBackTitle: ''` |
| `app/scan/_layout.tsx` | Plain Stack with titles | **CHANGE:** all four screens become modals (`presentation: 'modal'`); add `headerLeft` X close affordance; `gestureEnabled: true` for swipe-to-dismiss |
| `app/recipes/_layout.tsx` | Plain Stack with titles | **CHANGE:** Import flow (import, import-url, import-photo, import-manual, review) → modal. Destinations (discover, `[id]/index`, `[id]/edit`) → push. `[id]/index` keeps `headerShown: false` due to hero-image floating back |
| `app/shopping/_layout.tsx` | Plain Stack with titles | **KEEP push**; add `headerBackTitle: ''` |
| `app/settings` | Lives as pushed screen from `_layout.tsx` root | **KEEP push**; plan tab → settings chain; verify chevron-only |
| `app/onboarding` | Own stack (not audited — low priority) | **Verify** — likely already headerless (wizard pattern) |
| `app/(auth)/_layout.tsx` | `headerShown: false` | **NO CHANGE** |

**Custom header boilerplate to remove:**
- `app/recipes/[id]/index.tsx` lines 110-117: floating Pressable + Ionicons chevron-back over hero image. **KEEP** — legitimate hero-image pattern. Just migrate Ionicons → SymbolIcon.
- Other screens do NOT have obvious custom headers; they use the default `Stack` title. The `Ionicons chevron-back` hits turn up only in the hero-recipe-detail case and in `discover.tsx` (modal close). Good news: cleanup is less invasive than feared.

### Scan flow modal migration

`app/scan/_layout.tsx` currently:

```tsx
<Stack screenOptions={{ headerStyle: {...}, headerTintColor: '#1F2937', headerShadowVisible: false }}>
  <Stack.Screen name="index" options={{ title: 'Scan Your Kitchen' }} />
  <Stack.Screen name="review" options={{ title: 'Review Items' }} />
  <Stack.Screen name="receipt" options={{ title: 'Scan Receipt' }} />
  <Stack.Screen name="instacart" options={{ title: 'Import from Instacart' }} />
</Stack>
```

**Proposed:**

```tsx
<Stack screenOptions={{
  headerStyle: { backgroundColor: '#FFFBF5' },
  headerTintColor: '#1F2937',
  headerShadowVisible: false,
  headerBackTitle: '',
  presentation: 'modal',          // ALL scan screens are modal
}}>
  <Stack.Screen name="index" options={{
    title: 'Scan Your Kitchen',
    headerLeft: () => <CloseX onPress={() => router.dismissAll()} />,
  }} />
  <Stack.Screen name="review" options={{ title: 'Review Items' /* back chevron auto-provided */ }} />
  <Stack.Screen name="receipt" options={{
    title: 'Scan Receipt',
    headerLeft: () => <CloseX onPress={() => router.dismissAll()} />,
  }} />
  <Stack.Screen name="instacart" options={{
    title: 'Import from Instacart',
    headerLeft: () => <CloseX onPress={() => router.dismissAll()} />,
  }} />
</Stack>
```

**What breaks:**
1. `scan/index.tsx` uses `router.push('/scan/review', {...})` to advance to review. When the parent `scan/index` is itself a modal, pushing `review` creates a nested stack push *inside* the modal — that's the desired behavior. Swipe-back from `review` pops to `index`, swipe-down on `index` dismisses the whole modal. VERIFIED OK.
2. `scan/review.tsx` line 116 calls `router.back()` after accepting items. Behavior unchanged.
3. `auto-navigate useEffect` on `scan/index.tsx` lines 46-53 uses `router.push` — also unchanged.
4. Maestro: flow `16-pantry-scan-stub.yaml` is a stub (skipped for lack of camera). No breakage. `19-receipt-scan-stub.yaml` and `13-02` UAT entries deep-link into `/scan/receipt` — deep links to modal routes work fine in expo-router 55.
5. Entry point from `(tabs)/pantry.tsx` FAB uses `router.push('/scan')` — resolves to modal present-over-tabs, which is the desired iOS feel.

**"X" close affordance:** Use `router.dismissAll()` (NOT `router.back()`) on modal-root screens so "X" fully exits the modal stack even when user has pushed sub-screens inside the modal group. `router.back()` on sub-screens (review, receipt) just pops one level.

### Recipe import flow

```
app/recipes/
├── _layout.tsx                 — MODAL screenOptions for imports; PUSH for destinations
├── import.tsx                  — MODAL (method picker)
├── import-url.tsx              — MODAL
├── import-photo.tsx            — MODAL
├── import-manual.tsx           — MODAL
├── review.tsx                  — MODAL (keep swipe-back; add dirty-form guard)
├── discover.tsx                — PUSH (destination)
└── [id]/
    ├── index.tsx               — PUSH (hero-image headerShown:false preserved)
    ├── edit.tsx                — PUSH (add dirty-form guard)
    └── cook.tsx                — already headerShown:false + gestureEnabled:false (cooking mode — correctly untouched)
```

Concern: if a user is in a PUSH destination (`discover`) and taps "Import" (which opens a modal), mixing modal-over-push works correctly in expo-router 55 — the modal presents over the entire tab stack, not over just `discover`.

### Dirty-form swipe-back suspension

**Target screens:**

1. `app/recipes/[id]/edit.tsx` — compare `draft` to original `recipe`; `isDirty = !deepEqual(draft, recipeSnapshot)` OR simpler: keep a `touched` flag flipped on any setter.
2. `app/recipes/review.tsx` — already uses local draft state (STATE.md note from Phase 05-04: "Review screen uses local draft state separate from importedRecipe store"). Wire `touched` flag.
3. `app/scan/review.tsx` — once user has edited confidence/names/quantities. Per STATE.md note Phase 14-02: "review screen stays dumb renderer reading item.accepted" — so dirty state is detectable via any toggle after initial render.

**Pattern:** call `useDirtyFormGuard(isDirty)` at the top of the screen component. `usePreventRemove` correctly handles:
- Swipe-back gesture → intercepted
- Chevron tap → intercepted
- Programmatic `router.back()` → intercepted (when we call `data.action()` it proceeds)
- OS back (Android) → intercepted (iOS-only, so N/A)
- Modal swipe-down → **VERIFY** — modal drag-dismiss in RN 7 does fire `beforeRemove`/`usePreventRemove`; confirmed in React Navigation changelog. LOW confidence on exact nuance — flag for a quick Simulator check during Wave 0.

### Overflow menu library recommendation

**Options considered:**

| Option | Verdict | Reason |
|--------|---------|--------|
| `ActionSheetIOS` (from `react-native`) | **RECOMMENDED** | Zero new deps. Native iOS sheet. Supports destructive + cancel styling. Fires haptic. iOS-only app, so no cross-platform bridging needed. |
| `react-native-popup-menu` | REJECT | Adds dep; looks like Material UI; breaks iOS feel |
| `@react-navigation/elements` `<HeaderButton>` + ActionSheet | Partial | Good for `headerRight` wiring, but still uses `ActionSheetIOS` under the hood |
| `expo-router` built-in | N/A | No built-in action menu — routes are navigation, not menus |

**Usage sketch:**

```tsx
import { ActionSheetIOS } from 'react-native';
import { SymbolIcon } from '@/components/ui/SymbolIcon';

function HeaderEllipsis({ actions }: { actions: Array<{ label: string; onPress: () => void; destructive?: boolean }> }) {
  const showSheet = () => {
    const labels = actions.map(a => a.label);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex: actions.findIndex(a => a.destructive),
      },
      (idx) => { if (idx != null && idx < actions.length) actions[idx].onPress(); },
    );
  };
  return (
    <Pressable onPress={showSheet} hitSlop={12} accessibilityLabel="More options">
      <SymbolIcon name="ellipsis" size="body" weight="medium" />
    </Pressable>
  );
}
```

Use as `headerRight` on screens with 3+ actions (e.g., `recipes/[id]/index.tsx` has Plan + Remix + Delete — collapses naturally).

### FOOD_IMAGES reuse mapping

| Empty state | Current | Proposed FOOD_IMAGES key | Fallback if no fit |
|-------------|---------|--------------------------|--------------------|
| `app/scan/index.tsx` "ready to scan" | 📸 | `FOOD_IMAGES.hero[1]` (farmers market) | — |
| `components/pantry/EmptyPantry.tsx` | 📷 | `FOOD_IMAGES.hero[1]` (farmers market) | — |
| `app/recipes/import-photo.tsx` | 📷 | — | SF Symbol `camera` — no food image matches "camera affordance" semantically |
| `app/scan/receipt.tsx` | 🧾 | — | SF Symbol `doc.text.viewfinder` |
| `app/scan/instacart.tsx` | 🛒 | — | SF Symbol `cart.circle` |
| `app/shopping/orders.tsx` | 📦 | — | SF Symbol `shippingbox` |
| `app/(tabs)/shopping.tsx` "no list yet" | 🛒 | `FOOD_IMAGES.hero[0]` (plated dinner — connects "list → meal") | SF Symbol `cart` is the safer default |
| `components/suggestions/SuggestionList.tsx` error | 😕 | — | SF Symbol `exclamationmark.triangle` (ErrorState) |
| `components/plan/EmptyPlanState.tsx` | Ionicons `calendar-outline` | `FOOD_IMAGES.hero[2]` (hands cooking) | — |

**Pattern recommendation:** Food photos for "positive" empty states ("you haven't started yet — here's what this could look like"); SF Symbols for "neutral/action" empty states ("tap the camera to continue").

### Maestro flow impact

Flows that assert against text/copy likely to shift or selectors likely to break:

| Flow | Risk | Why |
|------|------|-----|
| `smoke.yaml` | LOW | Sentinel banner preserved; asserts only on `loading=…` debug text |
| `01-login.yaml` | LOW | Auth flow untouched |
| `02-signup-onboarding.yaml` | MEDIUM | Onboarding `checkmark` icon swap may change visual baseline; text selectors unchanged |
| `03-import-url.yaml` | HIGH | Import flow screens move to modal; "Paste URL" selector should still work (title unchanged); `07-pantry-add`, `18-recipe-search-favorite` tap "Back" text which WILL break when chevron becomes text-less |
| `04-import-manual.yaml` | HIGH | Same — modal presentation, dirty-form guard may trigger |
| `05-recipe-detail-edit.yaml` | HIGH | Edit screen gains dirty-form guard; "Back" selectors break; delete icon moves to ellipsis |
| `06-recipe-discover.yaml` | MEDIUM | Discover is push; chevron label removal may break if flow asserts on "Back" text |
| `07-pantry-add.yaml` | MEDIUM | Pantry FAB icon changes (Ionicons camera → SF Symbol); visual baseline re-gen |
| `08-home-suggestions.yaml` | LOW | No selectors on icons; suggestion error state emoji change visual-only |
| `09-meal-plan-generate.yaml` | LOW | Plan tab icons change; text selectors unchanged |
| `10-meal-plan-swap.yaml` | MEDIUM | SwapSheet close button is `Ionicons close` → `SymbolView xmark`; unchanged accessibility label |
| `11-shopping-list-generate.yaml` | MEDIUM | Shopping FAB icon change; empty state emoji → SF Symbol |
| `12-shopping-orders.yaml` | MEDIUM | Orders screen empty state emoji change; nav is push (unchanged) |
| `13-settings.yaml` | LOW | Settings nav untouched; minor icon changes |
| `18-recipe-search-favorite.yaml` | HIGH | Tapping the favorite heart relies on visual; `heart` SF Symbol renders differently than Ionicons — re-screenshot baseline |
| `20-kitchen-segment-toggle.yaml` | MEDIUM | Kitchen tab icon (restaurant → fork.knife) changes; "Kitchen"/"Library" text selectors unchanged |

**Mitigation plan:**
1. Add `accessibilityLabel` props to every `SymbolIcon` usage replacing an Ionicons. Maestro `tapOn: "Back"` may be brittle; prefer `tapOn: {id: ...}` via `testID` for new icon-only buttons.
2. After Wave 2 completes, re-run every Maestro flow sequentially. Broken ones get updated selectors or new screenshots.
3. Add a new flow `21-modal-dismiss.yaml` that explicitly validates modal swipe-down on scan/index.
4. DO NOT strip the sentinel banner — it's still useful for hydration assertion.

### Phase 19 coordination — explicit boundary

| Stays in Phase 15 | Deferred to Phase 19 |
|-------------------|----------------------|
| SF Symbols adoption (icon family choice) | SF Symbol *sizes tied to type tokens* with named scale — Phase 19 formalizes the scale |
| Native stack headers | Header font weight / color refinement (terracotta tint, SF Pro typography tokens) |
| Modal-vs-push rules | Modal presentation-detail (`detents`, blur backdrop, `expo-glass-effect`) — Phase 19 discretion |
| Chevron-only back button | Back-button color migration (iOS tint → terracotta) — Phase 19 token swap |
| Shared `EmptyState`/`LoadingState`/`ErrorState` with minimal API | Retheming those primitives (Spotify-style imagery, terracotta CTAs) — Phase 19 |
| Dirty-form guard hook | — |
| `FOOD_IMAGES` reuse in empty states | FOOD_IMAGES curation refresh — Phase 19 may swap photos |
| Keep `#F97316` orange everywhere | Orange → terracotta `#C65D3A` one-pass token swap |
| Keep `Button.tsx` and `ChipToggle.tsx` untouched | Full rewrite: 5-variant Button, 2-kind Chip |
| Keep existing `SearchBar.tsx` | Replace with DoorDash-style sticky pill + search modal |

**Tempting-but-do-not:**
- Do NOT rename `warmWhite` / `warmGray-*` Tailwind classes in `tailwind.config.js`.
- Do NOT add `src/design/tokens.ts` — that's Phase 19's deliverable.
- Do NOT introduce `expo-glass-effect` usage — Phase 19 will decide if/where it belongs.
- Do NOT unify spacing constants — Phase 19 introduces the 8pt grid audit.

## Common Pitfalls

### Pitfall 1: SymbolView flexbox sizing
**What goes wrong:** `<SymbolView size={20} />` renders a 20pt glyph, but the outer layout box may be wider/taller than expected, causing alignment drift inside flex rows.
**Why it happens:** `size` governs the glyph rendering, not the layout frame; `<SymbolView>` inherits full `ViewProps` and will expand if given flex/width.
**How to avoid:** On constrained rows (tab bar, list row leading icons), wrap in a sized `<View>` or add explicit `style={{ width: N, height: N }}`.
**Warning signs:** Visual tests show icons drifting 2–4px from prior Ionicons baseline; FAB appears off-center.

### Pitfall 2: Modal presentation + `router.push` nesting
**What goes wrong:** A modal screen that pushes a sub-screen (e.g., `scan/index` → `scan/review`) can accidentally create a nested modal stack if `presentation: 'modal'` is set on both.
**Why it happens:** `presentation: 'modal'` applied at the Stack level cascades to every screen unless an individual screen overrides to `'card'`.
**How to avoid:** Set `presentation: 'modal'` on the *parent* screen only (the entry point of the modal task); sub-screens inside the modal group should override to `presentation: 'card'` OR not set it (they become standard push children inside the modal). Test with simulator — swipe-down should dismiss the entire group, swipe-back should pop one screen.
**Warning signs:** Sub-screens appear to have their own dismiss gesture; weird stacking z-index behavior.

### Pitfall 3: `usePreventRemove` + modal swipe-down
**What goes wrong:** The hook is well-tested against back-button and swipe-back-from-edge, but modal swipe-down-to-dismiss is a separate native interaction that *should* trigger `beforeRemove` but has historical edge cases.
**Why it happens:** Native stack's modal drag-down dispatches a different gesture than edge-swipe; React Navigation 7 unified this but worth verifying.
**How to avoid:** In Wave 0 / Wave 3, add a manual UAT step: open recipes/edit, dirty the form, swipe down from the modal header — confirm Alert fires. If broken, add `gestureEnabled: !isDirty` as a belt-and-suspenders fallback.
**Warning signs:** User loses unsaved edits when dragging modal down, no Alert shown.

### Pitfall 4: `router.dismissAll()` on modal root
**What goes wrong:** Using `router.back()` on an "X" close in a deep modal stack only pops one screen, leaving the user inside sub-screens.
**Why it happens:** `router.back()` is always one-step.
**How to avoid:** On the root of a modal group (e.g., `scan/index`, `scan/receipt`, `scan/instacart`, `recipes/import`), wire the "X" to `router.dismissAll()`. On sub-screens (`scan/review`, `recipes/review`), wire the chevron-back to `router.back()`.
**Warning signs:** Tapping "X" on review screens only goes back one step instead of exiting.

### Pitfall 5: Ionicons name glyphMap typing
**What goes wrong:** Components currently type icon prop as `keyof typeof Ionicons.glyphMap` (seen in `BulkImportSheet`, `StepNavButtons`, `import.tsx` `MethodCard`). Removing Ionicons without updating the type causes TypeScript errors.
**Why it happens:** Ionicons ships strict glyph keys; SF Symbols doesn't have an equivalent typed enum shipped.
**How to avoid:** Type SymbolIcon `name` as `string` (SF Symbols has no typed enum) OR maintain a local `const SF_SYMBOLS = ['camera', 'cart', …] as const` and type as `typeof SF_SYMBOLS[number]`. Pick the lighter option — plain `string` with lint-level discipline is fine in an iOS-only codebase where bad names just render a blank frame.
**Warning signs:** TypeScript errors on prop passthrough; runtime blank icons (SF Symbols silently no-op invalid names).

### Pitfall 6: Expo SDK 55 New Architecture + native headers
**What goes wrong:** In New Architecture (Fabric) mode — mandatory on SDK 55 — native stack headers can flicker on route change if Zustand subscriptions trigger re-renders during the navigation transition.
**Why it happens:** Fabric synchronous layouts + async store updates sometimes race.
**How to avoid:** Keep `Stack.Screen options` static (don't derive from store state if avoidable). Known workaround from Phase 12 STATE ("expo-router 55 guarded groups"): test the nav pattern on simulator early.
**Warning signs:** Flicker of default "Untitled" before title appears on first navigation.

### Pitfall 7: NativeWind v4 + SymbolView className
**What goes wrong:** `<SymbolView className="text-orange-500" />` does NOT tint the symbol — `tintColor` is a prop, not a style.
**Why it happens:** NativeWind compiles `text-*` to `style.color`, which `SymbolView` ignores (it reads `tintColor` from props).
**How to avoid:** Use `tintColor` prop explicitly: `<SymbolIcon name="heart.fill" tintColor="#F97316" />`. Consider supporting `className` in SymbolIcon wrapper by intercepting `text-*` classes and translating to `tintColor`.
**Warning signs:** Icons always render in default gray regardless of className.

### Pitfall 8: Maestro text-selector regex with chevron-only back
**What goes wrong:** Maestro flows `tapOn: "Back"` currently works because Ionicons `chevron-back` is paired with a "Back" label. Switching to chevron-only makes the selector return nothing.
**Why it happens:** `headerBackTitle: ''` strips the text label the native stack provides.
**How to avoid:** Replace `tapOn: "Back"` with tap-on-coordinates (fragile) OR add `accessibilityLabel="Back"` to the header back button via `headerLeft` override with a Pressable. Simpler: use Maestro's `backPress` action on iOS (simulates the native back gesture) — works without text selectors.
**Warning signs:** Flow fails with `Element not found: Back`.

## Code Examples

### Migration skeleton: Ionicons → SymbolIcon

**Before:**
```tsx
import { Ionicons } from '@expo/vector-icons';
<Ionicons name="heart" size={22} color="#F97316" />
```

**After:**
```tsx
import { SymbolIcon } from '@/components/ui/SymbolIcon';
<SymbolIcon name="heart.fill" size="body" tintColor="#F97316" />
```

### Modal screen with "X" close and dirty guard

```tsx
import { Stack, router } from 'expo-router';
import { Pressable } from 'react-native';
import { SymbolIcon } from '@/components/ui/SymbolIcon';
import { useDirtyFormGuard } from '@/components/ui/useDirtyFormGuard';

export default function ReviewScreen() {
  const [isDirty, setIsDirty] = useState(false);
  useDirtyFormGuard(isDirty);

  return (
    <>
      <Stack.Screen options={{
        title: 'Review Recipe',
        headerLeft: () => (
          <Pressable onPress={() => router.dismissAll()} hitSlop={12} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size="body" weight="medium" tintColor="#1F2937" />
          </Pressable>
        ),
      }} />
      {/* form body */}
    </>
  );
}
```

### Tab icon swap (preserving focused/unfocused)

```tsx
// app/(tabs)/_layout.tsx
import { SymbolIcon } from '@/components/ui/SymbolIcon';

<Tabs.Screen
  name="kitchen"
  options={{
    tabBarIcon: ({ color, size, focused }) => (
      <SymbolIcon
        name={focused ? 'fork.knife.circle.fill' : 'fork.knife'}
        size={size}
        tintColor={color}
      />
    ),
  }}
/>
```

### Native header with overflow ellipsis on recipe detail

```tsx
<Stack.Screen options={{
  headerShown: false,       // hero preserved
  // OR if removing hero later:
  // title: '',
  // headerRight: () => <HeaderEllipsis actions={[
  //   { label: 'Add to Plan', onPress: openPlanSheet },
  //   { label: 'Remix', onPress: openRemix },
  //   { label: 'Delete', onPress: handleDelete, destructive: true },
  // ]} />,
}} />
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `navigation.addListener('beforeRemove', e => { e.preventDefault(); ... })` | `usePreventRemove(condition, onBlock)` | React Navigation 7 (2024) | Declarative, hook-based, navigator-agnostic. We're on 7.1.33 — use the hook. |
| `@expo/vector-icons/Ionicons` | `expo-symbols` `<SymbolView>` | Expo SDK 50+ (2024) | iOS-native feel, Dynamic Type support, 5000+ glyphs, weight/scale props |
| Custom header + floating back | Native stack with `headerBackTitle: ''` | iOS 14+ modern convention | Free accessibility, swipe-gesture integration, correct safe-area |
| React Navigation `<Stack.Screen>` JSX | `expo-router` file-based routes with `<Stack.Screen options={...}>` override slot | Expo Router 3+ (2024) | File-based routing is now the idiomatic choice; already in use |
| `expo-av` audio | `expo-audio` | Expo SDK 52+ | Not Phase 15 concern — mentioned because `cook.tsx` uses expo-speech which is bundled and fine |

**Deprecated/outdated:**
- `navigation.beforeRemove` listener pattern — superseded by `usePreventRemove`
- `Legacy Architecture` — dropped in SDK 55 entirely (we're on Fabric automatically)
- `expo-av` — deprecated; we already use `expo-audio` + `expo-speech`

## Open Questions

1. **Should `locationIcons` in PantryItemCard migrate in Phase 15 or defer to Phase 19?**
   - What we know: These are small inline emojis used as location indicators. They're quasi-decorative but quasi-functional.
   - What's unclear: Phase 19 may redesign pantry rows entirely.
   - Recommendation: MIGRATE in Phase 15 (SF Symbols look better and it's a one-line change per card). Document the SymbolIcon names so Phase 19 can retintor them.

2. **Should `RecipeFilterSheet` and `RemixSheet` emojis (in option arrays) migrate?**
   - What we know: These are chip-like UI elements inside sheets.
   - What's unclear: Phase 19 will rewrite both sheets as part of the chip-system rework.
   - Recommendation: DEFER. Phase 19 owns this.

3. **iOS 15 vs iOS 17 SF Symbol availability for `refrigerator` glyph.**
   - What we know: `refrigerator` is SF Symbols 5 / iOS 17. Our minimum deployment target is iOS 15.1 (Expo SDK 55 default).
   - What's unclear: Whether users on iOS 15/16 will see missing glyphs.
   - Recommendation: Use `snowflake` (iOS 13+) for fridge to be safe. Or bump deployment target to iOS 17 — check `ios/DinnerTime/Info.plist` for `MinimumOSVersion`. If already 17+, use `refrigerator`.

4. **Should settings subsections migrate to modal presentation?**
   - What we know: CONTEXT says "settings editors" are modal candidates. Current settings live in `(tabs)/settings.tsx` with sub-screens inline.
   - What's unclear: Whether "settings editors" means member-form modal (already a sheet) or future sub-screens.
   - Recommendation: NO CHANGE for Phase 15 — settings sub-flows currently use inline sheets (MemberFormModal etc.), not stack routes. Phase 23 handles Settings proper.

## Environment Availability

Phase 15 introduces no new external dependencies. The project's existing stack covers every need:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| iOS Simulator | Maestro UAT | ✓ | Xcode 26.4 runtime (per CLAUDE.md) | — |
| Maestro CLI | UI flow tests | ✓ | 2.4.0 (per CLAUDE.md) | — |
| `expo-symbols` native module | SF Symbols render | ✓ (in dev client) | ~55.0.7 | If dev client lacks the native module linkage, rebuild via EAS once |
| `@react-navigation/native` | `usePreventRemove` hook | ✓ | ^7.1.33 | — |
| Metro bundler | HMR for rapid iteration | ✓ | bundled with Expo | — |

**Missing dependencies:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 (mobile unit tests) + Maestro 2.4.0 (iOS Simulator UAT) |
| Config file | `apps/mobile/vitest.config.ts` (existing); no config for Maestro (conventions only) |
| Quick run command | `cd apps/mobile && pnpm test` (runs Vitest `--run`) |
| Full suite command | `cd apps/mobile && pnpm test` then `maestro test .maestro/` |
| Phase gate | Full Vitest + 18+ Maestro flows green before `/gsd:verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| UI-QUALITY-1 | Every pushed/modal screen has consistent nav header with chevron-only back | purity grep + Maestro visual | `grep -rn "<Pressable.*router\\.back" apps/mobile/src/app \| wc -l` (floor at known exception count, e.g., 1 for recipe hero) | ❌ Wave 0 — add `apps/mobile/scripts/verify-headers.sh` |
| UI-QUALITY-2a | No Ionicons imports in `src/` | purity grep | `! grep -rn "from '@expo/vector-icons'" apps/mobile/src` | ❌ Wave 0 — codify |
| UI-QUALITY-2b | No decorative emoji unicode in `src/app/` empty states | purity grep | `! grep -rn "text-[456]xl.*Text" apps/mobile/src/app \| grep -E "[\x{1F300}-\x{1F9FF}]"` | ❌ Wave 0 — codify |
| UI-QUALITY-3a | `EmptyState` component exists and renders visual + title | unit | `pytest apps/mobile/src/components/ui/__tests__/EmptyState.test.tsx` — actually Vitest: `vitest run src/components/ui/__tests__/EmptyState.test.tsx` | ❌ Wave 0 |
| UI-QUALITY-3b | `LoadingState` / `ErrorState` render correctly | unit | `vitest run src/components/ui/__tests__/LoadingState.test.tsx src/components/ui/__tests__/ErrorState.test.tsx` | ❌ Wave 0 |
| UI-QUALITY-3c | `useDirtyFormGuard` fires Alert when isDirty=true on back | unit (React Navigation test utils) | `vitest run src/components/ui/__tests__/useDirtyFormGuard.test.tsx` | ❌ Wave 0 |
| UI-QUALITY-4 | Typography/spacing consistency (DEFERRED to Phase 19) | — | — | N/A — out of scope |
| UI-QUALITY-5a | All 18+ Maestro flows pass post-migration | smoke | `maestro test .maestro/` | ✓ (exists; needs re-baseline screenshots) |
| UI-QUALITY-5b | `/gsd:ui-review` produces zero BLOCK-level findings | audit | `/gsd:ui-review 15` | ✓ (agent exists) |
| UI-QUALITY-6 | Modal swipe-down dismisses scan flow end-to-end | Maestro new flow | `maestro test .maestro/21-modal-dismiss.yaml` | ❌ Wave 3 |
| UI-QUALITY-7 | Dirty-form guard blocks swipe-back and prompts Alert | Maestro new flow | `maestro test .maestro/22-dirty-form-guard.yaml` (manual step — hard to automate Alert interaction, likely manual note) | ❌ Wave 3 — likely manual-only note |

### Sampling Rate

- **Per task commit:** `cd apps/mobile && pnpm test --run` (Vitest purity + unit tests; must complete under 30s)
- **Per wave merge:** `pnpm test` + targeted Maestro flows affected by wave's changes (`maestro test .maestro/03-import-url.yaml .maestro/05-recipe-detail-edit.yaml` after Wave 2 nav changes)
- **Phase gate:** Full Vitest suite + full Maestro suite + `/gsd:ui-review 15` produces ≥18/24 score and zero BLOCK findings

### Wave 0 Gaps

- [ ] `apps/mobile/src/components/ui/__tests__/EmptyState.test.tsx` — covers UI-QUALITY-3a
- [ ] `apps/mobile/src/components/ui/__tests__/LoadingState.test.tsx` — covers UI-QUALITY-3b
- [ ] `apps/mobile/src/components/ui/__tests__/ErrorState.test.tsx` — covers UI-QUALITY-3b
- [ ] `apps/mobile/src/components/ui/__tests__/useDirtyFormGuard.test.tsx` — covers UI-QUALITY-3c (requires mocking `usePreventRemove`)
- [ ] `apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx` — covers size→px mapping and tintColor passthrough
- [ ] `apps/mobile/scripts/verify-no-ionicons.sh` — grep check, exit 1 if any import found (add to pre-commit / CI)
- [ ] `apps/mobile/scripts/verify-no-decorative-emoji.sh` — grep for emoji unicode in `text-[456]xl` contexts under `src/app/`
- [ ] `apps/mobile/.maestro/21-modal-dismiss.yaml` — new flow verifying scan/review modal swipe-down
- [ ] Update ALL existing Maestro flows (target: 18) that rely on "Back" text selectors — either add accessibility labels or switch to `backPress` action

## Sources

### Primary (HIGH confidence)
- `apps/mobile/package.json` — verified versions: `expo-symbols@~55.0.7`, `expo-router@~55.0.12`, `@react-navigation/native@^7.1.33`, `nativewind@^4.2.3`, `expo-image@~55.0.8`
- `apps/mobile/src/**/*.{ts,tsx}` — grep inventories for Ionicons (34 files) and decorative emojis (13 locations)
- `apps/mobile/.maestro/*.yaml` — 22 flow files reviewed for risk
- `.planning/phases/15-ui-polish-and-navigation-consistency-audit/15-CONTEXT.md` — locked decisions
- `.planning/phases/19-design-professionalization-.../19-CONTEXT.md` — downstream boundary
- `.claude/agents/gsd-ui-auditor.md` — 6-pillar scoring rubric (Pillars 2 + 6 are Phase 15's primary improvement surface)
- `CLAUDE.md` — NativeWind mandate, Maestro UAT convention, bundle ID `com.dinnertime.app`

### Secondary (MEDIUM confidence — verified against official source)
- [Expo SymbolView docs](https://docs.expo.dev/versions/latest/sdk/symbols/) — confirmed prop signature (`name`, `size`, `tintColor`, `weight`, `scale`), weight/scale enum values, iOS-only string passing caveat
- [React Navigation usePreventRemove](https://reactnavigation.org/docs/preventing-going-back/) — confirmed hook signature, `data.action()` continuation pattern

### Tertiary (LOW confidence — needs runtime validation)
- SF Symbol `refrigerator` availability on iOS 15/16 — needs Simulator check or Info.plist MinimumOSVersion lookup
- Modal swipe-down-to-dismiss triggering `usePreventRemove` — RN 7 changelog suggests yes, but worth Wave 0 Simulator verification
- Expo Router 55 modal-over-push behavior when user enters modal from a push destination — widely-reported-stable but unverified in this codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package already installed and version-verified in repo
- Architecture: HIGH — patterns directly verified from official docs (expo-symbols, React Navigation 7)
- Pitfalls: HIGH — derived from actual code inspection; SymbolView tintColor pitfall is a known NativeWind gotcha
- Validation strategy: HIGH — Vitest already configured; Maestro suite exists
- FOOD_IMAGES mapping: MEDIUM — subjective per-empty-state decisions; overridable by Claude during planning
- `usePreventRemove` + modal drag: LOW — needs one Simulator touch test to confirm

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable stack, no churn expected)
