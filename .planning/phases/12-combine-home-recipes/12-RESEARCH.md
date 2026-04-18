# Phase 12: Combine Home & Recipes — Research

**Researched:** 2026-04-15
**Domain:** React Native navigation / iOS UI pattern consolidation (expo-router tabs, segmented controls, shared collapsing header)
**Confidence:** HIGH

## Summary

This phase is a **pure UI/navigation rationalization** — no new capabilities, no backend changes. Both source screens (`index.tsx` Home and `recipes.tsx` Recipes) are already well-factored around the project's `useCollapsingHeader` hook and reusable sub-components (`SuggestionList`, `SuggestedForYou`, `RecipeCard`, `SearchBar`, `RecipeFilterSheet`, `ImportFab`). The merge is a file-swap plus segment-state plumbing, not a rewrite.

Two material decisions for planning:

1. **Segmented control implementation:** CONTEXT leaves it to Claude's discretion. The project has no existing UISegmentedControl dependency and building a custom Tailwind/Pressable toggle (style-twin of the existing `FILTER_TABS` row in `pantry.tsx` and the Source chips in `RecipeFilterSheet`) is faster and more consistent than pulling in `@react-native-segmented-control/segmented-control`. **Recommendation: custom pressable segmented control**, same visual vocabulary as pantry filter chips.
2. **State preservation between segments:** Use a single screen component with `useState` for `segment`, `searchQuery`, `filters`, `searchOpen`, `filterSheetOpen`, and let each list own its own `Animated.FlatList` scroll state (mounted-but-hidden via `display: none` — NOT unmounted — so scroll position survives a segment toggle). Do not reach for Zustand for this; CONTEXT flags the cross-session-persistence test, and it fails here.

**Primary recommendation:** Build `apps/mobile/src/app/(tabs)/kitchen.tsx` with a segmented control just below the action row, render both lists in the same tree with `display: none` toggling so FlatList preserves scroll position, delete the two old tab files, reorder `_layout.tsx`, and do a mechanical sweep of four `router.replace`/`router.navigate` call sites plus 14 Maestro `.yaml` flows that currently tap `.*Recipes.*` or assert `.*Home.*`/`.*What should we cook tonight.*`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page structure**
- iOS segmented control at the top: [Suggestions] [Library]. Tapping switches which list renders below; no scroll stacking.
- Each segment preserves its own state: Library keeps search query, filter chips, and scroll position when the user switches to Suggestions and back.

**Tab name & default view**
- Tab label: **Kitchen**
- Tab icon: **`restaurant-outline`** from Ionicons (filled `restaurant` for active state)
- Default segment on first load: **Suggestions**
- Tab order in tab bar: **Kitchen, Plan, Pantry, Shopping** (Kitchen leftmost, replacing Home's position)

**Hero & greeting**
- Hero image + greeting ("Hey, {name}! What should we cook tonight?") survives on the **Suggestions segment only**.
- Daily rotating food hero image continues (same `FOOD_IMAGES.hero` pattern).
- When Library is active, header becomes plain collapsing title: **"Kitchen"** + subtitle **"{N} recipes"** (Pantry pattern).
- Greeting copy unchanged — no time-aware variants.

**Action buttons**
- Settings gear: top-right, visible on both segments.
- Import FAB (orange "+") appears **only on Library**. Hidden on Suggestions.
- Regenerate FAB on Suggestions: orange FAB with refresh/sparkle icon that triggers suggestion regeneration. Pull-to-refresh also works as a secondary path.

**Files to delete / modify**
- Delete `apps/mobile/src/app/(tabs)/index.tsx` and `apps/mobile/src/app/(tabs)/recipes.tsx`.
- Create single `apps/mobile/src/app/(tabs)/kitchen.tsx`.
- Update `apps/mobile/src/app/(tabs)/_layout.tsx` (remove both old screens, register `kitchen`, reorder).

### Claude's Discretion

- Exact segmented control component: RN's built-in `SegmentedControlIOS` (removed in RN 0.59+), the community `@react-native-segmented-control/segmented-control`, or a custom `ChipToggle`-based build.
- Whether to keep `SuggestedForYou` (progression-based recipe cards) in Library or migrate to Suggestions — evaluate UX coherence.
- Animation/transition between segments (fade, cross-dissolve, none).
- Regenerate FAB icon choice (`refresh-outline`, `sparkles-outline`, `reload-outline`) and tap feedback.
- Preserving scroll + filter state via Zustand store vs. local component state.
- Whether to add a Maestro flow for the segmented control interaction.

### Deferred Ideas (OUT OF SCOPE)

- Mixed feed with filter chips (rejected in favor of segmented control).
- Time-aware greeting variants.
- Recently-cooked strip on Suggestions.
- Overflow menu for recipe import.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI rationalization (post-v1) | Merge Home and Recipes into a single "Kitchen" tab with segmented control; tab bar drops from 5 to 4. All existing recipe features (import, favorites, search, filters) remain accessible. No orphaned navigation routes. | This research catalogs every existing route reference, every Maestro assertion, and both source screens' reusable parts. Every existing feature in `recipes.tsx` (SearchBar, ChipToggle/RecipeFilterSheet, SuggestedForYou, ImportFab, Discover entry point) survives as-is in the new Library segment. Every feature in `index.tsx` (HeroImage + greeting, SuggestionList with autoFetch, Settings gear) survives on Suggestions. The tab reorder and route-audit tasks close the "no orphaned navigation" criterion. |

## Project Constraints (from CLAUDE.md)

- **Platform:** iOS-first (Expo/React Native). No Android-specific branches needed in Phase 12.
- **AI Provider:** Claude API for all AI. Not relevant to this phase (pure UI).
- **GSD workflow enforcement:** All file changes must go through a GSD command — this phase is the authorization vehicle.
- **UAT (Maestro on iOS Simulator):** Before reporting a UI feature complete, validate with Maestro. Phase 12 MUST update existing Maestro flows that target `.*Recipes.*` / `.*Home.*` / `.*What should we cook tonight.*` and ideally adds one new flow for segment switching.
- **Tailwind/NativeWind** for styling; **Ionicons** for icons; **Zustand** for client state, **React Query** for server state; **expo-router** for navigation. No new dependencies required for this phase (see Standard Stack).
- **Conventions:** new tabs follow the existing collapsing-header pattern (`useCollapsingHeader` + `collapsingHeaderStyles`) — already applied to all five current tabs (commit `a5111a7`).

## Standard Stack

### Core

No new libraries. Everything needed is already installed.

| Library | Version (installed) | Purpose | Why Standard |
|---------|--------|---------|--------------|
| expo-router | ~55.0.12 | Tab registration via `<Tabs.Screen name="kitchen" />` | Already the project's tab system. File-based routing means creating `kitchen.tsx` registers the route automatically. |
| @expo/vector-icons | bundled | `restaurant-outline` / `restaurant` icons | Already used by every tab in `_layout.tsx`. |
| react-native `Animated` | 0.83.4 | FlatList scroll → collapsing-header interpolation | `useCollapsingHeader` hook already implements this. |
| NativeWind | 4.2.3 | Tailwind styling for the segmented control | Matches `ChipToggle` and `FILTER_TABS` patterns. |
| Zustand | 5.0.12 | Existing `suggestionsStore`, `recipeStore`, `progressionStore`, `pantryStore`, `networkStore` | No store changes required. |

### Supporting (already imported by existing screens)

| Component / Hook | Location | Reused By |
|------------------|----------|-----------|
| `useCollapsingHeader` + `collapsingHeaderStyles` | `src/components/ui/useCollapsingHeader.ts` | All five existing tabs — Kitchen will be the sixth consumer but one segment at a time. |
| `SuggestionList` | `src/components/suggestions/SuggestionList.tsx` | Already accepts `HeaderComponent` + `onScroll` props. Drop-in for the Suggestions segment. |
| `HeroImage` | `src/components/ui/HeroImage.tsx` | Used by Home today; keeps the daily food hero. |
| `SearchBar`, `ChipToggle`, `RecipeFilterSheet`, `SuggestedForYou`, `RecipeCard` | `src/components/recipes/` + `src/components/` | All already used by `recipes.tsx`. Port unchanged. |
| `FOOD_IMAGES.hero` daily rotation | `src/constants/foodImages.ts` | Same `new Date().getDay() % …` pattern. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Pressable segmented control | `@react-native-segmented-control/segmented-control` (community, supported by Expo docs) | **Rejected.** Adds a native module → new EAS build needed for the dev client. The project already has two visually-identical custom pill toggles (`pantry.tsx` FILTER_TABS and `RecipeFilterSheet` Source chips). Building a third is 20 lines and ships without a rebuild. |
| Single-screen + `display: none` toggle | Two separate routes `/(tabs)/kitchen/suggestions` + `/(tabs)/kitchen/library` | **Rejected.** Adds a nested stack, flickers on segment change, doesn't preserve scroll for free, and complicates the tab-bar entry. |
| Local `useState` for segment + filters | Zustand `kitchenStore` for cross-session persistence | **Recommended: local state.** CONTEXT's locked behavior is "preserved when user switches to Suggestions and back" — same-session only. Zustand adds a store for no win. Each segment's scroll position stays preserved because both FlatLists remain mounted. |

**Installation:** None. All packages already in `apps/mobile/package.json`.

**Version verification:** Not applicable — no version bumps.

## Architecture Patterns

### Recommended File Layout

```
apps/mobile/src/app/(tabs)/
├── _layout.tsx          # MODIFIED: drop `index` + `recipes`, add `kitchen`, reorder
├── kitchen.tsx          # NEW: unified screen
├── plan.tsx             # unchanged
├── pantry.tsx           # unchanged
└── shopping.tsx         # unchanged

# DELETED
├── index.tsx            # → merged into kitchen.tsx
└── recipes.tsx          # → merged into kitchen.tsx
```

### Pattern 1: Single screen, two rendered lists, `display: none` for the inactive one

**What:** Both `SuggestionList` and the recipes `Animated.FlatList` are instantiated on mount. The inactive one is hidden via `style={{ display: segment === 'suggestions' ? 'flex' : 'none' }}`.

**When to use:** Segmented pages where each segment owns a scrollable list and the user expects scroll position + filter state to survive the toggle.

**Why this over conditional render:** `{segment === 'library' ? <RecipesList/> : <SuggestionsList/>}` unmounts the hidden list → FlatList's internal scroll offset, search input focus, and filter expansion state all reset. `display: none` keeps the tree live, invisible, and non-interactive.

**Example shape:**

```tsx
// Source: pattern combines pantry.tsx FILTER_TABS + recipes.tsx collapsing header + index.tsx SuggestionList
export default function KitchenScreen() {
  const [segment, setSegment] = useState<'suggestions' | 'library'>('suggestions');
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const recipes = useRecipeStore((s) => s.recipes);
  // ...existing Library state: searchQuery, filters, searchOpen, filterSheetOpen
  // ...existing collapsing-header wiring
  const { onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } = useCollapsingHeader();

  const isSuggestions = segment === 'suggestions';
  const titleText = isSuggestions ? `Hey, ${displayName}!` : 'Kitchen';
  const subtitleText = isSuggestions
    ? 'What should we cook tonight?'
    : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`;

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      <Animated.View style={[styles.compactHeader, { opacity: compactHeaderOpacity }]}>
        <Text style={styles.compactTitle}>{isSuggestions ? titleText : 'Kitchen'}</Text>
      </Animated.View>

      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        {!isSuggestions && (
          <>
            <SearchToggleButton … />
            <FilterButton … />
            <DiscoverButton … />
          </>
        )}
        <Pressable onPress={() => router.push('/settings')} …>
          <Ionicons name="settings-outline" … />
        </Pressable>
      </View>

      {/* Segmented control — sits just below the action row, above both lists */}
      <View style={styles.segmentedBar}>
        <Segment active={isSuggestions} label="Suggestions" onPress={() => setSegment('suggestions')} />
        <Segment active={!isSuggestions} label="Library"     onPress={() => setSegment('library')} />
      </View>

      <View style={[{ flex: 1 }, !isSuggestions && { display: 'none' }]}>
        <SuggestionList HeaderComponent={<SuggestionsHeader …/>} onScroll={onScroll} />
      </View>
      <View style={[{ flex: 1 },  isSuggestions && { display: 'none' }]}>
        <Animated.FlatList … />  {/* recipes list identical to current recipes.tsx */}
      </View>

      {!isSuggestions && <ImportFab />}
      { isSuggestions && <RegenerateFab onPress={() => useSuggestionsStore.getState().fetchSuggestions()} />}
      <RecipeFilterSheet … />
    </SafeAreaView>
  );
}
```

### Pattern 2: Custom pressable segmented control (Tailwind)

**Source:** Style-twin of `pantry.tsx` FILTER_TABS (lines 62–82) and `RecipeFilterSheet.tsx` segmented row (lines 158–184).

```tsx
function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 py-2 rounded-lg items-center ${active ? 'bg-orange-500' : 'bg-warmGray-100'}`}
    >
      <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-warmGray-700'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// Container
<View className="flex-row mx-4 mb-2 gap-2">
```

A more iOS-authentic pill-inside-a-track variant is also viable; the above matches existing visual vocabulary.

### Pattern 3: Regenerate FAB on Suggestions

Mirrors `ImportFab` from `recipes.tsx` verbatim (same `#F97316`, 60×60, shadow, `bottom-24 right-24`). Only the icon changes.

```tsx
function RegenerateFab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.fab}>
      <Ionicons name="sparkles" size={28} color="#FFFFFF" />
    </Pressable>
  );
}
```

**Icon choice recommendation:** `sparkles` (already used for the Discover action at `recipes.tsx:296`, so users associate it with "generate new AI content"). Avoid `refresh-outline` which connotes "reload the same data."

### Anti-Patterns to Avoid

- **Conditional render of the two lists** (`{segment === 'library' ? <A/> : <B/>}`) — loses scroll, filter, and search state on every toggle. Breaks the CONTEXT requirement.
- **A Zustand `kitchenStore` for segment + filters** — the state is single-session and belongs in the component. Storing it globally is the wrong persistence scope and adds a store nobody reads elsewhere.
- **Animating segment changes with Reanimated layout transitions** — adds 30+ LOC and a Reanimated shared-value, for a toggle the user perceives as instant. An opacity fade at the list level is fine if desired, but most native apps (iOS Settings, Mail) don't animate segmented-control content changes at all.
- **Registering a new route at `/(tabs)/kitchen/suggestions`** — turns a segment into a screen, flicks the tab bar on switch, defeats state preservation.
- **Keeping `index.tsx`** as a redirect to `kitchen.tsx` — expo-router tabs would show a ghost tab entry unless the `<Tabs.Screen>` for `index` is also removed. Just delete both files and the layout entry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapsing large-title header with fade-in compact bar | A new Animated.Value + scroll interpolator | `useCollapsingHeader()` hook (`src/components/ui/useCollapsingHeader.ts`) | Already solved; used by all five current tabs. |
| Hero image with overlay text | New image component | `HeroImage` (`src/components/ui/HeroImage.tsx`) | Handles overlay + height + daily rotation. |
| Suggestion list with autoFetch + preview modal | New list | `SuggestionList` (`src/components/suggestions/SuggestionList.tsx`) | Already wired to `useSuggestionsStore`, handles loading/error/empty states, and accepts `HeaderComponent` + `onScroll` — designed for this reuse. |
| Filter state management for recipes | New reducer | `RecipeFilterState` + `EMPTY_FILTERS` + `countActiveFilters` from `RecipeFilterSheet.tsx` | Already tuple-of-concerns (favoritesOnly, source, time, pantryOnly) with proven client-side filter pipeline in `recipes.tsx:145-158`. |
| iOS segmented control look | `@react-native-segmented-control/segmented-control` | Custom Pressable pair (Pattern 2) | Avoids native-module dev-client rebuild. Consistency with pantry filter chips. See Alternatives table above. |

**Key insight:** This phase is 90% plumbing. Every UI primitive is already in the codebase. The work is wiring them into a new shell, not inventing anything new.

## Runtime State Inventory

> Applies: this is a refactor that renames routes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no database rows or AsyncStorage keys reference "Home" or "Recipes" tab. `useSuggestionsStore`, `useRecipeStore`, `useProgressionStore` operate on profile IDs and recipe UUIDs, not tab names. | No migration needed. |
| Live service config | **None** — no server-side config references the tab name. | No action. |
| OS-registered state | **None** — the app is iOS-only; deep links are handled by `expo-linking`. Deep link `dinnertime:///settings` (used by flow 13) does not touch tabs. | No action. |
| Secrets / env vars | **None.** | No action. |
| Build artifacts | **expo-router route cache.** Expo Router's file-based routing generates a typed-routes manifest from the filesystem. Deleting `index.tsx` and `recipes.tsx` and adding `kitchen.tsx` invalidates it. Action: restart Metro; if `typed-routes` are enabled, TS will flag the dead `'/(tabs)/recipes'` and `'/(tabs)/'` strings automatically. | Restart Metro after the file swap. Verify the app reloads cleanly in dev client. No reinstall needed. |

**Code references to update (exact list):**

| File | Line | Current | New |
|------|------|---------|-----|
| `apps/mobile/src/app/scan/review.tsx` | 93 | `router.replace('/(tabs)')` | `router.replace('/(tabs)/kitchen')` — post-scan "Get Dinner Ideas" path must land on the Suggestions segment. The default segment IS Suggestions, so no extra param needed. |
| `apps/mobile/src/app/scan/review.tsx` | 87 | `router.replace('/(tabs)/pantry')` | unchanged |
| `apps/mobile/src/app/recipes/import-url.tsx` | 72 | `router.replace('/(tabs)/recipes')` | `router.replace('/(tabs)/kitchen')` — plus: after save, the Library segment should be visible. See Open Question 1 below. |
| `apps/mobile/src/app/recipes/review.tsx` | 56, 145, 157 | `router.replace('/(tabs)/recipes')` | same as above |
| `apps/mobile/src/app/index.tsx` | 13 | `<Redirect href="/(tabs)" />` | unchanged — `/(tabs)` resolves to the first registered tab screen (which will be `kitchen`). |
| `apps/mobile/src/app/onboarding/index.tsx` | 59 | `<Redirect href="/(tabs)" />` | unchanged |
| `apps/mobile/src/app/(auth)/_layout.tsx` | 14 | `<Redirect href="/(tabs)" />` | unchanged |
| `apps/mobile/src/components/suggestions/SuggestionList.tsx` | 112 | `router.navigate('/(tabs)/pantry')` | unchanged |

**CONTEXT.md fidelity note:** CONTEXT says the Regenerate FAB calls `refreshSuggestions()`, but the actual store method is `useSuggestionsStore.getState().fetchSuggestions()`. There is no `refreshSuggestions` in the store. The plan should use `fetchSuggestions()` — the effect is identical (re-fetch against current pantry).

## Common Pitfalls

### Pitfall 1: `/(tabs)` redirects land on the wrong tab

**What goes wrong:** After deleting `index.tsx`, `<Redirect href="/(tabs)" />` resolves to *whichever screen is registered first* in `<Tabs>`. If the reorder in `_layout.tsx` isn't applied atomically with the file deletion, auth flow + onboarding flow can land on `plan` or `pantry` instead of `kitchen`.

**Why it happens:** expo-router tabs pick the first `<Tabs.Screen>` as the default target of the group's index redirect.

**How to avoid:** In the same commit, (a) delete `index.tsx`, (b) delete `recipes.tsx`, (c) add `<Tabs.Screen name="kitchen" …/>` as the first child in `_layout.tsx`, (d) remove the old `index` and `recipes` entries. Verify with Maestro flow 01 (login → lands on "UAT Tester" + "What should we cook tonight?").

**Warning signs:** App opens post-login and shows the Plan tab. Maestro flow 01 fails at `assertVisible text: ".*UAT Tester.*"`.

### Pitfall 2: `scan/review.tsx` "Get Dinner Ideas" flow regresses

**What goes wrong:** Current `scan/review.tsx:93` sets `autoFetch=true` on `useSuggestionsStore` and calls `router.replace('/(tabs)')`. After the merge, `/(tabs)` should resolve to `kitchen.tsx`, which mounts `SuggestionList`, which reads `autoFetch` and triggers `fetchSuggestions()`. If the Suggestions segment isn't the default on a fresh mount, the auto-fetch fires into an unmounted list.

**How to avoid:** Keep Suggestions as the hard-coded default initial state (`useState<'suggestions'|'library'>('suggestions')`). `SuggestionList` must remain mounted when its parent mounts, which it will be under the `display: none` pattern. No special `?segment=suggestions` param needed.

**Warning signs:** Post-scan returns to Kitchen but the dinner ideas never appear.

### Pitfall 3: Recipe save flow lands on wrong segment

**What goes wrong:** `recipes/review.tsx` does `router.replace('/(tabs)/recipes')` after save. After the merge, that becomes `/(tabs)/kitchen`, which defaults to **Suggestions**, not **Library** — so the user saves a recipe and doesn't see it land in their library.

**How to avoid:** Either (a) pass a query param `router.replace('/(tabs)/kitchen?segment=library')` and read it in `kitchen.tsx` via `useLocalSearchParams`, or (b) keep Suggestions as the default but acknowledge the visual gap. **Recommendation: option (a).** Also applies to `recipes/import-url.tsx:72`.

**Warning signs:** Maestro flow 03 (import URL) fails at `assertVisible text: ".*My Recipes.*"` — but note the new Library header is "Kitchen / {N} recipes", not "My Recipes", so that assertion needs updating too.

### Pitfall 4: Maestro flow text assertions break

**What goes wrong:** 14 of 21 Maestro flows contain one of:
- `tapOn: text: ".*Recipes.*"` — used by flows 03, 04, 05, 06, 18 to navigate to the Recipes tab.
- `assertVisible: text: ".*My Recipes.*"` — used by flows 03, 04, 05, 18 to confirm arrival on the Library. Post-merge, the header says "Kitchen / {N} recipes" — "My Recipes" no longer appears.
- `assertVisible: text: ".*What should we cook tonight.*"` — used by flows 01, 08 and is fine (still on Suggestions segment).
- `tapOn: text: ".*Home.*"` — not found in any flow. Safe.

**How to avoid:** Sweep `.maestro/*.yaml` and replace `Recipes` tab taps with `Kitchen` + a follow-up segment tap (`tapOn: text: "Library"`). Replace `.*My Recipes.*` assertions with `.*Kitchen.*` or a more stable marker (e.g., the search bar placeholder `.*Search recipes.*`).

**Warning signs:** `maestro test .maestro/` CI-style run: flows 03, 04, 05, 06, 11, 12, 13, 18, 19 break.

**Full impact list (Maestro flows that tap Recipes tab or assert Recipes UI):**

| Flow | Line | Change needed |
|------|------|---------------|
| `03-import-url.yaml` | 9, 73 | "Recipes" → "Kitchen" + "Library"; "My Recipes" → "Search recipes" or "Kitchen" |
| `04-import-manual.yaml` | 9, 59 | same |
| `05-recipe-detail-edit.yaml` | 11, 16 | same |
| `06-recipe-discover.yaml` | 9, 14 | same |
| `18-recipe-search-favorite.yaml` | 11, 16 | same |
| `08-home-suggestions.yaml` | 1–22 | Screen name unchanged ("Kitchen" tab opens on Suggestions by default); update flow name comment from "home" to "kitchen" (cosmetic). "What should we cook tonight" assertion still passes. |
| `11-shopping-list-generate.yaml` | 21 | `takeScreenshot: 02-home` label is cosmetic — optional rename. |
| `12-shopping-orders.yaml`, `13-settings.yaml`, `19-receipt-scan-stub.yaml` | various | Only cosmetic `takeScreenshot: 02-home` labels. |

### Pitfall 5: Library segment scrolled out of view is invisible to RefreshControl

**What goes wrong:** If the Library's `Animated.FlatList` is `display: none`, its `RefreshControl` cannot be pulled while hidden. But that's fine — the user can only refresh a visible list. However, if the suggestions auto-fetch while Library is active, the Suggestions header can mis-animate because both `onScroll` handlers share `useCollapsingHeader`.

**How to avoid:** Give each segment its own `useCollapsingHeader` instance: `const suggestionsHeader = useCollapsingHeader()` + `const libraryHeader = useCollapsingHeader()`. That way, each list drives its own scroll interpolation and the compact header's opacity matches the *active* segment's scroll position.

**Warning signs:** Switching segments shows the compact bar partially faded — a visual glitch.

### Pitfall 6: `SuggestedForYou` placement creates double context

**What goes wrong:** `SuggestedForYou` (from `progressionStore`) currently renders inside `recipes.tsx` above the RecipeCard list. If you keep it there on the Library segment *and* show the Suggestions segment, the user sees two kinds of suggestions in a tab called "Kitchen" — AI dinner suggestions (pantry-based, immediate) and progression-based recipe suggestions (cook-count-based, aspirational). CONTEXT flags this as Claude's discretion.

**Recommendation:** Keep `SuggestedForYou` in **Library** (unchanged). It's progression-based, recipe-ID-driven, and visually coherent with the RecipeCard list. Moving it to Suggestions would compete with `SuggestionList` and blur the "what to cook from your fridge right now" thesis of that segment.

**Warning signs:** User confusion in UAT ("why are there two suggestion lists?"). Not a hard bug; a UX call.

## Code Examples

### Example: Complete new `_layout.tsx` structure

```tsx
// Source: existing apps/mobile/src/app/(tabs)/_layout.tsx, reordered and re-registered
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/authStore';

export default function TabLayout() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  if (!isLoggedIn) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#F97316',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#FFFBF5', borderTopColor: '#F3F0EB' },
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="kitchen"
        options={{
          headerShown: false,
          title: 'Kitchen',
          tabBarLabel: 'Kitchen',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          headerShown: false,
          title: 'Plan',
          tabBarLabel: 'Plan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          headerShown: false,
          title: 'Pantry',
          tabBarLabel: 'Pantry',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="basket-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shopping"
        options={{
          headerShown: false,
          title: 'Shopping',
          tabBarLabel: 'Shopping',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Example: Reading `?segment=library` to honor post-save redirects

```tsx
// In kitchen.tsx
import { useLocalSearchParams } from 'expo-router';

const params = useLocalSearchParams<{ segment?: 'suggestions' | 'library' }>();
const [segment, setSegment] = useState<'suggestions' | 'library'>(
  params.segment === 'library' ? 'library' : 'suggestions',
);
```

Update the three `router.replace('/(tabs)/recipes')` sites in `recipes/*.tsx` to pass `?segment=library`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two tabs (Home + Recipes) for decision + library | One tab (Kitchen) with segmented control | Phase 12 (this phase) | Tab bar drops 5 → 4, matching the roadmap rationalization goal. |
| `SegmentedControlIOS` (RN core) | Community `@react-native-segmented-control/segmented-control` OR custom pill toggle | RN 0.59 (2019) | RN removed `SegmentedControlIOS`; community module requires dev-client rebuild. Custom pill toggles are the pragmatic modern default for Expo apps. |
| Cook tab | Removed 2026-04-14 (commit `5611f8e`) | Post-v1 polish | Precedent for this phase's tab removal — a tab has been dropped before, and the codebase is known-good after. |

**Deprecated/outdated:**

- `SegmentedControlIOS` from `react-native` — removed entirely; do not import.

## Open Questions

1. **Should recipe-save flows land on Library?**
   - What we know: Current `recipes/review.tsx:145,157` and `recipes/import-url.tsx:72` do `router.replace('/(tabs)/recipes')` post-save. The user's mental model after saving is "I want to see my new recipe in the library."
   - What's unclear: Whether the explicit `?segment=library` param is worth the extra plumbing vs. accepting that users see Suggestions and tap Library themselves.
   - Recommendation: **Implement `?segment=library`.** It's ~5 lines (param read + param pass) and preserves the existing "tap save → see new recipe" expectation.

2. **`SuggestedForYou` placement**
   - Recommendation stated above: **keep on Library** (unchanged from today). Document the call in the plan so the decision is visible.

3. **Maestro coverage for segmented control**
   - CONTEXT marks this as Claude's discretion. Recommendation: **yes, add one small flow** (`20-kitchen-segment-toggle.yaml`) that taps Library, asserts `Search recipes` placeholder visible, taps Suggestions, asserts `What should we cook tonight` visible. 20 lines, catches any future regression where the segment state desynchronizes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK 55 dev client | All mobile work | ✓ | 55.0.14 | — |
| Maestro CLI | UAT verification | ✓ | 2.4.0 (per CLAUDE.md) | — |
| iOS Simulator (iPhone 17 Pro) | UAT target | ✓ | iOS 26.4 | — |
| Metro bundler | Hot reload | ✓ | bundled | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

This phase adds no new external dependencies. Existing toolchain covers everything.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (mobile) + Maestro 2.4.0 (iOS UAT) |
| Config file | `apps/mobile/vitest.config.ts` + `apps/mobile/vitest.setup.ts` |
| Quick run command | `cd apps/mobile && npm test` |
| Full suite command | `cd apps/mobile && npm test` followed by `cd apps/mobile && maestro test .maestro/` |

**Important:** `apps/mobile/vitest.config.ts` line 12 excludes `src/components/**` — so component-level unit tests are NOT run. Screen tests (under `src/app/`) and store tests (under `src/stores/`) ARE run. For this phase, the meaningful automated tests are (a) an optional `kitchen.test.tsx` screen test (if included, would need the exclude list updated) and (b) Maestro flows.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-12-a | Tab bar shows 4 entries: Kitchen, Plan, Pantry, Shopping (in order) | Maestro smoke | `maestro test .maestro/01-login.yaml` (add tab-count assertion) | ❌ Wave 0 — update flow 01 |
| UI-12-b | Login lands on Kitchen → Suggestions segment → "What should we cook tonight?" visible | Maestro | `maestro test .maestro/01-login.yaml` | ✅ (existing assertion still passes) |
| UI-12-c | Kitchen tab Library segment shows recipe list with search + filters | Maestro | `maestro test .maestro/18-recipe-search-favorite.yaml` (after rewrite) | ❌ Wave 0 — rewrite flow 18 |
| UI-12-d | Import URL flow returns to Kitchen/Library and shows imported recipe | Maestro | `maestro test .maestro/03-import-url.yaml` (after rewrite) | ❌ Wave 0 — rewrite flow 03 |
| UI-12-e | Post-scan "Get Dinner Ideas" autoFetch still fires and renders suggestions | Maestro | `maestro test .maestro/08-home-suggestions.yaml` (rename + verify) | ❌ Wave 0 — verify flow 08 |
| UI-12-f | Segment toggle preserves search query + filter state on Library | Maestro | new `20-kitchen-segment-toggle.yaml` | ❌ Wave 0 — new flow |
| UI-12-g | No orphaned routes: `/(tabs)/recipes` and old `/(tabs)` index point nowhere broken | Manual/grep | `grep -r "(tabs)/recipes" apps/mobile/src` returns zero results post-change | ❌ Wave 0 — grep audit task |
| UI-12-h | FAB present on Library only (not Suggestions) | Maestro | new flow 20 + existing flow 03 | covered by UI-12-f |

### Sampling Rate

- **Per task commit:** `cd apps/mobile && npm test` (Vitest — store/screen unit tests).
- **Per wave merge:** same Vitest suite + `cd apps/mobile && maestro test .maestro/01-login.yaml .maestro/03-import-url.yaml .maestro/08-home-suggestions.yaml .maestro/20-kitchen-segment-toggle.yaml` (smoke subset).
- **Phase gate:** Full Vitest green + full Maestro sweep (`maestro test .maestro/`) green before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml` — new flow: tap Library, assert `Search recipes` placeholder visible; tap Suggestions, assert `What should we cook tonight` visible; verify FAB icon changes (optional screenshot). Covers UI-12-f.
- [ ] Update `apps/mobile/.maestro/03-import-url.yaml` — replace `Recipes` tab tap with `Kitchen` + `Library`; replace `My Recipes` assertion with `Search recipes` or `Kitchen`.
- [ ] Update `apps/mobile/.maestro/04-import-manual.yaml` — same rewrite as 03.
- [ ] Update `apps/mobile/.maestro/05-recipe-detail-edit.yaml` — same rewrite.
- [ ] Update `apps/mobile/.maestro/06-recipe-discover.yaml` — same rewrite.
- [ ] Update `apps/mobile/.maestro/18-recipe-search-favorite.yaml` — same rewrite.
- [ ] Update `apps/mobile/.maestro/08-home-suggestions.yaml` — rename flow title "08 — kitchen: suggestions segment renders after login"; assertions still pass.
- [ ] Cosmetic `takeScreenshot: 02-home` label rename in 11, 12, 13, 19 (non-blocking; can defer).
- [ ] Optional: `apps/mobile/src/app/(tabs)/__tests__/kitchen.test.tsx` — would require removing `src/components/**` from Vitest's exclude OR placing the test under `src/app/`. Since `src/app/**` tests are included, this is viable. Recommended scope: segment state persistence (render, toggle, assert Library state survives switch back). If included, the `src/components/**` exclude doesn't affect it.

## Sources

### Primary (HIGH confidence)

- Codebase: `apps/mobile/src/app/(tabs)/index.tsx`, `recipes.tsx`, `_layout.tsx`, `pantry.tsx` — direct read.
- Codebase: `apps/mobile/src/components/suggestions/SuggestionList.tsx`, `apps/mobile/src/components/ui/useCollapsingHeader.ts`, `apps/mobile/src/components/SuggestedForYou.tsx`, `apps/mobile/src/components/recipes/RecipeFilterSheet.tsx`, `apps/mobile/src/components/ui/ChipToggle.tsx` — direct read.
- Codebase: all 20 `apps/mobile/.maestro/*.yaml` flows — scanned for Home/Recipes references.
- Codebase: `apps/mobile/package.json` — confirms no SegmentedControl package installed; existing stack sufficient.
- Codebase: `apps/mobile/vitest.config.ts` — test framework + exclude list verified.
- CLAUDE.md project instructions and stack recommendations.
- CONTEXT.md (phase 12) locked decisions.
- STATE.md post-v1 polish log — confirms precedent for tab removal (Cook tab, commit `5611f8e`).

### Secondary (MEDIUM confidence)

- [Expo Docs — @react-native-segmented-control/segmented-control](https://docs.expo.dev/versions/latest/sdk/segmented-control/) — confirms library requires custom dev client and supports Expo SDK 55.
- [GitHub — react-native-segmented-control/segmented-control](https://github.com/react-native-segmented-control/segmented-control) — confirms package is the current community standard; maps to UISegmentedControl on iOS.
- [Expo SDK 55 Changelog](https://expo.dev/changelog/sdk-55) — confirms SDK 55 is current, RN 0.83, React 19.2 bundled.

### Tertiary (LOW confidence)

- None. All claims in this document are backed by direct codebase reads or official Expo documentation.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — no new libraries; every component already installed and in active use. Verified by package.json + direct grep.
- Architecture: **HIGH** — pattern is "same as today's two screens, composed together"; the `useCollapsingHeader` hook and `SuggestionList`'s existing `HeaderComponent`/`onScroll` props were purpose-built for this reuse.
- Pitfalls: **HIGH** — every enumerated pitfall is tied to a specific file:line in the current codebase; nothing speculative.
- Validation: **HIGH** — Maestro is the project's enforced UAT path per CLAUDE.md; the gap list maps 1:1 to existing flows.

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days — no fast-moving dependencies; the only time-sensitive piece is the Expo SDK cadence, which releases three times/year).
