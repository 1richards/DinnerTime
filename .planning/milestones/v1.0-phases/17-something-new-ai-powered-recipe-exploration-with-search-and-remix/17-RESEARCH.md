# Phase 17: "Something New" — AI Recipe Exploration — Research

**Researched:** 2026-04-20
**Domain:** Mobile UX rewire (Kitchen tab Suggestions segment) + server AI search endpoint + Zustand persist extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Segment rename**
- "Suggestions" segment label → **"Something New"** in `kitchen.tsx` segmented control
- Accessibility label updates to "Something New segment"
- Persisted zustand segment value `'suggestions'` stays as the key (rename is cosmetic only — no migration needed)

**Search entry UX**
- Reuse the Phase 19 StickySearchPill → /search modal pattern. Consistent with Recipe Box's search on the adjacent segment.
- Pill sits at the top of the Something New segment, placeholder text TBD during planning (candidates: "What are you craving?", "Search dinner ideas…")
- Tap pill → opens existing `/search` modal with a new context mode (e.g., `?context=something-new`) that routes the query through the AI-generation pipeline instead of the Recipe Box full-text search
- Submitting a query dismisses the modal and lands the user back on Something New with results rendered as cards

**Result presentation + primary tap**
- Keep preview-first pattern already shipped in `apps/mobile/src/app/recipes/discover.tsx`
- Card tap → existing preview modal → "Save to Library" OR "Remix"
- No behavioral change to card internals — Phase 17 wires discover-style results into the Something New segment
- Swipe actions / tap-to-remix-direct were explicitly rejected (preview-first is the safer, already-built path)

**"From the pantry" filter**
- Binary toggle. Switch ON = AI is prompted to return only recipes that are 100% feasible from the user's current pantry
- Implementation: pass pantry-manifest to the generation prompt; constrain the prompt; no client-side filtering needed
- Match-% badges and threshold sliders explicitly rejected
- Toggle is a pill-style control somewhere visible on the segment (exact placement is Claude's discretion during planning)

**Persistence + empty landing**
- Return user to their last search results when they land on the segment with no active query
- Recent-query chips render at the top of the segment as tappable shortcuts — tap replays the query
- Recent query list = last N (N to be decided during planning; suggested default: 5) deduplicated, most-recent first
- Clear-history control lives in the ellipsis overflow menu (consistent with FAB relocation)
- First-time user (no history, no results): search pill with hint copy, no card area

**Sparkles FAB disposition**
- Regenerate action moves to the ellipsis overflow menu on the Something New segment
- Consistent with Phase 15's pattern of relocating secondary actions to header-ellipsis menus
- Overflow menu items (initial set): Regenerate from pantry, Clear search history
- FAB slot on the segment either stays empty or hosts the search pill only — no floating regenerate button

### Claude's Discretion
- Exact pill placeholder copy
- Exact chip styling / spacing / max visible count on landing
- Loading skeleton for AI generation
- Error states (AI failure, pantry query failure)
- Exact context-mode parameter name passed to /search modal
- Whether recent query chips are horizontal scroll or wrap
- Whether preview modal CTA reads "Save to Library" or adopts the updated "Recipe Box" copy

### Deferred Ideas (OUT OF SCOPE)
- Match-percentage badges on cards — if binary promise feels too restrictive after beta feedback, revisit as a future enhancement.
- Tap-to-remix direct — rejected in favor of preview-first. Revisit if preview modal friction drops save/remix rates post-beta.
- Surprise-me FAB variant — user chose overflow menu instead.
- Recipe corpus expansion / cuisine fine-tuning — investor brief roadmap item; different phase (post-beta or Phase 24b vision-quality work).
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 17 is a post-v1 UX phase; it maps to the ROADMAP entry "Suggestions UX reimagining (post-v1)" rather than a checklist row in REQUIREMENTS.md. The six success criteria from the phase description are the requirement set.

| ID | Description | Research Support |
|----|-------------|------------------|
| P17-01 | Suggestions segment renamed to "Something New" | Exact code location identified: `apps/mobile/src/app/(tabs)/kitchen.tsx:146-186` (SegmentedControl). Zustand persistence key (`'suggestions'`) survives — only label + accessibilityLabel change. Maestro flow `20-kitchen-segment-toggle.yaml:77` currently asserts `.*Suggestions.*` and must be rebased to `.*Something New.*`. |
| P17-02 | Landing shows persisted previous results (no blocking empty-state FAB) | Pattern: extend `suggestionsStore.ts` with `persist` middleware + `partialize` keeping `searchResults`, `recentQueries`, `lastQuery`, `pantryOnly`. See `preferencesStore.ts` + `pantryStore.ts` for canonical two-field partialize + `version` + `migrate` pattern. |
| P17-03 | User types keywords in search bar to explore AI-generated recipe ideas | `StickySearchPill` with `context="something-new"` already typed in `SearchBar.tsx:22` (`SearchContext` union). `/search` modal (`apps/mobile/src/app/search.tsx`) is a placeholder — Phase 17 is its first real consumer. |
| P17-04 | "From the pantry" filter toggle restricts results to pantry-feasible recipes | Server-side enforcement: extend `recipeDiscovery.ts::buildDiscoveryPrompt` with an optional `pantryManifest: string[]` parameter. The adjacent service `suggestions.ts::buildSuggestionPrompt` already embeds a pantry manifest for pantry-grounded prompting — reuse that pattern verbatim. |
| P17-05 | Tap-to-remix on any result opens existing remix/edit flow with save-to-Recipe Box | Existing `PreviewSheet` in `discover.tsx:258-365` already has a "Save to Library" CTA. Add a "Remix" CTA that opens `RemixSheet` with `source={{kind:'inline', context: { title, description, ingredients, total_time_minutes }}}`. `RemixSheet` already supports the `'inline'` source shape (`RemixSheet.tsx:36-37`). |
| P17-06 | Sparkles regenerate FAB is replaced or repositioned so it doesn't feel like the only entry point | Replace the inline `<RegenerateFab />` render in `kitchen.tsx:468` with a `<HeaderEllipsis>` in the Something New action row. `HeaderEllipsis` primitive lives at `apps/mobile/src/components/ui/HeaderEllipsis.tsx` and is already consumed by `recipes/[id]/index.tsx:126` (three-action menu: Add to Plan / Remix / Delete). Copy that shape verbatim. |

All six criteria are implementable with existing primitives. No new library, no new native module, no migration.
</phase_requirements>

## Summary

Phase 17 is a **rewiring phase, not a new-tech phase.** Every component the user needs already ships on `main`:

- The search pill → modal flow is live (`StickySearchPill` + `/search?context=library` works end-to-end; `context` accepts `'something-new'` in the `SearchContext` union already).
- The preview-first card interaction is live and battle-tested on `recipes/discover.tsx`.
- The RemixSheet accepts inline (unsaved) context for save-as-recipe.
- The `HeaderEllipsis` overflow primitive is shipped and consumed in recipe detail.
- The server `recipeDiscovery.ts` service already generates full `ParsedRecipe[]` with preferences-aware prompts; extending its prompt with a pantry manifest + a `pantryOnly` option is ~20 lines of additive code.

The real planning work is **orchestration, not invention:**
1. Build a `/search` modal content branch for `context=something-new` with a text input + pantry toggle + submit that calls the new/extended discovery endpoint and lands results back in `suggestionsStore`.
2. Extend `suggestionsStore` with persisted `searchResults`, `recentQueries`, `pantryOnly`, and new actions `searchRecipes(query, options)` + `clearHistory()`.
3. Rebuild the Something New segment's header to render (a) sticky pill, (b) recent-query chip strip, (c) pantry-only pill toggle, (d) results cards with preview.
4. Swap the `<RegenerateFab />` for a `<HeaderEllipsis>` hosting "Regenerate from pantry" + "Clear search history."
5. Extend the server: either add `POST /api/v1/recipes/search` (cleaner) or add `query` + `pantryOnly` params to `POST /api/v1/recipes/discover`. Research recommends the former (keeps discover stable as a zero-input RECP-10 flow; a new endpoint makes the wire contract and tests self-contained).

**Primary recommendation:** Ship in a single fine-granularity phase with ~4 plans (1 server, 1 store, 1 UI, 1 UAT). No dev-client rebuild needed (no native modules, no new config plugins).

## Standard Stack

### Core (already installed — no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.12 | Client state + persist middleware | Repo standard for ALL stores. Phase 17's `suggestionsStore` extension uses the same `persist(..., { partialize, version, migrate })` shape from `pantryStore.ts`, `preferencesStore.ts`. |
| @react-native-async-storage/async-storage | (bundled by pnpm) | Persist backend for Zustand | Only AsyncStorage adapter in use; globally mocked in `vitest.setup.ts` so tests don't need per-file setup. |
| expo-router | bundled with SDK 55 | Modal route `/search` + back-nav | `/search` is declared as `presentation: 'modal'` in `_layout.tsx:59-66`. Phase 17 reuses that stack entry. |
| expo-symbols | (bundled) | SF Symbols via `SymbolIcon` / `SymbolView` | Phase 19 / Phase 15 shipped this — all new icons must use it. Ionicons is forbidden in `src/app/**`. |
| @anthropic-ai/sdk / @google/genai | (server) | AI clients via `getClientFor('recipe.discovery')` | Already plumbed. Phase 17 adds NO new task routes — `recipe.discovery` already routes to Gemini 3 flash (`taskRouting.ts:37`). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.x | Server state caching | **Avoid for Phase 17.** Repo uses Zustand-owned fetch for server data (only `usePreferences.ts` consumes react-query). A new RQ boundary here would be out of step with adjacent stores (`suggestionsStore`, `recipeStore`, `mealPlanStore`, `shoppingStore`, `progressionStore`, `pantryStore`). Use Zustand actions + manual fetch (pattern verbatim from `suggestionsStore.fetchSuggestions`). |

### Alternatives Considered (and rejected for Phase 17)

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Extending `suggestionsStore` | New `somethingNewStore` | Rename cost outweighs benefit. Segment value `'suggestions'` already persists under the existing key; a new store would introduce a second persist namespace for the same surface. |
| Extending `POST /recipes/discover` | New `POST /recipes/search` | **New endpoint is recommended.** `/discover` is the RECP-10 zero-input library-discovery path tested by `06-recipe-discover.yaml` + `routes/__tests__/recipes.discover.test.ts`. A separate `/recipes/search` route: (a) doesn't mutate a stable endpoint's behavior, (b) exercises a clean request shape `{query: string, pantryOnly: boolean}`, (c) keeps test files separate, (d) decouples future evolution (semantic search vs. discovery). |
| React Query for search | Zustand action | See above — stack consistency. |
| New persist store version upgrade | Add new fields to existing store | `suggestionsStore` currently has NO `persist` wrapper (lines 30-89 are bare `create`). Adding persist is a version-1 persist with no migration needed (first persist). |

### Installation

**No installs required.** Every dependency is already in `apps/mobile/package.json` and `packages/server/package.json`.

### Version verification

Package versions confirmed against the repo's current `package.json` (authoritative for this monorepo; npm registry check unnecessary for already-installed deps):

- `zustand`: 5.0.12 (per repo `package.json`; no change needed)
- `vitest`: 4.1.4 (both workspaces)
- `expo-router`: bundled with SDK 55 (root `expo` pin)
- `@anthropic-ai/sdk`, `@google/genai`: server-side; already abstracted behind `getClientFor()` in `packages/server/src/ai/clientFactory.ts`

## Architecture Patterns

### Recommended Structure

```
apps/mobile/src/
├── app/
│   ├── (tabs)/
│   │   └── kitchen.tsx           # rename label + swap FAB→HeaderEllipsis (modify)
│   └── search.tsx                # add context=something-new branch (modify)
├── components/
│   ├── suggestions/
│   │   ├── SuggestionList.tsx    # keep as fallback when no searchResults yet
│   │   ├── SomethingNewResults.tsx   # NEW — cards grid + preview modal
│   │   ├── RecentQueryChips.tsx      # NEW — horizontal chips on landing
│   │   └── PantryOnlyToggle.tsx      # NEW — binary toggle pill
│   └── ui/
│       └── HeaderEllipsis.tsx    # reuse as-is
├── stores/
│   └── suggestionsStore.ts       # extend: persist + searchRecipes + recentQueries (modify)
└── types/
    └── suggestions.ts            # add SearchResult = ParsedRecipe[] alias

packages/server/src/
├── routes/
│   └── recipes.ts                # add POST /search (recommended) OR extend /discover
└── services/
    └── recipeDiscovery.ts        # extend buildDiscoveryPrompt + discoverRecipes opts
```

### Pattern 1: Zustand action calling backend with rollback

**What:** All mobile stores encapsulate fetch + optimistic state; no React Query boundary.
**When to use:** Every server call in Phase 17 (`searchRecipes`, `saveRecipe` reuse).
**Example:**
```typescript
// Source: apps/mobile/src/stores/suggestionsStore.ts:38-75 (shape to follow)
searchRecipes: async (query: string, options: { pantryOnly: boolean }) => {
  set({ isLoading: true, error: null, lastQuery: query, pantryOnly: options.pantryOnly });
  try {
    const token = await getAuthToken();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/recipes/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, pantryOnly: options.pantryOnly }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      set({ error: err.error ?? 'Search failed', isLoading: false });
      return;
    }
    const { data } = await response.json();
    set((s) => ({
      searchResults: data,
      recentQueries: dedupPrepend(query, s.recentQueries, 5),
      isLoading: false,
      error: null,
    }));
  } catch (err) {
    set({ error: err instanceof Error ? err.message : 'Search failed', isLoading: false });
  }
},
```

### Pattern 2: Persist middleware with partialize + version

**What:** Zustand `persist` with typed partialize + explicit version for future migrations.
**When to use:** Adding persistence to `suggestionsStore` for `searchResults` + `recentQueries`.
**Example:**
```typescript
// Source: apps/mobile/src/stores/preferencesStore.ts:25-167
export const useSuggestionsStore = create<SuggestionsState>()(
  persist(
    (set, get) => ({
      /* ...state + actions... */
    }),
    {
      name: 'dinnertime-suggestions',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        searchResults: state.searchResults,
        recentQueries: state.recentQueries,
        lastQuery: state.lastQuery,
        pantryOnly: state.pantryOnly,
      }),
      version: 1, // first persist — no migrate needed
    }
  )
);
```

### Pattern 3: `HeaderEllipsis` for 2+ secondary actions

**What:** `ActionSheetIOS`-backed overflow menu. Collapses 2–4 actions into a single SF `ellipsis` glyph.
**When to use:** Replace `<RegenerateFab />` on Something New segment.
**Example:**
```typescript
// Source: apps/mobile/src/app/recipes/[id]/index.tsx:126-134
<HeaderEllipsis
  tintColor={colors.textPrimary}
  accessibilityLabel="More options"
  actions={[
    { label: 'Regenerate from pantry', onPress: () => searchRecipes('', { pantryOnly: true }) },
    { label: 'Clear search history', onPress: clearHistory, destructive: true },
  ]}
/>
```

### Pattern 4: Preview-first card tap → modal with CTAs

**What:** Cards are non-navigating; tapping opens a `Modal presentationStyle="pageSheet"` with full recipe content + Save + Remix CTAs.
**When to use:** Something New result cards. Copy `PreviewSheet` wholesale from `discover.tsx:258-365`; add a Remix CTA next to Save.
**Implementation note:** `PreviewSheet` currently only has a Save button. Phase 17 adds a secondary button that opens `RemixSheet` with `source={{kind:'inline', context: parsedRecipeContext}}`. `RemixSheet.tsx:36-37` already accepts this shape.

### Pattern 5: Inline-context RemixSheet for unsaved recipes

**What:** `RemixSheet` accepts `{kind:'inline', context: VariationContext}` for recipes that don't yet exist in the library.
**When to use:** When the user remixes a Something New result before saving.
**Source:** `apps/mobile/src/components/recipes/RemixSheet.tsx:35-39` + `155-164`. Save path hits `POST /api/v1/recipes/remix` which returns a full `ParsedRecipe`, then calls `recipeStore.saveRecipe({...parsed, source_type:'ai'})`.

### Anti-Patterns to Avoid

- **Rendering two independent `SuggestionList`s.** Do not fork `SuggestionList` — it's the empty-state/pantry-auto-suggest flow. Something New is a parallel results view; `kitchen.tsx` should render `<SomethingNewResults />` when `searchResults.length > 0 || recentQueries.length > 0`, else fall through to `<SuggestionList />` for the pantry-driven pre-search experience. This keeps the zero-query auto-suggest UX intact.
- **Renaming the `'suggestions'` Zustand segment key.** CONTEXT.md locks this. A rename would invalidate the persisted segment state for existing users and is pure cosmetic debt.
- **Client-side pantry filtering.** CONTEXT.md locks server-side enforcement. The pantry manifest goes into the AI prompt; the response is pre-filtered. Client receives a clean `ParsedRecipe[]`.
- **Treating the `/search` modal as long-lived state.** The modal is a submit portal — on submit, `searchRecipes()` runs, modal dismisses via `router.back()`, and the Something New segment renders results from the store. Do not hold query state in the modal beyond its lifetime.
- **Dismiss-then-fetch order inversion.** Fetching must be initiated *from* the modal (so its loading state is visible) OR the fetch kicks off and the modal dismisses immediately and the segment shows its own loading skeleton. Pick one; research recommends the latter (cleaner UX, matches `discover.tsx` which loads on mount).
- **Double-hitting Claude when a user taps a recent-query chip.** Treat chip taps as shortcuts: they set `query` in modal context if the modal is open, OR they call `searchRecipes(query, { pantryOnly })` directly from the landing strip. Do not rerender the modal solely to dispatch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Overflow action menu | Custom popover / BottomSheet | `HeaderEllipsis` (`components/ui/HeaderEllipsis.tsx`) | Already ships, iOS-native ActionSheetIOS under the hood, handles destructive action styling, consistent with Phase 15. |
| Sticky search pill | Custom animated header component | `StickySearchPill` (`components/ui/SearchBar.tsx`) | Already renders shadow-on-scroll via `scrollY.interpolate`; `context='something-new'` is a pre-typed union member; tested in `SearchBar.test.ts`. |
| Recipe preview modal | Custom modal | `PreviewSheet` (inline component in `recipes/discover.tsx:258-365`) | Already renders hero image, title, meta, ingredients, steps, fixed-bottom Save CTA. Extract it into `components/recipes/PreviewSheet.tsx` as a refactor, or copy inline. |
| AI recipe generation prompt | Hand-roll prompt | `recipeDiscovery.ts::buildDiscoveryPrompt` | Already structures HARD CONSTRAINTS (allergies) vs. SOFT PREFERENCES (dietary, cuisines). Extend with a `pantryManifest` param — don't rewrite. |
| Persist middleware for recent-queries | `AsyncStorage.setItem`/`getItem` by hand | Zustand `persist` + `partialize` | Existing pattern in 6 stores. Hand-rolled async storage access duplicates logic and races the hydration order. |
| Remix UX | Build a new editor | `RemixSheet` with `source={kind:'inline',...}` | Ships Surprise me / Swap protein / Swap veggies / Make it quicker. Accepts unsaved recipes via `VariationContext`. |
| Save-to-Library flow | Custom save action | `useRecipeStore((s)=>s.saveRecipe)({...parsed, source_type:'ai'})` | Same entry point the existing Discover preview uses (`discover.tsx:97`). |
| Loading skeleton | Custom shimmer | `SuggestionSkeleton` (`components/suggestions/SuggestionSkeleton.tsx`) | Reuse. If a different shape is needed (grid-style card), extract a second `RecipeCardSkeleton` primitive rather than hand-rolling per screen. |
| Error state | Custom error view | `ErrorState` (`components/ui/ErrorState.tsx`) with `retry` prop | Consumed by `SuggestionList:71-77`. |
| Dedup helper for recent-queries | Custom | Inline pure `dedupPrepend(query, list, maxN)` with unit test | Trivial to write, easier to test pure than co-located inside the action. |

**Key insight:** This phase has almost NO custom implementation surface — it is 90% composition of shipped primitives plus a thin server endpoint. Plans should reflect this: each plan is "wire primitive X to surface Y," not "design and build."

## Runtime State Inventory

> This is a rewire / cosmetic phase. The rename is cosmetic only and the new persisted data is first-time-writeable. Inventory is included because any phase that mutates persisted Zustand shape has runtime state implications.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `dinnertime-suggestions` is a NEW AsyncStorage namespace (suggestionsStore currently has no persist wrapper — line 30). First writeable. | None — first-time persist writes version:1. No migration needed. |
| Stored data (segmented control segment memory) | The existing `params.segment` route param reads `'suggestions' \| 'library'` (`kitchen.tsx:233`). Users currently arrive via `/(tabs)/kitchen?segment=library` (from save-flow redirects). The `'suggestions'` key stays valid per CONTEXT lock. | None — re-verify deep-link URLs in Phase 12's save-flow redirects still work: `/(tabs)/kitchen?segment=library` is untouched. |
| Live service config | None — no external services store "Suggestions" as a configuration string (Supabase schema uses neither term; Datadog/tunneling absent). | None. |
| OS-registered state | None. No iOS push-notification category, no Task Scheduler, no launchd unit references this UX. | None. |
| Secrets/env vars | None. All AI keys (`ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`) are already wired via `getClientFor()`; no new secret required. | None. |
| Build artifacts / installed packages | None. No new npm install, no new native module, no new EAS dev-client build. | None — existing dev client `com.dinnertime.app` can run Phase 17 without rebuild. |
| Maestro flow state | `20-kitchen-segment-toggle.yaml:77` asserts `text: ".*Suggestions.*"`. Rename breaks this flow. | Rebase flow 20 selector + add new Phase 17 flow (e.g., `27-something-new-search.yaml`). |
| Maestro flow state (deep-link) | `06-recipe-discover.yaml` uses `openLink: "dinnertime://recipes/discover"` — still valid since `/recipes/discover` route is NOT removed by Phase 17 (it's a separate library-discovery flow; keep it). | None — plan should explicitly NOT delete `/recipes/discover`. |
| Persisted suggestionsStore shape | New fields: `searchResults: ParsedRecipe[]`, `recentQueries: string[]`, `lastQuery: string \| null`, `pantryOnly: boolean`. | None on existing installs — new persist keys start undefined and default initializers in the store supply initial values. |

**Canonical question answered:** After deploying Phase 17, what runtime systems still reference the old "Suggestions" label? Only the Maestro flow suite (flow 20). Server DB, user data, and Zustand keys do NOT need migration.

## Common Pitfalls

### Pitfall 1: Persist rehydration races with `autoFetch`
**What goes wrong:** `suggestionsStore` currently exposes `autoFetch` — a cross-screen signal from scan review to "auto-fetch suggestions when the user lands." If the store becomes persisted, `autoFetch` may rehydrate as `true` from a prior session and fire `fetchSuggestions()` on cold launch.
**Why it happens:** Zustand persist rehydrates partialized state before your component tree decides to call actions.
**How to avoid:** Exclude `autoFetch` from `partialize` (only include `searchResults`, `recentQueries`, `lastQuery`, `pantryOnly`). Explicitly. This is why partialize exists.
**Warning signs:** App cold-starts and immediately calls `/api/v1/ai/suggest` even though the user didn't come from a scan flow.

### Pitfall 2: Modal lifecycle — user dismisses mid-flight
**What goes wrong:** User taps pill → types query → submits. Modal dismisses, fetch is in-flight. User taps "Something New" segment, sees stale results, gets confused when new results arrive.
**Why it happens:** Fetch runs asynchronously; no cancellation semantic.
**How to avoid:** Either (a) render a loading skeleton on the segment while `isLoading===true` OR (b) fetch *inside* the modal and only dismiss after response. Research recommends (a) — matches `SuggestionList:52-64` pattern.
**Warning signs:** Flicker or old results briefly visible between modal dismiss and new results render.

### Pitfall 3: Pantry manifest size blows prompt context
**What goes wrong:** A heavily-stocked pantry (~150 items post-beta import via Instacart) inflates the prompt, truncating output or causing Gemini to return fewer recipes.
**Why it happens:** Prompt budget is finite; `suggestions.ts` already caps context but `recipeDiscovery.ts` does NOT — it sends all existing titles verbatim (`recipes.ts:174`).
**How to avoid:** Cap `pantryManifest` at top N most-confident items (suggested N=50). Pattern borrowed from `mealPlanner.ts` where the prompt layer caps recipe library at 100.
**Warning signs:** Test with a pantry >100 items; check AI returns < 4 recipes or malformed tool calls.

### Pitfall 4: Pantry manifest staleness
**What goes wrong:** User adds/removes a pantry item, returns to Something New — searchResults on screen still list recipes that assume the old pantry.
**Why it happens:** Persisted `searchResults` don't invalidate when pantry changes.
**How to avoid:** Decision for planning: either (a) persist a `resultsGeneratedAtPantryVersion` and display a "Pantry changed — refresh results?" banner, OR (b) accept staleness; rely on user to tap "Regenerate from pantry" in the overflow menu. Research recommends (b) — simpler, binary pantry-only results are already coarse-grained; a banner adds noise.
**Warning signs:** User complaint "this recipe needs cilantro and I don't have any, why did you suggest it?"

### Pitfall 5: `preventDefault` on landing-state empty result
**What goes wrong:** First-time user (no recentQueries, no searchResults). Landing shows the pill + hint copy only. Without `SuggestionList`'s pantry-auto-suggest fallback, the segment feels broken.
**Why it happens:** `SuggestionList` currently provides the "ready for dinner ideas?" pantry-auto-flow. Removing it strands first-time users.
**How to avoid:** When `searchResults.length === 0 && recentQueries.length === 0 && pantryItems.length >= 3`, render `<SuggestionList />` as a fallback. The store's existing `fetchSuggestions()` action populates it. User sees familiar content until they interact with the new search pill.
**Warning signs:** First-run UAT shows an empty segment with only a pill and hint — no recipe content.

### Pitfall 6: `/search` modal context fork — multiple consumers
**What goes wrong:** The `/search` modal currently has ONE placeholder component rendering `context`. Phase 17 introduces the first real consumer (`context='something-new'`) while `context='library'` still needs to be wired later. Adding a conditional in `search.tsx` that only works for `something-new` could leave the library path broken-looking in UAT.
**Why it happens:** `SearchContext` union has three members; only one is implemented in Phase 17.
**How to avoid:** Make `search.tsx` a switch statement on `context`. Implement `'something-new'` fully. Leave `'library'` + `'pantry'` cases rendering the existing placeholder. Explicitly document that the library full-text search is already shipped elsewhere (Phase 19 shipped `RECP-07` via `recipes.ts?q=…`) — Phase 17 only fills in the Something New context.
**Warning signs:** Library StickySearchPill taps lead to a broken modal.

### Pitfall 7: ActionSheetIOS + Android fallback
**What goes wrong:** `HeaderEllipsis` uses `ActionSheetIOS.showActionSheetWithOptions` — Android would no-op.
**Why it happens:** Phase 17 ships on iOS only (per CLAUDE.md constraint: iOS-first). CLAUDE.md plans no Android for v1.
**How to avoid:** No action for Phase 17. When/if Android ships (post-v1 PLAT-01), `HeaderEllipsis` needs an `@expo/react-native-action-sheet` substitute. Log for Phase 25/v2 tracking.
**Warning signs:** None on iOS.

### Pitfall 8: Segment label switch breaks Maestro flow assertions
**What goes wrong:** Flow `20-kitchen-segment-toggle.yaml` asserts `.*Suggestions.*` on line 77. Rename breaks UAT.
**Why it happens:** Maestro flows bind to visible text.
**How to avoid:** Rebase flow 20: change line 77 from `text: ".*Suggestions.*"` to `text: ".*Something New.*"`. Add a new flow `27-something-new-search.yaml` that exercises the pill → modal → submit → results-render path.
**Warning signs:** `npx maestro test .maestro/20-kitchen-segment-toggle.yaml` fails at step 6.

### Pitfall 9: `source_type` drift on save
**What goes wrong:** Saving a Something New result forgets to stamp `source_type: 'ai'`, so the recipe appears in filtered library queries as "user-authored" rather than AI-generated.
**Why it happens:** `saveRecipe` accepts any `source_type`; callers are responsible.
**How to avoid:** Copy `discover.tsx:97` verbatim: `await saveRecipe({ ...parsed, source_type: 'ai' })`. This is already a test-covered invariant in `recipes/discover.test.ts`.
**Warning signs:** Library filter "AI-generated only" fails to include Something New saves.

### Pitfall 10: `ParsedRecipe` shape forward-compat
**What goes wrong:** Phase 24 added canonical-ingredient fields to `PantryItem`. `ParsedRecipe` may evolve. If Phase 17 stores `searchResults: ParsedRecipe[]` verbatim in AsyncStorage, a future field addition risks migration mismatch.
**Why it happens:** Persist + shape evolution.
**How to avoid:** Version the persist (`version: 1`). If Phase 24/25 adds required ParsedRecipe fields, a `migrate: (persisted, fromVersion) => ...` function can drop the old shape and force a re-fetch. Test this by consciously adding a future field and asserting migration defaults it.
**Warning signs:** Runtime TypeScript errors after a Phase 24+ update ships.

## Code Examples

### Example 1: Server — `POST /api/v1/recipes/search` (recommended new endpoint)

```typescript
// Source: Derived from packages/server/src/routes/recipes.ts:120-187 +
//   packages/server/src/services/recipeDiscovery.ts
// Phase 17 addition: recipes.post('/search', ...) alongside existing /discover.

recipes.post('/search', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');

  let body: { query?: string; pantryOnly?: boolean };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (typeof body.query !== 'string' || body.query.trim().length === 0) {
    return c.json({ error: 'Query is required' }, 400);
  }

  try {
    // Reuse existing preferences assembly (copy from /discover lines 131-170)
    const { data: members } = await supabase.from('household_members').select().eq('profile_id', user.id);
    const { data: profile } = await supabase.from('profiles').select('cuisine_preferences, skill_level').eq('id', user.id).single();

    const preferences: DiscoveryPreferences = {
      allergies: [...new Set((members ?? []).flatMap((m: any) => m.dietary_allergies ?? []))],
      dietary_restrictions: [...new Set((members ?? []).flatMap((m: any) => m.dietary_restrictions ?? []))],
      disliked_ingredients: [...new Set((members ?? []).flatMap((m: any) => m.disliked_ingredients ?? []))],
      cuisine_preferences: profile?.cuisine_preferences ?? [],
    };

    // Pantry manifest (optional, for pantryOnly branch)
    let pantryManifest: string[] | undefined;
    if (body.pantryOnly === true) {
      const { data: pantry } = await supabase
        .from('pantry_items')
        .select('name, quantity, unit, confidence')
        .eq('profile_id', user.id)
        .eq('status', 'available')
        .order('confidence', { ascending: false })
        .limit(50); // Pitfall 3: cap manifest size
      pantryManifest = (pantry ?? []).map((p: any) => p.name);
    }

    const library = await getRecipes(supabase, user.id);
    const existingTitles = library.map((r) => r.title);

    const data = await discoverRecipes({
      preferences,
      existingTitles,
      prompt: body.query,
      pantryManifest,   // NEW — threaded to buildDiscoveryPrompt
    });

    return c.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search recipes';
    return c.json({ error: message }, 500);
  }
});
```

### Example 2: Server — `buildDiscoveryPrompt` extension

```typescript
// Source: packages/server/src/services/recipeDiscovery.ts:91-145 — extend the
//   existing pure prompt builder. Pattern mirrored from
//   services/suggestions.ts:176-200 (pantry manifest formatting).

export function buildDiscoveryPrompt(
  preferences: DiscoveryPreferences,
  existingTitles?: string[],
  pantryManifest?: string[],   // NEW
): string {
  // ...existing HARD CONSTRAINTS and SOFT PREFERENCES lines (unchanged)...

  if (pantryManifest && pantryManifest.length > 0) {
    lines.push('');
    lines.push('PANTRY CONSTRAINT (HARD):');
    lines.push('- Only suggest recipes that are 100% feasible using ONLY these pantry items:');
    for (const name of pantryManifest) {
      lines.push(`  - ${name}`);
    }
    lines.push('- Common pantry staples (salt, pepper, water, oil) can be assumed available.');
    lines.push('- If you cannot find 4+ recipes that fit this constraint, return fewer recipes rather than violate it.');
  }

  lines.push('');
  lines.push('Return full recipes with structured ingredients (name, quantity, unit, notes) and ordered steps. Convert fractions to decimals for quantities.');
  return lines.join('\n');
}
```

### Example 3: Mobile — extended `suggestionsStore`

```typescript
// Source: apps/mobile/src/stores/suggestionsStore.ts — full extension.
// Pattern from preferencesStore.ts (persist), pantryStore.ts (partialize+version).

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { DinnerSuggestion } from '../types/suggestions';
import type { ParsedRecipe } from '../types/recipe';

export interface SearchOptions {
  pantryOnly: boolean;
}

interface SuggestionsState {
  // Existing
  suggestions: DinnerSuggestion[];
  isLoading: boolean;
  error: string | null;
  pantryItemCount: number;
  generatedAt: string | null;
  autoFetch: boolean;

  // NEW (Phase 17)
  searchResults: ParsedRecipe[];
  recentQueries: string[];
  lastQuery: string | null;
  pantryOnly: boolean;

  fetchSuggestions: () => Promise<void>;
  clearSuggestions: () => void;
  setAutoFetch: (value: boolean) => void;

  // NEW
  searchRecipes: (query: string, options: SearchOptions) => Promise<void>;
  clearHistory: () => void;
}

const MAX_RECENT = 5;

// Pure helper (extract to a module for standalone test).
function dedupPrepend(query: string, list: string[], max: number): string[] {
  const trimmed = query.trim();
  if (!trimmed) return list;
  const deduped = [trimmed, ...list.filter((q) => q !== trimmed)];
  return deduped.slice(0, max);
}

// ... (getApiBaseUrl, getAuthToken as in current file) ...

export const useSuggestionsStore = create<SuggestionsState>()(
  persist(
    (set, get) => ({
      // Existing initial state
      suggestions: [],
      isLoading: false,
      error: null,
      pantryItemCount: 0,
      generatedAt: null,
      autoFetch: false,

      // NEW initial state
      searchResults: [],
      recentQueries: [],
      lastQuery: null,
      pantryOnly: false,

      // Existing actions unchanged (fetchSuggestions, clearSuggestions, setAutoFetch)
      fetchSuggestions: async () => { /* ...unchanged... */ },
      clearSuggestions: () => set({ suggestions: [], error: null, pantryItemCount: 0, generatedAt: null }),
      setAutoFetch: (value) => set({ autoFetch: value }),

      // NEW
      searchRecipes: async (query, options) => {
        set({ isLoading: true, error: null, lastQuery: query, pantryOnly: options.pantryOnly });
        try {
          const token = await getAuthToken();
          const response = await fetch(`${getApiBaseUrl()}/api/v1/recipes/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ query, pantryOnly: options.pantryOnly }),
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            set({ error: err.error ?? 'Search failed', isLoading: false });
            return;
          }
          const { data } = await response.json();
          set((s) => ({
            searchResults: data as ParsedRecipe[],
            recentQueries: dedupPrepend(query, s.recentQueries, MAX_RECENT),
            isLoading: false,
            error: null,
          }));
        } catch (err) {
          set({ error: err instanceof Error ? err.message : 'Search failed', isLoading: false });
        }
      },

      clearHistory: () => set({ recentQueries: [], searchResults: [], lastQuery: null }),
    }),
    {
      name: 'dinnertime-suggestions',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Pitfall 1: explicitly exclude autoFetch + isLoading + error
        searchResults: state.searchResults,
        recentQueries: state.recentQueries,
        lastQuery: state.lastQuery,
        pantryOnly: state.pantryOnly,
      }),
      version: 1,
    }
  )
);
```

### Example 4: Mobile — `/search` modal content branch

```typescript
// Source: Extend apps/mobile/src/app/search.tsx (currently a placeholder).
// Pattern: simple form, no per-keystroke API calls — submit-and-dismiss.

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSuggestionsStore } from '../stores/suggestionsStore';
import { Button } from '../components/ui/Button';
import { colors } from '../design/tokens';

export default function SearchModal() {
  const { context } = useLocalSearchParams<{ context?: string }>();

  if (context === 'something-new') return <SomethingNewSearch />;
  // Existing placeholder fallback for 'library' | 'pantry' (future wiring)
  return <PlaceholderSearch context={context} />;
}

function SomethingNewSearch() {
  const searchRecipes = useSuggestionsStore((s) => s.searchRecipes);
  const storedPantryOnly = useSuggestionsStore((s) => s.pantryOnly);
  const lastQuery = useSuggestionsStore((s) => s.lastQuery);

  const [query, setQuery] = useState(lastQuery ?? '');
  const [pantryOnly, setPantryOnly] = useState(storedPantryOnly);

  const handleSubmit = () => {
    if (query.trim().length === 0) return;
    void searchRecipes(query, { pantryOnly });
    router.back(); // dismiss modal immediately; segment shows loading skeleton
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="What are you craving?"
        autoFocus
        returnKeyType="search"
        onSubmitEditing={handleSubmit}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          padding: 14,
          fontSize: 17,
        }}
      />

      <Pressable
        onPress={() => setPantryOnly((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}
        accessibilityRole="switch"
        accessibilityState={{ checked: pantryOnly }}
      >
        <Switch value={pantryOnly} onValueChange={setPantryOnly} />
        <Text style={{ marginLeft: 12, color: colors.textPrimary }}>
          Only what's in my pantry
        </Text>
      </Pressable>

      <View style={{ marginTop: 24 }}>
        <Button title="Search" onPress={handleSubmit} disabled={query.trim().length === 0} />
      </View>
    </View>
  );
}
```

### Example 5: Kitchen — swap `<RegenerateFab />` for `<HeaderEllipsis>`

```typescript
// Source: apps/mobile/src/app/(tabs)/kitchen.tsx:117-132 (delete RegenerateFab)
//   AND lines 349-394 (modify action row) AND line 468 (delete FAB render).

// In the action row (near library's filter/discover buttons), add when segment === 'suggestions':
{segment === 'suggestions' && (
  <>
    <Pressable
      onPress={() => {
        const pantryOnly = useSuggestionsStore.getState().pantryOnly;
        void useSuggestionsStore.getState().searchRecipes('', { pantryOnly: true });
      }}
      style={styles.actionBtn}
      hitSlop={8}
      accessibilityLabel="Regenerate from pantry"
    >
      <SymbolIcon name="sparkles" size={20} tintColor={colors.warning} />
    </Pressable>
    <HeaderEllipsis
      accessibilityLabel="More options"
      actions={[
        {
          label: 'Regenerate from pantry',
          onPress: () => {
            void useSuggestionsStore.getState().searchRecipes('', { pantryOnly: true });
          },
        },
        {
          label: 'Clear search history',
          onPress: () => useSuggestionsStore.getState().clearHistory(),
          destructive: true,
        },
      ]}
    />
  </>
)}

// At line 468, remove:
// {segment === 'suggestions' && <RegenerateFab />}
```

### Example 6: Preview sheet Remix button

```typescript
// Source: Extend PreviewSheet in apps/mobile/src/app/recipes/discover.tsx:258-365
// OR extract to components/recipes/PreviewSheet.tsx as a refactor.

import { RemixSheet, type RemixSource } from '../../components/recipes/RemixSheet';

function PreviewSheet({ recipe, heroUri, onClose, onSave, saving }: PreviewSheetProps) {
  const [remixOpen, setRemixOpen] = useState(false);

  const remixSource: RemixSource = {
    kind: 'inline',
    context: {
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      total_time_minutes: recipe.total_time_minutes,
    },
  };

  return (
    <>
      {/* ...existing ScrollView / hero / sections unchanged... */}

      <View style={styles.sheetBottomBar}>
        {recipe._saved ? (
          <View style={styles.sheetSavedRow}>
            <SymbolIcon name="checkmark.circle.fill" size={20} tintColor="#10B981" />
            <Text style={styles.sheetSavedText}>Saved to library</Text>
            <View style={{ flex: 1 }} />
            <Button title="Done" variant="outline" onPress={onClose} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Save to Library" onPress={onSave} loading={saving} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Remix"
                variant="outline"
                onPress={() => setRemixOpen(true)}
              />
            </View>
          </View>
        )}
      </View>

      <RemixSheet
        visible={remixOpen}
        recipeTitle={recipe.title}
        source={remixSource}
        baseForSave={{
          title: recipe.title,
          description: recipe.description,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
          total_time_minutes: recipe.total_time_minutes,
        }}
        onClose={() => setRemixOpen(false)}
      />
    </>
  );
}
```

## State of the Art

This phase is a **rewire** — it consolidates existing primitives rather than introducing new ones. Only state-of-the-art note:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dedicated `/recipes/discover` screen for AI-recipe-browsing | Integrated keyword+pantry search on Kitchen tab Suggestions segment | Phase 17 (this phase) | `/recipes/discover` stays shipped as a legacy deep-link (Maestro flow 06) but is no longer the primary entry. Mid-term, Phase 22 may consolidate it away; do NOT delete in Phase 17. |
| Sparkles FAB "tap to regenerate" loop | Search-driven exploration with regenerate demoted to overflow | Phase 17 | Aligns with Phase 15's "secondary actions → ellipsis" pattern. |
| Suggestions segment shows empty state with Get Dinner Ideas button | Suggestions segment shows last search results + recent chips (fallback to current empty state only for first-timers with no history AND sufficient pantry) | Phase 17 | Preserves `SuggestionList`'s pantry-auto-suggest UX as a fallback. |
| Client-side pantry filtering on `RecipeFilterSheet`'s `pantryOnly` toggle | Server-side pantry filtering in the AI prompt | Phase 17 | Avoids the naive `name.includes()` matching in `kitchen.tsx:82-99`. AI understands substitutions and common staples; the manifest-in-prompt approach is more forgiving. |

**Deprecated/outdated:** None introduced by this phase. `/recipes/discover` is NOT deprecated — keep it.

## Open Questions

1. **Separate `POST /recipes/search` endpoint vs. extending `POST /recipes/discover`?**
   - What we know: `/discover` has stable test coverage + Maestro flow 06. Extending it with `query` + `pantryOnly` would break tests that assume zero-input behavior unless carefully additive.
   - What's unclear: Whether future cross-segment semantic search (mentioned in ADVN-01 v2) should land at `/recipes/search` or a separate `/recipes/semantic`. If `/search` today becomes "any AI-driven recipe search," it may cover both paths.
   - **Recommendation:** Add new `POST /recipes/search`. Preserves `/discover` stability. Clear naming.

2. **Fallback to `SuggestionList` when user has never searched?**
   - What we know: CONTEXT.md says "first-time user (no history, no results): search pill with hint copy, no card area."
   - What's unclear: Whether this applies to users who have a stocked pantry but never used Something New (e.g., post-Phase 21 users returning to the segment). Strict CONTEXT reading says "no card area" — but then first-time users lose the valuable pantry-auto-suggest experience of SuggestionList.
   - **Recommendation:** Follow CONTEXT strictly for the initial landing state. Add a single Pressable "Get dinner ideas from my pantry" button below the hint copy — it's a zero-input regenerate-from-pantry shortcut that matches the overflow menu's "Regenerate from pantry" action. Opens the door for the user without auto-fetching. Confirm with user during planning.

3. **Should the `/search` modal dismiss before or after fetch?**
   - What we know: Two patterns in the codebase. `discover.tsx` fetches on mount (always visible during loading); `RemixSheet` keeps the sheet open during variation generation and renders results inline.
   - What's unclear: Which pattern feels better for Something New search.
   - **Recommendation:** Dismiss-first, load-on-segment. The modal is a transient submit portal; the segment is the canonical result container. Saves one spinner flash and matches the mental model.

4. **Preserve `autoFetch` cross-screen signal?**
   - What we know: `autoFetch` is set to `true` by scan review to fire `fetchSuggestions()` on Kitchen landing. With the new search flow, this signal has two interpretations: (a) fire pantry-auto-suggest (current), (b) fire a pantry-only search with empty query.
   - What's unclear: Whether scan-review should auto-search or continue to auto-suggest.
   - **Recommendation:** Keep `autoFetch → fetchSuggestions()` semantics (don't change). The "freshly scanned, show me ideas" flow is pantry-grounded and matches the legacy auto-suggest. Something New is an *exploratory* surface — auto-firing a search would feel presumptuous.

5. **Recent-query chip UX: horizontal scroll or wrap?**
   - What we know: CONTEXT.md says Claude's discretion. With `MAX_RECENT=5`, most screens will fit in one row.
   - What's unclear: Font scaling / accessibility at larger text sizes.
   - **Recommendation:** Horizontal ScrollView with chip width = intrinsic + 12px padding. Matches iOS search suggestions pattern (Safari/App Store).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server build + tests | ✓ | v22.22.0 | — |
| pnpm | Monorepo scripts | ✓ | 10.32.1 | — |
| Anthropic API key | `recipe.discovery` task (if routed there) | ✓ (in root `.env`) | — | — |
| Google AI API key | `recipe.discovery` task (currently routed to Gemini flash) | ✓ (in root `.env`) | — | — |
| Supabase URL + anon + service key | `pantry_items` + `household_members` + `recipes` queries | ✓ | — | — |
| Expo SDK 55 dev client | iOS Simulator UAT | ✓ (prebuilt at `apps/mobile/ios/build/...`) | com.dinnertime.app | — |
| Maestro 2.4.0 + Xcode iOS 26.4 sim | UAT | ✓ | — | — |
| Cloudflare tunnel (`cloudflared`) | Physical iPhone testing | ✓ (installed, ephemeral URL) | — | Simulator-only UAT via localhost |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Environment is green.** Phase 17 requires no new tooling or credentials.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (mobile + server workspaces; Node env) |
| Mobile config | `apps/mobile/vitest.config.ts` (env=node, `vitest.setup.ts` mocks react-native + expo-speech + AsyncStorage) |
| Server config | `packages/server/vitest.config.ts` |
| Quick run (mobile) | `cd apps/mobile && pnpm test -- --run src/stores/suggestionsStore.test.ts` |
| Quick run (server) | `cd packages/server && pnpm test -- --run src/routes/__tests__/recipes.search.test.ts src/services/__tests__/recipeDiscovery.test.ts` |
| Full suite (mobile) | `cd apps/mobile && pnpm test` |
| Full suite (server) | `cd packages/server && pnpm test` |
| UAT runner | Maestro 2.4.0 against iOS Simulator (iPhone 17 Pro); see `.maestro/scripts/uat.sh` |

**Mobile test gotcha:** `exclude: ['src/components/**/*.native.test.*']` — RN renderer-coupled tests must be named `*.native.test.*` so they are skipped under vitest's node env. Pure helper tests (`dedupPrepend`, resolver logic) can be `.test.ts` files and run under node env without any RN renderer.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P17-01 | Segment label reads "Something New" | visual / snapshot | Maestro flow rebase; grep assertion in `kitchen.tsx` source | ❌ Wave 0 — rebase `20-kitchen-segment-toggle.yaml` |
| P17-01 | Accessibility label is "Something New segment" | unit (source-contract) | `pnpm test -- --run src/app/(tabs)/__tests__/kitchen.test.ts` (new file; source contract) | ❌ Wave 0 |
| P17-02 | `suggestionsStore` persists `searchResults`, `recentQueries`, `lastQuery`, `pantryOnly` | unit | `pnpm test -- --run src/stores/__tests__/suggestionsStore.persist.test.ts` | ❌ Wave 0 |
| P17-02 | `autoFetch` is EXCLUDED from partialize (Pitfall 1) | unit | Same file as above, dedicated `it('excludes autoFetch from partialize')` case | ❌ Wave 0 |
| P17-03 | `/search?context=something-new` renders the search input + pantry toggle | unit (source-contract) | `pnpm test -- --run src/app/__tests__/search.test.ts` (substring + import assertions) | ❌ Wave 0 |
| P17-03 | `searchRecipes(query, {pantryOnly})` action hits `/api/v1/recipes/search` with correct body | unit | `pnpm test -- --run src/stores/__tests__/suggestionsStore.test.ts::searchRecipes` (vi.spyOn fetch) | ❌ Wave 0 |
| P17-03 | `dedupPrepend` pure helper dedupes + caps at 5 | unit | `pnpm test -- --run src/stores/__tests__/dedupPrepend.test.ts` | ❌ Wave 0 |
| P17-04 | Server `POST /recipes/search` with `pantryOnly:true` calls `discoverRecipes` with `pantryManifest` | integration | `cd packages/server && pnpm test -- --run src/routes/__tests__/recipes.search.test.ts` | ❌ Wave 0 |
| P17-04 | `buildDiscoveryPrompt` embeds `PANTRY CONSTRAINT` section when manifest provided | unit (pure) | `cd packages/server && pnpm test -- --run src/services/__tests__/recipeDiscovery.test.ts::buildDiscoveryPrompt` (extend existing) | Partially — extend existing test file |
| P17-04 | Pantry manifest capped at 50 items (Pitfall 3) | unit | Same integration test with a 100-item pantry fixture | ❌ Wave 0 |
| P17-05 | PreviewSheet renders a Remix button when not saved | unit (source-contract) | `pnpm test -- --run src/app/recipes/__tests__/discover.test.ts` (extend existing) | Partially — extend |
| P17-05 | Tapping Remix opens `RemixSheet` with `source={kind:'inline',...}` | UAT | Maestro flow `27-something-new-search.yaml` (tap Remix, assert RemixSheet modes visible) | ❌ Wave 0 |
| P17-06 | Sparkles FAB is no longer rendered on Something New segment | unit (source-contract) | `kitchen.test.ts` — assert no `<RegenerateFab>` or `styles.fab` references for `segment==='suggestions'` | ❌ Wave 0 |
| P17-06 | HeaderEllipsis mounts with "Regenerate from pantry" + "Clear search history" actions | unit (source-contract) | Same `kitchen.test.ts` — substring match on the actions array | ❌ Wave 0 |
| P17-06 | Ellipsis "Clear search history" calls `suggestionsStore.clearHistory` | unit | `suggestionsStore.test.ts::clearHistory` resets `searchResults + recentQueries + lastQuery` | ❌ Wave 0 |
| UAT — full happy path | User types query, sees results, taps card, remixes + saves | e2e | `npx maestro test apps/mobile/.maestro/27-something-new-search.yaml` | ❌ Wave 0 |
| UAT — segment rename regression | Kitchen segment toggle still works with new label | e2e | Rebase `20-kitchen-segment-toggle.yaml:77` from `.*Suggestions.*` → `.*Something New.*` | Partially — file exists |

### Sampling Rate

- **Per task commit (mobile):** `cd apps/mobile && pnpm test -- --run src/stores/__tests__/suggestionsStore.persist.test.ts src/stores/__tests__/suggestionsStore.test.ts src/stores/__tests__/dedupPrepend.test.ts` — under 5 seconds.
- **Per task commit (server):** `cd packages/server && pnpm test -- --run src/routes/__tests__/recipes.search.test.ts src/services/__tests__/recipeDiscovery.test.ts` — under 10 seconds.
- **Per wave merge:** `pnpm -r test` (both workspaces) — full suite.
- **Phase gate:** `pnpm -r test` GREEN + `cd apps/mobile && npx maestro test .maestro/20-kitchen-segment-toggle.yaml .maestro/06-recipe-discover.yaml .maestro/27-something-new-search.yaml` GREEN before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts` — covers P17-02, P17-03, P17-06 (partialize, searchRecipes, clearHistory). Framework: vitest + `vi.stubGlobal('fetch', ...)`.
- [ ] `apps/mobile/src/stores/__tests__/suggestionsStore.persist.test.ts` — dedicated partialize/autoFetch-exclusion test. Could also go in the file above.
- [ ] `apps/mobile/src/stores/__tests__/dedupPrepend.test.ts` — pure helper, three cases (empty, duplicate, cap-at-max).
- [ ] `apps/mobile/src/app/__tests__/search.test.ts` — source-contract test via `fs.readFileSync` (pattern from `21-05`: substring asserts on imports, testIDs, context branches).
- [ ] `apps/mobile/src/app/(tabs)/__tests__/kitchen.test.ts` — source-contract test asserting "Something New" label + no `<RegenerateFab>` + HeaderEllipsis actions.
- [ ] `packages/server/src/routes/__tests__/recipes.search.test.ts` — integration test with `createApp({ supabase: mockSupabase, anthropic: mockAnthropic })` pattern from `recipes.discover.test.ts`.
- [ ] Extend `packages/server/src/services/__tests__/recipeDiscovery.test.ts` — add `buildDiscoveryPrompt` cases for pantry-manifest inclusion + empty-manifest skip.
- [ ] `apps/mobile/.maestro/27-something-new-search.yaml` — new UAT flow exercising pill → modal → submit → results → preview → Remix → save.
- [ ] Rebase `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml` — line 77 selector update.

All framework install: none needed. Vitest, Maestro, and the mock infrastructure (`vitest.setup.ts`, `_ensure-logged-in.yaml`) are in place.

## Project Constraints (from CLAUDE.md)

Every directive below must be honored by the plans that implement Phase 17.

**Tech stack (enforced):**
- iOS-first; no Android work in this phase. `HeaderEllipsis` (ActionSheetIOS) is acceptable because the app is iOS-only.
- AI routes through the backend; mobile never holds an AI API key. All Phase 17 AI calls go through `packages/server` via `getClientFor('recipe.discovery')`.
- Supabase is the database. No direct secrets in mobile. Auth tokens are pulled via `supabase.auth.getSession()` (see `suggestionsStore.ts:23-28`).
- Backend is Hono. The new `POST /recipes/search` route lives in `packages/server/src/routes/recipes.ts` (a single Hono app).

**What NOT to use:**
- Expo Go — CLAUDE.md forbids; use EAS dev client builds. (Phase 17 adds no native modules, so existing dev client suffices.)
- `expo-av` — deprecated; none needed for Phase 17 regardless.
- Redux, React Navigation directly, GraphQL, Firebase — none relevant.
- Tailwind CSS web version — use NativeWind. Phase 17 uses existing design tokens (`colors.brand`, `colors.textPrimary`, etc.) from `apps/mobile/src/design/tokens.ts`.

**Dev environment startup (reference when planning UAT):**
- Server: `set -a && source .env && set +a && cd packages/server && pnpm dev` (port 3000).
- Metro: `cd apps/mobile && npx expo start --dev-client --lan`.
- After `.env` changes: clear Metro cache with `--clear`.
- Simulator UAT: set `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- Physical iPhone UAT: start `cloudflared tunnel --url http://localhost:3000`, update `apps/mobile/.env`, restart Metro with `--clear`.

**UAT (enforced):**
- Before reporting UI complete, validate with Maestro against iOS Simulator.
- Use `--lan` not `--tunnel` for simulator runs.
- Selectors: avoid regex specials in assertion text (Maestro treats text as regex). Prefer plain UI labels like `"Something New"`.
- Take screenshots liberally; Claude can `Read` them directly for debugging.

**GSD Workflow enforcement:**
- All edits must originate from a GSD command. For Phase 17 execution: `/gsd:execute-phase`.
- Do not make direct edits outside the workflow.

**Auth / Storage:**
- `supabase.auth.getSession()` is the canonical auth-token source (see `suggestionsStore.ts`, `discover.tsx`, `RemixSheet.tsx`). All server calls in Phase 17 must use this helper. Do not hand-roll JWT handling.

**Image handling:**
- `expo-image` for all images. Phase 17 reuses `getRecipeImage()` + `FOOD_IMAGES` constants (see `discover.tsx:19,179` + `SuggestionList.tsx:11-17`) — do not introduce raw `Image` components.

## Sources

### Primary (HIGH confidence)

- `/Users/patrickrichards/DinnerTime/CLAUDE.md` — tech stack, constraints, dev environment, UAT rules.
- `/Users/patrickrichards/DinnerTime/.planning/phases/17-something-new-ai-powered-recipe-exploration-with-search-and-remix/17-CONTEXT.md` — locked decisions.
- `/Users/patrickrichards/DinnerTime/.planning/REQUIREMENTS.md` — Phase 17 falls under "Suggestions UX reimagining (post-v1)" in ROADMAP.
- `/Users/patrickrichards/DinnerTime/.planning/STATE.md` — Phase 17 context gathered 2026-04-19; project at 98% / Phase 21 complete; Phase 12 precedent for Kitchen tab patterns.
- `apps/mobile/src/app/(tabs)/kitchen.tsx` — segmented control (line 146-186), RegenerateFab (117-132), action row (359-394), FAB render (467-468). Integration points for Phase 17.
- `apps/mobile/src/app/search.tsx` — placeholder modal awaiting Phase 17 content.
- `apps/mobile/src/app/recipes/discover.tsx` — card grid + PreviewSheet (258-365) pattern to reuse.
- `apps/mobile/src/components/recipes/RemixSheet.tsx` — inline-context support (line 36-37, 155-164).
- `apps/mobile/src/components/ui/SearchBar.tsx` — `SearchContext` union includes `'something-new'`, `StickySearchPill`.
- `apps/mobile/src/components/ui/HeaderEllipsis.tsx` — overflow-menu primitive for FAB replacement.
- `apps/mobile/src/stores/suggestionsStore.ts` — current store shape, pattern to extend.
- `apps/mobile/src/stores/preferencesStore.ts` — canonical Zustand persist + partialize + version pattern.
- `apps/mobile/src/stores/pantryStore.ts` — persist migration pattern (version 2, onRehydrateStorage Set/Array conversion) if Phase 17 ever needs migrations.
- `apps/mobile/vitest.config.ts` + `apps/mobile/vitest.setup.ts` — test infrastructure.
- `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml` — Maestro flow to rebase.
- `apps/mobile/.maestro/06-recipe-discover.yaml` — UAT pattern for discover preview flow (keep shipped).
- `packages/server/src/routes/recipes.ts` — existing `/discover` route (lines 114-187) to model new `/search` route on.
- `packages/server/src/services/recipeDiscovery.ts` — `discoverRecipes`, `buildDiscoveryPrompt`, `DiscoveryPreferences` to extend.
- `packages/server/src/services/suggestions.ts` — pantry manifest formatting pattern (`buildSuggestionPrompt`, lines 143-201).
- `packages/server/src/ai/taskRouting.ts` — `recipe.discovery` already routes to Gemini flash (line 37); no routing change needed.

### Secondary (MEDIUM confidence)

- `apps/mobile/src/app/recipes/[id]/index.tsx` — consumer example of `HeaderEllipsis` with three actions (lines 126-134).
- `apps/mobile/.maestro/scripts/uat.sh` (referenced in CLAUDE.md) — UAT helper commands.
- `packages/server/src/routes/__tests__/recipes.discover.test.ts` — test shape for new `recipes.search.test.ts` (not read in full; mentioned in file listing).

### Tertiary (LOW confidence)

- None used for critical claims. All recommendations grounded in the repository itself.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every library is already in `package.json` and in active use. No speculation.
- Architecture patterns: **HIGH** — patterns copied verbatim from 2+ existing stores / screens each.
- Pitfalls: **HIGH** — derived from reading the actual store + component code, not speculation. Pitfalls 1, 3, 4, 5 have explicit precedents in the codebase. Pitfalls 8 and 9 are UAT regressions visible from reading flow files.
- Server changes: **HIGH** — `recipeDiscovery.ts` + `recipes.ts` routes are current and stable; new route is additive.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — stable stack, active repo but Phase 17 touches no volatile deps)
