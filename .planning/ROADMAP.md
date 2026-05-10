# Roadmap: DinnerTime

## Milestones

- **v1.0 — Private Beta Launch Ready** — Phases 1-25 (shipped 2026-04-22). See `milestones/v1.0-ROADMAP.md`.
- **v1.0.1 — Post-Launch Patches** — Phase 26 + ~18 inline patches (shipped 2026-05-01). See `milestones/v1.0.1-ROADMAP.md`.

## Phases

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
