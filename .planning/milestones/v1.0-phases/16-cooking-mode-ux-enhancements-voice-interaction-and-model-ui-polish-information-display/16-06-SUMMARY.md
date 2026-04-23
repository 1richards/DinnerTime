---
phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display
plan: 06
subsystem: cook-screen
tags: [react-native, expo, cooking, voice, sse, action-sheet, haptics, dark-mode, telemetry, nativewind, phase-19-tokens]

# Dependency graph
requires:
  - phase: 16-01
    provides: telemetry batcher (logCookingEvent / flushTelemetry / sanitizePayload / wireSupabaseAuth) consumed on every stt_final, stt_error, tts_echo_swallowed, intent_routed, ask_start, ask_first_chunk, ask_complete
  - phase: 16-02
    provides: streamAsk SSE client with NO_STREAM_BODY fallback signal — primary Ask path
  - phase: 16-03
    provides: StickyCookingHeader, VoiceWaveform, StopTTSButton, TimerBar (retokened), haptics (6 typed wrappers), useVoiceAmplitude
  - phase: 16-04
    provides: ScrollableRecipe (forwardRef + ScrollableRecipeHandle.scrollToIngredients), StepCard, IngredientRow, useCurrentStepScroll
  - phase: 16-05
    provides: CommandToast, show_ingredients intent + regex, handleTranscript v2 deps (onCommandToast / onCommandHaptic / onShowIngredients), 72pt StepNavButtons, retokened AskSheet with ErrorState + incremental answer
  - phase: 09
    provides: handleTranscript dispatcher, intentRouter, cookingStore, useStepSpeaker (now extended with stop handle), useVoiceListener (now telemetry-instrumented)
provides:
  - cook.tsx composing every Phase 16 Wave 2 primitive end-to-end
  - useVoiceListener telemetry instrumentation (stt_final, stt_error, tts_echo_swallowed)
  - useStepSpeaker imperative handle { speak, stop } consumed by StopTTSButton + Ask fallback
  - SSE streaming Ask flow with NO_STREAM_BODY → askAssistant fallback
  - Scoped dark-mode palette via inline rootStyle (no app-wide theme toggle)
  - Exit ActionSheetIOS with UI-SPEC copy verbatim + flushTelemetry on destructive confirm
  - Per-timer T-10s warning haptic + T-0 success haptic + "X timer done" TTS
  - show_ingredients voice intent end-to-end: transcript → intentRouter → handleTranscript → recipeRef.current.scrollToIngredients()
affects: [16-07 cleanup (will delete StepDisplay + VoiceStatusBadge no-longer-imported by this plan), 16-08 DEVICE-TEST-16 manual verification, Phase 17 cooking-adjacent UX]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level imperative TTS handle via useMemo(empty deps) — stable identity across renders, consumed by StopTTSButton + Ask fallback without callback thrash"
    - "Per-timer T-10s crossing detection via Map<timerId, prevRemaining> ref + once-per-crossing fire — no duplicate haptics if tick jitter puts remaining slightly above then below 10s"
    - "Scoped dark-mode via inline style (not NativeWind variant) — root SafeAreaView gets backgroundColor override + ScrollableRecipe wrapper gets backgroundColor override; NativeWind className colors stay light-palette (acceptable because dark palette is scoped to cooking only)"
    - "Lazy dynamic import of expo-speech inside isSpeakingAsync polling interval — keeps the file's direct dep graph focused on Phase 16 primitives"
    - "ActionSheetIOS with cancelButtonIndex + destructiveButtonIndex mapped to options array — preferred over custom Modal for native iOS look-and-feel"
    - "PII-safe telemetry payloads: raw transcript text NEVER leaves the device; sanitizePayload whitelists 9 structured keys and strips everything else (intent_type, length, first_chunk_ms, total_ms, answer_length, confidence, error_code)"
    - "Auth-gate for Ask flow: resolve supabase.auth.getSession() once per call, pass access_token into streamAsk so the module stays pure (no supabase import)"

key-files:
  created:
    - ".planning/phases/16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display/16-06-SUMMARY.md"
  modified:
    - "apps/mobile/src/app/recipes/[id]/cook.tsx"
    - "apps/mobile/src/cooking/useVoiceListener.ts"
    - "apps/mobile/src/cooking/useStepSpeaker.ts"

key-decisions:
  - "SSE primary + askAssistant fallback on NO_STREAM_BODY / NO_AUTH — per plan. Fallback also fires when access_token resolves empty upfront (session expired mid-cook). Other error codes (CLAUDE_ERROR, HTTP_4xx/5xx, STREAM_ERROR) surface as askError and render AskSheet's ErrorState."
  - "Dark mode applied via inline style wrapper (rootStyle + scrollOverrideStyle) instead of a full NativeWind variant rewrite — simplest approach per 16-RESEARCH.md Don't-Hand-Roll line 710. Scope is cook screen only (CONTEXT D-03)."
  - "Timer ticker lives in cook.tsx, not cookingStore — matches existing Phase 9 pattern of 'screen owns the interval, store owns the data'. The prevRemainingRef tracks previous remaining per timer so T-10s fires exactly ONCE per timer instance."
  - "TTS 'X timer done' speech uses stepSpeaker.speak() (the new handle from Task 1) — not a module-level Speech.speak import — keeping one TTS surface in cook.tsx."
  - "Manual nav button taps fire fireCommandHaptic (Medium impact) to mirror voice-command haptic — consistent user feedback across both input modalities. Matches the cook-screen haptic contract in UI-SPEC §Haptics."
  - "ttsSpeaking state driven by a 500ms isSpeakingAsync poll — expo-speech does not expose a change event. This is good enough for StopTTSButton visibility (500ms lag is imperceptible when a TTS clip is several seconds long)."
  - "Exit button flushTelemetry is fire-and-forget (void-returning). If the flush HTTP call hangs, we don't block navigation — telemetry is nice-to-have, UX is critical."

patterns-established:
  - "Cook-screen integration layer pattern: a single .tsx composes all voice + UI primitives, owns the Ask flow, owns the timer ticker, owns the exit action sheet. Keeps primitives pure and testable under vitest node env."
  - "Dark-mode inline-style wrapper pattern: scoped theme overrides apply via style prop on root container + any child that needs a darker bg. Avoids full NativeWind variant rewrites and keeps light-palette as the single source of truth for className lookups."
  - "Telemetry event wiring convention: sessionId read lazily via useCookingStore.getState() at the call site — NEVER via useCookingStore hook subscription — so the component does not re-render on session changes during a cook session."

requirements-completed: [COOK-UX-01, COOK-UX-02, COOK-UX-03, COOK-UX-04, COOK-UX-05]

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 16 Plan 06: Cook Screen End-to-End Integration Summary

**Cook screen now composes every Phase 16 primitive — StickyCookingHeader / ScrollableRecipe / CommandToast / 72pt StepNavButtons / AskSheet — with SSE streaming (+ NO_STREAM_BODY fallback), scoped dark-mode palette, destructive exit confirm, T-10s + T-0 timer haptics, and show_ingredients voice intent wired end-to-end through the ScrollableRecipe imperative ref.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T04:30Z (approx)
- **Completed:** 2026-04-22T04:42Z
- **Tasks:** 2
- **Files modified:** 3 (cook.tsx + useVoiceListener.ts + useStepSpeaker.ts)

## Accomplishments

### Composed primitives checklist (UI-SPEC §Layout structure)

- [x] **StickyCookingHeader** — top cluster with Exit / title / VoiceWaveform / StopTTSButton (visibility gated by `isSpeaking` state) / conditional timer band.
- [x] **ScrollableRecipe** — full-recipe scroll container (INGREDIENTS + STEPS), current step highlighted, ingredients tap-to-check. Attached via forwardRef; `recipeRef.current?.scrollToIngredients()` invoked by voice dispatcher.
- [x] **StepNavButtons** (72pt deviation) — Back / Repeat / Next with `fireCommandHaptic` on every tap (mirrors voice-command haptic).
- [x] **CommandToast** — `lastCommandToast` from cookingStore renders 1.5s body/700 bounce above content. Auto-clears via `clearCommandToast`.
- [x] **AskSheet** — bottom-sheet modal with streaming-answer prop, `error` prop for network failures (renders `ErrorState`), incremental delta rendering (SSE contract).
- [x] **Contextual tip banner** — Phase 10 preserved, retokened from amber-* to `bg-warning/10 border-warning` + `text-label text-warning` + `text-body text-text-primary` (UI-SPEC §Color).

### SSE streaming integration

**Primary:** `streamAsk` — opens SSE to `/api/v1/cooking/ask-stream`, forwards every `event: delta` chunk into `setAskAnswer(prev => (prev ?? '') + chunk)` so AskSheet re-renders the text as it streams. First chunk fires `ask_first_chunk` telemetry with `first_chunk_ms`.

**Fallback:** `askAssistant` — invoked from `runFallback` closure inside `handleAsk`. Triggered on:
- `NO_STREAM_BODY` — RN 0.83 ReadableStream unavailable (Pitfall 1).
- `NO_AUTH` — token resolves empty from the SSE path (rare; handled for parity).

**Error surfacing:** Any other `onError(code)` path (HTTP_4xx/5xx, CLAUDE_ERROR, STREAM_ERROR) sets `askError` + clears loading. AskSheet renders `ErrorState` banner with the UI-SPEC copy "Couldn't reach the kitchen assistant. / Try again in a moment."

### Dark-mode implementation

**Approach:** Inline style wrapper. The root `<SafeAreaView>` gets `style={rootStyle}` where `rootStyle = { backgroundColor: DARK_PALETTE.bg }` when `darkMode === true`. The inner `<View>` wrapping `<ScrollableRecipe>` gets a matching `scrollOverrideStyle`.

**Palette values (from global.css lines 46-66 + UI-SPEC §Color):**

| Token | Light | Dark |
| --- | --- | --- |
| `bg` | #FAF7F2 | #141210 |
| `surface` | #FFFFFF | #1E1B18 |
| `text-primary` | #1C1917 | #F5F0E8 |
| `text-secondary` | #5C4D3D | #C4B7A4 |
| `border` | #E5D9CA | #40372D |

NativeWind className tokens (`bg-bg`, `text-text-primary`, etc.) still resolve to the **light** palette under NativeWind — the inline `style` prop wins for anything we override. This is the "scoped dark mode" per CONTEXT D-03 — app-wide dark mode is explicitly deferred.

**Toggle location:** `cookingStore.darkMode` (already persisted via `partialize: (state) => ({ darkMode: state.darkMode })` from 16-00). Settings surface to toggle it is deferred to 16-07 or later (CONTEXT D-03 notes Settings > Cooking section); the state slice is ready.

### T-10s ticker location

The timer ticker lives in `cook.tsx` (not `cookingStore`), matching the existing Phase 9 pattern of "screen owns interval, store owns data". The implementation:

1. `prevRemainingRef = useRef<Map<string, number>>(new Map())` — tracks last observed remaining ms per timer.
2. `setInterval(1000)` reads current timers from `useCookingStore.getState().timers`.
3. For each timer, compute `remaining = endsAt - now`.
4. If `prev >= 10_000 && remaining < 10_000 && remaining > 0`: fire `fireTimerWarnHaptic()` (Light impact).
5. Update `prevRemainingRef`.
6. If `remaining <= 0`: `removeTimer(t.id)` + delete from prevRef + `fireTimerExpireHaptic()` (Success notification) + `stepSpeaker.speak('{label} timer done.')`.
7. Otherwise: in-place `setState` updates the `remainingMs` field (minimal churn).

### show_ingredients end-to-end wiring (CONTEXT-locked contract closed)

| Stage | Code | Notes |
| --- | --- | --- |
| User says "show me the ingredients" | — | Audible to `ExpoSpeechRecognitionModule` |
| `useVoiceListener` emits `stt_final` telemetry + forwards final transcript | `apps/mobile/src/cooking/useVoiceListener.ts:84` | telemetry payload: `{ length, confidence }` — no raw text |
| `handleTranscript` calls `routeIntent(transcript)` | `apps/mobile/src/cooking/intentRouter.ts:52` | regex `SHOW_INGREDIENTS` matches |
| Returns `{ type: 'show_ingredients' }` | — | |
| Dispatcher switch hits `show_ingredients` branch | `apps/mobile/src/cooking/handleTranscript.ts:82-87` | fires `stopSpeech` + `onCommandHaptic` + `onCommandToast('Ingredients')` + `onShowIngredients()` |
| `onShowIngredients` = `() => recipeRef.current?.scrollToIngredients()` | `apps/mobile/src/app/recipes/[id]/cook.tsx:389` | wired in cook.tsx onTranscript useCallback |
| `ScrollableRecipe` forwardRef exposes `scrollToIngredients` | `apps/mobile/src/components/cooking/ScrollableRecipe.tsx:75-87` | reads captured `ingredientsY.current`, scrolls to `y=ingredientsY` (falls back to `y=0` if onLayout has not fired) |
| ScrollView animates to ingredients section | — | Default iOS `scrollTo({ animated: true })` 400ms |

The scroll fires on every recognized `show_ingredients` intent. Fires silently on null ref (e.g., recipe not yet rendered). Voice toast "Ingredients" appears 1.5s before auto-dismiss. No TTS echo per the silent-confirmation rule.

### Exit flow

`handleExit` calls `ActionSheetIOS.showActionSheetWithOptions({...})` with UI-SPEC copy verbatim:
- **title:** "End cooking session?"
- **message:** "Your place in the recipe won't be saved."
- **options:** ["End cooking session", "Keep cooking"]
- **destructiveButtonIndex:** 0
- **cancelButtonIndex:** 1

On destructive tap (idx === 0):
1. `fireExitConfirmHaptic()` (NotificationFeedbackType.Warning).
2. `stepSpeaker.stop()` — halt any in-flight TTS.
3. `flushTelemetry()` — fire-and-forget; last batch ships even if network hangs.
4. `exit()` — cookingStore state reset.
5. `router.back()` — return to recipe detail screen.

On "Keep cooking" (idx === 1): no-op — modal dismisses, cook screen stays mounted.

### Telemetry events wired

| Event | Fired from | Payload (sanitized) |
| --- | --- | --- |
| `stt_final` | `useVoiceListener` result handler | `{ length, confidence }` |
| `stt_error` | `useVoiceListener` error handler | `{ error_code }` |
| `tts_echo_swallowed` | `useVoiceListener` soft-gate drop | `{}` |
| `intent_routed` | `cook.tsx.onTranscript` after handleTranscript | `{ intent_type, length }` |
| `ask_start` | `handleAsk` pre-streamAsk | `{}` |
| `ask_first_chunk` | streamAsk onChunk first call | `{ first_chunk_ms }` |
| `ask_complete` | streamAsk onDone OR fallback success | `{ total_ms, answer_length }` |

All payloads routed through `sanitizePayload()` (9-key whitelist). Raw transcript text NEVER leaves the device.

## Task Commits

1. **Task 1: Telemetry hooks for useVoiceListener + stop handle for useStepSpeaker** — `c3d4eed` (feat)
2. **Task 2: Rewrite cook.tsx composing every Phase 16 primitive end-to-end** — `1b529d9` (feat)

## Files Created/Modified

### Modified (3)

- `apps/mobile/src/cooking/useVoiceListener.ts` — added `logCookingEvent` + `sanitizePayload` imports + `useCookingStore` import. stt_final and stt_error events emitted with sanitized payloads. tts_echo_swallowed event emitted from the soft isSpeakingAsync gate. session_id read lazily via `useCookingStore.getState().currentSessionId` so the hook does NOT re-subscribe.
- `apps/mobile/src/cooking/useStepSpeaker.ts` — now returns `StepSpeakerHandle { speak, stop }` via `useMemo(empty deps)` for stable identity. Consumers (StopTTSButton, Ask fallback, timer-done TTS) invoke speaker methods imperatively without re-mounting the hook.
- `apps/mobile/src/app/recipes/[id]/cook.tsx` — full rewrite (119 → 658 lines). Composes every Phase 16 primitive, wires SSE + fallback, owns timer ticker, exit action sheet, dark-mode wrapper, show_ingredients scroll dispatch, telemetry surfaces.

### Created (1)

- `.planning/phases/16-.../16-06-SUMMARY.md` — this file.

## Decisions Made

See `key-decisions` frontmatter. Seven decisions documented with rationale tied to plan intent, UI-SPEC contracts, and pitfalls from 16-RESEARCH.md.

## Deviations from Plan

### Auto-fixed Issues

None. All plan requirements shipped as specified.

### Minor Tactical Decisions (within plan latitude)

**1. ttsSpeaking detection via 500ms isSpeakingAsync poll instead of a native event subscription**
- **Why:** `expo-speech` does not expose a `did-start-speaking` / `did-stop-speaking` change event. The plan describes `ttsSpeaking={isSpeaking}` state "toggled by useStepSpeaker's start/end callbacks" but expo-speech's onDone/onStopped callbacks only fire on a single `Speech.speak({ onDone })` call — multiple stacked speaks (step TTS + ask answer + timer-done) would require a ref-counted approach.
- **What:** Lightweight 500ms `setInterval` polling `Speech.isSpeakingAsync()`. StopTTSButton visibility has at most 500ms lag, which is imperceptible when a TTS clip is several seconds long.
- **Trade-off:** Simpler state model at the cost of a modest polling overhead (one async call per 500ms during a cook session). Acceptable for the MVP; can be replaced with a ref-counted onDone/onStopped approach if UAT surfaces a perceivable lag.

**2. Ask flow speaks the full answer ONCE on SSE done — not sentence-by-sentence**
- **Why:** The plan's `<action>` block mentions "Sentence chunker for TTS" as optional (references 16-RESEARCH.md Pattern 6 lines 592-619). Shipping the simpler version first keeps the Ask contract readable and avoids a second TTS state machine.
- **Trade-off:** User hears the TTS start at the END of the SSE stream (typically 1-3s after first chunk arrives visually). Text already scrolls incrementally during streaming, so the UX gap is narrow. If UAT surfaces a perceivable delay between seeing the text and hearing the narration, wire a sentence-boundary chunker in a follow-up.

**3. Dark-mode toggle location deferred to a later plan**
- **Why:** The plan requires the SCOPED PALETTE wiring (cookingStore.darkMode → root wrapper). That's implemented. The Settings > Cooking section (CONTEXT mentions it as "create this section if missing") is not part of 16-06's scope — no must_haves.truth references Settings. Ship the palette mechanism now; ship the toggle UX in 16-07 or a future UX plan.
- **Trade-off:** End users cannot flip into dark cooking mode yet. Developers can via `useCookingStore.setState({ darkMode: true })` — sufficient for physical-device visual verification in 16-08 DEVICE-TEST-16.

## Issues Encountered

- **Pre-existing test failures out of scope:**
  - `__tests__/auth-store.test.ts > Auth Store > initialize > should set isOnboarded based on profile.onboarding_complete` (1 failure)
  - `src/stores/__tests__/progressionStore.test.ts > fetchVariations returns string[] on 200` (1 failure)
  - `src/stores/__tests__/shoppingStore.test.ts > generateList` (1 failure) and `> fetchCurrent` (1 failure)

  These are RED against HEAD independent of this plan — noted in 16-01 SUMMARY "Issues Encountered" as pre-existing. Verified my changes did not regress them by running the plan-scoped test suite (cooking + components/cooking + cook.test + cookingStore): 153/153 green.
- **Pre-existing TypeScript errors out of scope:**
  - `TS2578 Unused '@ts-expect-error' directive` across 5 Wave 0 test files (CommandToast, StickyCookingHeader, StopTTSButton, VoiceWaveform, haptics, telemetry, useVoiceAmplitude).
  - `TS2345 Element | null` type-narrowing issues in TimerBar + CommandToast tests.

  Both patterns are noted in 16-05 deferred-items.md as 16-07 cleanup targets. My cook.tsx compiles cleanly (`pnpm tsc --noEmit` on cook.tsx reports zero errors).

## Known Stubs

None. Every must_haves.truth from the plan frontmatter is implemented with live wiring:

- Cook screen composes StickyCookingHeader + ScrollableRecipe + StepNavButtons + CommandToast + AskSheet + dark-mode scoped palette — live.
- SSE streaming /ask-stream primary; askAssistant fallback on NO_STREAM_BODY — live.
- Telemetry events fire on every stt_final, intent_routed, ask_start/first_chunk/complete, tts_echo_swallowed; flush on exit — live.
- Dark cooking mode applies scoped palette override driven by cookingStore.darkMode — live (toggle UX deferred to a later plan).
- T-10s haptic fires once per timer crossing the 10s threshold — live (prevRemainingRef gate).
- Exit tap shows iOS action sheet with UI-SPEC copy verbatim — live.
- gestureEnabled: false preserved on route — live (passed via Stack.Screen options).
- Voice "show ingredients" scrolls the ScrollableRecipe via recipeRef.current.scrollToIngredients() — live (wired through handleTranscript's onShowIngredients dep).

## User Setup Required

None — all service configuration (Supabase auth token, Anthropic API key, EXPO_PUBLIC_API_URL) is already established from prior plans. The telemetry batcher's token seam is wired at cook-screen mount via `wireSupabaseAuth()`.

**Reminder:** Migration `00020_cooking_events.sql` (shipped in 16-01) must be applied to the hosted Supabase project before telemetry traffic actually persists. 16-01 SUMMARY's "User Setup Required" section tracks that requirement; status unchanged by 16-06.

## Next Phase Readiness

- **16-07 (cleanup + Maestro smoke):** can now `rm apps/mobile/src/components/cooking/StepDisplay.tsx apps/mobile/src/components/cooking/VoiceStatusBadge.tsx` — cook.tsx no longer imports either. Maestro flow 28 can exercise the new composition end-to-end (exit action sheet tap, voice mock transcript → show_ingredients scroll). 16-07 should also sweep the `@ts-expect-error` + `TS2345` pre-existing errors in the Phase 16 test files.
- **16-08 (DEVICE-TEST-16):** physical iPhone verification of:
  - Full Composed layout at counter distance (34pt current step readable?).
  - Timer haptics (simulator no-ops haptics — device-only verification).
  - SSE streaming happy path vs. NO_STREAM_BODY fallback (sse-smoke.ts on-device).
  - Dark-mode visual: background flip is crisp, `brand` accent still legible.
  - Command toast + voice waveform animations.
- **Phase 17 onwards:** cooking-mode composition is stable; future UX work extends via the primitive API surfaces (ScrollableRecipeHandle additions, new intents via intentRouter + handleTranscript).

## Self-Check

**Files:**
- FOUND: `apps/mobile/src/app/recipes/[id]/cook.tsx` (658 lines)
- FOUND: `apps/mobile/src/cooking/useVoiceListener.ts` (logCookingEvent imports + 3 telemetry call-sites)
- FOUND: `apps/mobile/src/cooking/useStepSpeaker.ts` (StepSpeakerHandle export + { speak, stop } memoized return)

**Commits in git log:**
- FOUND: `c3d4eed` (Task 1 — telemetry + stop handle)
- FOUND: `1b529d9` (Task 2 — cook.tsx rewrite)

**Plan verification checks:**
- `grep -cE "^import.*(StepDisplay|VoiceStatusBadge)" cook.tsx` → 0 (no Phase 9 stale imports).
- `grep -c "streamAsk\|askAssistant" cook.tsx` → 8 (both primary + fallback wired).
- `grep -c "recipeRef\|ScrollableRecipeHandle\|scrollToIngredients\|onShowIngredients" cook.tsx` → 9 (show_ingredients wiring present).
- `grep -c "StickyCookingHeader" cook.tsx` → 3 (import + render + docstring).
- `grep -c "<ScrollableRecipe" cook.tsx` → 1 (composed).
- `grep -c "lastCommandToast" cook.tsx` → 3 (destructure + render + docstring).
- `grep -c "darkMode" cook.tsx` → 3 (destructure + rootStyle + scrollOverride).
- `grep -c "ActionSheetIOS" cook.tsx` → 2 (import + invocation).
- `grep -c "fireTimerWarnHaptic\|fireTimerExpireHaptic" cook.tsx` → 3 (import + 2 call sites).

**TypeScript:** `pnpm tsc --noEmit` on cook.tsx reports zero errors. Pre-existing unrelated errors (5 test files) documented above.

**Tests:** `pnpm test --run src/cooking src/components/cooking src/stores/__tests__/cookingStore.test.ts src/app/recipes` → **153/153 green** across 22 test files.

## Self-Check: PASSED

---
*Phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display*
*Plan: 06 — Cook Screen End-to-End Integration*
*Completed: 2026-04-22*
