---
phase: 28-recipe-load-telemetry-performance-10s-3-5s
plan: 03
subsystem: mobile
tags: [react-native, zustand, telemetry, performance, recipes, perf-budget]

# Dependency graph
requires:
  - phase: 28-01
    provides: RECIPE_LIST_COLUMNS list-trim (drops steps + step_image_urls); getRecipeById keeps full select for detail
  - phase: 27-01
    provides: image_url write-back (generate-image persists when recipeId passed)
provides:
  - RECIPE_LOAD_MS=3500 perf budget (cold Recipe Box list-fetch ceiling)
  - fetchRecipes round-trip (incl. getAuthToken pre-flight) timed via withBudget('recipe.fetch', RECIPE_LOAD_MS)
  - per-image time-to-visible telemetry — logAiEvent('recipe.image.visible') split by cache_hit vs cold_gen
  - hydrateRecipeDetail(id) store action — GET /recipes/:id full data merged on detail open (O1 client guard)
affects: [telemetry-measurement, recipe-detail, ai_events]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "withBudget wraps the WHOLE timed body (incl. auth pre-flight) by moving the try-body into the timed fn; outer try/catch keeps error handling unchanged"
    - "Per-image telemetry emits exactly once per resolution transition (inside the one-shot .then/branch) so re-renders don't spam ai_events; mount→resolve ms encompasses queue wait, no double-count"
    - "Detail re-hydration lives in its OWN useEffect keyed [id, hydrateRecipeDetail] — id-only deps fire once per open; keeping it out of the [recipe,...] effect avoids the mergeRecipeLocal→new-reference→re-fire infinite loop"
    - "Null-guard (recipe.steps ?? []) on every pre-hydration access because PostgREST returns the trimmed column as undefined (NOT []) and the TS type (steps:string[]) won't catch it"

key-files:
  created: []
  modified:
    - apps/mobile/src/lib/perfBudgets.ts
    - apps/mobile/src/lib/__tests__/perfBudgets.test.ts
    - apps/mobile/src/stores/recipeStore.ts
    - apps/mobile/src/hooks/useGeneratedRecipeImage.ts
    - apps/mobile/src/app/recipes/[id]/index.tsx

key-decisions:
  - "RECIPE_LOAD_MS=3500 — the upper bound of the 3-5s target band, used as the over-budget breadcrumb threshold (not a hard timeout)"
  - "Per-image payload is {ms, success} only (both whitelisted); session_id='recipe-box' coarse bucket, no titles/ingredients (PII guard)"
  - "hydrateRecipeDetail is best-effort: silent no-op on offline/error so the trimmed list data still renders; GET /recipes/:id uses getRecipeById (full select, unaffected by 28-01)"

# Metrics
metrics:
  duration: 4min
  tasks: 3
  files: 5
  completed: 2026-06-09
---

# Phase 28 Plan 03: Recipe-load telemetry (client) + O1 detail re-hydration Summary

Client half of Phase 28 T3 telemetry plus the O1 client correctness guard: times the recipe.fetch round-trip (auth pre-flight included) against a 3.5s budget, emits per-image time-to-visible split by cache-hit vs cold-gen, and re-hydrates full recipe steps on detail open so the 28-01 list-trim never leaves the detail screen empty or crashing.

## What Was Built

- **Task 1 — RECIPE_LOAD_MS budget + wrapped fetchRecipes** (`4e0a995`): Added `RECIPE_LOAD_MS = 3500` to `perfBudgets.ts`. Refactored `fetchRecipes` so `getAuthToken` + URL build + fetch + JSON parse all run inside `withBudget('recipe.fetch', RECIPE_LOAD_MS, ...)`; the outer try/catch and `!response.ok` early-set are unchanged in behavior. TDD: added a constant test and a `recipe.fetch` passthrough test to the existing `perfBudgets.test.ts` (RED confirmed → GREEN).
- **Task 2 — per-image time-to-visible** (`b92df3e`): `useGeneratedRecipeImage` now captures `mountedAt` at the top of `evaluate()` and emits `logAiEvent('recipe.image.visible')` on all three resolution paths — `cache_hit` (synchronous hit), and `cold_gen` for both the inflight-resolve and fresh-fetch-resolve branches (`success = u != null`). A module-level `emitImageEvent` helper routes `{ ms, success }` through `sanitizePayload`.
- **Task 3 — detail re-hydration (O1 client guard)** (`2b6a1e5`): Added `hydrateRecipeDetail(id)` to the store (interface + impl) — GETs `/api/v1/recipes/:id` and `mergeRecipeLocal`s the full row, best-effort. The detail screen calls it in a **separate** `useEffect` keyed `[id, hydrateRecipeDetail]` (NOT the `[recipe, ...]` effect — that infinite-loops), and null-guards both the steps render (`(recipe.steps ?? []).map`) and `baseForSave` (`steps: recipe.steps ?? []`).

## Verification

- `pnpm vitest run src/lib/__tests__/perfBudgets.test.ts` → 6 passed (RED→GREEN on the two new cases).
- `npx tsc --noEmit -p tsconfig.json` filtered to the four touched files → no new errors.
- All plan verification greps pass: `RECIPE_LOAD_MS` exported; `withBudget('recipe.fetch'` wraps fetchRecipes; `logAiEvent`/`recipe.image.visible` in the hook; `hydrateRecipeDetail` defined + called; `[id, hydrateRecipeDetail]` id-only deps; `recipe.steps ?? []` at both the steps render and baseForSave.

## Deviations from Plan

None - plan executed exactly as written. Task 3's two flagged blockers (null-guard the steps render because PostgREST returns `undefined` not `[]`; keep hydration in its own `[id, ...]` effect to avoid the infinite re-hydrate loop) were implemented exactly as the revised plan specified.

## Notes

- This plan is the client complement to 28-01's server-side list-trim: it is safe regardless of trim-deploy order, because `hydrateRecipeDetail` re-fetches full data via `getRecipeById` (full select) on every open.
- Telemetry is dormant-plumbing-only (no Sentry spans), per the locked phase decision. Real p50/p95 numbers require a build that includes Phases 27+28 and a cold load against the live app — the data-driven verification at the phase tail.

## Self-Check: PASSED

All 5 modified files present on disk; all 3 task commits (4e0a995, b92df3e, 2b6a1e5) found in git history.
