# Phase 16: Cooking Mode UX Enhancements - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous)

<domain>
## Phase Boundary

Refine the existing cooking mode (shipped in Phase 9) so hands-free cooking feels genuinely delightful. Three vectors of improvement:

1. **Voice interaction quality** — measure STT accuracy/latency on a real iPhone in a real kitchen; upgrade path (on-device vs. Whisper fallback vs. Whisper-only) is data-driven, not pre-emptive.
2. **Cooking UI structure** — pivot from single-step-dominant layout to a Claude.ai-artifact-style scrollable recipe with the current step highlighted. Ingredients are a visible recipe section (not hidden). Upcoming steps are peek-able. Timers live in a sticky header.
3. **Design-system alignment** — adopt Phase 19 tokens (terracotta brand, cream surface, SF Pro typography) so cooking mode ships visually coherent with the rest of the professionally designed app.

**Out of scope for this phase:**
- Structured recipe step refactor (difficulty/technique tags) — that's Phase 24 data model work.
- Android support / cross-platform cooking mode — iOS-first per project constraints.
- Full Whisper server-side pipeline — shipped only if telemetry shows on-device falls below threshold.

</domain>

<decisions>
## Implementation Decisions

### Voice Model & Latency Strategy

- **STT approach (Claude's discretion):** Ship beta with on-device `@jamsch/expo-speech-recognition` (status quo) as the primary path. Build the telemetry pipeline (sub-bullet below) so the Whisper-fallback decision is data-driven. Do NOT pre-emptively build Whisper integration; defer until telemetry justifies it.
- **Cooking-mode telemetry:** Yes — instrument this phase. Capture per-utterance: STT confidence score, STT latency (start-of-speech → final transcript), intent-classifier result (nav/timer/ask/unrecognized), `/cooking/ask` p50/p95 latency, misrecognition count (inferred from rapid-fire back→next corrections), TTS-echo-swallow events. Store anonymized locally + submit batched to backend for aggregation. Use to decide Whisper-fallback necessity post-beta.
- **`/cooking/ask` latency target:** p95 < 1.5 seconds from user-finished-speaking to TTS-first-word. Keep Claude Sonnet 4 for quality. Implement response streaming so first sentence starts TTS as soon as it arrives (not waiting for full response). Tune system prompt for brevity already in place (`max_tokens: 300`).
- **Echo-loop handling:** Keep current soft `Speech.isSpeakingAsync()` check in `useVoiceListener`. Preserves barge-in (user can voice-interrupt mid-TTS). Do NOT hard-gate STT during TTS. Accept the soft-check's rare false-triggers as a reasonable tradeoff for barge-in UX.

### Cooking UI Information Density

- **Layout pivot — Claude.ai artifact style:** Cooking mode becomes a scrollable full-recipe view. The entire step list is visible; the current step is visually highlighted (outline, background, or typographic emphasis). On step advance, scroll animates to center the new current step. This replaces the existing "one big current step + small header" model in `cook.tsx`.
- **Ingredients:** Part of the scrollable recipe (not a collapsible side sheet). Positioned at the top as a section (Claude.ai artifact pattern). Each ingredient checkable (tap to strike-through) so users can track what's in the pan. Voice "show ingredients" scrolls to the section.
- **Upcoming-step preview:** Implicit in the scrollable layout — next/previous steps visible as users scroll. The current step is highlighted so users always know where they are.
- **Timer display:** Sticky header chip bar (always visible even when scrolling recipe). Horizontal chip row, one chip per active timer with live countdown. Haptic pulse at T-10s per timer. TTS "X timer done" at expiry.
- **Long-step handling:** Let the recipe scroll naturally (recipe-doc style). Don't auto-shrink typography. Long steps simply take more vertical space and users scroll past them — consistent with Claude.ai artifact pattern.

### Design System Alignment (Phase 19 tokens)

- **Adopt Phase 19 tokens now:** Cooking mode uses brand/surface/text tokens from Phase 19 (already shipped). Do not ship cooking mode with orange-era hardcoded styles.
- **Step text typography (Claude's discretion):** Use Phase 19 typography scale. Recommended start: title (22pt semibold) for non-current steps, display (34pt semibold) for the highlighted current step. Validate on physical iPhone at counter-height distance during UAT — adjust the current-step scale if it's too small for kitchen readability.
- **Nav button sizing:** Keep large 72pt tap targets for Back/Repeat/Next (deliberate deviation from Phase 19's 44pt icon-only standard). Rationale: cooking-hands accessibility — greasy/wet fingers need larger targets. Document this deviation in the relevant plan and UI-SPEC. Use Phase 19 SF Symbol icons and button color tokens, but override height.
- **Background surface — user toggle:** Ship with cream-surface default (matches rest of app) and a settings toggle for "Dark cooking mode" (Spotify Now-Playing-style dark). Toggle lives in Settings > Cooking (create this section if missing) and optionally as an in-cooking-mode long-press on the screen. Persist via Zustand + AsyncStorage.

### Voice Command Feedback

- **Confirmation on recognized command:** Brief toast + medium haptic. Toast text examples: "Next step", "Timer set · 10 min", "Repeating". 1.5s auto-dismiss. Silent (no TTS echo — prevents the "I said Next, then TTS said 'Moving to step 3', then the next step reads aloud" cascade). Works when phone is on silent mode.
- **Listening-state indicator:** Animated waveform mic icon when listening (bars animate with amplitude). Pulse dot when idle but armed. Gray static when voice is toggled off. Replaces current static-pill `VoiceStatusBadge`.
- **Unrecognized input handling:** Fall through to `/cooking/ask` (matches current intent router behavior). Anything not a known nav/timer/repeat phrase becomes a Q&A. Keeps the "ask anything" promise intact — user says "is this done" → Claude explains doneness test. Costs tokens but prevents dead ends. Telemetry tracks fall-through rate per session.
- **TTS interrupt:** Dedicated Stop button that appears when TTS is speaking. Anchored in the sticky header next to timer chips. Tapping it halts TTS immediately. Also: voice barge-in continues to work via the soft `isSpeakingAsync` check.

### Claude's Discretion

The following answers were explicitly left to Claude's discretion during discuss:
- **STT approach** — recommend: ship on-device + telemetry, decide Whisper from data.
- **Step text typography** — recommend: Phase 19 title (22pt) for non-current, display (34pt) for current; validate at counter distance.

For implementation details not addressed above (state management integration, animation timing, exact telemetry batching cadence, toast component API), use established codebase patterns (Zustand store, React Native Reanimated, NativeWind+Phase-19 tokens).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 9 cooking infrastructure)

- `apps/mobile/src/stores/cookingStore.ts` (91 lines) — Zustand store with recipe/stepIndex/voiceEnabled/ttsEnabled/listening/timers/lastAssistantAnswer state. Extend for new Phase 16 state (ingredientChecks: Record<string, boolean>, darkMode: boolean).
- `apps/mobile/src/cooking/useVoiceListener.ts` — Single touch-point for `@jamsch/expo-speech-recognition` API. Pre-1.0 lib is abstracted here. Add telemetry hooks here.
- `apps/mobile/src/cooking/intentRouter.ts` (43 lines) — Pure regex classifier. Already falls through to `{type: 'ask'}` for unrecognized input, so the "fall-through to /ask" decision requires no router change — only feedback/toast logic in `handleTranscript`.
- `apps/mobile/src/cooking/handleTranscript.ts` — Pure dispatcher; extend to emit toast events and haptics per intent.
- `apps/mobile/src/cooking/useStepSpeaker.ts` — TTS wrapper; extend to expose stop handle for Stop button.
- `apps/mobile/src/cooking/askAssistant.ts` (58 lines) — HTTP client for `/api/v1/cooking/ask`. Extend for streaming (fetch with ReadableStream body parser) to hit <1.5s p95 TTS-first-word target.
- `apps/mobile/src/components/cooking/*` — StepDisplay, StepNavButtons, TimerBar, VoiceStatusBadge, AskSheet. Will be heavily reworked or replaced for new layout.
- `packages/server/src/routes/cooking.ts` (197 lines) — `/ask` + `/tips` routes; `/ask` needs streaming response support.

### Established Patterns

- **State management:** Zustand for cooking-mode local state; React Query for recipe fetch.
- **Styling:** NativeWind + Phase 19 design tokens (brand, surface, text-primary/secondary/tertiary, border). Do not hardcode colors.
- **Icons:** SF Symbols via `expo-symbols` wrapped in `SymbolIcon` (Phase 15 convention).
- **Full-screen immersive routes:** `gestureEnabled: false` on cook.tsx to prevent accidental dismiss; exit button in top-left with explicit confirm.
- **Haptics:** `expo-haptics` — use `Haptics.ImpactFeedbackStyle.Medium` for command confirmation, `.Light` for T-10s timer pulse.
- **Telemetry:** Check for existing telemetry pipeline in `apps/mobile/src/lib/`; if none, create a minimal batched event logger that POSTs to a new `/api/v1/telemetry/cooking` endpoint.

### Integration Points

- **Settings screen** — new "Cooking" section for dark-mode toggle (Phase 23 will professionalize settings; Phase 16 can create a minimal section).
- **Recipe detail screen** — "Cook" button still navigates to `/recipes/[id]/cook` — no change.
- **Auth/session** — cooking telemetry requires authenticated user, reuse existing auth token pattern.
- **Phase 19 tokens** — consume existing token exports (check `apps/mobile/src/styles/` or `apps/mobile/src/theme/` — Phase 19 already shipped, find the established path).

</code_context>

<specifics>
## Specific Ideas

- **Claude.ai artifact recipe card** is the reference UI pattern for the layout pivot. All-visible ingredients + numbered steps in scroll order, with clean section hierarchy. Current-step highlighting is the only cooking-mode-specific layer on top.
- **Sticky timer header** must stay glanceable at counter distance. Large-enough chip text, per-chip progress or countdown, clear visual when a timer is <10s from done.
- **Dark cooking mode** should feel Spotify-premium: dark background, high-contrast text, brand accent only on current step + interactive elements (mic, timers, Stop button). Not a full dark-mode theme rewrite — only cooking screen.
- **Streaming `/ask`**: a realistic implementation is Server-Sent Events (SSE) from Hono, parsed in the mobile client, with `expo-speech` called incrementally as sentences complete.

</specifics>

<deferred>
## Deferred Ideas

- **Whisper server-side fallback** — deferred unless telemetry shows on-device STT accuracy below threshold in real kitchens. Instrumented in this phase; implemented in a follow-up if data demands.
- **Full system-wide dark mode** — Phase 16 ships cooking-only dark mode. App-wide dark mode is a separate phase (likely Phase 19.x or after).
- **Structured step data model** — difficulty tags, technique hints, per-step timing — deferred to Phase 24 (data-model refactor).
- **Android cooking mode** — iOS-first per project constraints; no cross-platform work in this phase.
- **Apple Watch cooking companion** — completely out of scope for v1.

</deferred>
