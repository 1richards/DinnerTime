---
phase: 28-recipe-load-telemetry-performance-10s-3-5s
verified: 2026-06-10T03:49:38Z
status: human_needed
score: 5/6 success criteria verified in code
re_verification: false
human_verification:
  - test: "Cold-load Recipe Box on device after Fly deploy + EAS build #25"
    expected: "Cold Recipe Box list loads in 3-5s; new telemetry logs visible in server stdout (recipes.list lines with db_query_ms/row_count/payload_bytes; recipe.image.visible events in ai_events)"
    why_human: "Runtime perf target (3-5s) requires a live Fly deploy + EAS build that includes Phases 27+28 changes. The code enabling it is verified present; the measurement requires a cold device load against the live API."
  - test: "Run POST /backfill-images against Patrick's prod library, observe { examined, updated, skipped }"
    expected: "All legacy null-image_url recipes gain an image_url; re-run returns { examined: 0, updated: 0, skipped: 0 } (idempotency confirmed)"
    why_human: "Backfill is a one-time manual trigger against production data; requires live Supabase + Gemini credentials."
---

# Phase 28: Recipe-load Telemetry + Performance Verification Report

**Phase Goal:** Cut Recipe Box cold-load from ~10s to 3-5s via telemetry (light up dormant plumbing) + high-confidence wins (generate-on-save + backfill so list stops cold-generating, getRecipes payload trim + LIMIT).
**Verified:** 2026-06-10T03:49:38Z
**Status:** human_needed — all code present and verified; runtime measurement needs Fly deploy + EAS build
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (6 ROADMAP Success Criteria)

| #  | Success Criterion | Status | Evidence |
|----|-------------------|--------|----------|
| 1  | GET /recipes log includes db_query_ms + row_count + payload_bytes | VERIFIED | `packages/server/src/routes/recipes.ts:88-97` — console.log with all three fields + stage:'recipes.list' + request_id |
| 2  | POST /generate-image records cache-hit/miss + Gemini ms to ai_events via recordAiCall | VERIFIED | `recipeImageGen.ts:360-389` exports `generateRecipeImageWithMeta({url,cacheHit,genMs})`; `recipes.ts:684-708` calls `void recordAiCall(...)` with task='recipe.generateImage.hit/miss' |
| 3  | perfBudgets.ts exports RECIPE_LOAD_MS; fetchRecipes wrapped in withBudget('recipe.fetch'); useGeneratedRecipeImage emits logAiEvent per-image | VERIFIED | `perfBudgets.ts:37` exports RECIPE_LOAD_MS=3500; `recipeStore.ts:255` wraps full round-trip (incl. getAuthToken) in withBudget; `useGeneratedRecipeImage.ts:38-46` emits logAiEvent('recipe.image.visible') on all 3 resolution paths |
| 4  | getRecipes list excludes steps + step_image_urls, keeps ingredients, LIMIT 200; getRecipeById keeps full select; [id]/index.tsx re-hydrates via hydrateRecipeDetail in separate [id,hydrateRecipeDetail] effect + null-guards recipe.steps ?? [] | VERIFIED | `recipeStore.ts:49-50` RECIPE_LIST_COLUMNS confirmed excludes 'steps' and 'step_image_urls', includes 'ingredients'; `recipeStore.ts:181` .limit(RECIPE_LIST_LIMIT=200); `getRecipeById:245-248` uses untyped .select(); detail screen `[id]/index.tsx:58-59` separate effect; `index.tsx:349,427` both steps null-guards present |
| 5  | generate-on-save: POST / fire-and-forget non-blocking 201; /backfill-images authed + idempotent (image_url IS NULL) + not boot-run | VERIFIED | `recipes.ts:469-506` void Promise.resolve().then(...) fires BEFORE return c.json({data},201); backfill at `recipes.ts:1232-1290` uses `.is('image_url', null)` + auth via authMiddleware; `/backfill-images` absent from `packages/server/src/index.ts` (not boot-run) |
| 6a | No regression in recipe/discovery unit test suites | VERIFIED | 7 targeted suites: 50 passed (0 failed). Full src/ unit suite: 38 files, 543 passed. 76 ECONNREFUSED failures are pre-existing integration tests requiring live server — confirmed baseline, not regressions |
| 6b | Runtime 3-5s cold-load confirmed on device | HUMAN NEEDED | Code enabling it is present; actual measurement requires Fly deploy + EAS build #25 + cold load against live API |

**Score: 5/6 code criteria verified. Criterion 6b (runtime measurement) is deployment-gated.**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/server/src/services/recipeStore.ts` | RECIPE_LIST_COLUMNS + LIMIT + timing return | VERIFIED | RECIPE_LIST_COLUMNS at line 49-50; RECIPE_LIST_LIMIT=200 at line 58; getRecipes returns {rows,queryMs,rowCount} at line 160-189 |
| `packages/server/src/routes/recipes.ts` | db_query_ms/row_count/payload_bytes log in GET /; recordAiCall in /generate-image; fire-and-forget in POST /; /backfill-images route | VERIFIED | lines 88-97 (list log); lines 684-708 (generate-image telemetry); lines 469-506 (generate-on-save); lines 1232-1290 (backfill) |
| `packages/server/src/services/recipeImageGen.ts` | generateRecipeImageWithMeta returns {url,cacheHit,genMs}; RECIPE_IMAGE_MODEL export | VERIFIED | RECIPE_IMAGE_MODEL at line 32; generateRecipeImageWithMeta at lines 360-389; generateRecipeImage delegates at line 339 |
| `apps/mobile/src/lib/perfBudgets.ts` | RECIPE_LOAD_MS budget | VERIFIED | Line 37: `export const RECIPE_LOAD_MS = 3500` |
| `apps/mobile/src/stores/recipeStore.ts` | fetchRecipes wrapped in withBudget; hydrateRecipeDetail action | VERIFIED | withBudget wrap at lines 255-286; hydrateRecipeDetail action at lines 344-361 |
| `apps/mobile/src/hooks/useGeneratedRecipeImage.ts` | logAiEvent per-image on resolve (hit/miss) | VERIFIED | emitImageEvent helper at lines 33-46; called on cache_hit (line 294), inflight-resolve (line 305), fresh-fetch-resolve (line 327) |
| `apps/mobile/src/app/recipes/[id]/index.tsx` | hydrateRecipeDetail in separate effect; recipe.steps ?? [] null-guards | VERIFIED | Separate effect at lines 58-59 with [id,hydrateRecipeDetail] deps; null-guards at lines 349 and 427 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `recipes.ts GET /` | getRecipes timing | structured console.log stage='recipes.list' | WIRED | Line 88-97: all three fields present + request_id |
| `getRecipes .select()` | recipes table | RECIPE_LIST_COLUMNS (excludes steps/step_image_urls) | WIRED | Line 165: .select(RECIPE_LIST_COLUMNS); confirmed via column list parse — steps/step_image_urls absent, ingredients present |
| `POST /generate-image` | ai_events | recordAiCall with latency_ms + cache hit/miss | WIRED | Lines 697-708: void recordAiCall({task:'recipe.generateImage.hit/miss', latencyMs:genMs, ...}) |
| `POST / saveRecipe` | image_url persistence | fire-and-forget void Promise.resolve().then | WIRED | Lines 469-506: block runs only when !data.image_url; dedup early-return passes before the block |
| `POST /backfill-images` | recipes.image_url | .is('image_url', null) loop + update | WIRED | Lines 1232-1290: idempotency filter at line 1242; update per row at lines 1271-1276 |
| `fetchRecipes (mobile)` | withBudget('recipe.fetch', RECIPE_LOAD_MS) | getAuthToken inside timed fn | WIRED | Line 255: await withBudget('recipe.fetch', RECIPE_LOAD_MS, async () => { const token = await getAuthToken(); ... }) |
| `useGeneratedRecipeImage resolve` | ai_events | logAiEvent('recipe.image.visible') | WIRED | Three resolution paths all call emitImageEvent; sanitizePayload routes {ms, success} |
| `[id]/index.tsx open` | GET /recipes/:id full data | hydrateRecipeDetail → mergeRecipeLocal | WIRED | Separate useEffect at lines 58-59; hydrateRecipeDetail calls mergeRecipeLocal(full.id, full) |

---

### Data-Flow Trace (Level 4)

Level 4 trace is appropriate for the server log path and mobile store.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| GET / timing log | queryMs, rowCount, payloadBytes | Date.now() around Supabase query; Buffer.byteLength of serialized JSON | Yes — real DB round-trip timing + actual serialized size | FLOWING |
| generateRecipeImageWithMeta | url, cacheHit, genMs | Supabase Storage cache probe + Gemini generationBytes path | Yes — real Storage/Gemini calls | FLOWING |
| fetchRecipes | recipes state | GET /api/v1/recipes response body.data | Yes — set({recipes: body.data ?? []}) | FLOWING |
| hydrateRecipeDetail | recipe.steps via mergeRecipeLocal | GET /api/v1/recipes/:id → getRecipeById (full .select()) | Yes — getRecipeById uses untyped .select() returning all columns including steps | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RECIPE_LIST_COLUMNS excludes steps/step_image_urls | Python column list parse | steps=False, step_image_urls=False, ingredients=True | PASS |
| backfill-images not in server index.ts | grep backfill packages/server/src/index.ts | 0 matches | PASS |
| 7 targeted unit suites | pnpm vitest run (7 files) | 50 passed, 0 failed | PASS |
| Full src/ unit suite | pnpm vitest run src/ | 38 files, 543 passed, 0 failed | PASS |
| generate-on-save fires before return 201 | Read recipes.ts:469-506 | void Promise.resolve().then block at line 472, c.json({data},201) at line 506 | PASS |
| getRecipeById uses full select (no column restriction) | Read recipeStore.ts:245-248 | .select() called with no arguments | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| T1 | 28-01 | GET /recipes sub-stage timing (db_query_ms, row_count, payload_bytes) | SATISFIED | recipes.ts:88-97 |
| O1 | 28-01 + 28-03 | List query lightweight column set + LIMIT; client detail re-hydration | SATISFIED | recipeStore.ts:49-58,165,181; [id]/index.tsx:58-59,349,427 |
| T2 | 28-02 | POST /generate-image records cache-hit/miss + Gemini ms to ai_events | SATISFIED | recipeImageGen.ts:360-389; recipes.ts:697-708 |
| O2 | 28-02 | generate-on-save fire-and-forget non-blocking | SATISFIED | recipes.ts:469-506 |
| O3 | 28-02 | Backfill route authed + idempotent + not boot-run | SATISFIED | recipes.ts:1232-1242; index.ts has no backfill reference |
| T3 | 28-03 | Client-side recipe.fetch withBudget + per-image logAiEvent | SATISFIED | recipeStore.ts:255; useGeneratedRecipeImage.ts:38-46,294,305,327 |

---

### Anti-Patterns Found

None. Scanned all 9 phase-touched files. The two "placeholder" grep hits in recipes.ts are comments describing mobile UI fallback behavior for null image URLs — not code stubs. No empty handlers, no hardcoded empty arrays in render paths, no return null stubs.

---

### Human Verification Required

#### 1. Cold-load runtime measurement (Criterion 6b)

**Test:** After deploying to Fly (server) and installing EAS build #25 on a physical iPhone, force-close the app, ensure no warm state, then open Recipe Box and observe load time.
**Expected:** List visible within 3-5s; server logs show recipes.list lines; ai_events table records recipe.image.visible events on subsequent image resolution; for newly-saved recipes the image_url is pre-populated (list image hook skips cold-gen).
**Why human:** The 3-5s target is deployment + data gated. Code enabling it is verified present. The measurement requires a live deploy, a cold device state, and reading the new telemetry output.

#### 2. POST /backfill-images against Patrick's production library

**Test:** Trigger `POST /api/v1/recipes/backfill-images` via an authenticated request (Patrick's account). Observe the response JSON. Re-run immediately.
**Expected:** First run returns `{ examined: N, updated: M, skipped: K }` where K = rows where Gemini returned null. Re-run returns `{ examined: 0, updated: 0, skipped: 0 }` confirming idempotency.
**Why human:** Requires live production Supabase + Gemini credentials; operates on real data.

---

### Gaps Summary

No code gaps. All six success criteria have verified code implementations:

- Criterion 1 (T1 server telemetry): VERIFIED — GET /recipes logs recipes.list JSON with all three fields.
- Criterion 2 (T2 image telemetry): VERIFIED — generateRecipeImageWithMeta + recordAiCall wired in /generate-image.
- Criterion 3 (T3 client telemetry): VERIFIED — RECIPE_LOAD_MS exported; fetchRecipes wrapped in withBudget; logAiEvent emitted on all image resolution paths.
- Criterion 4 (O1 payload trim + detail re-hydration): VERIFIED — RECIPE_LIST_COLUMNS confirmed excludes steps/step_image_urls; LIMIT 200 applied; getRecipeById untouched (full select); separate [id, hydrateRecipeDetail] effect in detail screen; both steps ?? [] null-guards present.
- Criterion 5 (O2/O3 generate-on-save + backfill): VERIFIED — fire-and-forget before 201; backfill uses .is('image_url',null); not in server index.ts.
- Criterion 6 (no regression — unit suites): VERIFIED — 50 targeted tests + 543 full src/ unit tests pass; 76 ECONNREFUSED failures are pre-existing integration baseline.
- Criterion 6b (3-5s runtime): HUMAN NEEDED — code is present; measurement requires deploy.

---

_Verified: 2026-06-10T03:49:38Z_
_Verifier: Claude (gsd-verifier)_
