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

### Phase 999.2: Bulk-remove on shopping list (BACKLOG)

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
