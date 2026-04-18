# Phase 12: Combine Home & Recipes - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Merge the existing Home tab (greeting + AI dinner suggestions) and Recipes tab (library, search, filters, import) into a single unified "Kitchen" tab with a segmented control (Suggestions | Library). Tab bar reduces from 5 to 4 tabs. No new capabilities — all existing functionality preserved.

</domain>

<decisions>
## Implementation Decisions

### Page structure
- **iOS segmented control** at the top: [Suggestions] [Library]
- Tapping switches which list renders below; no scroll stacking
- Each segment preserves its own state: Library keeps search query, filter chips, and scroll position when the user switches to Suggestions and back (matches iOS Mail/Settings conventions)
- **SuggestedForYou (progression-based) placement:** Claude's discretion during planning — evaluate whether it's coherent in Library or should migrate to Suggestions

### Tab name & default view
- Tab label: **Kitchen** (new identity for the unified tab)
- Tab icon: **`restaurant-outline`** from Ionicons (filled `restaurant` for active state)
- Default segment on first load: **Suggestions** (aligns with app's core thesis "open the fridge, get dinner ideas")
- Tab order in tab bar: **Kitchen, Plan, Pantry, Shopping** (Kitchen leftmost, replacing Home's position)

### Hero & greeting
- Hero image + greeting ("Hey, {name}! What should we cook tonight?") survives on the **Suggestions segment only**
- Daily rotating food hero image continues (same `FOOD_IMAGES.hero` pattern as today)
- When user switches to Library segment, the header becomes a plain collapsing title: **"Kitchen"** with subtitle **"{N} recipes"** (matches Pantry tab pattern of "Pantry" / "{N} items")
- Greeting copy unchanged — no time-aware variants

### Action buttons placement
- **Settings gear** stays in the top-right of the Kitchen tab, visible regardless of active segment (same spot as today's Home tab)
- **Import FAB** (orange "+" for adding recipes) appears **only when the Library segment is active**. Hidden on Suggestions.
- **Regenerate FAB** on the Suggestions segment: orange FAB with refresh/sparkle icon that triggers `refreshSuggestions()`. Pull-to-refresh also works as a secondary path. More discoverable for new users than gesture-only.

### Claude's Discretion
- Exact segmented control component: React Native's built-in `SegmentedControl` vs. a custom styled `ChipToggle` — choose based on iOS fidelity vs. consistency with existing `ChipToggle` component
- Whether to keep `SuggestedForYou` (progression-based recipe cards) in Library or migrate to Suggestions — evaluate based on UX coherence during planning
- Animation/transition between segments (fade, cross-dissolve, none)
- Regenerate FAB icon choice (`refresh-outline`, `sparkles-outline`, `reload-outline`) and tap feedback
- Preserving scroll+filter state via Zustand store vs. local component state
- Whether to add a Maestro flow for the segmented control interaction

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/mobile/src/app/(tabs)/index.tsx` — current Home tab: hero image, greeting, `<SuggestionList>`, settings gear, collapsing header
- `apps/mobile/src/app/(tabs)/recipes.tsx` — current Recipes tab: collapsing header, `SearchBar`, `ChipToggle`, `RecipeFilterSheet`, `SuggestedForYou` section, `FlatList<RecipeCard>`, `ImportFab`
- `useCollapsingHeader` hook + `collapsingHeaderStyles` — shared header pattern across tabs; both new segments can reuse this
- `HeroImage` component — renders the daily food image with overlay text
- `ChipToggle` component — existing filter chip pattern, candidate for building the segmented control
- `SuggestionList`, `RecipeFilterSheet`, `SuggestedForYou`, `RecipeCard`, `SearchBar` — all imported into the Kitchen tab as-is
- `router.push('/settings')` and `router.push('/recipes/import')` navigation targets unchanged

### Established Patterns
- Collapsing large-title header with animated compact header fade-in (Phase 14 polish)
- Orange FAB (`#F97316`, 60×60, shadow) for primary contextual action (Phase 14)
- Pantry-aware filtering via `pantryNames` Set (existing in recipes.tsx)
- Segmented state preserved via Zustand where cross-session persistence matters; local useState for ephemeral UI state
- Tab registration in `apps/mobile/src/app/(tabs)/_layout.tsx` — one `<Tabs.Screen name="..." />` per tab

### Integration Points
- Delete `apps/mobile/src/app/(tabs)/index.tsx` and `apps/mobile/src/app/(tabs)/recipes.tsx` — replaced by single `kitchen.tsx`
- Update `apps/mobile/src/app/(tabs)/_layout.tsx` to remove both old screens and register `kitchen` (and reorder: Kitchen, Plan, Pantry, Shopping)
- `router.push('/')` calls elsewhere in the app (if any) need to point at `/(tabs)/kitchen` instead
- Deep links / routes that referenced `/recipes` need audit (e.g., post-scan auto-navigation in `scan/review.tsx` uses `router.replace('/(tabs)')` — verify it still lands correctly)
- Maestro flows referencing Home or Recipes tabs need updates

</code_context>

<specifics>
## Specific Ideas

- Segmented tabs preview the user liked: `[ Suggestions ] [ Library ]` with the active segment underlined, mirroring iOS-native segmented controls
- Retaining greeting warmth ("Hey, Patrick!") on Suggestions while keeping Library scannable
- Kitchen metaphor: this tab is the "home base" for all cooking decisions — what to cook (Suggestions) and what you know how to cook (Library)

</specifics>

<deferred>
## Deferred Ideas

- Mixed feed with filter chips (rejected in favor of segmented control)
- Time-aware greeting variants (deferred — adds complexity)
- Recently-cooked strip on Suggestions (deferred — can add later if suggestions feel thin)
- Overflow menu for recipe import (deferred — FAB is more discoverable)

</deferred>

---

*Phase: 12-combine-home-recipes*
*Context gathered: 2026-04-18*
