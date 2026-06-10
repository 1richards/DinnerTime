---
phase: 29-something-new-lightweight-first-generation-29s-3-5s
plan: 04
subsystem: mobile-client
tags: [hydration-gate, save-safety, preview-sheet, loading-affordance, d5, d6]

# Dependency graph
requires:
  - phase: 29-something-new-lightweight-first-generation-29s-3-5s
    plan: 03
    provides: "useHydratedRecipeContent — prefetchHydration(preview) (returns inflight promise) + hydrationStatusFor; suggestionsStore background-patches searchResults[i] ingredients+steps as hydration lands (the live 'hydrated' signal)"
provides:
  - "D5 save-safety gate: every Something New save/cook/favorite/plan surface awaits in-flight hydration (or bails with a 'Still preparing' alert) before POST /recipes / addToPlan — an un-hydrated save can never 400"
  - "previewFrom exported from useHydratedRecipeContent as the single source of truth (suggestionsStore + SomethingNewResults + kitchen.tsx all map a recipe identically → same cache key resolves across surfaces)"
  - "RecipeCard PreviewActions.hydrating — subtle dimmed affordance while a preview's content fills (card stays tappable)"
  - "PreviewSheet ingredientsLoading prop (D6) mirroring stepsLoading — 'Gathering ingredients…' spinner instead of a bald empty-state; kitchen.tsx wires both from previewRecipe"
affects: [29-04-deploy-measure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Await-in-flight-hydration gate: ensureHydrated()/ensurePreviewHydrated() are no-op pass-throughs when ingredients+steps are already non-empty, else await prefetchHydration(previewFrom(recipe)) and either return a content-complete recipe or null+Alert — the single shared shape used by all save handlers"
    - "Loader-mirrors-its-sibling: the new ingredients loading branch reuses the exact sheetStepsLoading style + ActivityIndicator pattern already proven for steps, so the two affordances are visually identical"

key-files:
  created: []
  modified:
    - apps/mobile/src/hooks/useHydratedRecipeContent.ts
    - apps/mobile/src/stores/suggestionsStore.ts
    - apps/mobile/src/stores/__tests__/suggestionsStore.test.ts
    - apps/mobile/src/components/recipes/RecipeCard.tsx
    - apps/mobile/src/components/suggestions/SomethingNewResults.tsx
    - apps/mobile/src/app/(tabs)/kitchen.tsx
    - apps/mobile/src/app/recipes/discover.tsx

key-decisions:
  - "Authoritative gate = ingredients.length>0 && steps.length>0 (exactly what POST /recipes requires) rather than hydrationStatusFor — the store patches these onto the recipe as hydration lands (29-03), so the non-empty arrays ARE the live, server-equivalent 'safe to save' signal; status is the in-flight indicator only"
  - "previewFrom moved into the hook module and exported; suggestionsStore's local copy deleted. One definition guarantees every surface produces the same hydration cache key, so an await on one surface resolves a prefetch kicked by another"
  - "kitchen's 4 save surfaces (handlePreviewSave, handlePreviewCookNow, inline onCookLater→addToPlan, inline onAdHocFavorite) share one ensurePreviewHydrated() helper; onCookLater gated too because addToPlan persists the recipe"
  - "Added a prefetch-on-sheet-open effect in kitchen.tsx so a stale persisted previewRecipe (whose 29-03 background hydration wasn't re-kicked) starts hydrating while the sheet is up — the D6 loaders then resolve in place; prefetchHydration is no-op-cached so it's cheap"
  - "hydrating affordance is a dim (opacity 0.5) on the action cluster, NOT a disable — the await-path is the correctness mechanism; a hard disable would make the card feel broken while a tap-then-wait succeeds"

requirements-completed: [D5, D6]

# Metrics
duration: 9min
completed: 2026-06-09
---

# Phase 29 Plan 04: Save/Cook/Favorite hydration gate + PreviewSheet loaders Summary

**Closes the CRITICAL `POST /recipes` 400 gap: every Something New save surface (3 in `SomethingNewResults`, 4 in `kitchen.tsx`) now awaits in-flight background hydration via a shared `ensureHydrated`/`ensurePreviewHydrated` helper before saving/cooking/planning — returning a content-complete recipe or bailing with a "Still preparing" alert, so an un-hydrated tap can never POST empty ingredients/steps. PreviewSheet gains an `ingredientsLoading` affordance mirroring the existing `stepsLoading`, wired from `previewRecipe`, so a hydrating preview shows "Gathering ingredients…" / "Generating steps…" spinners instead of a bald empty-state flash.**

## Performance

- **Duration:** ~9 min
- **Tasks:** 2 code tasks (Task 3 is a human-verify checkpoint — deferred, see below)
- **Files modified:** 7
- **Tests:** 56/56 green across the relevant suites (20 store+hook, 36 recipes app+components); `tsc --noEmit` no new errors in any touched file

## Accomplishments

- **D5 — every save surface gated (Task 1):**
  - `SomethingNewResults.PreviewRecipeCard`: derived `hydrated = ingredients.length>0 && steps.length>0`; new `ensureHydrated()` awaits `prefetchHydration(previewFrom(recipe))`, patches the resolved `{ ingredients, steps, nutrition }` onto the save body, or alerts + bails on null. Applied at the TOP of `handleSave`, `handleSaveAndFavorite`, `handleCookNow`. `pantryMatchCount` left as-is (reduces over `[]` → 0, self-corrects on hydrate) with an explanatory comment.
  - `kitchen.tsx`: `ensurePreviewHydrated()` mirrors the same shape and gates `handlePreviewSave`, `handlePreviewCookNow`, the inline `onCookLater` (which calls `addToPlan` — also persists), and the inline `onAdHocFavorite`. Added a prefetch-on-open `useEffect` to self-heal stale persisted previews.
  - `RecipeCard`: new `PreviewActions.hydrating` flag dims the action cluster (opacity 0.5) while content fills; card stays tappable.
- **previewFrom unified (Task 1):** exported from `useHydratedRecipeContent.ts`; `suggestionsStore` deleted its local copy and imports the shared one — guarantees one cache key per preview across store + both UI surfaces.
- **D6 — PreviewSheet loaders (Task 2):** added `ingredientsLoading?: boolean` to `discover.tsx PreviewSheet`; the ingredients empty-branch now renders the `sheetStepsLoading` spinner + "Gathering ingredients…" while loading (reusing the steps pattern) instead of "No ingredients listed." `kitchen.tsx` passes `stepsLoading={previewRecipe.steps.length===0}` and `ingredientsLoading={previewRecipe.ingredients.length===0}` so both flip false the instant hydration patches content in.

## Task Commits

Each code task committed atomically (normal `git commit` to `main`, sequential, no `--no-verify`):

1. **Task 1: gate Save/Cook/Favorite on hydration across all save surfaces (D5)** — `a4b1e48` (feat) — useHydratedRecipeContent, suggestionsStore (+test), RecipeCard, SomethingNewResults, kitchen.tsx. _Includes the kitchen `stepsLoading`/`ingredientsLoading` prop wiring (same file, committed once)._
2. **Task 2: PreviewSheet ingredientsLoading affordance + stepsLoading (D6)** — `267e777` (feat) — discover.tsx PreviewSheet.

## Files Created/Modified

- `apps/mobile/src/hooks/useHydratedRecipeContent.ts` (modified) — exported `previewFrom(r: ParsedRecipe): HydratePreview` as the single source of truth.
- `apps/mobile/src/stores/suggestionsStore.ts` (modified) — import shared `previewFrom`, deleted local copy.
- `apps/mobile/src/stores/__tests__/suggestionsStore.test.ts` (modified) — hydration-hook mock now exports a passthrough `previewFrom` (the store maps through it before the mocked `prefetchHydration`).
- `apps/mobile/src/components/recipes/RecipeCard.tsx` (modified) — `PreviewActions.hydrating` + dim-cluster affordance.
- `apps/mobile/src/components/suggestions/SomethingNewResults.tsx` (modified) — `hydrated` derivation, `ensureHydrated()` gate on all 3 handlers, `hydrating` passed to `previewActions`.
- `apps/mobile/src/app/(tabs)/kitchen.tsx` (modified) — `ensurePreviewHydrated()` gate on all 4 preview save surfaces, prefetch-on-open effect, PreviewSheet `stepsLoading`/`ingredientsLoading` wiring.
- `apps/mobile/src/app/recipes/discover.tsx` (modified) — `ingredientsLoading` prop + render branch.

## Decisions Made

- **Non-empty arrays are the gate, not `hydrationStatusFor`** — they're exactly what the server requires and the store patches them in as hydration lands, so they're the live, server-equivalent signal. `hydrationStatusFor` remains available as the in-flight indicator.
- **One `previewFrom`** so a prefetch kicked on any surface resolves an await on any other (shared cache key).
- **onCookLater gated** because `addToPlan` persists the recipe — an un-hydrated plan entry would be just as broken as an un-hydrated save.
- **Prefetch-on-sheet-open** covers the D7 edge where a persisted preview's background hydration wasn't re-kicked: the sheet's loaders then resolve in place.
- **Dim, don't disable** the action cluster while hydrating — the await-path is the correctness mechanism; tap-then-wait must still succeed.

## Deviations from Plan

None — plan executed as written. The `ingredients.length>0 && steps.length>0` non-empty check was used as the authoritative gate (the plan's interfaces note explicitly endorses this as "a reliable 'hydrated' signal for the store-backed cards" and "the simplest gate"), with `prefetchHydration(previewFrom(...))` as the await-fallback exactly as specified.

## Deferred — On-Device Human Verification (Task 3 checkpoint)

**Status: DEFERRED (not blocking).** Plan 29-04 Task 3 is a `checkpoint:human-verify` requiring a booted simulator / device to confirm the end-to-end flow. This session ran **autonomously with no device available**, so the checkpoint was NOT executed as a blocking gate. The two code tasks are fully implemented and grep/test-verifiable; the on-device confirmation is carried forward to the phase's **deploy/measure gate on EAS build #26**.

To confirm on build #26 (per the plan's `how-to-verify`):

1. Backend + Metro per CLAUDE.md (sim: `EXPO_PUBLIC_API_URL=http://localhost:3000`, `npx expo start --dev-client --lan`), server running the 29-01/29-02 changes.
2. Kitchen → Something New, run a pantry-only search → cards appear in ~3-5s (watch Fly `recipes.search` line, `light: true`, `gemini_ms` 3-5s).
3. Card content fills shortly after render (background hydration); opening a card immediately shows "Gathering ingredients…" / "Generating steps…" then populates (**D6**).
4. **CRITICAL (D5):** tap Save / Cook Now the INSTANT a card appears, before hydration finishes — it must NOT 400; it either waits then saves successfully (recipe lands in Recipe Box WITH ingredients+steps) or shows "Still preparing…".
5. **D7:** force-quit + relaunch while previews are on screen — persisted previews re-hydrate (no permanently-empty cards) and Save still works.
6. Maestro screenshots at loading + resolved states.

**Resume signal (unchanged):** "approved" if cards render in 3-5s, hydration fills content, save never 400s, and relaunch re-hydrates.

## Known Stubs

None. The empty ingredients/steps state on a fresh light preview is the intended pre-hydration design (29-03), and this plan's whole job is to (a) prevent any save from firing on it and (b) show a loader rather than a bald empty-state while it fills. No placeholder data is rendered or persisted.

## Issues Encountered

One test-only adjustment (not a code bug): moving `previewFrom` into the (mocked) hook module meant the store test's `vi.mock('../../hooks/useHydratedRecipeContent')` no longer exported it, throwing on `previewFrom(r)` in `hydrateAll`. Added a passthrough `previewFrom: (r) => r` to the mock — the store maps through it before the mocked `prefetchHydration`, which is all that suite asserts. Committed in `a4b1e48`.

## Self-Check: PASSED

All 7 modified files present; both task commits (`a4b1e48`, `267e777`) verified in `git log`. 56/56 relevant tests green; `tsc --noEmit` reports no errors in any touched source file (the 30 pre-existing tsc errors are all in unrelated `__tests__` files — out of scope).

---
*Phase: 29-something-new-lightweight-first-generation-29s-3-5s*
*Completed: 2026-06-09*
