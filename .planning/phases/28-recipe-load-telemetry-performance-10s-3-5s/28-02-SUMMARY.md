---
phase: 28-recipe-load-telemetry-performance-10s-3-5s
plan: 02
subsystem: api
tags: [hono, supabase, telemetry, image-gen, gemini, performance, recipes]

# Dependency graph
requires:
  - phase: 27-*
    provides: POST /generate-image persists image_url write-back (mirrored for generate-on-save + backfill)
  - phase: 28-01
    provides: getRecipes { rows, queryMs, rowCount } shape + recipes.list timing log (preserved untouched)
provides:
  - generateRecipeImageWithMeta(input) → { url, cacheHit, genMs } telemetry-aware variant; generateRecipeImage delegates to it
  - RECIPE_IMAGE_MODEL export for telemetry labelling
  - POST /generate-image records recipe.generateImage.hit/miss to ai_events via recordAiCall (T2)
  - POST / generate-on-save — fire-and-forget image_url generation+persist after the 201 (O2)
  - POST /backfill-images — manual, idempotent, per-user legacy null-image backfill (O3)
affects: [28-03, telemetry-measurement, recipe-box-cold-load, mobile-image-hook-skip-branch]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Result-with-meta variant (generateRecipeImageWithMeta) returns { url, cacheHit, genMs } so callers record cost/latency without re-timing; the plain string fn delegates so every caller shares one path"
    - "Fire-and-forget generate-on-save: void Promise.resolve().then(...) AFTER building the 201 so the save UX is never blocked by the Gemini round-trip"
    - "Idempotent per-user backfill via .is('image_url', null) — already-populated rows are never selected; content-addressed Storage cache makes re-runs cheap"

key-files:
  created:
    - packages/server/src/routes/__tests__/recipes.post.test.ts
    - packages/server/src/routes/__tests__/recipes.backfill-images.test.ts
  modified:
    - packages/server/src/services/recipeImageGen.ts
    - packages/server/src/routes/recipes.ts
    - packages/server/src/routes/__tests__/recipes.generate-image.test.ts

key-decisions:
  - "[28-02] generateRecipeImage refactored to delegate to generateRecipeImageWithMeta — back-compat preserved for /:id/step-images and every existing caller (one code path)"
  - "[28-02] generate-on-save fires only when the saved row has no image_url; dedup early-return path (existing title) returns before the block so it never generates"
  - "[28-02] backfill-images is per-user (profile_id = c.get('user').id), NOT all-users — image gen is a per-user cost; mirrors 27-01 ownership guard (.eq('profile_id'))"
  - "[28-02] Dropped a fragile 'persist-not-yet-called' synchronous assertion from the post test — await points let the microtask run before res.json() resolves; the meaningful 201-immediate + post-flush-persist contract is covered by two separate tests"

patterns-established:
  - "Telemetry-aware service variant + thin string-returning delegate (generateRecipeImageWithMeta / generateRecipeImage)"
  - "Fire-and-forget side-effect after the response: void Promise.resolve().then with try/catch, telemetry via void recordAiCall"

requirements-completed: [T2, O2, O3]

# Metrics
duration: 5min
completed: 2026-06-09
---

# Phase 28 Plan 02: Recipe-image telemetry + generate-on-save + backfill Summary

**POST /generate-image now records cache-hit vs cold-gen + Gemini ms to ai_events (T2); recipes are given an image_url at SAVE time fire-and-forget so the Recipe Box list never cold-generates on a cold open (O2); and a manual, idempotent per-user /backfill-images route repairs legacy null-image rows (O3).**

## Performance

- **Duration:** ~5 min
- **Tasks:** 3
- **Files modified:** 3 / created: 2

## Accomplishments

- **T2:** Added `generateRecipeImageWithMeta(input) → { url, cacheHit, genMs }` to `recipeImageGen.ts`; `generateRecipeImage` now delegates to it (back-compat for `/:id/step-images` and other callers). Exported `RECIPE_IMAGE_MODEL`. `/generate-image` calls `void recordAiCall(...)` with task `recipe.generateImage.hit`/`.miss`, `latencyMs: genMs`, `model`, and `success` — fire-and-forget, never blocks the response.
- **O2:** `POST /` now, after building the saved row and only when `!data.image_url`, kicks off `generateRecipeImageWithMeta` + `image_url` persist via `void Promise.resolve().then(...)` AFTER the `c.json({ data }, 201)` is returned. The save UX is unblocked; the list never cold-generates for newly-saved recipes. Records `recipe.generateImage.onSave.hit/miss`. The dedup early-return (existing title) returns before the block and never generates.
- **O3:** `POST /backfill-images` — authed, per-user, selects only `.is('image_url', null)` rows (idempotency filter), generates+persists each, returns `{ examined, updated, skipped }`. Never auto-run on boot; mirrors the 27-01 `.eq('profile_id')` ownership guard.
- **28-01 preserved:** `getRecipes` `{ rows, queryMs, rowCount }` shape and the `recipes.list` timing log are untouched — verified by re-running `recipes.get`/`search`/`discover`/`recipeStore` suites (31 passed).

## Task Commits

1. **Task 1 — generateRecipeImageWithMeta + /generate-image ai_events telemetry (T2):** `f902ace` (feat)
2. **Task 2 — generate-on-save fire-and-forget image_url persist (O2):** `e41d331` (feat)
3. **Task 3 — POST /backfill-images manual idempotent backfill (O3):** `8f7dde2` (feat)

## Files Created/Modified

- `packages/server/src/services/recipeImageGen.ts` — Added `RECIPE_IMAGE_MODEL` export, `RecipeImageResult` interface, and `generateRecipeImageWithMeta`; refactored `generateRecipeImage` to delegate.
- `packages/server/src/routes/recipes.ts` — Imports `generateRecipeImageWithMeta` + `RECIPE_IMAGE_MODEL` + `recordAiCall`; `/generate-image` uses the meta variant and records T2 telemetry; `POST /` generate-on-save block (O2); new `POST /backfill-images` route (O3).
- `packages/server/src/routes/__tests__/recipes.generate-image.test.ts` — Stubs `generateRecipeImageWithMeta`, mocks `recordAiCall`; two new T2 telemetry assertions (hit + miss); existing 8 write-back cases preserved (10 total).
- `packages/server/src/routes/__tests__/recipes.post.test.ts` *(new)* — 5 cases: 201 immediate, microtask-flush persist scoped to id+profile_id + onSave telemetry, null-url no-clobber, dedup no-generate, already-has-image no-generate.
- `packages/server/src/routes/__tests__/recipes.backfill-images.test.ts` *(new)* — 4 cases: null-row select filter, `{ examined:2, updated:1, skipped:1 }` + persist scoping, idempotent zero-rows, select-error 500.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test reliability] Dropped a timing-fragile synchronous assertion in recipes.post.test.ts**
- **Found during:** Task 2
- **Issue:** The plan's case 1 suggested asserting `update` had NOT been called in the synchronous response path. In practice the fire-and-forget microtask runs during the `await res.json()` yield, so the assertion failed non-deterministically — it tested microtask *scheduling timing*, not a stable contract.
- **Fix:** Reframed case 1 to assert the stable contract (201 returned immediately + body's `image_url` is null because generation does not mutate the response). The fire-and-forget persist is verified separately in case 2 (after an explicit `setImmediate` microtask flush). No behavior change to the route.
- **Files modified:** `packages/server/src/routes/__tests__/recipes.post.test.ts`
- **Commit:** `e41d331`

## Issues Encountered

None beyond the test-timing adjustment above.

## Test Results

- Targeted plan suites: `recipes.generate-image.test.ts` (10) + `recipes.post.test.ts` (5) + `recipes.backfill-images.test.ts` (4) → **19 passed**.
- Regression check: `recipes.get` / `recipes.search` / `recipes.discover` / `recipeStore` → **31 passed** (28-01 shape preserved).
- Known baseline (NOT regressions): root `__tests__/*.test.ts` integration tests require a live server on :3000 (ECONNREFUSED); pre-existing untyped-Hono-context `tsc` errors remain out of scope.

## Known Stubs

None — no stub/placeholder values introduced. All three routes are fully wired (generate → persist → telemetry).

## Next Phase Readiness

- T2 telemetry is live: a deploy-measure cold load will now log `recipe.generateImage.hit/miss` + onSave events to `ai_events` for per-image cost analysis.
- O2 means newly-saved recipes carry image_url before the list loads → the mobile image hook's `skip:true` branch fires, eliminating cold-open generate-image requests for new saves.
- O3 `/backfill-images` is ready for Patrick to trigger against prod to repair existing libraries (the one-time complement to O2).

---
*Phase: 28-recipe-load-telemetry-performance-10s-3-5s*
*Completed: 2026-06-09*

## Self-Check: PASSED
- FOUND: packages/server/src/services/recipeImageGen.ts
- FOUND: packages/server/src/routes/recipes.ts
- FOUND: packages/server/src/routes/__tests__/recipes.post.test.ts
- FOUND: packages/server/src/routes/__tests__/recipes.backfill-images.test.ts
- FOUND: .planning/phases/28-recipe-load-telemetry-performance-10s-3-5s/28-02-SUMMARY.md
- FOUND commit: f902ace
- FOUND commit: e41d331
- FOUND commit: 8f7dde2
