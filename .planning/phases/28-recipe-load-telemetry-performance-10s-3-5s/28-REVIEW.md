---
phase: 28-recipe-load-telemetry-performance-10s-3-5s
reviewed: 2026-06-09T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - packages/server/src/services/recipeStore.ts
  - packages/server/src/routes/recipes.ts
  - packages/server/src/services/recipeImageGen.ts
  - apps/mobile/src/lib/perfBudgets.ts
  - apps/mobile/src/stores/recipeStore.ts
  - apps/mobile/src/hooks/useGeneratedRecipeImage.ts
  - apps/mobile/src/app/recipes/[id]/index.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: fixed
fixes_applied: 2026-06-09
fixed:
  - CR-01
  - WR-01
  - WR-02
  - WR-03
deferred:
  - WR-04
  - WR-05
  - IN-01
  - IN-02
  - IN-03
---

# Phase 28: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 28 trims the recipe LIST query to a lightweight column set that deliberately drops `steps` (and `step_image_urls`), adds a `{ rows, queryMs, rowCount }` return shape, timing/telemetry, generate-on-save, and a `/backfill-images` route. The telemetry, return-shape migration (all 3 prod callers updated to `.rows`), payload PII guards, fire-and-forget rejection handling, and `/backfill-images` auth/idempotency/ownership are all correct.

The serious problem is the **`steps` column trim**. The detail screen (`recipes/[id]/index.tsx`) re-hydrates correctly and is fully null-guarded — but that re-hydration only runs on the *detail* route. Multiple OTHER consumers read `recipe.steps` straight off the trimmed store array WITHOUT re-hydrating, most critically **Cook Mode entered directly from the Recipe Box**, which crashes. This is the dominant user flow ("Cook Now" from a recipe card) and the guard placed at `index.tsx:349` does not protect it.

A secondary structural concern: the persisted Zustand store overwrites previously-complete rows (which had steps) with trimmed rows on every `fetchRecipes`, so even recipes that *were* fully cached locally lose their steps until re-hydrated.

## Critical Issues

### CR-01: Cook Mode crashes when entered from the Recipe Box — `steps` is `undefined` on the trimmed list and the cook path never re-hydrates

**File:** `apps/mobile/src/app/recipes/[id]/cook.tsx:604`, `apps/mobile/src/components/cooking/ScrollableRecipe.tsx:234`, `apps/mobile/src/stores/cookingStore.ts:84,108`

**Issue:**
28-01 drops `steps` from `RECIPE_LIST_COLUMNS`, so PostgREST returns rows where `steps` is `undefined` (the TS type still declares `steps: string[]`, so the compiler is blind to it). The detail screen re-hydrates via `hydrateRecipeDetail(id)` and guards every access with `recipe.steps ?? []`. **Cook Mode does neither.**

Entry path that breaks: Recipe Box card tap → `SavedRecipeDetail` modal (`kitchen.tsx`) → "Cook Now" → `router.push('/recipes/${r.id}/cook')` (`kitchen.tsx:557`). The cook screen sources `recipe` from `recipes.find(...)` (the trimmed store array) and, when missing, calls only `void fetchRecipes()` (`cook.tsx:196`) — which re-fetches the *trimmed* list, never the full row. It never calls `hydrateRecipeDetail`. Result: `recipe.steps` is `undefined` when cooking starts.

Unguarded dereferences that throw `TypeError: Cannot read properties of undefined (reading ...)`:
- `cookingStore.ts:84` — `enter()` path via `next()`: `recipe.steps.length`
- `cookingStore.ts:108` — `jumpToStep()`: `recipe.steps.length`
- `ScrollableRecipe.tsx:234` — `recipe.steps.map((step, i) => ...)` renders on mount → crash before the user even taps anything
- `cook.tsx:604` — `recipe.steps[i]` in `onStepTap`

`cook.tsx:173-174` ARE guarded (`recipe?.steps?.[...]`, `?.length ?? 0`), which is exactly why the guard at `index.tsx:349` was thought sufficient — but the guard was not applied at every pre-hydration access site as the plan intended. `ScrollableRecipe` renders unconditionally with the live recipe, so the crash fires on cook-mode open from the list, before any re-fetch resolves.

Note: the same trimmed `recipe.steps` also flows undefined through `RecipeCard.tsx:459` (`baseForSave.steps`), `kitchen.tsx:875` (Cook Later → `addToPlan` persists a meal-plan entry with `steps: undefined`), and `edit.tsx:80` (`draft.steps`, then `edit.tsx:134 [...d.steps]` spreads undefined → crash on add/remove step). These are the same root cause.

**Fix:** Re-hydrate full detail on the cook path AND harden the cook render against missing steps. Minimum:

```tsx
// cook.tsx — add hydrate alongside the existing fetch effect
const { recipes, fetchRecipes, hydrateRecipeDetail } = useRecipeStore();
useEffect(() => {
  if (id) void hydrateRecipeDetail(id);   // pulls full steps before cooking
}, [id, hydrateRecipeDetail]);

// Gate cook UI until steps are present so ScrollableRecipe never maps undefined:
if (!recipe || !Array.isArray(recipe.steps) || recipe.steps.length === 0) {
  return <LoadingOrEmptyState />;   // spinner while hydrate lands; offline-safe
}
```

And make the store/consumers null-safe so a trimmed row can never throw:
```tsx
// cookingStore.ts next()/jumpToStep()
const maxIndex = Math.max(0, (recipe.steps?.length ?? 0) - 1);
// ScrollableRecipe.tsx:234
{(recipe.steps ?? []).map((step, i) => ( ... ))}
// cook.tsx:604
if (recipe.steps?.[i]) stepSpeaker.speak(recipe.steps[i]);
// RecipeCard.tsx:459, kitchen.tsx:875, edit.tsx:80 — use `recipe.steps ?? []`
```

Better still: defensively re-hydrate in any screen that consumes full-row fields off the list (cook, edit, remix-from-card, cook-later). The detail-screen guard alone does not cover the product's primary "Cook Now from Recipe Box" flow.

## Warnings

### WR-01: Persisted store overwrites complete (steps-bearing) rows with trimmed rows on every fetch

**File:** `apps/mobile/src/stores/recipeStore.ts:281-286, 466`

**Issue:** `fetchRecipes` does `set({ recipes: body.data ?? [] })`, wholesale-replacing the array, and the store persists `recipes` to AsyncStorage (`partialize: (state) => ({ recipes: state.recipes })`). Before 28-01 the persisted rows had `steps`; after this phase every fetch clobbers them with trimmed rows. So a recipe that was fully cached locally (steps present, usable offline) silently loses its steps on the next foreground refresh, widening CR-01's blast radius and degrading offline cook/edit. `hydrateRecipeDetail` then merges back per-recipe, but only for the one recipe whose detail screen is opened.

**Fix:** Merge rather than replace so existing detail-only fields survive a list refresh:
```ts
set((state) => {
  const prev = new Map(state.recipes.map((r) => [r.id, r]));
  const merged = (body.data ?? []).map((row: Recipe) => {
    const old = prev.get(row.id);
    // keep locally-known steps/step_image_urls the trimmed list omits
    return old ? { ...row, steps: row.steps ?? old.steps,
                   step_image_urls: row.step_image_urls ?? old.step_image_urls } : row;
  });
  return { recipes: merged, isLoading: false, error: null };
});
```

### WR-02: `RECIPE_LIST_LIMIT = 200` silently truncates — users with >200 recipes lose rows from the list AND from client-side search, with no signal

**File:** `packages/server/src/services/recipeStore.ts:58, 179-189`; `packages/server/src/routes/recipes.ts:88-97`

**Issue:** The query caps at 200 with `.order('created_at' desc)`. A user with >200 saved recipes silently drops the oldest beyond 200. Because mobile search runs over the in-memory array (per the column-trim rationale comment), those recipes also become **unsearchable** in the app, with no UI or log flag — they simply vanish. The timing log emits `row_count` but nothing compares it against the limit, so an operator cannot tell a truncated response from a naturally-200-row one.

**Fix:** Detect saturation and surface it. Cheapest: log a distinct flag when `rowCount === RECIPE_LIST_LIMIT`, and return a `truncated` boolean in the response so the client can show "showing 200 of N" / fall back to server-side search:
```ts
const truncated = rows.length === RECIPE_LIST_LIMIT;
// route: include truncated in the JSON, and:
if (truncated) console.warn(JSON.stringify({ stage: 'recipes.list.truncated', profile_id: user.id, limit: RECIPE_LIST_LIMIT }));
```
Long term, server-side `q` filtering already exists (ILIKE) — route client search through it when truncated so capped users can still find old recipes.

### WR-03: `/backfill-images` runs unbounded, sequentially, inside one request — times out and hammers Gemini for a user with many null rows

**File:** `packages/server/src/routes/recipes.ts:1232-1288`

**Issue:** The route selects ALL null-image rows for the user (`.is('image_url', null)`, no `.limit()`) and generates them one-by-one in a `for` loop, each awaiting a full Gemini round-trip (cold gen is seconds each). A user with, say, 150 legacy null rows produces a single HTTP request that runs for minutes — well past any proxy/Fly/ALB timeout — and the client gets a dropped connection while the server keeps burning Gemini calls with no way to observe completion. It is idempotent and correctly scoped/owned (good), but it is not bounded or batched.

**Fix:** Cap per call and return a cursor/remaining count so the client (or Patrick) re-invokes until drained:
```ts
const BATCH = 20;
const { data: rows } = await supabase.from('recipes')
  .select('id, title, description, ingredients, image_url')
  .eq('profile_id', user.id).is('image_url', null).limit(BATCH);
// ... after the loop:
return c.json({ examined, updated, skipped, remaining_estimate: rows.length === BATCH ? 'more' : 0 });
```
Consider bounded parallelism (e.g. p-limit at 2, mirroring the client `MAX_CONCURRENT`) to shorten wall time without saturating Gemini.

### WR-04: `RecipeRow` type omits `is_favorite` and `labels` though the list query selects them — silent type drift

**File:** `packages/server/src/services/recipeStore.ts:8-35, 50`

**Issue:** `RECIPE_LIST_COLUMNS` selects `is_favorite` and `labels` (both real columns, verified against `00005_recipe_favorites.sql` / `00032_recipe_labels.sql`), but the `RecipeRow` interface declares neither. The function returns `data as unknown as RecipeRow[]`, so callers see a type that claims `is_favorite`/`labels` don't exist while the runtime object has them and lacks `steps`/`step_image_urls` that the type DOES claim. This is exactly the type-vs-runtime gap that let CR-01 slip past the compiler.

**Fix:** Add `is_favorite: boolean` and `labels: string[]` to `RecipeRow`, and split the list shape from the full shape so the compiler can flag step access on list rows:
```ts
export type RecipeListRow = Omit<RecipeRow, 'steps' | 'step_image_urls'>;
export async function getRecipes(...): Promise<{ rows: RecipeListRow[]; queryMs: number; rowCount: number }>
```
A `RecipeListRow` that lacks `steps` would have surfaced CR-01 at build time.

### WR-05: Generate-on-save uses the stale pre-write `data` row for the dedup/skip decision and never refreshes — a row imported with an image still re-checks via `!data.image_url`

**File:** `packages/server/src/routes/recipes.ts:469-504`

**Issue:** The fire-and-forget block is correct on rejection handling (inner try/catch + `void Promise`), ownership (`.eq('profile_id', userId)`), and dedup (early-return at 452 never reaches it). However it gates on `!data.image_url` where `data` is the freshly-inserted row. `saveRecipe` inserts `image_url: recipe.image_url`, so a recipe saved WITH an image correctly skips — good. The subtle issue: if two concurrent saves of the same title race past the dedup check (double-tap before the first insert commits), both insert and both fire generate-on-save, double-billing the first cold gen. Low-likelihood but the dedup is not transactional.

**Fix:** Acceptable as-is given the content-addressed Storage cache makes the second gen a cheap hit, but document it, or add a unique partial index on `(profile_id, lower(title))` to make dedup authoritative at the DB layer.

## Info

### IN-01: `recipes.get('/:id')` is declared AFTER `/search`, `/discover` but the trailing static routes are fine — confirm `/backfill-images` etc. don't collide with `/:id`

**File:** `packages/server/src/routes/recipes.ts:411, 1232`

**Issue:** `GET /:id` is a parameterized route; the new `POST /backfill-images` is POST so no collision. Just flagging that any future `GET /backfill-images` would be shadowed by `GET /:id`. No action needed now.

### IN-02: `cook.tsx` and `index.tsx` duplicate the "fetch on missing recipe" effect with diverging behavior

**File:** `apps/mobile/src/app/recipes/[id]/cook.tsx:194-198`; `apps/mobile/src/app/recipes/[id]/index.tsx:43-47, 57-59`

**Issue:** Both screens have a `useEffect` that calls `fetchRecipes()` when the recipe is missing, but only the detail screen added the `hydrateRecipeDetail` effect. The divergence is the proximate cause of CR-01. Extract a shared `useHydratedRecipe(id)` hook so every full-row consumer gets identical re-hydration semantics instead of copy-paste effects that drift.

### IN-03: Telemetry payload PII review — clean

**File:** `packages/server/src/routes/recipes.ts:490-499, 697-704`; `apps/mobile/src/hooks/useGeneratedRecipeImage.ts:33-45`

**Issue:** Verified no PII leaks. `recordAiCall` writes only `{tokens_in, tokens_out, latency_ms, success, error_code}` — no titles/ingredients. Client `emitImageEvent` routes through `sanitizePayload`, and `ms`/`success` are both in the whitelist; `session_id: 'recipe-box'` is a coarse constant bucket, not user data. The `task` strings (`recipe.generateImage.onSave.miss`, etc.) are static labels. No finding — recorded as positive confirmation of the scrutiny item.

---

## Fixes Applied

**Applied:** 2026-06-09 · **Fixer:** Claude (gsd-code-fixer)

### CR-01 — FIXED (also resolves WR-01) · commit `fd8f6cd`

Backed out the `steps` column trim rather than threading re-hydration through
every off-list consumer. `recipe.steps` is read straight off the in-memory list
array by many flows that never re-hydrate (Cook Mode from the Recipe Box,
cookingStore, cook.tsx, edit.tsx, Cook Later in kitchen.tsx, RecipeCard), so
restoring the columns is the correct, low-risk fix; the dominant load cost is
image generation (handled by O2/O3, untouched).

- `packages/server/src/services/recipeStore.ts` — restored `steps` and
  `step_image_urls` to `RECIPE_LIST_COLUMNS`. Kept `RECIPE_LIST_LIMIT = 200`,
  the `{ rows, queryMs, rowCount }` return shape, and the GET /recipes timing
  log (`db_query_ms` / `row_count` / `payload_bytes`).
- `packages/server/src/services/__tests__/recipeStore.test.ts` — flipped the
  exclusion assertion to assert `steps` + `step_image_urls` ARE included.
- The detail re-hydration (`hydrateRecipeDetail`) and the `(recipe.steps ?? [])`
  null-guards in `[id]/index.tsx` were LEFT in place (defensive belt-and-
  suspenders, harmless).
- **Resolves WR-01** (fetchRecipes clobbering persisted steps) — steps are
  present on every list row again, so a list refresh no longer trims them.

### WR-02 — FIXED · commit `d8aec6b`

LIMIT 200 truncation is now observable instead of silent.

- `recipeStore.ts` `getRecipes` now returns `truncated` (`rows.length >=
  RECIPE_LIST_LIMIT`).
- `routes/recipes.ts` GET / includes `truncated` in the JSON body and the
  `recipes.list` telemetry line, and emits a distinct
  `recipes.list.truncated` `console.warn` when saturated.
- Backward-compatible: the mobile store reads `body.data ?? []`, so the new
  sibling field is inert on the client until wired up.

### WR-03 — FIXED · commit `7dcd71a`

`/backfill-images` is now bounded and re-invocable.

- `routes/recipes.ts` caps the candidate select at `BACKFILL_BATCH = 25`
  (oldest-first), and returns `{ examined, updated, skipped, remaining }` where
  `remaining` comes from a cheap head/count of still-null rows after the batch
  (heuristic fallback if that count query fails). Still authed, idempotent, and
  ownership-scoped.

### Deferred (per review scope)

- **WR-04** (RecipeRow omits `is_favorite`/`labels`; no `RecipeListRow` split) —
  type-drift hardening, not a runtime bug. Deferred.
- **WR-05** (generate-on-save dedup not transactional under concurrent double-
  save) — low-likelihood, cheap content-addressed cache hit on the second gen.
  Deferred.
- **IN-01** (route-ordering note — no action needed), **IN-02** (extract a shared
  `useHydratedRecipe` hook — now lower priority since steps are restored),
  **IN-03** (PII review — positive confirmation, no change). Deferred.

### Verification

- `pnpm vitest run` for `recipeStore.test.ts`, `recipes.get.test.ts`,
  `recipes.backfill-images.test.ts` — **24 passed**.
- `recipes.post.test.ts`, `recipes.generate-image.test.ts` — **15 passed**.
- `apps/mobile` `npx tsc --noEmit` — only the pre-existing `*.test.ts` baseline
  errors (type-drift fixtures + unused `@ts-expect-error` directives); no new
  errors and no mobile source files were modified.

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
