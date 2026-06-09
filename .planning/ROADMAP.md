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

**Plans:** 0 plans


<details>
<summary>v1.0 (Phases 1-25) — SHIPPED 2026-04-22</summary>

(moved to milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>v1.0.1 (Phase 26) — SHIPPED 2026-05-01</summary>

(moved to milestones/v1.0.1-ROADMAP.md)

</details>

### Next Milestone

Run `/gsd:new-milestone` to start v1.1.

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

