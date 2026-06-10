---
phase: 29-something-new-lightweight-first-generation-29s-3-5s
verified: 2026-06-09T22:34:00Z
status: human_needed
score: 5/7 criteria verified in code (2 require on-device EAS build)
re_verification: false
human_verification:
  - test: "Tap 'Something New' and time first-card appearance"
    expected: "Results cards appear in 3-5s (vs the previous ~29s baseline)"
    why_human: "Runtime latency measurement requires a live EAS build (#26) hitting production Fly API with real Gemini calls. Cannot verify timing in static code analysis."
  - test: "Tap Save the instant a Something New card appears (before hydration completes)"
    expected: "Either a brief loading state then save succeeds, OR a 'Still preparing' alert — never a 400 from POST /recipes"
    why_human: "Race-condition safety requires live device timing with real background hydration in flight. The code gates are verified present, but that the await-path resolves correctly under real async timing needs on-device validation."
---

# Phase 29: Something New Lightweight-First Generation Verification Report

**Phase Goal:** Cut POST /recipes/search from ~29s to 3-5s via lightweight-first previews + background hydration of full ingredients+steps. Flagship "Something New" flow.
**Verified:** 2026-06-09T22:34:00Z
**Status:** human_needed — all 5 code-verifiable criteria VERIFIED; 2 runtime/device criteria require EAS build #26 on-device
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (7 ROADMAP Success Criteria)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `/search light:true` returns previews without requiring ingredients/steps; 4 DB fetches parallelized; default path stays full (backward-compat) | VERIFIED | `buildSuggestRecipesSchema(true)` required=`['title','difficulty','practiced_skills']` (no ingredients/steps); default path required=`['title','ingredients','steps','difficulty','practiced_skills']`; `Promise.all` in /search handler (recipes.ts:270); backward-compat test at recipes.search.test.ts:337 passes |
| 2 | Background hydration via `/hydrate` reusing `recipe.parseText`; client `useHydratedRecipeContent` with MAX_CONCURRENT=2; `suggestionsStore.hydrateAll` patches `searchResults` | VERIFIED | `recipeHydration.ts`: `callAIParseRecipeText` + `toolOutputToRecipe` reuse; `useHydratedRecipeContent.ts`: `MAX_CONCURRENT=2`; `suggestionsStore.ts:231` `void hydrateAll(previews, set)` after results land |
| 3 | Save/Cook/Favorite GATED until hydrated in both `SomethingNewResults.tsx` and `kitchen.tsx` | VERIFIED | `SomethingNewResults.tsx`: `ensureHydrated()` at top of `handleSave`/`handleSaveAndFavorite`/`handleCookNow`; `kitchen.tsx`: `ensurePreviewHydrated()` at top of `handlePreviewSave`/`handlePreviewCookNow`/inline `onCookLater`/inline `onAdHocFavorite` — all 7 save surfaces gated |
| 4 | `PreviewSheet` has `stepsLoading` wired + new `ingredientsLoading` affordance | VERIFIED | `discover.tsx:365-366` both props with defaults; `discover.tsx:700-754` render branches ("Gathering ingredients…" / "Generating steps…" + ActivityIndicator); `kitchen.tsx:827-828` wires both from `previewRecipe.steps.length===0` / `ingredients.length===0` |
| 5 | Persistence safety: `onRehydrateStorage` re-hydrates empty persisted previews | VERIFIED | `suggestionsStore.ts:344-349` `onRehydrateStorage` callback defers `rehydrateUnhydrated()` to next tick; `rehydrateUnhydrated` (lines 320-323) calls `hydrateAll` on previews where `isUnhydrated` (empty ingredients OR steps) |
| 6 | Telemetry: `/search` logs `gemini_ms`; client `withBudget('suggestions.search', SUGGESTIONS_SEARCH_MS)`; hydration `logAiEvent` | VERIFIED | `recipes.ts:370/377` `gemini_ms` in `recipes.search` JSON log; `suggestionsStore.ts:193-195` `withBudget('suggestions.search', SUGGESTIONS_SEARCH_MS)`; `perfBudgets.ts:49` `SUGGESTIONS_SEARCH_MS=5000`; `useHydratedRecipeContent.ts:38-41` `logAiEvent` with `name:'recipe.hydrate.visible'` |
| 7a | No regression — unit suites all green | VERIFIED | Server: 567/567 tests pass (40 test files); Mobile: 916/916 tests pass (108 test files); 13 Phase 29 commits verified in git history (f9ca40d through 267e777) |
| 7b | Actual 3-5s runtime on device | HUMAN NEEDED | Requires EAS build #26 + live Fly API + real Gemini calls |
| 7c | Tap Save pre-hydration — never a 400 | HUMAN NEEDED | Requires on-device race-condition testing with real async timing |

**Code score:** 5/5 code-verifiable criteria VERIFIED + 2/2 runtime criteria deferred to human

---

## Required Artifacts

| Artifact | Status | Evidence |
|----------|--------|----------|
| `packages/server/src/services/recipeDiscovery.ts` | VERIFIED | `buildSuggestRecipesSchema(light)`, `buildDiscoveryPrompt(..., light)`, `discoverRecipes({light})`, `ingredient_names` mapping — all present and substantive |
| `packages/server/src/services/recipeHydration.ts` | VERIFIED | `hydrateRecipePreview()` calling `callAIParseRecipeText` + `toolOutputToRecipe`, sha256 content-address cache, 30min TTL, inflight coalescing — all present |
| `packages/server/src/services/discoveryCache.ts` | VERIFIED | `DiscoveryCacheKeyInput.light` + `::${light?1:0}` appended to composite key |
| `packages/server/src/routes/recipes.ts` | VERIFIED | `POST /hydrate` at line 490; `body.light` + `Promise.all` in `/search`; `gemini_ms`/`total_ms` log |
| `apps/mobile/src/hooks/useHydratedRecipeContent.ts` | VERIFIED | `MAX_CONCURRENT=2`, `prefetchHydration` (returns inflight promise), `hydrationStatusFor`, `previewFrom`, `emitHydrationEvent` — all exported and substantive |
| `apps/mobile/src/stores/suggestionsStore.ts` | VERIFIED | `light:true` in both `searchRecipes` and `appendSearchResults`; `withBudget` wrap; `hydrateAll`; `rehydrateUnhydrated`; `onRehydrateStorage` |
| `apps/mobile/src/components/suggestions/SomethingNewResults.tsx` | VERIFIED | `hydrated = ingredients.length>0 && steps.length>0`; `ensureHydrated()` gate on all 3 handlers; `hydrating` passed to `previewActions` |
| `apps/mobile/src/app/(tabs)/kitchen.tsx` | VERIFIED | `ensurePreviewHydrated()` on all 4 preview save surfaces; `prefetch-on-open` effect; `stepsLoading`/`ingredientsLoading` wired to PreviewSheet |
| `apps/mobile/src/app/recipes/discover.tsx` | VERIFIED | `ingredientsLoading` prop + "Gathering ingredients…" spinner branch; `stepsLoading` branch already present |
| `apps/mobile/src/lib/perfBudgets.ts` | VERIFIED | `SUGGESTIONS_SEARCH_MS = 5000` |

---

## Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `routes/recipes.ts /search` | `discoverRecipes({ light })` | `body.light === true` threaded into options | WIRED | `recipes.ts:222` `const light = body.light === true`; threaded at discoverRecipes call site |
| `routes/recipes.ts POST /hydrate` | `recipeHydration.hydrateRecipePreview` | service import + call | WIRED | `recipes.ts:23` import; `recipes.ts:510` `await hydrateRecipePreview(...)` |
| `suggestionsStore.searchRecipes` | `POST /recipes/search { light: true }` | fetch body | WIRED | `suggestionsStore.ts:206` `light: true` in fetch body |
| `suggestionsStore` results land | `prefetchHydration` per-card | `void hydrateAll(previews, set)` | WIRED | `suggestionsStore.ts:231` immediately after `set({ searchResults: recipes })` |
| `suggestionsStore onRehydrateStorage` | `rehydrateUnhydrated` | `setTimeout(0)` defer | WIRED | `suggestionsStore.ts:344-349` |
| `SomethingNewResults handleSave/Save+Fav/CookNow` | `prefetchHydration(previewFrom(recipe))` | `ensureHydrated()` await | WIRED | Lines 295-307; guards all 3 handlers |
| `kitchen.tsx 4 save handlers` | `prefetchHydration(previewFrom(previewRecipe))` | `ensurePreviewHydrated()` await | WIRED | Lines 588-595; guards handlePreviewSave, handlePreviewCookNow, onCookLater, onAdHocFavorite |
| `kitchen.tsx PreviewSheet` | `stepsLoading` + `ingredientsLoading` | props from `previewRecipe.{steps,ingredients}.length===0` | WIRED | `kitchen.tsx:827-828` |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SomethingNewResults.tsx` | `recipe.ingredients` / `recipe.steps` | `suggestionsStore.searchResults[i]` patched by `hydrateAll` | Yes — patched from `/recipes/hydrate` response which calls `callAIParseRecipeText` against real AI | FLOWING |
| `discover.tsx PreviewSheet` | `ingredientsLoading` | `previewRecipe.ingredients.length === 0` (kitchen.tsx:828) | Yes — flips false when hydration patches ingredients | FLOWING |
| `suggestionsStore.searchResults` | light previews | POST `/recipes/search {light:true}` → `discoverRecipes({light:true})` | Yes — real Gemini call with light schema | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command / Method | Result | Status |
|----------|-----------------|--------|--------|
| Server unit suite (567 tests) | `cd packages/server && pnpm vitest run src/services/__tests__/ src/routes/__tests__/` | 40 files, 567 tests PASS | PASS |
| Mobile unit suite (916 tests) | `cd apps/mobile && npx vitest run src/` | 108 files, 916 tests PASS | PASS |
| Light schema excludes ingredients/steps from required | `buildSuggestRecipesSchema(true).items.required` | `['title','difficulty','practiced_skills']` — no ingredients/steps | PASS |
| Default schema still includes ingredients+steps | `buildSuggestRecipesSchema(false).items.required` | `['title','ingredients','steps','difficulty','practiced_skills']` | PASS |
| Backward-compat test passes | `recipes.search.test.ts:337` | `opts.light` is falsy; `body.data[0].ingredients.length > 0` | PASS |
| 13 Phase 29 commits in git history | `git log --oneline` | f9ca40d through 267e777 all present | PASS |
| Actual 3-5s timing | On-device with EAS build #26 | Not testable without live build | SKIP (human needed) |
| Pre-hydration save safety | On-device tap race | Not testable without live build | SKIP (human needed) |

---

## Requirements Coverage

| Criterion | Plans | Description | Status |
|-----------|-------|-------------|--------|
| D1 (light schema + prompt) | 29-01 | `buildSuggestRecipesSchema(light)` — drops ingredients/steps from required in light mode | SATISFIED |
| D2 (parallel DB fetches) | 29-01 | `Promise.all([members, profile, library, pantry])` in /search | SATISFIED |
| D3 (hydration endpoint) | 29-02 | `POST /recipes/hydrate` + `recipeHydration.ts` service | SATISFIED |
| D4 (client background hydration) | 29-03 | `useHydratedRecipeContent` + `suggestionsStore.hydrateAll` | SATISFIED |
| D5 (save/cook/favorite gate) | 29-04 | `ensureHydrated`/`ensurePreviewHydrated` on all 7 save surfaces | SATISFIED |
| D6 (loading affordances) | 29-04 | `ingredientsLoading` + `stepsLoading` in PreviewSheet | SATISFIED |
| D7 (persistence safety) | 29-03 | `onRehydrateStorage` → `rehydrateUnhydrated` on next tick | SATISFIED |
| D8-server (Gemini timing) | 29-01 | `gemini_ms` / `total_ms` in `recipes.search` log | SATISFIED |
| D8-client (perf budget + hydration telemetry) | 29-03 | `withBudget('suggestions.search', 5000)` + `logAiEvent` on hydration | SATISFIED |

---

## Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER comments found in any of the 10 phase-modified files. The intentional empty `steps:[]` / quantity-less `ingredients` on light previews is documented design (not stubs) and self-corrects via background hydration.

---

## Human Verification Required

### 1. End-to-End Latency: 3-5s First Card Appearance

**Test:** On a physical iPhone with EAS build #26 installed and production API (`dinnertime-api.fly.dev`), open "Something New" and start a timer when the request fires. Stop when the first recipe cards appear.
**Expected:** Cards appear in 3-5s (vs the ~29s baseline documented in Phase 29 context). The `recipes.search` log on Fly should show `gemini_ms < 5000`.
**Why human:** Runtime Gemini latency under production load cannot be measured with static code analysis. The code that enables it (light schema, parallel DB fetches, light:true flag) is fully present and verified — but the actual millisecond outcome requires a live call.

### 2. Pre-Hydration Save Safety (No 400)

**Test:** On-device with build #26: immediately tap Save on the first card that appears (while hydration is still in flight — within ~0.5s of cards appearing). Observe the result.
**Expected:** Either (a) the card dims briefly ("Still preparing" alert if hydration times out) and no network 400 error appears in logs, OR (b) the save completes successfully after a short await. In NO case should a `POST /recipes` 400 with "ingredients required" reach the server.
**Why human:** The `ensureHydrated()` await-path correctness depends on real async race timing between `hydrateAll` background kicks and user tap latency. The code gates are verified, but only a real device test with a real Gemini hydration in flight can confirm the race is handled correctly.

---

## Gaps Summary

No code gaps. All 5 code-verifiable ROADMAP success criteria are satisfied:
1. Light `/search` with parallel DB fetches + backward-compat default path — VERIFIED
2. Background hydration via `/hydrate` + client hook + store patching — VERIFIED
3. All 7 save surfaces gated until hydrated — VERIFIED
4. PreviewSheet `ingredientsLoading`/`stepsLoading` wired — VERIFIED
5. Persistence safety + telemetry — VERIFIED

The 2 human-needed items (actual 3-5s runtime, pre-hydration save race) are correctly classified as deploy/device concerns that cannot be verified in code. They depend on EAS build #26 being live on a test device with the production Fly API deployed.

---

_Verified: 2026-06-09T22:34:00Z_
_Verifier: Claude (gsd-verifier)_
