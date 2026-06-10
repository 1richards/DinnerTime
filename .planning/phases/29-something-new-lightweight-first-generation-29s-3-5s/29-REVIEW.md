---
phase: 29-something-new-lightweight-first-generation-29s-3-5s
reviewed: 2026-06-09T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - packages/server/src/services/recipeDiscovery.ts
  - packages/server/src/services/recipeHydration.ts
  - packages/server/src/routes/recipes.ts
  - packages/server/src/services/discoveryCache.ts
  - apps/mobile/src/hooks/useHydratedRecipeContent.ts
  - apps/mobile/src/stores/suggestionsStore.ts
  - apps/mobile/src/components/suggestions/SomethingNewResults.tsx
  - apps/mobile/src/app/(tabs)/kitchen.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: fixed
fixes_applied:
  fixed: 5
  deferred: 4
  fixed_at: 2026-06-09
---

# Phase 29: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** deep
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Phase 29 "Something New lightweight-first" change set across the
scrutiny axes requested: backward-compat of the default `/search` path, save-gating
completeness, the hydration hook's concurrency limiter, `onRehydrateStorage`, the
`/hydrate` endpoint, the `ingredient_names → ingredients` mapping, and telemetry PII.

**The two highest-risk axes are SOUND:**

1. **Backward-compat (default `/search`):** Verified clean. `buildSuggestRecipesSchema(false)`
   reconstructs the pre-Phase-29 full schema with `ingredients`/`steps` REQUIRED. The shared
   `COMMON_RECIPE_PROPERTIES` object is read-only — no schema mutation leaks the light variant
   into the full path. The `light` flag is opt-in (`body.light === true`) on the route, threads
   through `discoverRecipes` without touching the full branch, and the `light` cache-key fold is
   internally consistent (in-process TTL cache, recomputed by the same builder on both `/search`
   and `/discover`). No way for the live shipped app (no `light` flag) to receive a light payload.

2. **Save-gating:** Verified complete across all four surfaces. Every save/cook/favorite/plan
   entry in `SomethingNewResults.tsx` and `kitchen.tsx` routes through `ensureHydrated` /
   `ensurePreviewHydrated`, which `await prefetchHydration` and **bail with an alert when
   hydration resolves with empty/failed content** (`!content || !content.ingredients?.length ||
   !content.steps?.length`) — so an AI hydration failure produces a "Still preparing" alert, NOT
   an empty 400-bound save. The remix-then-save path (`RemixSheet.handleSaveAsNew`) is independent:
   it goes through the server `/remix` endpoint (`applyRemixVariation` → full ingredients+steps),
   so it never saves a light preview. The `/recipes/discover` screen uses the full `/discover`
   endpoint and is correctly ungated.

3. **Telemetry PII:** Clean. Server `recordAiCall` records only `{task, model, latency, success}`
   (no prompts). Client `emitHydrationEvent` sends only `{ms, success}`. No recipe content leaked.

Remaining findings are quality/robustness defects (WARNING) and minor items (INFO). No BLOCKERs.

## Warnings

### WR-01: Title-only patch in `hydrateAll` mis-assigns content when two previews share a title

**File:** `apps/mobile/src/stores/suggestionsStore.ts:88-101`
**Issue:** `hydrateAll` patches resolved content into `searchResults` by `x.title === r.title`.
The hydration *cache key* (`cacheKeyFor`) is `title#fingerprint(ingredient_names)` — i.e. two
previews with the same title but different ingredient lists hydrate to DIFFERENT content. But the
store patches **every** row whose title matches with whichever result lands. `appendSearchResults`
merges `[...s.searchResults, ...appended]` with no hard dedup (the server `excludeTitles` is only
a *soft* prompt constraint the AI can violate), so a duplicate title on screen is reachable. When
it happens, both cards get patched with the same ingredients/steps, and the React list key
`${recipe.title}-${idx}` (SomethingNewResults.tsx:180) further conflates them. Result: a user can
save card B and get card A's ingredients.
**Fix:** Patch by the same content-address identity the hook uses, not by title alone. Carry the
preview's fingerprint and match on it, e.g.:
```ts
const targetKey = cacheKeyFor(previewFrom(r)); // export cacheKeyFor or a stable id
searchResults: s.searchResults.map((x) =>
  cacheKeyFor(previewFrom(x)) === targetKey ? { ...x, ...content } : x,
)
```
Or assign each preview a stable synthetic id at fetch time and key both the patch and the React
list on it. Additionally, dedup on merge in `appendSearchResults` so duplicate titles never
coexist on screen.

### WR-02: `/hydrate` accepts unbounded client-controlled prompt input — cost + injection surface

**File:** `packages/server/src/routes/recipes.ts:490-526`, `packages/server/src/services/recipeHydration.ts:105-125`
**Issue:** `/hydrate` is newly added and, unlike `/search`/`/discover` (whose preference inputs are
derived from server-side DB state), takes its entire prompt payload — `title`, `description`,
`cuisine`, `ingredient_names[]` — directly from the authenticated client body with NO length or
size bound. `buildHydrationPrompt` interpolates all of them verbatim into the AI prompt. There is
no rate-limiting middleware on the route (only a rate-limit *error formatter* exists in
`index.ts`). An authenticated client can:
(a) send a multi-megabyte `ingredient_names` array or a very long `description`/`title` to inflate
   per-call Gemini token cost (each distinct payload misses the content-address cache), and
(b) inject instructions via `description`/`ingredient_names` ("ignore the above and …") since those
   fields are concatenated into the model prompt unescaped.
The blast radius is bounded by auth + the 4096 `maxTokens` output cap, but it is a real
cost/abuse vector that the full-recipe paths don't expose to the same degree.
**Fix:** Clamp inputs before building the prompt:
```ts
const title = (typeof body.title === 'string' ? body.title : '').slice(0, 200);
const description = (typeof body.description === 'string' ? body.description : '').slice(0, 500);
const ingredient_names = (Array.isArray(body.ingredient_names) ? body.ingredient_names : [])
  .filter((n): n is string => typeof n === 'string')
  .slice(0, 40)
  .map((n) => n.slice(0, 80));
```
Long term, attach the existing per-user rate limiter to the AI-backed routes.

### WR-03: Failed hydration poisons the session cache for the entire app session

**File:** `apps/mobile/src/hooks/useHydratedRecipeContent.ts:364-373, 421-427, 435-444`
**Issue:** When a hydrate fetch resolves `null` (network blip, server 500, AI failure), the entry
is stored as `{ content: null, attempted: true }`. Every subsequent read — the hook's `evaluate`,
`prefetchHydration` (`if (existing) … return Promise.resolve(existing.content)`), and
`hydrationStatusFor` — treats `attempted && !content` as a **terminal `failed`** state and never
retries for the rest of the session. So a single transient failure permanently disables Save/Cook
for that card until app relaunch: `ensureHydrated` re-calls `prefetchHydration`, gets the cached
`null` back immediately, and shows "Still preparing" forever. The persisted-storage layer correctly
drops failed entries (so relaunch retries), but in-session there is no recovery path. The doc
comment claims "do NOT retry this session" is intentional, but combined with the save-gate it means
a transient blip soft-locks the card.
**Fix:** Make the user-initiated `ensureHydrated`/`prefetchHydration` path able to retry a `failed`
entry (e.g. clear the cache entry on a user save tap before re-fetching), or add a TTL/attempt
counter so a `failed` entry becomes retryable after N seconds rather than permanently.

### WR-04: `/recipes/search` light path computes pantry-match against empty ingredients silently

**File:** `apps/mobile/src/components/suggestions/SomethingNewResults.tsx:276-279`
**Issue:** The "X items from pantry" badge reduces over `recipe.ingredients`, which is empty for a
fresh light preview until background hydration patches it in. The badge therefore renders "0 from
pantry" on first paint and self-corrects only after hydration lands. This is acknowledged in a
comment, but for `pantryOnly` searches the *entire value proposition* is the pantry match, so the
flagship surface shows a misleading "0" for several seconds. The server already has the cheap
`ingredient_names` list at preview time and could compute/return the match count without waiting
for full hydration.
**Fix:** Either render a "checking pantry…" placeholder instead of "0" while
`recipe.ingredients.length === 0` and `ingredient_names` exists, or compute the badge from the
preview's `ingredient_names` (already present on the light row) rather than the not-yet-hydrated
`ingredients`.

### WR-05: `handleCookNow` fallback can navigate into the WRONG recipe's cook screen

**File:** `apps/mobile/src/components/suggestions/SomethingNewResults.tsx:434-436`, `apps/mobile/src/app/(tabs)/kitchen.tsx:662-665`
**Issue:** After saving, the code resolves the created recipe via
`state.recipes.find((r) => !beforeIds.has(r.id))` and falls back to `state.recipes[0]?.id` when the
diff is empty. The diff is empty on the **dedup branch** (`POST /recipes` returns the existing row
with `duplicate: true` and does NOT add a new id), and `state.recipes[0]` is whatever sits at index
0 of the library — typically the most recently saved/sorted recipe, NOT the one the user tapped.
So tapping Cook Now on a Something New card whose title already exists in the library can launch
Cook Mode for an unrelated recipe.
**Fix:** Resolve the fallback by title match against the recipe just saved, not by array position:
```ts
const created =
  state.recipes.find((r) => !beforeIds.has(r.id)) ??
  state.recipes.find((r) => normalize(r.title) === normalize(recipe.title));
const cookId = created?.id;
if (cookId) router.push(`/recipes/${cookId}/cook`);
```
(`handleSaveAndFavorite` at lines 404-407 already uses the title-match fallback correctly — apply
the same pattern to both Cook Now handlers.)

## Info

### IN-01: `onRehydrateStorage` D7 re-trigger is correct but unguarded against repeated failure

**File:** `apps/mobile/src/stores/suggestionsStore.ts:344-351`, `320-324`
**Issue:** The `setTimeout(…, 0)` defer correctly avoids racing the hook module load, and
`rehydrateUnhydrated` filters to `isUnhydrated` rows only — no infinite loop, since `hydrateAll`
patches resolved content and a failed hydration leaves the row untouched (so it won't re-loop
*within* a session because nothing re-invokes `onRehydrateStorage`). This is fine. The minor note:
if every persisted preview's hydration fails, those rows stay permanently empty and the only signal
to the user is the per-card save-gate alert (see WR-03). Not a bug, but worth a "couldn't refresh
these saved ideas" affordance.
**Fix:** Optional — surface a non-blocking toast when `rehydrateUnhydrated` resolves with all rows
still unhydrated.

### IN-02: `hydrationCacheKey` ignores `description`/`difficulty`/`cuisine` that DO affect output

**File:** `packages/server/src/services/recipeHydration.ts:64-73`
**Issue:** The server content-address key hashes only `title + total_time + sorted ingredient_names`,
but `buildHydrationPrompt` also feeds `description`, `difficulty`, and `cuisine` into the model. Two
previews with the same title+time+names but different descriptions collide to one cache entry, so
the second caller gets the first's hydrated recipe. In practice Something New titles are unique so
collisions are unlikely, and the client fingerprint mirrors the same fields (consistent), so this is
low impact — but the key is not a faithful content address of the actual prompt inputs.
**Fix:** Either fold `description`/`difficulty`/`cuisine` into the hash, or document that they're
intentionally excluded because title+names dominate the output.

### IN-03: `ingredient_names → ingredients` maps to `quantity: null` — downstream tolerance confirmed

**File:** `packages/server/src/services/recipeDiscovery.ts:520-532`
**Issue:** Light previews map bare names to `{name, quantity: null, unit: null, notes: null}`. This
was the requested scrutiny point. Verified non-fatal: the card badge (`isIngredientInPantry`) reads
only `ing.name`; the save flow is gated behind hydration (which replaces these with full quantities
before any POST); `PreviewSheet` shows `ingredientsLoading` while `ingredients.length === 0`. No
scaling/display path consumes `quantity: null` before hydration. No fix required — noting for the
record that the null-quantity intermediate is safe given the save-gate.

### IN-04: Duplicate cache module logic (`recipeHydration.ts` vs `discoveryCache.ts`)

**File:** `packages/server/src/services/recipeHydration.ts:49-97`, `packages/server/src/services/discoveryCache.ts:103-137`
**Issue:** `lookup`/`store`/LRU-eviction + the `responseCache`/`inflightMap` pattern are
copy-pasted near-verbatim between the two cache modules (the header comment even says "mirroring
discoveryCache.ts"). Two independent copies of the eviction/TTL logic will drift. Not a bug.
**Fix:** Extract a shared `createContentAddressedCache<T>({ ttlMs, maxEntries })` helper and have
both modules instantiate it.

---

## Fixes Applied

**Fixed at:** 2026-06-09 · **Fixed:** 5 WARNING · **Deferred:** 4 INFO

All 5 WARNING findings fixed and committed atomically to `main`. The four INFO
findings (IN-01 … IN-04) are deferred — non-bugs / optional hardening, noted
below for a future pass.

| Finding | Commit | Summary of fix |
|---------|--------|----------------|
| WR-01 | `9545aae` | Export `cacheKeyFor` from the hydration hook; `hydrateAll` now patches `searchResults` by the composite content-address key (title + `fingerprint(ingredient_names)`) instead of bare title, so two same-title previews with different ingredient lists no longer cross-assign content. `appendSearchResults` hard-dedups by composite key so soft-constraint duplicate titles can't coexist and collide. Added a regression test. |
| WR-02 | `b362260` | `/recipes/hydrate` now clamps client input before `buildHydrationPrompt`: title ≤200, description ≤500, cuisine ≤50, `ingredient_names` ≤30 items each ≤100 chars. Truncates (not 400) to match the `/search` `count` clamp and keep the flagship flow resilient. No rate-limit middleware exists yet (only the error formatter in `index.ts`) — length bounds are the priority. Added a clamp-enforcement test. |
| WR-03 | `2d9207f` | `prefetchHydration` no longer treats a previously-failed entry (`attempted && !content`) as terminal: it drops the poisoned cache entry and re-attempts. A transient hydrate blip no longer permanently soft-locks Save/Cook with "Still preparing"; the save-gate's await-fallback recovers in-session on a user tap. Display status stays `failed` after one attempt (unchanged), mirroring `useGeneratedRecipeImage`. Added a retry regression test. |
| WR-04 | `409d235` | Pantry-match badge now computes from the light preview's `ingredient_names` when full `ingredients` aren't hydrated yet (falling back to `ingredients` once they land), so the flagship pantryOnly surface shows the correct match count immediately instead of an absent/“0” badge for several seconds. |
| WR-05 | `c25a6b8` | Both Cook Now handlers (`SomethingNewResults.handleCookNow`, `kitchen.handlePreviewCookNow`) now fall back to a normalized **title match** against the just-saved recipe instead of `state.recipes[0]`. Tapping Cook Now on a card whose title already exists (dedup branch returns no new id) no longer launches Cook Mode for an unrelated recipe. Matches `handleSaveAndFavorite`'s correct fallback. |

**Deferred (INFO):**
- **IN-01** — `rehydrateUnhydrated` all-fail toast affordance (optional UX nicety).
- **IN-02** — fold `description`/`difficulty`/`cuisine` into the server content-address hash (low impact; titles are unique in practice).
- **IN-03** — `quantity: null` intermediate confirmed safe by the review; no fix required.
- **IN-04** — extract a shared `createContentAddressedCache<T>` to dedupe `recipeHydration.ts` / `discoveryCache.ts` (refactor, not a bug).

**Test results after fixes:**
- `packages/server`: `recipes.hydrate.test.ts` + `recipeHydration.test.ts` → 11 passed.
- `apps/mobile`: `suggestionsStore.test.ts` + `useHydratedRecipeContent.test.ts` → 22 passed.
- `apps/mobile` `tsc --noEmit`: no errors in any edited file; remaining errors are the known pre-existing baseline (unrelated test fixtures: TimerBar, plan/*, cooking/* `@ts-expect-error` directives).

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fixes applied: 2026-06-09 by Claude (gsd-code-fixer)_
