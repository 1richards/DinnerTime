# Phase 17: "Something New" — AI Recipe Exploration - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Reimagine the Suggestions segment on the Kitchen tab from a reactive "tap-to-regenerate" loop into a proactive keyword-driven recipe search. Users type keywords → see AI-generated recipe cards → optionally filter to pantry-feasible only → tap → preview → save to Recipe Box or open the existing RemixSheet.

**In scope:**
- Rename "Suggestions" segment to "Something New" (success criteria #1)
- Keyword search UI on the segment (via existing StickySearchPill + /search modal pattern)
- "From the pantry" filter toggle (binary, server-enforced)
- Persistence of previous results + recent query chips on landing
- Tap-to-remix / save-to-Recipe-Box flows reusing existing `recipes/discover.tsx` preview + `RemixSheet`
- Sparkles regenerate FAB relocated to ellipsis overflow menu

**Out of scope (new capabilities belong elsewhere):**
- Net-new recipe-authoring UX (RemixSheet already handles this)
- Full-text search across the saved Recipe Box (already shipped Phase 19)
- Cross-segment data-model consolidation (Phase 22 territory)

</domain>

<decisions_index>
## Locked Decisions — Numbered Index

Plans reference these by ID (e.g., "per D-03", "D-10 lock"). These are the canonical numbers; the narrative decisions in the `<decisions>` section below expand each one with rationale and rejected alternatives.

| ID | Decision | Plan refs |
|----|----------|-----------|
| **D-01** | Segment rename is cosmetic only: visible label flips `"Suggestions"` → `"Something New"` and accessibilityLabel follows. Persisted Zustand segment key stays `'suggestions'` — no migration, no rename of gating logic. | 17-00, 17-03 |
| **D-02** | Search entry reuses the Phase 19 StickySearchPill + `/search` modal pattern. Something New adds a new `context=something-new` branch; it does NOT introduce a second search-entry vocabulary. | 17-00, 17-03 |
| **D-03** | Preview-first tap behavior preserved: card tap → existing `recipes/discover.tsx` preview modal → "Save to Library" OR "Remix" bottom-bar buttons. No swipe actions, no direct tap-to-remix. | 17-00, 17-03 |
| **D-04** | "From the pantry" is a **binary toggle**, server-enforced: mobile sends `pantryOnly: boolean`; server loads the user's pantry manifest and constrains the AI prompt. No match-% badges, no thresholds, no client-side filtering. | 17-01, 17-03 |
| **D-05** | Recent-query chips strip renders at the top of the Something New segment when history exists. Tap replays the query with the last-known `pantryOnly` value. Max 5, deduped, most-recent first. | 17-00, 17-03 |
| **D-06** | Sparkles regenerate FAB is removed. Regenerate + Clear History move into a `HeaderEllipsis` overflow menu on the Something New segment, matching the Phase 15 pattern used on recipe detail. | 17-00, 17-03 |
| **D-07** | New server route `POST /api/v1/recipes/search` is created — NOT an extension of `POST /discover`. `/discover` stays byte-exact (shape, prompt, tests). The two routes share prompt-builder helpers but remain independently addressable. | 17-00, 17-01 |
| **D-08** | First-time users (no searchResults, no recentQueries) see the pill + hint copy + a **"Get dinner ideas from my pantry"** button. Gives empty state a concrete on-ramp instead of a blank canvas. | 17-03, 17-04 |
| **D-09** | Submit flow is **dismiss-first**: `/search` modal calls `router.back()` immediately on submit; the Something New segment owns the loading skeleton. Modal never shows a spinner — loading feedback lives where results will land. | 17-03 |
| **D-10** | Legacy `fetchSuggestions`, `clearSuggestions`, `setAutoFetch`, `autoFetch` are preserved byte-exact. `SuggestionList` (Phase 4 pantry-grounded autoFetch path) remains a reachable fallback for post-scan redirects and first-time-with-pantry-no-history users. **This is the D-10 lock** — Phase 17 must not regress the autoFetch behavior. | 17-00, 17-02, 17-03, 17-04 |
| **D-11** | Recent-query chips render in a **horizontal ScrollView** (not wrapped rows). Taste-call per Claude's discretion authorization; consistent with iOS chip patterns elsewhere in the app. | 17-00, 17-03, 17-04 |

</decisions_index>

<decisions>
## Implementation Decisions

### Segment rename (D-01)
- "Suggestions" segment label → **"Something New"** in `kitchen.tsx` segmented control
- Accessibility label updates to "Something New segment"
- Persisted zustand segment value `'suggestions'` stays as the key (rename is cosmetic only — no migration needed)

### Search entry UX (D-02)
- **Reuse the Phase 19 StickySearchPill → /search modal pattern.** Consistent with Recipe Box's search on the adjacent segment.
- Pill sits at the top of the Something New segment, placeholder text TBD during planning (candidates: "What are you craving?", "Search dinner ideas…")
- Tap pill → opens existing `/search` modal with a new context mode (e.g., `?context=something-new`) that routes the query through the AI-generation pipeline instead of the Recipe Box full-text search
- Submitting a query dismisses the modal (D-09) and lands the user back on Something New with results rendered as cards

### Result presentation + primary tap (D-03)
- **Keep preview-first pattern** already shipped in `apps/mobile/src/app/recipes/discover.tsx`
- Card tap → existing preview modal → "Save to Library" OR "Remix"
- No behavioral change to card internals — Phase 17 wires discover-style results into the Something New segment
- Swipe actions / tap-to-remix-direct were explicitly rejected (preview-first is the safer, already-built path)

### "From the pantry" filter (D-04)
- **Binary toggle.** Switch ON = AI is prompted to return only recipes that are 100% feasible from the user's current pantry
- Implementation: pass pantry-manifest to the generation prompt; constrain the prompt; no client-side filtering needed
- Match-% badges and threshold sliders explicitly rejected (adds UI noise; binary promise is clearer)
- Toggle is a pill-style control somewhere visible on the segment (exact placement is Claude's discretion during planning)

### Persistence + empty landing (D-05, D-08, D-11)
- **Return user to their last search results** when they land on the segment with no active query
- **Recent-query chips (D-05)** render at the top of the segment as tappable shortcuts — tap replays the query
- Recent query list = last N (N to be decided during planning; suggested default: 5) deduplicated, most-recent first
- Chips render in a **horizontal ScrollView (D-11)**
- Clear-history control lives in the ellipsis overflow menu (consistent with FAB relocation)
- First-time user (D-08, no history, no results): search pill with hint copy + "Get dinner ideas from my pantry" on-ramp button

### Server routing (D-07)
- **New route: `POST /api/v1/recipes/search`** — NOT a branch inside `POST /discover`
- `/discover` keeps its current shape, prompt, and test suite untouched
- The two routes may share prompt-builder helpers (e.g., `buildDiscoveryPrompt(...)`) but their external contracts are independent

### Submit → dismiss (D-09)
- `/search` modal does NOT hold the loading spinner
- On submit: call `searchRecipes(...)` then `router.back()` immediately
- The Something New segment owns the loading skeleton; users see feedback where the results will appear

### Sparkles FAB disposition (D-06)
- **Regenerate action moves to the ellipsis overflow menu** on the Something New segment
- Consistent with Phase 15's pattern of relocating secondary actions to header-ellipsis menus (precedent: recipe detail's Delete/Add-to-Plan)
- Overflow menu items (initial set): Regenerate from pantry, Clear search history
- FAB slot on the segment either stays empty or hosts the search pill only — no floating regenerate button

### Legacy preservation (D-10)
- `fetchSuggestions`, `clearSuggestions`, `setAutoFetch`, `autoFetch` semantics byte-exact
- `SuggestionList` (Phase 4 pantry-grounded autoFetch path) remains as a reachable fallback
- Phase 17 must NOT regress the autoFetch → SuggestionList post-scan flow

### Claude's Discretion
- Exact pill placeholder copy
- Exact chip styling / spacing / max visible count on landing
- Loading skeleton for AI generation
- Error states (AI failure, pantry query failure)
- Exact context-mode parameter name passed to /search modal
- ~~Whether recent query chips are horizontal scroll or wrap~~ (locked to horizontal per D-11)
- Whether preview modal CTA reads "Save to Library" or adopts the updated "Recipe Box" copy

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- **StickySearchPill** (`apps/mobile/src/components/...` — Phase 19) — already built as a sticky search affordance; currently used on Recipe Box. Same component, same /search modal target, different context parameter.
- **/search modal** (`apps/mobile/src/app/search.tsx`) — Phase 19 modal route. Extend with a `context=something-new` branch that invokes AI generation instead of full-text search.
- **recipes/discover.tsx** — existing AI-generated recipe card layout + preview modal + Save-to-Library button (`Save to Library` string preserved at line 360). Rename/move or in-place adapt this view under the Something New segment.
- **RemixSheet** (`apps/mobile/src/components/recipes/RemixSheet.tsx`) — existing 4-mode remix sheet; preview modal already routes here for "Save as new recipe" variations.
- **suggestionsStore** (`apps/mobile/src/stores/suggestionsStore.ts`) — current `fetchSuggestions` action. Extend with `searchRecipes(query, options)` and persist last results + recent queries to AsyncStorage (Zustand persist middleware is already established repo-wide).
- **recipeStore** (`apps/mobile/src/stores/recipeStore.ts`) — saves into Recipe Box. Existing `addRecipe` / `saveFromDiscover` path is reusable.

### Established Patterns
- Sticky pill → /search modal navigation is the canonical search entry (Phase 19). Reusing it avoids a second search-entry vocabulary in the app.
- Ellipsis overflow menu for secondary actions is the shipped pattern from Phase 15 (recipe detail header). Regenerate + Clear History belong there.
- Zustand + React Query split: UI state (segment, pill state) → Zustand; server state (AI results) → React Query with a cache-key that includes query + pantry-filter-toggle.

### Integration Points
- `apps/mobile/src/app/(tabs)/kitchen.tsx:150-185` — segment definition. Label swap + accessibilityLabel update land here.
- `apps/mobile/src/app/(tabs)/kitchen.tsx` SuggestionsHeader (line ~193) — where the hero + greeting + segmented control live. The pill needs to render above results when segment === 'suggestions'.
- `apps/mobile/src/app/search.tsx` — add new context branch + AI-generation path.
- `packages/server/src/routes/ai.ts` (or equivalent) — may need a new `/ai/recipe-search` endpoint or an extension of the existing suggestions endpoint that accepts `query` + `pantryOnly` parameters. Planning decides.

</code_context>

<specifics>
## Specific Ideas

- User selected "Recommended" on all four primary gray areas — the shipped decisions are the conservative-reuse path (Phase 19 StickySearchPill, Phase 19 /search modal, existing discover.tsx preview flow, existing RemixSheet). Signal: do not invent new UI vocabulary for this phase.
- FAB → overflow-menu decision cites Phase 15 as precedent — align styling with the existing header-ellipsis menus on recipe detail.
- Segment rename is purely cosmetic; the underlying 'suggestions' key in Zustand is kept for backward compatibility of persisted segment state.

</specifics>

<deferred>
## Deferred Ideas

- **Match-percentage badges on cards** — rejected for this phase (binary pantry filter wins). If the binary promise feels too restrictive after beta feedback, revisit as a future enhancement.
- **Tap-to-remix direct** — rejected in favor of preview-first. If we observe the preview modal friction drops save/remix rates post-beta, revisit.
- **Surprise-me FAB variant** — mentioned as an option but user chose overflow menu instead. If we want a fast "just give me something" action later, consider elevating from overflow to a prominent but non-primary affordance.
- **Recipe corpus expansion / cuisine fine-tuning** — investor brief roadmap item; different phase (post-beta or Phase 24b vision-quality work).

</deferred>

---

*Phase: 17-something-new-ai-powered-recipe-exploration-with-search-and-remix*
*Context gathered: 2026-04-20*
*Decisions index added: 2026-04-20 (revision — plans reference D-XX codes that needed a source)*
