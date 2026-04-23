# Phase 16 Cooking Mode UX Enhancements — Physical Device Test Checklist

**Plans covered:** 16-01 through 16-08 (entire Phase 16)
**Build profile:** EAS development client (iOS)
**Primary hardware:** physical iPhone (not simulator — see below)
**Tester:** —
**Date executed:** —

## Why physical hardware

Four Phase 16 behaviors cannot be validated on the iOS Simulator:

1. **STT accuracy under real kitchen acoustics** — no simulator-based noise synth matches the sizzle + vent-hood soundscape.
2. **Haptics** — `expo-haptics` is a no-op on the Simulator. Each of the 6 Phase 16 haptic events can only be felt on the Taptic Engine.
3. **TTS audibility** — Simulator speaker, iPhone speaker, AirPods, and CarPlay each produce different fanout characteristics. Counter-distance audibility is a real-device gate.
4. **Dark cooking mode on OLED** — Simulator LCD hides grey-crush and banding that only appears on real OLED hardware.

## Pre-flight

1. `cd apps/mobile && eas build --profile development --platform ios` (or reuse the latest dev client if `app.json` plugin set hasn't changed — Phase 16 adds `expo-haptics` which does NOT require a config plugin).
2. Install dev client on a physical iPhone.
3. Sign in to DinnerTime with a test account that has at least one recipe with 6+ steps and 8+ ingredients.
4. Ensure the phone is OFF SILENT MODE for TTS audibility checks (haptics fire regardless of ringer).
5. Start a Cloudflare tunnel so telemetry POSTs reach the backend (`cloudflared tunnel --url http://localhost:3000`; update `apps/mobile/.env` with the tunnel URL; restart Metro with `--clear`).
6. Enable the server-side telemetry endpoint and verify `POST /api/v1/telemetry/cooking` returns 200 with `curl` before walking through the flow.

## §Latency (COOK-UX-01)

Goal: p95 `/cooking/ask` TTS-first-word latency < 1.5 seconds.

| # | Step | Pass/Fail | Measured | Notes |
|---|------|-----------|----------|-------|
| 1 | Open a recipe with 6+ steps and tap Cook | | | |
| 2 | Ask Claude a free-form question ("how do I know the chicken is done?") | | | first-word must arrive ≤ 1.5s after end-of-speech |
| 3 | Repeat 10 times across varied questions; record first-word and total latency for each | | | capture telemetry dashboard screenshot |
| 4 | Compute p50 and p95 over the 10 samples | | p50: __ ms / p95: __ ms | |
| 5 | Run SSE smoke script (`src/cooking/sse-smoke.ts`) once from the dev client and confirm `res.body` is NOT null | | | if null, document FALLBACK path per plan 16-01 |

**Result:** —

## §Voice (COOK-UX-02, COOK-UX-05)

Goal: ≥ 8/10 success across all 4 intents at counter distance (0.5–1.5m).

| # | Intent | Phrases | Pass rate (x/10) | Notes |
|---|--------|---------|------------------|-------|
| 1 | Next step | "next step", "continue", "move on" | __ / 10 | |
| 2 | Back | "go back", "previous" | __ / 10 | |
| 3 | Repeat | "repeat", "say that again" | __ / 10 | |
| 4 | Timer | "set a timer for 5 minutes" | __ / 10 | |
| 5 | Ask fall-through | "is the chicken done" | __ / 10 | |

Also verify:
- [ ] Each recognized command fires a toast (1.5s auto-dismiss) with no TTS echo
- [ ] Unrecognized input falls through to AskSheet (no dead ends)

**Result:** —

## §Telemetry (COOK-UX-02)

Goal: one real-kitchen cook session produces a batch of events in Supabase.

| # | Step | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Cook one full recipe start-to-finish (see §Real-Kitchen Session) | | |
| 2 | Inspect Supabase `cooking_events` table (or equivalent) | | must contain ≥ 1 row per intent + ≥ 1 `ask_latency` row |
| 3 | Confirm no PII fields (transcript, user_name) in stored rows | | `sanitizePayload` should have stripped them client-side |
| 4 | Confirm session_id groups all events from the session | | |

**Result:** —

## §Haptics (COOK-UX-05, COOK-UX-04)

Goal: each of the 6 haptic events fires a distinguishable Taptic pattern.

| # | Event | Expected pattern | Pass/Fail |
|---|-------|-----------------|-----------|
| 1 | Voice command recognized (Next / Back / Repeat / Timer) | `ImpactFeedbackStyle.Medium` | |
| 2 | Ingredient tap-to-check | `ImpactFeedbackStyle.Light` | |
| 3 | Timer at T-10s | `ImpactFeedbackStyle.Light` (single pulse) | |
| 4 | Timer expires | `NotificationFeedbackType.Success` | |
| 5 | Stop TTS button tapped | `ImpactFeedbackStyle.Medium` | |
| 6 | Exit confirm destructive tap | `NotificationFeedbackType.Warning` | |

**Result:** —

## §TTS (COOK-UX-01)

Goal: narration is audible at counter distance and barge-in works.

| # | Scenario | Pass/Fail | Notes |
|---|----------|-----------|-------|
| 1 | Phone on counter at arm's length, native speaker | | audible over running water? |
| 2 | AirPods connected | | first-word latency same or better? |
| 3 | CarPlay / Bluetooth speaker | | N/A for kitchen but sanity-check for in-car use |
| 4 | Barge-in: say "next step" while TTS is speaking current step | | TTS cuts; next step advances |
| 5 | Tap Stop button while TTS is speaking | | TTS cuts immediately |

**Result:** —

## §Dark Mode (COOK-UX-03)

Goal: dark cooking theme reads premium on real OLED — no grey-crush, no banding on brand surfaces.

| # | Step | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Toggle "Dark cooking mode" in Settings > Cooking | | |
| 2 | Enter cooking mode on a 6-step recipe | | background is true `#141210`-like black, not washed grey |
| 3 | Current-step brand rail reads vibrant orange (not muddy) | | |
| 4 | Ingredient section has readable contrast | WCAG AA 4.5:1 | |
| 5 | Timer chips retain brand glow (not crushed) | | |
| 6 | Toggle back to light — transition is smooth, no flash | | |

**Result:** —

## §Real-Kitchen Session (COOK-UX-01, 02, 04, 05)

Goal: one full end-to-end cook under real kitchen noise (stovetop, running water, vent hood on) with telemetry uploading on the way.

| # | Step | Pass/Fail | Notes |
|---|------|-----------|-------|
| 1 | Pick a 6+ step recipe (e.g. Garlic Butter Rice with Chicken) | | |
| 2 | Start cooking; leave phone on the counter 1m away from stovetop | | |
| 3 | Voice-advance through every step using the target intent set | | log any misrecognitions |
| 4 | Set at least 2 timers via voice during the cook | | |
| 5 | Ask one free-form question during a step ("is the oil ready?") | | verify AskSheet streams |
| 6 | Exit via Exit confirm at the end | | verify telemetry batch POSTs on exit |
| 7 | Check Supabase telemetry table for the session_id rows | | verify count matches expected intents fired |

**Result:** —

## Sign-off

- [ ] All six sections green on a physical iPhone
- [ ] Any FAIL row has a follow-up issue opened (link here: __)
- [ ] Telemetry dashboard reviewed and p95 latency target verified
- [ ] Ready for `/gsd:verify-work` Phase 16 close-out
