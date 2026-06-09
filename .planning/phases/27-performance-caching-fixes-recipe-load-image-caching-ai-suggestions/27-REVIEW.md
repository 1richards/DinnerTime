---
phase: 27-performance-caching-fixes-recipe-load-image-caching-ai-suggestions
reviewed: 2026-06-08T00:00:00Z
depth: deep
files_reviewed: 8
files_reviewed_list:
  - packages/server/src/routes/recipes.ts
  - packages/server/src/services/discoveryCache.ts
  - packages/server/src/ai/adapters/anthropicAdapter.ts
  - packages/server/src/ai/adapters/geminiAdapter.ts
  - packages/server/src/services/recipeDiscovery.ts
  - apps/mobile/src/app/(tabs)/kitchen.tsx
  - apps/mobile/src/components/recipes/RecipeCard.tsx
  - apps/mobile/src/hooks/useGeneratedRecipeImage.ts
  - apps/mobile/src/app/recipes/discover.tsx
findings:
  critical: 0
  high: 2
  medium: 3
  low: 3
  total: 8
status: fixes_applied
fixed:
  - HI-01
  - HI-02
  - ME-01
  - ME-02
  - ME-03
deferred:
  - LO-01
  - LO-02
  - LO-03
---

# Phase 27: Code Review Report

**Reviewed:** 2026-06-08
**Depth:** deep
**Files Reviewed:** 9 (8 in-scope + supporting cross-refs)
**Status:** findings

## Summary

The caching/coalescing core is solid: the discovery cache removes the in-flight
promise in a `finally`, never stores a rejected result, and LRU eviction (delete
+ re-set on hit, head-eviction on overflow) is correct. The cache key sorts the
pantry manifest deterministically and the base-load vs. load-more split
(`cacheable: false` for load-more) cannot read or poison a base entry.

The defects that matter are on the consumer side:

1. **`RecipeCard` `React.memo` comparator omits most rendered fields** — editing
   a recipe's title, description, labels, servings, or nutrition mutates the row
   but the card stays stale. Concretely triggered by the LabelsEditor in Recipe
   Box detail. (HIGH)
2. **The Anthropic `cache_control` change sends an empty system text block when
   `i.system` is absent**, which the live Anthropic API rejects. Currently
   latent because `recipe.discovery` routes to Gemini and no live task calls the
   Anthropic `generateStructured` path — but the unit test exercises exactly the
   empty-system shape and would pass against the mock while failing against the
   real API. (HIGH)
3. **`discover.tsx` module-scoped cache is never cleared on sign-out** —
   a second account on the same device sees the first account's Discover
   suggestions for up to 10 minutes. (MEDIUM)

## Structural Findings (fallow)

No structural pre-pass was provided for this review.

## Narrative Findings (AI reviewer)

### High

#### HI-01: RecipeCard memo comparator omits title/description/labels/servings/nutrition — stale cards after edits

**File:** `apps/mobile/src/components/recipes/RecipeCard.tsx:475-483`
**Issue:** The comparator returns `true` (skip render) when only
`recipe.id`, `recipe.image_url`, `recipe.is_favorite`, `mode`, and
`pantryMatchCount` are unchanged. But the card body renders `recipe.title`,
`recipe.description`, `totalTime` (from `total_time_minutes` /
`prep_time_minutes` / `cook_time_minutes`), `recipe.servings`,
`recipe.calories_per_serving`, `recipe.protein_grams_per_serving`, and
`recipe.labels` (lines 346-446). `recipeStore.updateRecipe` returns a new object
`{ ...r, ...patch }` for any field (`src/stores/recipeStore.ts:288,330`), so the
reference changes but the comparator still skips the render. The most concrete
trigger: `LabelsEditor` in `SavedRecipeDetail` calls
`updateRecipe(recipe.id, { labels: next })` (`kitchen.tsx:977`); after editing
labels, the corresponding Recipe Box list card shows the old label chips until an
unrelated re-render. Same staleness for title/description/servings/nutrition
edits.
**Fix:** Add the render-affecting fields to the comparator:
```ts
export const RecipeCard = React.memo(
  RecipeCardBase,
  (prev, next) =>
    prev.recipe.id === next.recipe.id &&
    prev.recipe.image_url === next.recipe.image_url &&
    prev.recipe.is_favorite === next.recipe.is_favorite &&
    prev.recipe.title === next.recipe.title &&
    prev.recipe.description === next.recipe.description &&
    prev.recipe.servings === next.recipe.servings &&
    prev.recipe.total_time_minutes === next.recipe.total_time_minutes &&
    prev.recipe.prep_time_minutes === next.recipe.prep_time_minutes &&
    prev.recipe.cook_time_minutes === next.recipe.cook_time_minutes &&
    prev.recipe.calories_per_serving === next.recipe.calories_per_serving &&
    prev.recipe.protein_grams_per_serving === next.recipe.protein_grams_per_serving &&
    prev.recipe.labels === next.recipe.labels && // array identity; store replaces it on edit
    prev.mode === next.mode &&
    prev.pantryMatchCount === next.pantryMatchCount,
);
```
(`labels` compares by reference, which is correct because the store always
replaces the row object on update.)

#### HI-02: Anthropic generateStructured sends an empty system text block with cache_control — invalid against the live API

**File:** `packages/server/src/ai/adapters/anthropicAdapter.ts:113-122`
**Issue:** The system field is now always an array with a single text block whose
`text` is `i.system ?? ''`. When a caller passes no system, this becomes
`[{ type: 'text', text: '', cache_control: { type: 'ephemeral' } }]`. The
Anthropic Messages API rejects empty `text` blocks, and `cache_control` on a
prefix below the ~1024-token minimum is at best a no-op. This is latent today —
`recipe.discovery` routes to Gemini (`taskRouting.ts:37`) and every current
Anthropic-routed task uses `analyzeImageStructured`, not `generateStructured` —
but the unit test (`anthropicAdapter.test.ts:53`) calls
`generateStructured({ user: 'p', tool })` with no system, so it green-lights the
broken shape against the mock. If discovery (or any structured task) is ever
rerouted to Anthropic without a system prompt, it will 400 at runtime.
**Fix:** Only emit the system array when there's actual system text, and keep the
cache breakpoint on the tool schema (the static prefix) regardless:
```ts
const res = await this.client.messages.create({
  model: this.model,
  max_tokens: i.maxTokens ?? 4096,
  ...(i.system
    ? {
        system: [
          {
            type: 'text' as const,
            text: i.system,
            cache_control: { type: 'ephemeral' as const },
          },
        ],
      }
    : {}),
  tools: [ /* ...with cache_control as today... */ ],
  ...
});
```

### Medium

#### ME-01: discover.tsx module-scoped cache leaks across accounts on the same device

**File:** `apps/mobile/src/app/recipes/discover.tsx:60,112,128-131`
**Issue:** `discoverCache` lives at module scope and is keyed by nothing — not by
`userId`. On the success path it stores the last Discover result for 10 minutes
(`DISCOVER_CACHE_TTL_MS`). There is no clear-on-sign-out (no reference to it in
`authStore`/sign-out). If account A discovers recipes, signs out, and account B
signs in within the TTL, account B's `useEffect` (line 128) reads
`discoverCache.results` and renders account A's suggestions. The server-side
`discoveryCache` is correctly scoped by `userId` in its key, so this is purely a
mobile module-cache bug.
**Fix:** Either key the cache by the active profile id, or invalidate it on auth
change. Minimal version — export a reset and call it from the sign-out path:
```ts
export function clearDiscoverCache() { discoverCache = null; }
// in authStore signOut(): import + call clearDiscoverCache()
```
Or guard the read: store `{ at, userId, results }` and only reuse when
`userId === currentProfileId`.

#### ME-02: generate-image route has no try/catch around image gen + DB write — a DB-update rejection drops a successfully generated URL and 500s

**File:** `packages/server/src/routes/recipes.ts:596-625`
**Issue:** Unlike every sibling route, `/generate-image` only wraps
`c.req.json()` in try/catch. `await generateRecipeImage(...)` (596) and the
`await supabaseAdmin.from('recipes').update(...)` (616-620) are unguarded. The
header comment promises "Return 200 either way so callers don't need
error-handling branches," but if the `update` promise rejects (network blip,
PostgREST hiccup) the route throws and Hono returns a generic 500 — even though
the image was already generated and the client could have used it. The mobile
hook treats any non-2xx as a failed attempt (`useGeneratedRecipeImage.ts:159`),
discarding a good URL.
**Fix:** Wrap the write so a persistence failure never fails the response:
```ts
if (recipeIdValid && urlValid) {
  const user = c.get('user');
  try {
    await supabaseAdmin.from('recipes').update({ image_url: url })
      .eq('id', body.recipeId).eq('profile_id', user.id);
  } catch (e) {
    console.warn('[generate-image] image_url persist failed', e);
  }
}
return c.json({ url });
```
Also consider wrapping `generateRecipeImage` so a thrown gen error returns
`{ url: null }` (the documented fallback) instead of a 500.

#### ME-03: base-load discovery cache key omits the library AVOID list — saved recipes can re-surface within the TTL

**File:** `packages/server/src/services/discoveryCache.ts:52-57` +
`packages/server/src/routes/recipes.ts:264-283,356-367`
**Issue:** The cache key intentionally excludes `excludeTitles`, but it also
never includes `existingTitles`/the library, while `discoverRecipes` feeds those
titles into the model's AVOID list (`recipeDiscovery.ts:340-343`). So if a user
runs Discover, saves a suggested recipe, then re-triggers Discover within the
12-minute TTL, the cached response (computed against the pre-save library) is
returned — re-surfacing the recipe they just saved and which the model was
supposed to avoid. The `POST /` dedupe (`recipes.ts:415`) prevents a duplicate
DB row, but the UX shows an already-saved card as a fresh suggestion. Acceptable
for a short TTL, but it undercuts the AVOID contract the prompt advertises.
**Fix:** Fold a stable digest of the library into the key (e.g. count + a hash of
sorted titles), or shorten the TTL for the keyword/library path. Document the
chosen trade-off in the module header so the omission is deliberate rather than
incidental.

### Low

#### LO-01: discoveryCache TTL/LRU touch happens before the value is returned but coalescing skips the touch

**File:** `packages/server/src/services/discoveryCache.ts:111-116`
**Issue:** When a concurrent identical request hits the in-flight branch
(line 114-115) it returns the shared promise without ever touching/extending the
cached entry once it lands — only the first caller's `store()` sets the entry.
This is correct behavior, just worth noting: coalesced callers don't refresh
LRU recency. No action required unless recency-of-access fairness matters.
**Fix:** None required; documenting for completeness.

#### LO-02: kitchen renderItem depends on a non-memoized handleCardPress

**File:** `apps/mobile/src/app/(tabs)/kitchen.tsx:544-561`
**Issue:** `renderRecipeCard` is `useCallback(..., [handleCardPress])`, but
`handleCardPress` (544) is recreated every render (no `useCallback`), so the
`useCallback` is defeated and `renderRecipeCard` is a new function each render.
This is harmless today only because the RecipeCard memo comparator ignores
`onPress`/`onCookNow` — but that coupling is fragile: the moment HI-01 is fixed
to compare more props, the comparator still won't compare callbacks, so this
stays benign, yet the `useCallback` gives a false impression of stability.
**Fix:** Wrap `handleCardPress` in `useCallback([])` (it only calls the stable
`setSavedDetail` setter), or drop the misleading `useCallback` on
`renderRecipeCard`.

#### LO-03: count clamp rounds fractional client input silently; excludeTitles type-filter can yield empty array treated as "base load"

**File:** `packages/server/src/routes/recipes.ts:176-182,260-263`
**Issue:** `count` is clamped to 1–6 with `Math.round`, fine. But `isLoadMore`
requires `excludeTitles.length > 0`; a client that sends `count: 2` with
`excludeTitles: []` (or all-non-string entries filtered out) is treated as a
cacheable base load with `count` in the key. That's internally consistent and
won't poison the base (`count: undefined`) entry because the keys differ, but it
means a "load more" request that lost its titles will silently read/write a
distinct cache slot keyed on `count`. Low impact; flagging as a sharp edge.
**Fix:** Optional — derive `isLoadMore` from the presence of an explicit `count`
alone, or have the client always send non-empty `excludeTitles` for load-more.

---

## Fixes Applied

**Applied:** 2026-06-08 — all HIGH + MEDIUM findings fixed. The 3 LOW findings
were deliberately deferred (cosmetic / low-impact; LO-02 stays benign now that
the HI-01 comparator still ignores callbacks).

| Finding | Status | Commit | Notes |
|---------|--------|--------|-------|
| HI-01 | fixed | `390be95` | Broadened the `RecipeCard` `React.memo` comparator to compare all render-affecting fields (title, description, servings, total/prep/cook time, calories, protein, labels). `labels` compares by reference — correct because `recipeStore.updateRecipe` always replaces the row object. Windowing win from 27-02 preserved (unchanged row still skips render). |
| HI-02 | fixed | `1d3481e` | `anthropicAdapter.generateStructured` now emits the `system` field only when `i.system` is present (conditional spread), so it never sends an empty `text` block with `cache_control` that the live API would reject. Tool-schema cache breakpoint retained. Added assertions for both the empty-system (`system` undefined) and with-system shapes. |
| ME-01 | fixed | `0d825ab` | `discover.tsx` module cache now records the `userId` it was computed for and treats a differing active user as a miss (read guard + write stamp via `useAuthStore.getState().user?.id`). Prevents account B from seeing account A's Discover suggestions on the same device within the TTL. Chosen over a sign-out reset to keep the change self-contained (no authStore coupling), matching the review's "guard the read" option and the server cache's userId scoping. |
| ME-02 | fixed | `72fb1e8` | `/generate-image` now wraps both `generateRecipeImage` (throw → `{ url: null }` fallback) and the `image_url` write-back (rejection OR PostgREST `error` → log + continue). A persistence failure no longer 500s the request or discards a good generated URL. Added 3 regression tests (write reject, write error, gen throw). |
| ME-03 | fixed | `4c0bf34` | Chose the **library-digest-in-key** fix over shortening the TTL: it directly models the AVOID input. `discoveryCacheKey` now folds an order-insensitive, normalized digest of the library titles (`count + sha256(sorted)`) into the composite; both `/search` and `/discover` pass `libraryTitles: existingTitles`. Saving a recipe grows the library → key changes → fresh discovery honoring AVOID; the pre-save entry ages out via TTL/LRU. Reordering/re-casing the same library does NOT shift the key. Added a regression test. |
| LO-01 | deferred | — | Documented-only; no action required (coalesced callers not refreshing LRU recency is acceptable). |
| LO-02 | deferred | — | Stays benign: the HI-01 comparator still ignores `onPress`/`onCookNow`, so the non-memoized `handleCardPress` in `kitchen.tsx` does not trigger re-renders. Cosmetic cleanup only. |
| LO-03 | deferred | — | Low-impact sharp edge in `count`/`excludeTitles` handling; internally consistent and cannot poison the base entry. |

**Verification:**
- `packages/server` — `vitest run` over `discoveryCache.test.ts`, `recipes.generate-image.test.ts`, and `src/ai` (adapter suites): **45 passed**. New regression tests added for HI-02, ME-02, ME-03.
- `apps/mobile` — `tsc --noEmit`: no new errors in the touched files (`RecipeCard.tsx`, `discover.tsx`). Pre-existing untyped-Hono-context errors elsewhere are the known baseline.

---

_Reviewed: 2026-06-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Fixes applied: 2026-06-08 by Claude (gsd-code-fixer) — HI-01, HI-02, ME-01, ME-02, ME-03_
