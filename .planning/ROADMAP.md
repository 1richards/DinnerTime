# Roadmap: DinnerTime

## Milestones

- **v1.0 — Private Beta Launch Ready** — Phases 1-25 (shipped 2026-04-22). See `milestones/v1.0-ROADMAP.md`.
- **v1.0.1 — Post-Launch Patches** — Phase 26 + ~18 inline patches (shipped 2026-05-01). See `milestones/v1.0.1-ROADMAP.md`.
- **v1.0.2 — Performance & Caching** — Phase 27 (in progress). Recipe-load, image-caching, and AI-suggestion-latency fixes from debug sessions.

## Phases

### v1.0.2 — Performance & Caching (in progress)

### Phase 27: Performance & caching fixes (recipe load, image caching, AI suggestions)

**Goal:** Eliminate redundant image generation and AI re-computation that make Recipe Box load slowly and "Something New" feel sluggish. Persist generated hero images so cold starts stop re-requesting them, cache + coalesce discovery responses, window the recipe list, and remove the source-type ("AI") corner badge. Root causes are diagnosed in `.planning/debug/perf-recipe-load-image-caching.md` and `.planning/debug/perf-ai-suggestions-latency.md`.

**UI hint:** no (minor UI only — RecipeCard badge removal + FlatList windowing props; no new screens)

**Requirements:** TBD (fix phase — scope from debug docs)

**Success criteria:**
- Generated hero image URL is written back to `recipes.image_url`; a saved recipe never re-requests `POST /generate-image` on a later cold start / new device.
- Repeat identical discovery requests (same user + normalized query + pantry signature) return from a server-side cache; concurrent identical requests coalesce to a single upstream call.
- Recipe Box FlatList uses windowing props; off-screen cards do not trigger image generation on mount.
- The source-type ("AI"/"URL") corner badge no longer renders on any recipe card.
- Prompt caching applied to the static discovery system prompt/tools where it clears provider min-token thresholds.
- No regression in existing recipe/discovery test suites.

**Plans:** 5/5 plans complete

Plans:
- [x] 27-01-PLAN.md — Server image_url write-back: persist generated hero URL to recipes.image_url (Decision 1)
- [x] 27-02-PLAN.md — Mobile rendering: FlatList windowing + RecipeCard memo + badge removal + recipeId wiring (Decisions 3, 4, 7)
- [x] 27-03-PLAN.md — Discovery response cache + in-flight coalescing on /search + /discover (Decision 2)
- [x] 27-04-PLAN.md — Discovery batch 6→3 + observable Gemini retry + Discover mount guard (Decision 5)
- [x] 27-05-PLAN.md — Prompt caching on the static discovery system prompt + tool schema (Decision 6)

Waves:
- Wave 1 (parallel): 27-01, 27-02, 27-04
- Wave 2 (parallel): 27-03 (after 27-01), 27-05 (after 27-04)

### Phase 28: Recipe-load telemetry + performance (10s → 3-5s)

**Goal:** Cut Recipe Box cold-load time from ~10s to 3-5s. Light up the dormant telemetry plumbing (ai_events table, withBudget, server sub-stage logs) to measure where the time actually goes, then ship the high-confidence wins: stop the list from generating images on the critical path (persist image_url so cold opens just fetch URLs), trim the getRecipes payload, and paginate. Diagnosis basis: Recipe Box "loaded" = images visible, and cold recipes fire multi-second Gemini generation 2-at-a-time (~6÷2×3s ≈ 9s); secondary cost is SELECT * with no pagination shipping full steps/ingredients JSONB for the whole library.

**UI hint:** no (instrumentation + data-layer; minor list pagination wiring, no new screens)

**Requirements:** TBD (perf phase — scope from CONTEXT + Explore trace). Tracked as decision IDs T1, T2, T3 (telemetry) and O1, O2, O3 (optimizations) from 28-CONTEXT.md.

**Success criteria:**
- Server GET /recipes request log includes sub-stage timing: DB query ms, row count, payload bytes.
- POST /generate-image records cache-hit/miss + Gemini generation ms to ai_events (via recordAiCall).
- Client records recipe.fetch round-trip via withBudget (new RECIPE_LOAD_MS) and per-image time-to-visible via the logAiEvent client.
- getRecipes list query selects an explicit lightweight column set (no full steps/step_image_urls JSONB) and is paginated/limited; recipe detail still loads full data on open.
- Recipes never trigger image generation on the Recipe Box critical path: image_url is populated at save time (generate-on-save) and a backfill path exists for legacy null-image_url rows.
- After deploy, a cold Recipe Box load measurably drops toward 3-5s (verified via the new telemetry), no test regressions.

**Plans:** 2/3 plans executed

Plans:
- [x] 28-01-PLAN.md — Server T1+O1: GET /recipes sub-stage timing log + getRecipes lightweight column set + LIMIT (steps/step_image_urls trimmed, ingredients kept)
- [ ] 28-02-PLAN.md — Server T2+O2+O3: /generate-image recordAiCall timing + generate-on-save fire-and-forget + manual idempotent /backfill-images route
- [x] 28-03-PLAN.md — Client T3+O1-guard: RECIPE_LOAD_MS withBudget on fetchRecipes + per-image logAiEvent + detail re-hydration of full steps on open

Waves:
- Wave 1 (parallel): 28-01 (server timing+trim), 28-03 (client telemetry+detail hydration — no file overlap with server)
- Wave 2: 28-02 (server image telemetry + generate-on-save + backfill — after 28-01, shares recipes.ts)

**Verification gate (human/deploy):** After all 3 plans land, deploy server to Fly + EAS build (Phase 27 fixes only reach devices in build #24+; measurements MUST be on a build that includes Phase 27 + 28). Then read the new ai_events / withBudget / `recipes.list` telemetry on a cold Recipe Box load to confirm the 3-5s target. The 3-5s confirmation is data-driven + human-gated — it cannot be asserted by the test suite alone.
