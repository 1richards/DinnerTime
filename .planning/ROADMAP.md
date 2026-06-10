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
- getRecipes list query is capped (LIMIT 200, observable truncation) and GET /recipes logs payload_bytes so a *safe* trim can be decided from data. (NOTE: the steps/step_image_urls column trim was attempted then BACKED OUT in code review — `recipe.steps` is read off the in-memory list array by Cook Mode/edit/Cook Later, so trimming it crashed those flows. Payload trim deferred pending payload_bytes telemetry; detail re-hydration + null-guards retained as defensive.)
- Recipes never trigger image generation on the Recipe Box critical path: image_url is populated at save time (generate-on-save) and a backfill path exists for legacy null-image_url rows.
- After deploy, a cold Recipe Box load measurably drops toward 3-5s (verified via the new telemetry), no test regressions.

**Plans:** 3/3 plans complete

Plans:
- [x] 28-01-PLAN.md — Server T1+O1: GET /recipes sub-stage timing log + getRecipes lightweight column set + LIMIT (steps/step_image_urls trimmed, ingredients kept)
- [x] 28-02-PLAN.md — Server T2+O2+O3: /generate-image recordAiCall timing + generate-on-save fire-and-forget + manual idempotent /backfill-images route
- [x] 28-03-PLAN.md — Client T3+O1-guard: RECIPE_LOAD_MS withBudget on fetchRecipes + per-image logAiEvent + detail re-hydration of full steps on open

Waves:
- Wave 1 (parallel): 28-01 (server timing+trim), 28-03 (client telemetry+detail hydration — no file overlap with server)
- Wave 2: 28-02 (server image telemetry + generate-on-save + backfill — after 28-01, shares recipes.ts)

**Verification gate (human/deploy):** After all 3 plans land, deploy server to Fly + EAS build (Phase 27 fixes only reach devices in build #24+; measurements MUST be on a build that includes Phase 27 + 28). Then read the new ai_events / withBudget / `recipes.list` telemetry on a cold Recipe Box load to confirm the 3-5s target. The 3-5s confirmation is data-driven + human-gated — it cannot be asserted by the test suite alone.

### Phase 29: "Something New" lightweight-first generation (29s → 3-5s)

**Goal:** Cut the "Something New" generation wait (the *"…finding great meals from your pantry"* skeleton) from ~29s to 3-5s. PROVEN by live telemetry: `POST /recipes/search` takes 28,942ms — a single Gemini call generating 3 COMPLETE recipes (heavy `ingredients[]` + `steps[]`) before any card shows. Fix: `/search` returns LIGHTWEIGHT previews fast (title, description, times, calories, difficulty, skill — drop heavy ingredients/steps from the required generation), then hydrate full ingredients+steps in the BACKGROUND (mirroring the existing image-fill pattern), so cards appear in 3-5s. Parallelize the 4 serial pre-call DB fetches.

**UI hint:** yes (Something New cards + PreviewSheet loading affordances + Save/Cook gating)

**Requirements:** TBD (perf phase — scope from 29-CONTEXT.md, grounded in a full read-only flow map)

**Success criteria:**
- `POST /recipes/search` returns lightweight previews (no required heavy ingredients/steps) in ~3-5s; the 4 serial pre-call DB fetches (members/profile/pantry/library) are parallelized.
- Full ingredients+steps hydrate in the background after previews render, throttled (reuse the MAX_CONCURRENT=2 limiter pattern), patched into searchResults as each lands — via a server hydrate path reusing the recipe.parseText engine (like applyRemixVariation).
- Save / Cook Now / Save+Favorite are GATED until a recipe is hydrated (POST /recipes 400s without ingredients+steps — the hard dependency).
- PreviewSheet shows a loading affordance for un-hydrated steps (wire existing `stepsLoading` prop) AND ingredients (new affordance); no empty-state flash.
- Persistence handles un-hydrated previews: re-hydrate on store rehydrate (or exclude un-hydrated from persistence) — no relaunch with permanently-empty cards.
- Telemetry: discovery call records sub-stage timing (Gemini ms vs DB ms) and client wraps searchRecipes in withBudget; hydration timing recorded. No regression.

**Plans:** 3/4 plans executed

Plans:
- [x] 29-01-PLAN.md — Server fast path: opt-in `light` discovery schema/prompt (D1), parallelize the 4 pre-call DB fetches (D2), /search Gemini-vs-total timing (D8-server). Backward-compatible: light is request-flag-gated so the old app still gets full recipes.
- [x] 29-02-PLAN.md — Server hydrate: `POST /recipes/hydrate` reusing the recipe.parseText engine (like applyRemixVariation) + content-address cache (D3).
- [x] 29-03-PLAN.md — Client hydration: `useHydratedRecipeContent` hook mirroring useGeneratedRecipeImage (MAX_CONCURRENT=2), suggestionsStore light:true + background-hydrate-all + withBudget + rehydrate safety (D4, D7, D8-client).
- [ ] 29-04-PLAN.md — UX/safety: gate Save/Cook/Favorite until hydrated (D5, critical), PreviewSheet steps+ingredients loaders (D6), + human-verify checkpoint (3-5s + no-400 + rehydrate).

Waves:
- Wave 1: 29-01 (server fast path — recipeDiscovery.ts + recipes.ts /search)
- Wave 2: 29-02 (server hydrate — appends /hydrate to recipes.ts; after 29-01 to avoid same-file conflict)
- Wave 3: 29-03 (client hook + store; needs the /search light contract + /hydrate endpoint)
- Wave 4: 29-04 (UX gating + affordances; needs the hydration status signal from 29-03)

**Backward-compat / deploy-ordering risk (LOCKED mitigation):** The server deploys to Fly BEFORE the EAS build ships. The currently-shipped app calls /search expecting full ingredients+steps. Light mode is therefore OPT-IN via `body.light === true` (29-01): the default (no flag) path stays byte-compatible and returns full recipes, so the old app keeps working after the server deploys. The NEW app (29-03) sends `light:true`. Cache key folds `light` so light and full responses never collide.

**Verification gate (human/deploy):** After all 4 plans land, deploy server to Fly + EAS build #26. Confirm via Fly logs that `POST /recipes/search` (light) drops to ~3-5s (the `recipes.search` timing line), that hydration fills content without breaking save (D5 no-400), and that a relaunch re-hydrates persisted previews (D7). The 3-5s confirmation is data-driven + human-gated — handled by the 29-04 checkpoint.
