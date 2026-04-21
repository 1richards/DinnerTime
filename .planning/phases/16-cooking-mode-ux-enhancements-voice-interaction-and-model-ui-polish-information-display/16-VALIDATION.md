---
phase: 16
slug: cooking-mode-ux-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Authoritative test-to-requirement mapping lives in `16-RESEARCH.md` §Validation Architecture.
> This file is the operational contract that executor + checker enforce.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | vitest (mobile unit), jest (server unit — inherited), maestro 2.4.0 (iOS UAT), expo-doctor (RN health) |
| **Config files** | `apps/mobile/vitest.config.ts`, `packages/server/jest.config.*`, `apps/mobile/.maestro/*.yaml` |
| **Quick run command** | `cd apps/mobile && pnpm test --run src/cooking src/components/cooking` |
| **Full suite command** | `pnpm -r test --run && cd apps/mobile && bash .maestro/scripts/uat.sh smoke` |
| **Estimated runtime** | ~25s unit · ~90s Maestro smoke |

---

## Sampling Rate

- **After every task commit:** `cd apps/mobile && pnpm test --run src/cooking src/components/cooking`
- **After every plan wave:** Full suite (unit + applicable Maestro flow)
- **Before `/gsd:verify-work`:** Full suite + physical-iPhone DEVICE-TEST-16.md checklist green
- **Max feedback latency:** 30 seconds (unit); 120 seconds (Maestro)

---

## Per-Task Verification Map

> Concrete task IDs finalized by planner. This scaffold lists the requirement → test-type → command mapping. The planner pulls from this when writing `<automated>` verify blocks per task.

| Requirement | Test Type | Command / File | Wave | Dependency |
|-------------|-----------|----------------|------|-----------|
| COOK-UX-01 (responsive voice latency) | unit — SSE parser | `pnpm test --run src/cooking/streamingAsk.test.ts` | W1 | W0 SSE smoke |
| COOK-UX-01 (responsive voice latency) | integration — telemetry capture | `pnpm test --run src/lib/telemetry/cookingEvents.test.ts` | W1 | W0 telemetry scaffold |
| COOK-UX-01 (responsive voice latency) | manual — p95 < 1.5s first-word TTS | DEVICE-TEST-16.md §Latency | W5 | telemetry shipping |
| COOK-UX-02 (STT evaluated / telemetry) | unit — event schema | `pnpm test --run src/lib/telemetry/cookingEvents.test.ts` | W1 | — |
| COOK-UX-02 (STT evaluated / telemetry) | integration — backend endpoint | `pnpm -C packages/server test --testPathPattern=telemetry` | W1 | — |
| COOK-UX-02 (STT evaluated / telemetry) | manual — real-kitchen session yields events | DEVICE-TEST-16.md §Telemetry | W5 | W1 pipeline |
| COOK-UX-03 (Apple-HIG polished UI) | unit — token usage | `pnpm test --run src/components/cooking/StepCard.test.tsx` (asserts no hardcoded colors) | W2 | W0 unit scaffold |
| COOK-UX-03 (Apple-HIG polished UI) | unit — typography scale | `pnpm test --run src/components/cooking/ScrollableRecipe.test.tsx` | W2 | W0 unit scaffold |
| COOK-UX-03 (Apple-HIG polished UI) | UAT — screenshot regression | `bash apps/mobile/.maestro/scripts/uat.sh` (`.maestro/28-cooking-mode-ui.yaml`) | W4 | W2 primitives |
| COOK-UX-04 (at-a-glance info) | unit — sticky timer visibility | `pnpm test --run src/components/cooking/StickyCookingHeader.test.tsx` | W2 | W0 |
| COOK-UX-04 (at-a-glance info) | unit — ingredient row checkable | `pnpm test --run src/components/cooking/IngredientRow.test.tsx` | W2 | W0 |
| COOK-UX-04 (at-a-glance info) | unit — current-step auto-scroll | `pnpm test --run src/cooking/useCurrentStepScroll.test.ts` | W3 | W2 |
| COOK-UX-04 (at-a-glance info) | UAT — scroll + timer visible | `.maestro/28-cooking-mode-ui.yaml` | W4 | W3 |
| COOK-UX-05 (voice commands + visual confirm) | unit — command toast dispatch | `pnpm test --run src/cooking/handleTranscript.test.ts` | W3 | W0 |
| COOK-UX-05 (voice commands + visual confirm) | unit — haptic events | `pnpm test --run src/cooking/haptics.test.ts` | W3 | W0 |
| COOK-UX-05 (voice commands + visual confirm) | unit — waveform listener amplitude adapter | `pnpm test --run src/cooking/useVoiceAmplitude.test.ts` | W3 | W0 |
| COOK-UX-05 (voice commands + visual confirm) | manual — physical-iPhone voice tests | DEVICE-TEST-16.md §Voice | W5 | W3 |

*Status codes: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — tracked per task in plan frontmatter.*

---

## Wave 0 Requirements

Before any Wave 1 task runs, the following must be in place:

- [ ] `apps/mobile/src/cooking/__fixtures__/sse-response.ts` — mock SSE event stream for streamingAsk tests
- [ ] `apps/mobile/src/cooking/streamingAsk.test.ts` — stubs for COOK-UX-01 (test red, impl arrives W1)
- [ ] `apps/mobile/src/lib/telemetry/cookingEvents.test.ts` — stubs for COOK-UX-02 (test red)
- [ ] `apps/mobile/src/components/cooking/__fixtures__/recipe.ts` — shared test recipe fixture (8-ingredient, 6-step)
- [ ] `apps/mobile/src/components/cooking/StepCard.test.tsx` through `VoiceWaveform.test.tsx` — stub suites for all 7 new primitives
- [ ] `apps/mobile/.maestro/28-cooking-mode-ui.yaml` — skeleton flow (launch → cook recipe → screenshot)
- [ ] `.planning/phases/16-.../DEVICE-TEST-16.md` — manual checklist mirroring Phase 9 pattern (voice, latency, telemetry, dark-mode, real-kitchen noise)
- [ ] `packages/server/src/routes/telemetry.test.ts` — server endpoint stub
- [ ] Verify SSE streaming works on RN 0.83 `fetch` ReadableStream (smoke script `apps/mobile/src/cooking/sse-smoke.ts` — Wave 0 gate)
- [ ] Verify `expo-haptics` actually fires on iOS Simulator (may be a no-op; if no-op document as DEVICE-TEST-16 manual verification)
- [ ] Verify `@jamsch/expo-speech-recognition@0.2.15` exposes amplitude events (smoke test; if absent, `VoiceWaveform` runs cosmetic loop per UI-SPEC fallback)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-kitchen STT accuracy (sizzle, vent hood, background talk) | COOK-UX-02 | No automated synthetic noise simulator matches real kitchen acoustics; tests must run on a physical iPhone in a real cooking environment | DEVICE-TEST-16.md §Real-Kitchen Session — cook 1 full recipe, log STT misrecognition count, verify telemetry events uploaded to backend |
| Haptic feedback feel (medium on command, T-10s pulse, T-0 bump) | COOK-UX-05, COOK-UX-04 | Simulator does not fire real taptic engine; feel is the only success signal | DEVICE-TEST-16.md §Haptics — trigger each event via voice, confirm physical vibration matches documented pattern |
| TTS audibility vs kitchen noise | COOK-UX-01 | Simulator speaker ≠ iPhone speaker ≠ Bluetooth/AirPods fanout | DEVICE-TEST-16.md §TTS — cook with phone on counter at arm's length, AirPods connected, wired CarPlay-style |
| Voice command reliability at counter distance (0.5–1.5m from phone) | COOK-UX-05 | Mic distance + kitchen acoustics cannot be simulator-tested | DEVICE-TEST-16.md §Voice Distance — verify "next step", "timer for 5 minutes", free-form ask each succeed 8/10 trials |
| Dark-mode cooking screen looks Spotify-grade premium on real OLED | COOK-UX-03 | Simulator LCD ≠ iPhone OLED contrast; only real hardware reveals grey-crush or banding | DEVICE-TEST-16.md §Dark Mode — cook 1 recipe with dark toggle on, evaluate contrast on real device |
| Streaming /ask p95 < 1.5s TTS first-word across Wi-Fi + LTE | COOK-UX-01 | Metro localhost latency ≠ real-world network; must measure via telemetry on real device | Review telemetry dashboard after 5 DEVICE-TEST-16 sessions; p95 TTS-first-word < 1.5s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references above
- [ ] No watch-mode flags (all `--run` / one-shot)
- [ ] Feedback latency < 30s (unit), < 120s (Maestro)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 complete and planner-check green
- [ ] DEVICE-TEST-16.md complete and checked before `/gsd:verify-work`

**Approval:** pending
