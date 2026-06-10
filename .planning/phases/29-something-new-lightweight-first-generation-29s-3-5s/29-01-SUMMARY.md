---
phase: 29-something-new-lightweight-first-generation-29s-3-5s
plan: 01
subsystem: api
tags: [gemini, recipe-discovery, caching, performance, hono, supabase]

# Dependency graph
requires:
  - phase: 17-something-new
    provides: "POST /recipes/search route, discoverRecipes service, buildDiscoveryPrompt"
  - phase: 27-performance-caching
    provides: "discoveryCache (TTL'd response cache + in-flight coalescing, content-addressed key)"
provides:
  - "OPT-IN light discovery mode on discoverRecipes (light:true drops heavy ingredients[]/steps[] from required generation, keeps cheap ingredient_names)"
  - "buildSuggestRecipesSchema(light) exported schema builder (full vs light variants)"
  - "buildDiscoveryPrompt light param (omits full-detail instruction in light mode)"
  - "/recipes/search reads body.light, parallelizes 4 pre-call DB fetches via Promise.all, logs gemini_ms vs total_ms"
  - "discoveryCacheKey folds light into the composite (light and full responses can't collide)"
affects: [29-02-hydration-endpoint, 29-03-client-light-flag, 29-04-deploy-measure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in capability flag threaded through service options + prompt + tool schema, default byte-identical (deploy-safety for server-ahead-of-app)"
    - "Schema builder (buildSuggestRecipesSchema) over two const schemas — shared COMMON_RECIPE_PROPERTIES prevents full/light drift on card fields"
    - "Parallel pre-call DB fetches via Promise.all with post-batch per-result .error checks preserving the original serial error messages"

key-files:
  created: []
  modified:
    - packages/server/src/services/recipeDiscovery.ts
    - packages/server/src/routes/recipes.ts
    - packages/server/src/services/discoveryCache.ts
    - packages/server/src/services/__tests__/recipeDiscovery.test.ts
    - packages/server/src/routes/__tests__/recipes.search.test.ts
    - packages/server/src/services/__tests__/discoveryCache.test.ts

key-decisions:
  - "Light mode is OPT-IN (body.light===true); default path stays byte-identical so the currently-shipped app is unaffected when the server deploys ahead of the EAS build"
  - "Light schema keeps a cheap ingredient_names string array (D1a) so the pantry-match badge survives — far cheaper than full ingredient objects + steps"
  - "light folded into the discovery cache key so a light payload can never be served to the old (full-contract) app and vice versa"

patterns-established:
  - "Capability-flag-with-byte-identical-default: opt-in flag threaded through options/prompt/schema, default unchanged, regression test asserts the full path is untouched"
  - "Promise.all-with-preserved-error-surface: parallelize independent awaits, then check each result's .error after the batch and rethrow the identical message"

requirements-completed: [D1, D2, D8-server]

# Metrics
duration: 7min
completed: 2026-06-10
---

# Phase 29 Plan 01: Lightweight-first "Something New" generation Summary

**Opt-in `light` discovery mode that drops heavy ingredients[]/steps[] from the Gemini generation (the ~29s cost driver), keeps a cheap ingredient_names list, parallelizes the 4 pre-call DB fetches, and adds /search Gemini-vs-total timing — with the default (no-flag) path kept byte-identical for the currently-shipped app.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-10T04:57:33Z
- **Completed:** 2026-06-10T05:04:17Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6

## Accomplishments
- `buildSuggestRecipesSchema(light)` — light variant drops `ingredients`/`steps` from `required` AND properties, swaps in a cheap `ingredient_names: string[]` (not required); keeps title/description/times/servings/difficulty/practiced_skills/skill_note/nutrition. Default schema is byte-identical to today (`['title','ingredients','steps','difficulty','practiced_skills']` required).
- `buildDiscoveryPrompt(..., light)` — in light mode skips the "Return full recipes with structured ingredients … and ordered steps" instruction and substitutes a previews-only line; keeps the SKILL TAGGING + NUTRITION blocks (cheap, wanted on cards).
- `discoverRecipes({ light })` — selects the light tool/schema, threads `light` into the prompt, and maps `ingredient_names` into `ingredients` objects (`{name, quantity:null, unit:null, notes:null}`) with `steps:[]`. Full path unchanged.
- `/recipes/search` — reads `body.light`, threads `light` into `discoverRecipes` and the cache key, **parallelizes** members + profile + library (+ pantry when `pantryOnly`) via `Promise.all` (was 4 serial awaits), and logs a structured `recipes.search` line with `gemini_ms` + `total_ms` (D8-server).
- `discoveryCacheKey` folds `light` into the composite so a light response and a full response for the same query can never collide in the in-process cache.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1 RED: failing tests for light schema + prompt** — `f9ca40d` (test)
2. **Task 1 GREEN: opt-in light discovery schema + prompt variant (D1)** — `dfb554d` (feat)
3. **Task 2 RED: failing tests for /search light mode + light cache key** — `2ab0c1d` (test)
4. **Task 2 GREEN: /search light mode, parallel fetches, sub-stage timing (D2+D8-server)** — `adc3b55` (feat)

_No REFACTOR commits — implementation was clean as written._

## Files Created/Modified
- `packages/server/src/services/recipeDiscovery.ts` — `DiscoverRecipesOptions.light`; `buildSuggestRecipesSchema(light)` builder (shared `COMMON_RECIPE_PROPERTIES`, heavy ingredients/steps only in full, `ingredient_names` only in light); `buildSuggestRecipesTool(light)`; `buildDiscoveryPrompt` light param; `discoverRecipes` light tool selection + `ingredient_names`→ingredients mapping.
- `packages/server/src/routes/recipes.ts` — `/search` body `light?`, `const light = body.light === true`, `Promise.all` over members/profile/library/pantry with preserved error messages, `light` threaded into cache key + `discoverRecipes`, `recipes.search` timing log (`gemini_ms`/`total_ms`).
- `packages/server/src/services/discoveryCache.ts` — `DiscoveryCacheKeyInput.light` + folded into the composite key.
- `packages/server/src/services/__tests__/recipeDiscovery.test.ts` — Phase 29 cases: light schema required/properties, light prompt omits full-detail line, light mapping (ingredient_names→2 ingredients, steps empty), full-path regression guards.
- `packages/server/src/routes/__tests__/recipes.search.test.ts` — light:true threads light into discoverRecipes; no-flag backward-compat (full ingredients+steps); profile error surfaces as 500 under parallelized fetches.
- `packages/server/src/services/__tests__/discoveryCache.test.ts` — light flag folds into key (light vs full differ; default === light:false).

## Decisions Made
- **Light is OPT-IN, default byte-identical.** The server deploys to Fly before the EAS build ships; the old app calls `/search` expecting full ingredients+steps. Default (no flag) stays the full-recipe contract; only `light:true` (sent by the new app in Plan 29-03) switches to previews. Regression tests assert the full required schema and full-detail instruction survive.
- **Keep `ingredient_names` in the light schema (D1a).** Bare names are far cheaper to generate than full ingredient objects + steps and let the pantry-match badge keep working without hydration.
- **Fold `light` into the cache key.** Prevents the in-process discovery cache from ever serving a light payload to the full-contract app (and vice versa). `light` omitted/false produce the same key value (`::0`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Explicit row type on `library.rows.map`**
- **Found during:** Task 2 (/search parallelization)
- **Issue:** Moving the library fetch into `Promise.all` widened the destructured tuple element's type, so `library.rows.map((r) => r.title)` made `r` implicitly `any` — one NEW `tsc` error beyond the documented untyped-Hono baseline.
- **Fix:** Annotated the callback parameter `(r: { title: string })`. Restored the file's `tsc` error count to the exact pre-change baseline (82).
- **Files modified:** packages/server/src/routes/recipes.ts
- **Verification:** `tsc --noEmit` recipes.ts error count back to 82 (baseline); diff-ignoring-line-numbers shows zero new errors.
- **Committed in:** adc3b55 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to avoid introducing a new type error. No scope creep — purely a type annotation forced by the Promise.all refactor the plan mandated.

## Issues Encountered
- None beyond the deviation above. The full server suite's 76 failures are all `ECONNREFUSED 127.0.0.1:3000` in the top-level `__tests__/` integration suites (require a live server) and pre-existing untyped-Hono `tsc` errors — both are the documented baseline, confirmed unchanged by stashing the working tree.

## Known Stubs
None. Light mode intentionally returns previews with empty `steps` and quantity-less `ingredients` — this is the designed lightweight-first contract, NOT an accidental stub. Full ingredients + steps are hydrated in the background by the hydration endpoint + client hook delivered in Plans 29-02 (server `/recipes/hydrate`) and 29-03 (client `useHydratedRecipeContent`). The old app never receives light payloads (opt-in flag + cache-key separation), so nothing un-hydrated reaches a shipped client this plan.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server light path is ready. Plan 29-02 can add `POST /recipes/hydrate` (reusing `applyRemixVariation`/`recipe.parseText`) to fill ingredients+steps for a light preview.
- Plan 29-03 (client) wires `light:true` into the mobile `searchRecipes` call and adds background hydration mirroring `useGeneratedRecipeImage`.
- Plan 29-04 deploys (Fly) + measures `/recipes/search` drop to ~3-5s using the new `recipes.search` `gemini_ms` log.

## Self-Check: PASSED

All modified files present; all 4 task commits (f9ca40d, dfb554d, 2ab0c1d, adc3b55) verified in git history.

---
*Phase: 29-something-new-lightweight-first-generation-29s-3-5s*
*Completed: 2026-06-10*
