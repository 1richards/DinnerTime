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

**Plans:** 4/4 plans complete

Plans:
- [x] 29-01-PLAN.md — Server fast path: opt-in `light` discovery schema/prompt (D1), parallelize the 4 pre-call DB fetches (D2), /search Gemini-vs-total timing (D8-server). Backward-compatible: light is request-flag-gated so the old app still gets full recipes.
- [x] 29-02-PLAN.md — Server hydrate: `POST /recipes/hydrate` reusing the recipe.parseText engine (like applyRemixVariation) + content-address cache (D3).
- [x] 29-03-PLAN.md — Client hydration: `useHydratedRecipeContent` hook mirroring useGeneratedRecipeImage (MAX_CONCURRENT=2), suggestionsStore light:true + background-hydrate-all + withBudget + rehydrate safety (D4, D7, D8-client).
- [x] 29-04-PLAN.md — UX/safety: gate Save/Cook/Favorite until hydrated (D5, critical), PreviewSheet steps+ingredients loaders (D6), + human-verify checkpoint (3-5s + no-400 + rehydrate).

Waves:
- Wave 1: 29-01 (server fast path — recipeDiscovery.ts + recipes.ts /search)
- Wave 2: 29-02 (server hydrate — appends /hydrate to recipes.ts; after 29-01 to avoid same-file conflict)
- Wave 3: 29-03 (client hook + store; needs the /search light contract + /hydrate endpoint)
- Wave 4: 29-04 (UX gating + affordances; needs the hydration status signal from 29-03)

**Backward-compat / deploy-ordering risk (LOCKED mitigation):** The server deploys to Fly BEFORE the EAS build ships. The currently-shipped app calls /search expecting full ingredients+steps. Light mode is therefore OPT-IN via `body.light === true` (29-01): the default (no flag) path stays byte-compatible and returns full recipes, so the old app keeps working after the server deploys. The NEW app (29-03) sends `light:true`. Cache key folds `light` so light and full responses never collide.

**Verification gate (human/deploy):** After all 4 plans land, deploy server to Fly + EAS build #26. Confirm via Fly logs that `POST /recipes/search` (light) drops to ~3-5s (the `recipes.search` timing line), that hydration fills content without breaking save (D5 no-400), and that a relaunch re-hydrates persisted previews (D7). The 3-5s confirmation is data-driven + human-gated — handled by the 29-04 checkpoint.

## Backlog

### Phase 999.1: Hands-free voice control in cooking mode (STT) (BACKLOG)

**Goal:** [Captured for future planning] Re-enable kitchen voice commands ("next/repeat/stop") that survive ambient noise. Removed pre-launch because on-device STT (`@jamsch/expo-speech-recognition`) wasn't reliable enough at arm's length and burned launch time troubleshooting.
**Requirements:** TBD
**Plans:** 0 plans

Existing scaffolding to revive (still on disk, just unwired from cook.tsx):
- `apps/mobile/src/cooking/useVoiceListener.ts`
- `apps/mobile/src/cooking/useVoiceAmplitude.ts`
- `apps/mobile/src/components/cooking/VoiceWaveform.tsx`
- `voiceEnabled` flag in `cookingStore`

Likely path forward: replace on-device STT with server-side Whisper / ElevenLabs STT routed through the backend proxy — on-device quality cap was the blocker.

Acceptance: "next" / "repeat" / "stop" commands fire reliably from arm's length in a noisy kitchen.

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.2: On-demand recipe enrichment — step photos + deeper instructions (BACKLOG)

**Goal:** [Captured for future planning] Let the cook pull a richer version of any recipe on demand — generated step-by-step photos, fuller technique guidance ("knead until the dough springs back", with what that looks/feels like), tips on common failure modes, equipment substitutes. Today's recipes are functional but terse; the on-demand expansion turns DinnerTime into a teaching tool the way a good cookbook author would, without bloating every recipe upfront.

**Requirements:** TBD

**Plans:** 0 plans

Sketch of the implementation:
- New "Enrich recipe" affordance on the recipe detail screen (and possibly on each step inside cook mode) — single tap, one-time per recipe, idempotent.
- Backend route `POST /api/v1/recipes/:id/enrich` — Claude Sonnet rewrites each step with expanded technique notes, sensory cues, common-mistake callouts; Gemini 2.5 Flash Image (already wired for hero generation) renders a per-step photo. Results persist to a new `recipe_step_enrichments` table keyed by `(recipe_id, step_index)`.
- Mobile reads enriched payload via the existing recipe fetch; renders inline photo + expanded text under each step when present, falls back to the terse base step otherwise.
- Cost control: enrichment is opt-in per recipe (button press), cached forever, deduped by recipe_id. Gemini image cost is the dominant line item — eyeball the per-recipe cost before opening it to all users.

Acceptance: tap "Enrich recipe" on any saved recipe → loading state → each step gets a rendered photo and a 2-3-sentence expansion explaining technique, sensory checkpoints, and common pitfalls. Closing and reopening the recipe shows the cached enriched version instantly.

Open questions:
- Where does this sit relative to remix? (remix changes the recipe; enrichment teaches the existing one)
- Should cook mode auto-enrich the next 1-2 steps in the background so the photo is ready when the user advances?
- Voice mode: "describe this step" already exists via Ask — does enrichment subsume that or sit alongside it?

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.3: Bulk-remove on shopping list (BACKLOG)

**Goal:** [Captured for future planning] Multi-select rows in the shopping list and delete them in one shot, instead of swiping each one individually. Today's flow is fine for one-off removals but tedious when the user wants to clear half a category (e.g. "I already have all this produce").
**Requirements:** TBD
**Plans:** 0 plans

Sketch of the implementation:
- Long-press on a row enters selection mode → row gains a checkmark, rest of the rows expose a tap-to-toggle affordance.
- Bulk-action toolbar appears (replaces the share bar) showing count + "Remove" button + "Cancel".
- New store action `removeItems(ids: string[])` batches the delete; new server endpoint `DELETE /api/v1/shopping/items` accepting `{ids: [...]}` (or just N parallel DELETEs if simpler).
- Roughly 150–200 LOC across `shopping.tsx`, `CategorySection.tsx`, the row component, the store, and the server route.

Acceptance: long-press a shopping row → tap two more rows → tap "Remove (3)" → all three vanish, server state matches.

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.4: Stand up Figma as source of truth for visual design and UX flows (BACKLOG)

**Goal:** [Captured for future planning] End the pain of tweaking visual designs and UX flows directly in NativeWind/React Native code. Today every iteration is "edit code → run sim → eyeball → repeat" with no fast visual canvas to think in, no shareable mocks, and no way to explore variants before committing them to code. Stand up Figma + Figma MCP as the source of truth so design iteration happens on a canvas first, then lands in code via Code Connect mappings.

**Requirements:** TBD
**Plans:** 0 plans

**Prerequisite (hard blocker):** Upgrade Figma seat from View to Editor. The account `patrickrrichards@gmail.com` is on the starter plan with a View-only seat — all MCP write operations (`create_new_file`, `use_figma`, `upload_assets`) fail with a permission error. Needs Figma Professional (~$15/editor/mo) or equivalent before any of the below is possible.

Scope:
1. Figma seat upgrade + workspace/team setup
2. Reconstruct existing app screens in Figma as a baseline design file: Kitchen / Cook Tonight, Pantry, Plan, Scan (fridge + receipt + review + Instacart), Recipes (discover + import flows), Settings (incl. staples + pantry rules + account), Auth (login + register + reset)
3. Extract design tokens (colors, spacing, typography, radii) from the NativeWind / Tailwind config and mirror them as Figma variables so design file and code share one token system
4. Set up Code Connect mappings so MCP `get_design_context` returns real NativeWind components from `apps/mobile/src/components/` instead of generic React+Tailwind boilerplate
5. Document the design-iterate-implement loop in CLAUDE.md so future visual changes go through Figma first (sketch → review → implement → ship), not "edit code and pray"

Acceptance: Pat can open a Figma file showing every existing screen, drag a new layout variant, and have Claude pull it back into a working PR via `get_design_context` returning real component references — without manually translating layout decisions from canvas to code.

Open questions:
- Which Figma plan tier covers the MCP feature set we need (basic Editor vs. Organization for Code Connect)?
- Solo workspace, or set up the team properly anticipating future collaborators?
- Auto-sync of design tokens (manual export vs. tooling like Tokens Studio)?

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)

### Phase 999.5: Household account sharing — multi-user households (BACKLOG)

**Goal:** [Captured for future planning] Real multi-account households: husband + wife each have their own auth user (own email, own Apple ID), both see the same pantry / recipes / meal plan / shopping list, while keeping individual dietary preferences and per-user account state. Canonical pattern used by Mealime, AnyList, Plan-to-Eat, Cozi.

**Requirements:** TBD
**Plans:** 0 plans

**Why now:** Surfaced during v1.0 UAT — the UAT account is naturally shared by Patrick + partner, and the absence of multi-user support is now the most-asked feature gap. v1.0 ships with a documented "one cook per household" limitation; this phase converts that into the v1.1 headline feature.

**Current state (as of v1.0):**
- 35 migrations, ~30 RLS policies of the form `auth.uid() = profile_id` on the shared-data tables.
- Shared-data tables that need household scoping: `pantry_items`, `recipes`, `recipe_favorites` (decision needed: per-user heart vs shared library), `meal_plans`, `meal_plan_entries`, `shopping_lists`, `shopping_list_items`, `shopping_orders`, `user_staples`, `cooking_events`, `recipe_cooks`.
- Stays per-user: `profiles`, `skill_progression`, `feedback_submissions`, `account_deletions`, `beta_invites`, analytics events (`ai_events`, `plan_events`, `shopping_events`, `scan_events`).
- **Naming wrinkle:** the existing `household_members` table (migration 00002) is actually a dietary-persona roster, not real households. Needs renaming to `dietary_personas` to free up the namespace.

**Work breakdown (~9-10 focused dev-days):**

| Chunk | Effort | Notes |
|---|---|---|
| New tables (`households`, `household_memberships`) + `current_household_ids()` SQL helper | 0.5 day | Helper function keeps each RLS policy a one-liner |
| Add `household_id` column to ~8 shared tables + backfill | 1.5 days | Backfill must be idempotent and transactional |
| Rewrite ~30 RLS policies to gate on household membership | 1 day | Mechanical via the helper; RLS-leak test suite is mandatory before cutover |
| Rename `household_members` → `dietary_personas` | 0.5 day | Migration + UI references |
| Server routes (Hono) — set `household_id` on inserts, reads stay RLS-gated | 1 day | ~10-15 endpoints |
| Mobile auth store — track `currentHouseholdId`, send on inserts | 0.5 day | |
| Invite flow — generate 6-digit code, 24h TTL, accept endpoint | 1 day | |
| Onboarding branch — "create household" vs "join existing" | 0.5 day | One new screen |
| Settings UI — list members, regenerate invite, remove member | 1 day | Could defer to a follow-on phase |
| Decisions: favorites per-user or shared? `recipe_cooks` attribution? | 0.5 day | Affects schema; resolve before migration |
| Tests (RLS leak coverage, integration, two-user Maestro) | 1.5 days | Non-negotiable for RLS correctness |
| Migration runbook + rollback + prod cutover monitoring | 0.5 day | Backfill is one-shot |

Could compress to ~6 days by deferring member-management UI and locking to a single membership role.

**Top risks (blast radius, not effort):**
1. **RLS regressions** — a wrong operator in `current_household_ids()` would leak one household's pantry to another. RLS-leak test suite must be exhaustive *before* the cutover.
2. **Backfill correctness** — every existing v1.0 user must end up with exactly one auto-created household + membership. Partial failure leaves the user base in a split-brain state. Idempotent + transactional is non-negotiable.

**Open design questions to resolve at /gsd:discuss-phase time:**
- Is "favorite this recipe" a per-user heart or a household library flag?
- `recipe_cooks` / `cooking_events`: attribute the cook to the user who pressed the button, or to the household?
- Can a user belong to multiple households (Patrick at home + Patrick at his parents')? Default: no — single membership simplifies everything.
- Role model: just "member", or admin/member? Default: just "member" for v1.1, no roles.
- Invite delivery: in-app code only, or email magic link too? Default: in-app code only for v1.1.

**Definition of done:**
- Two TestFlight users can sign up, one invites the other, both see the same pantry/plan/shopping list in real time after refresh.
- RLS leak test suite covers every shared table; CI fails on regression.
- Existing v1.0 users (single-user) are unaffected — their auto-created household is invisible UX-wise unless they tap "Invite household member".
- Migration is reversible via documented rollback steps.

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)


### Phase 999.6: Cook-from-the-counter — recipe ideas from a photo of loose ingredients (BACKLOG)

**Goal:** [Captured for future planning] A third camera entry point that sits BETWEEN the two existing photo paths. Today there are two: (1) **pantry scan** — photograph the fridge/pantry, vision extracts items, they're stored into the pantry inventory; (2) **photo recipe creation** — photograph an existing written recipe, it's parsed into a saved recipe. This new path is a hybrid: photograph **a few loose ingredients on the counter** ("I've got these 4 things out, what can I make?"), vision identifies them, and the app **generates recipe ideas seeded by those visible items, supplemented by what's already in the pantry / staples**. The output is Something-New-style suggestions, not a pantry write and not a parsed recipe.

**Requirements:** TBD

**Plans:** 0 plans

Sketch of the implementation:
- New camera affordance (e.g. a "Cook from a photo" / "What can I make?" entry alongside the existing scan). Single photo, like the pantry scan.
- Reuse the existing **pantry-scan vision** path (`vision.pantryScan`, Claude Sonnet) to extract a lightweight item list from the counter photo — but do NOT auto-write to the pantry (or make that an optional toggle: "also add these to my pantry"). The extracted items are the discovery SEED.
- Feed the detected items into the **discovery** path (`recipe.discovery`, now on flash-lite) as the primary ingredients, with the user's existing pantry + staples passed as "also available to supplement." Likely a new `seedIngredients` input to the discovery prompt distinct from the full pantry manifest, with prompt language like "build around these on-hand items, you may add common staples / pantry items the user already has."
- Land the user on the **SomethingNewResults / PreviewSheet** flow (reusing the lightweight-first + background-hydration work from Phase 29) so the ideas appear fast.
- Pantry-match badges should reflect the union of detected-counter-items + pantry.

Open questions:
- Should detected items optionally be written to the pantry (toggle), or stay ephemeral to this one discovery?
- How to disambiguate / let the user correct a misidentified item before generating (a quick confirm chip row, like the pantry-scan review screen)?
- Does this share the scan review UI, or get a lighter confirm step?
- Relationship to "Something New" pantryOnly — is this just Something New with a photo-derived pantry subset, or its own surfaced flow?

Acceptance: snap a photo of a few ingredients on the counter → app identifies them → within a few seconds, recipe ideas appear that center on those items and sensibly fill in with pantry/staples the user already has, in the same fast Something-New card flow.

Plans:
- [ ] TBD (promote with /gsd:review-backlog when ready)
