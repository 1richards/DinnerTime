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

**Plans:** 2/5 plans executed

Plans:
- [x] 27-01-PLAN.md — Server image_url write-back: persist generated hero URL to recipes.image_url (Decision 1)
- [x] 27-02-PLAN.md — Mobile rendering: FlatList windowing + RecipeCard memo + badge removal + recipeId wiring (Decisions 3, 4, 7)
- [ ] 27-03-PLAN.md — Discovery response cache + in-flight coalescing on /search + /discover (Decision 2)
- [ ] 27-04-PLAN.md — Discovery batch 6→3 + observable Gemini retry + Discover mount guard (Decision 5)
- [ ] 27-05-PLAN.md — Prompt caching on the static discovery system prompt + tool schema (Decision 6)

Waves:
- Wave 1 (parallel): 27-01, 27-02, 27-04
- Wave 2 (parallel): 27-03 (after 27-01), 27-05 (after 27-04)

