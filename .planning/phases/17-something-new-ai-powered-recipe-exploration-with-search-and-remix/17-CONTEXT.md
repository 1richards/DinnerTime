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

<decisions>
## Implementation Decisions

### Segment rename
- "Suggestions" segment label → **"Something New"** in `kitchen.tsx` segmented control
- Accessibility label updates to "Something New segment"
- Persisted zustand segment value `'suggestions'` stays as the key (rename is cosmetic only — no migration needed)

### Search entry UX
- **Reuse the Phase 19 StickySearchPill → /search modal pattern.** Consistent with Recipe Box's search on the adjacent segment.
- Pill sits at the top of the Something New segment, placeholder text TBD during planning (candidates: "What are you craving?", "Search dinner ideas…")
- Tap pill → opens existing `/search` modal with a new context mode (e.g., `?context=something-new`) that routes the query through the AI-generation pipeline instead of the Recipe Box full-text search
- Submitting a query dismisses the modal and lands the user back on Something New with results rendered as cards

### Result presentation + primary tap
- **Keep preview-first pattern** already shipped in `apps/mobile/src/app/recipes/discover.tsx`
- Card tap → existing preview modal → "Save to Library" OR "Remix"
- No behavioral change to card internals — Phase 17 wires discover-style results into the Something New segment
- Swipe actions / tap-to-remix-direct were explicitly rejected (preview-first is the safer, already-built path)

### "From the pantry" filter
- **Binary toggle.** Switch ON = AI is prompted to return only recipes that are 100% feasible from the user's current pantry
- Implementation: pass pantry-manifest to the generation prompt; constrain the prompt; no client-side filtering needed
- Match-% badges and threshold sliders explicitly rejected (adds UI noise; binary promise is clearer)
- Toggle is a pill-style control somewhere visible on the segment (exact placement is Claude's discretion during planning)

### Persistence + empty landing
- **Return user to their last search results** when they land on the segment with no active query
- **Recent-query chips** render at the top of the segment as tappable shortcuts — tap replays the query
- Recent query list = last N (N to be decided during planning; suggested default: 5) deduplicated, most-recent first
- Clear-history control lives in the ellipsis overflow menu (consistent with FAB relocation)
- First-time user (no history, no results): search pill with hint copy, no card area

### Sparkles FAB disposition
- **Regenerate action moves to the ellipsis overflow menu** on the Something New segment
- Consistent with Phase 15's pattern of relocating secondary actions to header-ellipsis menus (precedent: recipe detail's Delete/Add-to-Plan)
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
