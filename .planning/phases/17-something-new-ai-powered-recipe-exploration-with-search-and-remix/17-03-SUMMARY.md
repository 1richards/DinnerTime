---
phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
plan: 03
subsystem: mobile-ui
tags: [expo-router, zustand, search-modal, stickysearchpill, headerellipsis, remixsheet, preview-sheet]

# Dependency graph
requires:
  - phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
    provides: 17-00 Wave 0 source-contract tests (search.test.ts + kitchen.test.ts + discover.test.ts Phase 17 describe block) — 11 red tests this plan flips green
  - phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
    provides: 17-01 POST /api/v1/recipes/search endpoint (consumed via suggestionsStore.searchRecipes on dismiss-first submit)
  - phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix
    provides: 17-02 suggestionsStore.searchRecipes + clearHistory + persisted searchResults/recentQueries/lastQuery/pantryOnly
  - phase: 15-taste-exploration
    provides: RemixSheet 4-mode inline-source pattern (kind:'inline' — consumed here by PreviewSheet Remix button)
  - phase: 19-search-consolidation
    provides: StickySearchPill + /search modal context-param pattern (new branch context='something-new' lands here)
provides:
  - /search?context=something-new modal UI (TextInput autoFocus + pantry Switch + Submit) that dispatches to useSuggestionsStore.searchRecipes and dismisses via router.back (D-09)
  - Something New segment header stack: StickySearchPill + RecentQueryChips + SomethingNewResults | FirstTimeHint | SuggestionList (D-10 fallback)
  - PreviewSheet Remix button that opens inline-source RemixSheet (P17-05)
  - HeaderEllipsis overflow menu with Regenerate from pantry + Clear search history (D-06)
  - First-time on-ramp: "Get dinner ideas from my pantry" button (D-08)
  - Exported PreviewSheet + DiscoveredRecipe from recipes/discover.tsx (reusable for kitchen.tsx Something New results)
  - Three new reusable components: SomethingNewResults, RecentQueryChips, PantryOnlyToggle
affects:
  - 17-04 (UAT) — Maestro flow 27 can now walk the full pill → search → pantry toggle → results → preview → Save/Remix path end-to-end
  - 17-04 (UAT) — Maestro flow 20 rebase (Suggestions → Something New selector) unblocked

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dismiss-first submit (D-09): /search modal calls router.back() immediately after firing searchRecipes; loading skeleton lives where results land, not in the modal"
    - "Segment-owns-loading: SomethingNewResults reads isLoading from the store directly and renders SuggestionSkeleton — kitchen.tsx doesn't hold modal state"
    - "Inline JSX text expression for source-contract matching: `>{'Something New'}</Text>` keeps the literal on a single source line so substring assertions match despite prettier's default JSX-text wrapping (Rule 3 deviation below)"
    - "Render-tree priority for Something New segment: Phase 17 results → first-time hint → legacy SuggestionList (D-10 preservation via hasResults/hasHistory/hasLegacySuggestionsPath flags)"
    - "Inline-source RemixSheet for unsaved previews: kind:'inline' + context:{title, description, ingredients, total_time_minutes} avoids needing a recipe.id (Discover cards have none)"

key-files:
  created:
    - "apps/mobile/src/components/suggestions/SomethingNewResults.tsx"
    - "apps/mobile/src/components/suggestions/RecentQueryChips.tsx"
    - "apps/mobile/src/components/suggestions/PantryOnlyToggle.tsx"
  modified:
    - "apps/mobile/src/app/(tabs)/kitchen.tsx"
    - "apps/mobile/src/app/search.tsx"
    - "apps/mobile/src/app/recipes/discover.tsx"

key-decisions:
  - "Inline-exported PreviewSheet (not extracted to components/recipes/PreviewSheet.tsx): planner's preferred path; lower blast radius for Phase 17, deferrable refactor. DiscoveredRecipe type exported alongside"
  - "Deleted RegenerateFab entirely (not just unmounted): no other consumers (grep confirmed); removes dead code rather than leaving an unreachable function"
  - "Inlined FirstTimeHint + SomethingNewEllipsis in kitchen.tsx (not extracted): both are kitchen-specific render helpers with store-state callbacks and no reusable surface; extraction would only add file-count noise"
  - "Used Animated.ScrollView (not FlatList) for the Something New segment: render tree branches between grid/first-time/fallback aren't uniform list items; ScrollView keeps the collapsing-header scrollY wiring intact and allows the sub-component to own its own internal ScrollView (SomethingNewResults)"
  - "Segment JSX text written as `>{'Something New'}</Text>` (single line) instead of prettier-wrapped text child: required so the Wave 0 source-contract test's `SOURCE.includes(\"'Something New'\")` substring assertion matches. Documented as Deviation 1 (Rule 3 — blocking)"
  - "Preview hero URI derivation: kitchen.tsx uses `getRecipeImage('something-new-${title}', image_url)` to match the SomethingNewResults card hero so the preview modal opens with the same image the card showed"
  - "PantryOnlyToggle component built per plan but NOT mounted in Plan 03: the /search modal owns the actual submit (via Switch); the Kitchen-segment pill-toggle placement was Claude's discretion and ultimately deferred — toggle state is rehydrated into the /search modal on next open (via useSuggestionsStore.pantryOnly). Component stays available for a future placement pass without rework"

patterns-established:
  - "Source-contract-friendly JSX: single-line `>{'Label'}</Text>` literal expression keeps substring assertions robust against prettier's text-child wrapping"
  - "Shared-preview-sheet pattern: the first screen that owns a preview (discover.tsx) exports it; downstream screens (kitchen.tsx Something New) import and mount with their own state glue — no parallel implementations"
  - "Segment-owns-loading: the surface where results land renders the loading skeleton; modal routes that dispatch an async action dismiss immediately (D-09)"

requirements-completed: [P17-01, P17-02, P17-03, P17-05, P17-06]

# Metrics
duration: 7 min
completed: 2026-04-21
---

# Phase 17 Plan 03: Mobile Something New UI Rewire Summary

**Segment rename + sticky search pill + /search modal branch + preview Remix button + overflow ellipsis menu + 3 new components — flips 11 Wave 0 screen source-contract tests red→green with zero regressions. Kitchen tab's Something New segment now wires every Phase 17 behavior into its shipping surface.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-21T03:06:22Z
- **Completed:** 2026-04-21T03:13:13Z
- **Tasks:** 3
- **Files created:** 3 (Something New components)
- **Files modified:** 3 (kitchen.tsx, search.tsx, recipes/discover.tsx)

## Accomplishments

- **Task 1 — Phase 17 presentation components:** Created `SomethingNewResults` (results grid + skeleton + error + empty states, mirrors discover.tsx card styling, lifts preview tap via `onRequestPreview`), `RecentQueryChips` (horizontal ScrollView chips strip per D-11), and `PantryOnlyToggle` (pill-style binary toggle per D-04). All three consume `useSuggestionsStore` directly where needed and use design tokens exclusively — zero literal hex/px beyond mirrored discover.tsx card styles. All three compile cleanly.
- **Task 2 — PreviewSheet gains Remix button:** Added the second bottom-bar CTA alongside "Save to Library" (D-03 preview-first preserved). Remix opens a `RemixSheet` with `kind:'inline'` source — no recipe.id required (discover cards don't have one). Pitfall 9 preserved byte-exact — `saveRecipe({...parsed, source_type:'ai'})` stamp intact. Exported `PreviewSheet` + `DiscoveredRecipe` type so `kitchen.tsx` can reuse the sheet for Something New results. All 4 `discover.test.ts` cases green.
- **Task 3A — search.tsx Something New branch:** Replaced the placeholder with a `context === 'something-new'` switch. Renders TextInput (autoFocus, returnKeyType='search') + Switch (pantryOnly) + Button (Search). Submit trims, guards empty queries, fires `searchRecipes(query, {pantryOnly})`, then `router.back()` immediately (D-09 dismiss-first). Pitfall 6 preserved — legacy library/pantry placeholder echo remains reachable as fallback. All 5 `search.test.ts` cases green.
- **Task 3B — kitchen.tsx rewire:** Flipped segment label "Suggestions" → "Something New" + accessibilityLabel "Something New segment" (D-01 cosmetic; `segment === 'suggestions'` gates untouched). Deleted `RegenerateFab` function + JSX mount entirely. Mounted `StickySearchPill` (context='something-new') on the Something New segment. Added `HeaderEllipsis` overflow menu in the action row slot (Regenerate from pantry + Clear search history). Built the render tree: recent-query chips (when history) → results grid (when results/loading) → first-time hint (no history + no active legacy path) → SuggestionList fallback (D-10 autoFetch/post-scan). Added inline `FirstTimeHint` with "Get dinner ideas from my pantry" button (D-08). Mounted `PreviewSheet` at screen root in a modal, wired `saveRecipe({...recipe, source_type:'ai'})` (Pitfall 9 invariant). All 6 `kitchen.test.ts` cases green.
- **Test delta:** 11 Wave 0 screen tests red → green. Full mobile suite: **440 pass / 4 fail** (was 429 pass / 15 fail). The 4 remaining failures are pre-existing baseline (auth-store onboarding, progressionStore fetchVariations, shoppingStore × 2) — unchanged from Wave 2. Zero Phase 17 regressions. Server suite unchanged at 610/612 (2 pre-existing failures). TypeScript `--noEmit` clean.

## Task Commits

1. **Task 1 — Something New presentation components:** `33ad53a` (feat) — SomethingNewResults + RecentQueryChips + PantryOnlyToggle
2. **Task 2 — PreviewSheet Remix button + export:** `5376637` (feat) — Remix button wired to inline-source RemixSheet; PreviewSheet + DiscoveredRecipe exported
3. **Task 3 — kitchen.tsx + search.tsx rewire:** `59b8b12` (feat) — segment rename, RegenerateFab removed, HeaderEllipsis mounted, pill + chips + results + first-time hint wired, /search something-new branch

_Plan metadata commit follows this SUMMARY._

## Files Changed

| File | Type | LOC | Purpose |
|------|------|-----|---------|
| `apps/mobile/src/components/suggestions/SomethingNewResults.tsx` | CREATED | 252 | Results grid + loading/error/empty states, PreviewSheet trigger |
| `apps/mobile/src/components/suggestions/RecentQueryChips.tsx` | CREATED | 66 | Horizontal ScrollView chip strip (D-11) |
| `apps/mobile/src/components/suggestions/PantryOnlyToggle.tsx` | CREATED | 89 | Pill-style binary toggle (D-04; built but not mounted in Plan 03 — see Decisions) |
| `apps/mobile/src/app/(tabs)/kitchen.tsx` | MODIFIED | 527 → 698 (+171) | Segment rename + RegenerateFab removal + StickySearchPill + HeaderEllipsis + RecentQueryChips + SomethingNewResults + FirstTimeHint + SuggestionList fallback + PreviewSheet modal |
| `apps/mobile/src/app/search.tsx` | MODIFIED | 28 → 126 (+98) | SomethingNewSearch branch (TextInput + Switch + Submit + D-09 dismiss-first); Pitfall 6 fallback preserved |
| `apps/mobile/src/app/recipes/discover.tsx` | MODIFIED | 576 → 620 (+44) | PreviewSheet gains Remix button + RemixSheet mount; PreviewSheet + DiscoveredRecipe exported |

**kitchen.tsx LOC delta: +171** (527 → 698). Most comes from (a) the Animated.ScrollView tree that replaces the single SuggestionList wrapper, (b) the Something New render-tree branching (results/first-time/fallback), (c) the PreviewSheet Modal wiring at root, (d) the SomethingNewEllipsis helper, (e) the FirstTimeHint helper.

## Test Counts (apps/mobile — Phase 17 screen surface)

**Before this plan (Wave 2 baseline):**
- `search.test.ts`: 1 green / 4 red
- `kitchen.test.ts`: 1 green / 5 red
- `discover.test.ts`: 2 green / 2 red
- **Total Phase 17 screen red: 11 signals**

**After this plan:**
- `search.test.ts`: **5 green / 0 red** ✅
- `kitchen.test.ts`: **6 green / 0 red** ✅
- `discover.test.ts`: **4 green / 0 red** ✅
- **Phase 17 delta: 11 red → 11 green. Zero regressions.**

**Full mobile suite:** 440 green / 4 red. The 4 remaining failures are pre-existing baseline (auth-store, progressionStore, shoppingStore × 2) — unchanged from Wave 2.

**Full server suite:** 610 green / 2 red — unchanged baseline from Wave 1.

## TypeScript Verification

`cd apps/mobile && pnpm tsc --noEmit` exits 0 (clean). No new errors introduced.

## Decisions Made

- **Inline export of PreviewSheet** (preferred path in plan). DiscoveredRecipe type exported alongside. Keeps discover.tsx as the single source of the preview UI; downstream consumers (kitchen.tsx) import it. Future refactor to `components/recipes/PreviewSheet.tsx` remains clean because the current export shape is already the final API.
- **Deleted RegenerateFab entirely.** Grep confirmed no other consumers (`apps/mobile/src`). Leaving the function as dead code would pollute the symbol table and fail any future lint sweep; removing it is lower-risk than keeping it.
- **Inlined FirstTimeHint + SomethingNewEllipsis in kitchen.tsx.** Both are kitchen-specific render helpers with store-state callbacks. Extracting them would add file-count noise without a reuse story.
- **Animated.ScrollView (not FlatList) for the Something New surface.** The render tree is heterogeneous (header + chips + one of three branches), not a uniform list. ScrollView preserves the collapsing-header scrollY wiring while letting `SomethingNewResults` own its own internal ScrollView.
- **Segment JSX text on a single line:** `>{'Something New'}</Text>` is a deliberate formatting choice to match the Wave 0 source-contract test's substring assertion (`SOURCE.includes("'Something New'")`). See Deviations below.
- **Preview hero URI derivation keyed on the title:** `getRecipeImage('something-new-${title}', image_url)` matches the key used by SomethingNewResults card hero so the preview opens with the same image the card showed.
- **PantryOnlyToggle component built but NOT mounted on the segment in Plan 03.** The /search modal uses a native Switch (locks the test contract on "Switch" import), and the Kitchen-segment pill-toggle placement was tagged as Claude's discretion in the plan. Deferring the placement pass avoids committing to a visual choice before UAT in Plan 04. Toggle state is rehydrated from `useSuggestionsStore.pantryOnly` on every /search modal open, so the UX is consistent even without an on-segment toggle.
- **D-10 fallback-trigger logic:** `hasLegacySuggestionsPath = autoFetch || legacySuggestions.length > 0`. The SuggestionList renders when neither Phase 17 results nor recentQueries exist AND either (a) the autoFetch signal is set (post-scan flow) or (b) the store already has legacy suggestions in memory. First-time hint renders only when BOTH Phase 17 and legacy paths are empty.
- **`useRecipeStore.getState().saveRecipe` not used for the preview Save handler.** Instead used a subscribed selector (`const saveRecipe = useRecipeStore((s) => s.saveRecipe)`) so the Kitchen screen participates in React's render cycle. Matches the existing `discover.tsx` pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] JSX text wrapping broke Wave 0 source-contract substring assertion**

- **Found during:** Task 3 (after rewriting kitchen.tsx segmented control)
- **Issue:** The Wave 0 test `kitchen.test.ts` asserts `SOURCE.includes('>Something New<') || SOURCE.includes("'Something New'") || SOURCE.includes('"Something New"')`. My initial rewrite had the JSX text child wrapped across lines by prettier:
  ```jsx
  <Text ...>
    Something New
  </Text>
  ```
  None of the three substrings match because there's whitespace/newlines between `>` and `Something New` and between `Something New` and `</Text>`. The `accessibilityLabel="Something New segment"` line contains "Something New" but not the exact `"Something New"` form (it's `"Something New segment"`). Initial verification showed 14/15 cases green with 1 failure.
- **Fix:** Changed the JSX text child to a single-line JSX expression: `>{'Something New'}</Text>`. This puts the literal `'Something New'` into the source file verbatim, matching the `SOURCE.includes("'Something New'")` branch. Cosmetic parity with the pre-existing `>Suggestions<` behavior preserved at runtime (both render the same visible text).
- **Files modified:** `apps/mobile/src/app/(tabs)/kitchen.tsx`
- **Verification:** All 6 `kitchen.test.ts` cases green post-fix. Full 15/15 Wave 0 screen tests green.
- **Committed in:** `59b8b12` (Task 3 commit — the rewrite and the fix landed together)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The Wave 0 test's substring contract was written assuming a particular JSX formatting. The `>{'Something New'}</Text>` form preserves the test's intent (locking the visible segment label to "Something New") while surviving prettier's text-child wrapping. Pattern documented in "patterns-established" so future source-contract tests + JSX text slots stay in sync. No scope creep.

## Issues Encountered

- **Pre-existing baseline failures unchanged:** 4 mobile (auth-store onboarding, progressionStore fetchVariations, shoppingStore × 2) + 2 server (taskRouting env, meal-plans AI generate) — all flagged as baseline in the Wave 0 SUMMARY and Wave 2 SUMMARY. Not touched by this plan.

## User Setup Required

None — no external service configuration, no new dependencies, no env-var changes. All primitives consumed (StickySearchPill, HeaderEllipsis, RemixSheet, PreviewSheet, Button, SymbolIcon) were already in the repo.

## autoFetch Interaction Corner Cases

- **Post-scan redirect lands on Something New with empty results:** autoFetch → true, legacySuggestions === [] initially. `hasLegacySuggestionsPath = true` ensures SuggestionList mounts (D-10 preserved); FirstTimeHint is skipped. Once SuggestionList's useEffect fires fetchSuggestions, `legacySuggestions` populates and the fallback renders its result cards as before.
- **User with legacy suggestions in memory + empty Phase 17 state:** `legacySuggestions.length > 0` → SuggestionList fallback renders. As soon as the user submits a Phase 17 query via the search pill, `hasResults=true` flips and SomethingNewResults takes over. The legacy suggestions remain in the store (nothing clears them) and will reappear if the user calls `clearHistory()` on the Phase 17 state without having any recentQueries.
- **First-time user without pantry:** FirstTimeHint's "Get dinner ideas from my pantry" calls `searchRecipes('', { pantryOnly: true })`. Plan 17-01's server route handles empty pantry manifests gracefully (`pantryManifest` becomes `[]` → prompt omits the PANTRY CONSTRAINT section). Behavior is "search without query AND without pantry constraint at the prompt level" — functionally equivalent to "surprise me".
- **Store hydration race:** Wave 2 persists `searchResults, recentQueries, lastQuery, pantryOnly` but NOT `autoFetch` (Pitfall 1). On cold launch, `autoFetch` is false, `legacySuggestions` is [] (not persisted by the legacy shape either), so `hasLegacySuggestionsPath === false`. If the user had Phase 17 results from the last session → SomethingNewResults shows them; if not but has recentQueries → chips strip; if neither → FirstTimeHint. All three branches work correctly.

## Next Phase Readiness

- **Plan 17-04 (UAT) unblocked.** Maestro flow `27-something-new-search.yaml` can exercise the full user path: open Something New segment → tap search pill → type query → toggle pantry Switch → submit → observe dismiss-first loading → observe results grid → tap card → observe preview modal → tap Remix → observe RemixSheet mode picker. Maestro flow 20 rebase (Suggestions → Something New selector at line ~77) also unblocked.
- **Deferred for Plan 17-04 or later:** Mounting `PantryOnlyToggle` on the segment (if the /search Switch isn't enough). Extracting PreviewSheet into `components/recipes/PreviewSheet.tsx` (cosmetic refactor; current export shape is already stable). Inline-SuggestionHeader collapsing-header shim for the SomethingNewResults internal ScrollView (two nested ScrollViews currently — acceptable because the inner one has fixed height and doesn't compete for the gesture, but could be unified if Maestro reveals jank).
- **Blockers / concerns:** None. All three Phase 17 Wave 0 screen test files green. TypeScript clean. 4 pre-existing failures remain baseline. Flow 20 needs a one-line selector rebase (Suggestions → Something New) in Plan 17-04's task list.

---

## Self-Check: PASSED

**Files verified on disk:**
- FOUND: `apps/mobile/src/components/suggestions/SomethingNewResults.tsx` (252 lines, exports `SomethingNewResults`)
- FOUND: `apps/mobile/src/components/suggestions/RecentQueryChips.tsx` (66 lines, exports `RecentQueryChips`)
- FOUND: `apps/mobile/src/components/suggestions/PantryOnlyToggle.tsx` (89 lines, exports `PantryOnlyToggle`)
- FOUND: `apps/mobile/src/app/(tabs)/kitchen.tsx` (698 lines; contains "Something New" label, `HeaderEllipsis`, `StickySearchPill` with `context="something-new"`, no `<RegenerateFab />` JSX)
- FOUND: `apps/mobile/src/app/search.tsx` (126 lines; contains `SomethingNewSearch` function, `context === 'something-new'` branch, `router.back()` + `searchRecipes(`)
- FOUND: `apps/mobile/src/app/recipes/discover.tsx` (620 lines; contains `<RemixSheet`, `kind: 'inline'`, `title="Remix"`, preserved `source_type: 'ai'` + `Save to Library`)

**Commits verified via `git log --oneline`:**
- FOUND: `33ad53a` — Task 1 (Something New presentation components)
- FOUND: `5376637` — Task 2 (PreviewSheet Remix button + export)
- FOUND: `59b8b12` — Task 3 (kitchen rename + wire + search branch)

**Test outcomes verified:**
- FOUND: `search.test.ts` 5/5 green
- FOUND: `kitchen.test.ts` 6/6 green
- FOUND: `discover.test.ts` 4/4 green
- FOUND: Full mobile suite 440/444 pass (4 pre-existing baseline failures unchanged)
- FOUND: TypeScript `pnpm tsc --noEmit` exit code 0

*Phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix*
*Completed: 2026-04-21*
