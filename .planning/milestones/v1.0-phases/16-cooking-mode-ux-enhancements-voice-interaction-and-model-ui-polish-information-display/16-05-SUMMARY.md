---
phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display
plan: 05
subsystem: ui
tags: [react-native, expo, cooking, voice, intents, accessibility, tokens, nativewind, a11y]

# Dependency graph
requires:
  - phase: 16-00
    provides: Wave 0 red-stub tests for CommandToast, intentRouter show_ingredients cases, and handleTranscript toast/haptic callbacks (flipped to green here)
  - phase: 09
    provides: handleTranscript dispatcher + intentRouter regex classifier (extended non-destructively)
  - phase: 19
    provides: design tokens (brand, surface, text-primary/secondary/tertiary, border, surface-subtle), Phase 19 Button primitive, ErrorState, SymbolIcon, iconPropsForText('display')
provides:
  - CommandToast primitive (1.5s auto-dismiss, brand left-edge accent, accessibilityLiveRegion=polite)
  - show_ingredients intent routing (regex before ask fallthrough)
  - CookingIntent union extended with show_ingredients variant
  - TranscriptDeps extended with onCommandToast, onCommandHaptic, onShowIngredients
  - Timer TTS removal (silent confirmation per UI-SPEC §Voice feedback principle)
  - StepNavButtons rewritten at 72pt (documented Phase 19 deviation)
  - AskSheet retokened with ErrorState + incremental-answer rendering contract for SSE streaming
affects:
  - 16-06 (cook.tsx integration will wire onCommandToast/onCommandHaptic/onShowIngredients to real toast/haptic/scroll; will switch to disableBack/disableNext props; will forward SSE deltas into AskSheet.answer)
  - 16-07 (cleanup — delete VoiceStatusBadge.tsx + StepDisplay.tsx after cook.tsx swap; sweep stale @ts-expect-error in cooking tests)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Voice command confirmation: toast + haptic (silent, no TTS echo). Dispatcher owns haptic/toast callouts; component is purely visual."
    - "Intent router ordering convention: timer → nav → pause → resume → scoped intents (show_ingredients) → ask fallthrough. New scoped intents are inserted just before the ask fallthrough so free-form questions still reach /ask."
    - "72pt cooking-hands tap target as a documented Phase 19 deviation — local to StepNavButtons; all other tokens stay compliant."
    - "Streaming answer contract: AskSheet.answer is a React prop; SSE deltas flow in via normal re-renders, no typewriter effect/cursor."
    - "Direct setTimeout (not useEffect) in purely-visual primitives that the vitest node harness invokes as plain functions — matches the shipped pattern used by CommandToast."

key-files:
  created:
    - "apps/mobile/src/components/cooking/CommandToast.tsx"
    - ".planning/phases/16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display/deferred-items.md"
  modified:
    - "apps/mobile/src/cooking/intentRouter.ts"
    - "apps/mobile/src/cooking/handleTranscript.ts"
    - "apps/mobile/src/types/cooking.ts"
    - "apps/mobile/src/components/cooking/StepNavButtons.tsx"
    - "apps/mobile/src/components/cooking/AskSheet.tsx"
    - "apps/mobile/src/app/recipes/[id]/cook.tsx"
    - "apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts"
    - "apps/mobile/src/cooking/__tests__/intentRouter.test.ts"
    - "apps/mobile/src/cooking/__tests__/handleTranscript.test.ts"
    - "apps/mobile/src/components/cooking/__tests__/CommandToast.test.tsx"

key-decisions:
  - "Timer intent no longer speaks — silent-confirmation rule per UI-SPEC §Voice feedback principle. Toast/haptic replaces TTS echo."
  - "show_ingredients regex permits up to 3 intervening tokens between verb and 'ingredients' ('can you show me the ingredients' hits). Accepted edge case: 'what ingredients are substitutes for X' routes to show_ingredients instead of /ask — users rephrase for substitution flow."
  - "StepNavButtons is a hand-rolled Pressable tree rather than the Phase 19 Button, because Button's variantStyles enforce 44pt. Keeping the 72pt deviation local preserves Button invariants."
  - "StepNavButtons prop names inverted (canGoBack/canGoNext → disableBack/disableNext) per the plan's stated interface. cook.tsx maps with `!` until 16-06 replaces the callsite."
  - "cook.tsx adds temporary no-op callbacks (onCommandToast/onCommandHaptic/onShowIngredients) for the extended TranscriptDeps interface, preserving compile-green until 16-06 wires real handlers."

patterns-established:
  - "Intent router insertion-point convention: scoped recognized intents sit between pause/resume and the ask fallthrough; document the insertion in the file-level JSDoc and include a regression guard in the test suite."
  - "Silent-confirmation UX: recognized commands → toast + haptic, never TTS echo."

requirements-completed: [COOK-UX-03, COOK-UX-05]

# Metrics
duration: 11min
completed: 2026-04-22
---

# Phase 16 Plan 05: Voice Command Feedback Primitives Summary

**CommandToast (1.5s auto-dismiss, brand accent) + show_ingredients intent routing + timer TTS removal + 72pt StepNavButtons + retokened AskSheet with ErrorState and incremental SSE answer rendering**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-22T04:17:10Z
- **Completed:** 2026-04-22T04:27:44Z (approx)
- **Tasks:** 2
- **Files modified:** 10 (1 created, 9 modified) + 1 docs file (deferred-items.md)

## Accomplishments

- **CommandToast primitive** — 1.5s setTimeout-based dismiss, `accessibilityLiveRegion="polite"`, body/700 centered single line, brand left-edge accent strip, zero hardcoded hex. Direct setTimeout instead of useEffect so the vitest node harness (which invokes the component as a plain function) sees the timer fire on `vi.advanceTimersByTimeAsync(1500)`.
- **show_ingredients intent** — new regex `\b(show|see|list|what)\b(?:\s+\w+){0,3}\s+ingredients\b` placed after the resume check and before the ask fallthrough in `intentRouter.ts`. CookingIntent union gained `{ type: 'show_ingredients' }`.
- **handleTranscript v2** — TranscriptDeps gained `onCommandToast`, `onCommandHaptic`, `onShowIngredients`. Every recognized intent except `ask`/`pause`/`resume` fires `onCommandHaptic() + onCommandToast(copy)`. Timer case dropped `deps.speak(...)` per §Voice feedback principle. New `show_ingredients` case dispatches `stopSpeech → onCommandHaptic → onCommandToast('Ingredients') → onShowIngredients` with no network call.
- **StepNavButtons at 72pt** — hand-rolled Pressable tree using Phase 19 tokens (`bg-surface`, `border-border`, `text-body font-bold text-text-primary`, `iconPropsForText('display')` at 28pt). Documented 72pt deviation inline with UI-SPEC §Spacing §Exceptions reference. Interface migrated to `disableBack/disableNext`.
- **AskSheet retokened** — legacy `warmWhite`/`warmGray-*`/`#6B7280` replaced with Phase 19 tokens (`bg-surface`, `bg-surface-subtle`, `text-text-primary/secondary/tertiary`). Added optional `error?: string | null` prop rendering `ErrorState` banner with the UI-SPEC copy `"Couldn't reach the kitchen assistant. / Try again in a moment."` Incremental-answer contract: spinner hides as soon as `answer` becomes non-empty, enabling SSE delta streaming consumers (16-06) to forward chunks directly without intermediate state.

## Intent → Toast Copy Matrix (UI-SPEC §Copywriting)

| Intent             | Toast Copy          | Haptic | Network |
| ------------------ | ------------------- | ------ | ------- |
| next               | `Next step`         | medium | no      |
| back               | `Previous step`     | medium | no      |
| repeat             | `Repeating`         | medium | no      |
| timer              | `Timer set · N min` | medium | no      |
| show_ingredients   | `Ingredients`       | medium | no      |
| pause              | (silent)            | none   | no      |
| resume             | (silent)            | none   | no      |
| ask (fallthrough)  | (no toast — AskSheet opens instead) | none | YES (/cooking/ask) |

## show_ingredients Dispatch Sequence

```
routeIntent('show ingredients') → { type: 'show_ingredients' }
  ↓ handleTranscript switch
  deps.stopSpeech()
  deps.onCommandHaptic()
  deps.onCommandToast('Ingredients')
  deps.onShowIngredients()       ← wired in 16-06 to recipeRef.current.scrollToIngredients()
  return { type: 'show_ingredients' }
```

**No network call.** `onAsk`, `next`, `back`, `repeat`, `addTimer`, `speak` are never invoked for this intent.

## Task Commits

1. **Task 1: CommandToast + intentRouter show_ingredients + handleTranscript toast/haptic/onShowIngredients** — `cb3d1b3` (feat)
2. **Task 2: StepNavButtons @ 72pt + AskSheet retoken w/ error + incremental answer** — `4c6610f` (feat)

## Files Created/Modified

- **Created:** `apps/mobile/src/components/cooking/CommandToast.tsx` — 1.5s toast primitive with brand accent strip + live region.
- **Modified:** `apps/mobile/src/types/cooking.ts` — CookingIntent union +show_ingredients.
- **Modified:** `apps/mobile/src/cooking/intentRouter.ts` — SHOW_INGREDIENTS regex inserted before ask fallthrough; file-level JSDoc updated with ordering rationale.
- **Modified:** `apps/mobile/src/cooking/handleTranscript.ts` — TranscriptDeps +3 callbacks; per-intent haptic/toast dispatch; timer speak removed; show_ingredients case added.
- **Modified:** `apps/mobile/src/cooking/__tests__/intentRouter.test.ts` — 10 new cases (matching + regression guards + documented edge case).
- **Modified:** `apps/mobile/src/cooking/__tests__/handleTranscript.test.ts` — makeDeps extended; timer baseline updated; new show_ingredients describe block.
- **Modified:** `apps/mobile/src/components/cooking/StepNavButtons.tsx` — 72pt hand-rolled rewrite, Phase 19 tokens, new disableBack/disableNext interface.
- **Modified:** `apps/mobile/src/components/cooking/AskSheet.tsx` — full retoken, optional error prop, incremental-answer renderer, secondary Close button.
- **Modified:** `apps/mobile/src/app/recipes/[id]/cook.tsx` — no-op Phase 16 deps + canGoBack/canGoNext → !disableBack/!disableNext mapping (temporary until 16-06).
- **Modified:** `apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts` — makeDeps extended; timer assertion updated to silent-confirmation.
- **Modified:** `apps/mobile/src/components/cooking/__tests__/CommandToast.test.tsx` — removed now-stale `@ts-expect-error` directive.
- **Created:** `.planning/phases/16-.../deferred-items.md` — logs pre-existing 16-03/16-04 red stubs excluded per SCOPE BOUNDARY.

## Decisions Made

- **Timer silent-confirmation:** Dropped `deps.speak('Timer set for N minutes.')` per UI-SPEC §Voice feedback principle — matches the locked "no TTS echo" rule and works when the phone is on silent mode.
- **show_ingredients regex width:** Allows up to 3 intervening tokens ("show me the ingredients" hits). The broader match accepts the known "what ingredients are substitutes for X" edge case as a tradeoff — users rephrase for substitution flow.
- **StepNavButtons interface inversion:** Changed from `canGoBack/canGoNext` to `disableBack/disableNext` per the plan's stated new interface. cook.tsx maps `!` until 16-06 replaces the integration fully.
- **StepNavButtons Button vs Pressable:** Hand-rolled Pressable because Phase 19 Button variants enforce 44pt in variantStyles. Localizing the 72pt deviation keeps the primitive's invariants intact rather than adding a Button `height` override that would leak 72pt globally.
- **cook.tsx temporary no-op deps:** Added `onCommandToast: () => {}`, `onCommandHaptic: () => {}`, `onShowIngredients: () => {}` to avoid compile break before 16-06 wires real handlers. Documented inline with a 16-06 pointer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] cook.tsx compile break from new StepNavButtons interface**
- **Found during:** Task 2 (StepNavButtons rewrite)
- **Issue:** cook.tsx passed `canGoBack={canGoBack}` / `canGoNext={canGoNext}` — incompatible with the plan's new `{ disableBack, disableNext }` interface. TypeScript failed the build.
- **Fix:** Mapped `canGoBack → !disableBack`, `canGoNext → !disableNext` at the callsite with an explanatory comment. 16-06 cook.tsx integration will replace the whole derivation properly.
- **Files modified:** apps/mobile/src/app/recipes/[id]/cook.tsx
- **Verification:** `pnpm tsc --noEmit` shows only pre-existing Wave 0 test-file errors; cook.tsx compiles.
- **Committed in:** 4c6610f (Task 2 commit)

**2. [Rule 3 - Blocking] cook.test.ts + cook.tsx compile break from extended TranscriptDeps**
- **Found during:** Task 1 follow-up (ran tsc after adding new deps to TranscriptDeps)
- **Issue:** Every existing TranscriptDeps consumer now required onCommandToast/onCommandHaptic/onShowIngredients. cook.tsx and cook.test.ts (both landed before Phase 16) were missing the props.
- **Fix:** Added no-op callbacks to cook.tsx onTranscript dispatch (temporary until 16-06 wires real handlers). Extended cook.test.ts makeDeps to supply the three new mocks so every existing integration case continues type-checking.
- **Files modified:** apps/mobile/src/app/recipes/[id]/cook.tsx, apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts
- **Verification:** cook.test.ts still passes all 9 cases; cook.tsx compiles.
- **Committed in:** cb3d1b3 (Task 1) for cook.test.ts, 4c6610f (Task 2) for cook.tsx.

**3. [Rule 2 - Missing Critical] Removed stale `@ts-expect-error` on CommandToast test import**
- **Found during:** Task 2 follow-up (tsc sweep)
- **Issue:** Wave 0 red stub had `@ts-expect-error — component does not exist yet`. Now that Task 1 shipped the component, the directive was unused (TS2578) and failed strict tsc.
- **Fix:** Removed the directive line. Component import now resolves cleanly.
- **Files modified:** apps/mobile/src/components/cooking/__tests__/CommandToast.test.tsx
- **Verification:** CommandToast test suite 4/4 passes at runtime; tsc no longer reports TS2578 for this file.
- **Committed in:** 4c6610f (Task 2 commit)

**4. [Rule 1 - Bug] intentRouter SHOW_INGREDIENTS regex too narrow**
- **Found during:** Task 1 (first test run)
- **Issue:** Initial regex `\b(show|see|list|what(?:'s|\s+are)?(?:\s+the)?)\s+ingredients\b` failed on "can you show me the ingredients" — the spec lists this exact phrase as a required match.
- **Fix:** Widened to `\b(show|see|list|what)\b(?:\s+\w+){0,3}\s+ingredients\b` — permits up to 3 intervening tokens between verb and "ingredients".
- **Files modified:** apps/mobile/src/cooking/intentRouter.ts
- **Verification:** All 10 new intentRouter cases green (including "can you show me", "what are the", "what ingredients").
- **Committed in:** cb3d1b3 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking)
**Impact on plan:** All deviations necessary to keep compile green + honor the plan's behavior spec. No scope creep — every change flows from a plan-stated interface contract.

## Issues Encountered

- **vitest invokes components as plain functions** — the Wave 0 CommandToast test calls `CommandToast({ message, id, onClear })` directly, so `useEffect` / `useRef` / `new Animated.Value()` don't work (no React render tree). Resolved by calling `setTimeout` directly in the function body (matches the shipped-component pattern in the cooking suite). The 1.5s auto-dismiss contract is still preserved in production because the parent toggles `message` state and React re-renders normally.
- **Regex edge case accepted as tradeoff:** "what ingredients are substitutes for X" matches show_ingredients instead of /ask. Documented in intentRouter.test.ts with a follow-up note — if UAT telemetry shows real friction, tighten the regex in 16-08.
- **Linter/tool revert during Task 2:** Mid-task, several files (StepNavButtons, AskSheet, cook.tsx, cook.test.ts) appeared to revert after a sibling 16-03 commit landed on top of my Task 1. Re-verified each file's actual on-disk state and found Task 2 edits had been preserved correctly — the system-reminders reporting earlier snapshots were stale but the actual file state was correct.

## Deferred Issues

Pre-existing Wave 0 red stubs from 16-03/16-04 remain red (out of scope per SCOPE BOUNDARY):
- `src/components/cooking/__tests__/ScrollableRecipe.test.tsx` (6 failing cases — `scrollableRecipeRender` API mismatch with shipped component).
- Multiple `@ts-expect-error` directives in tests now stale after component shipping (StickyCookingHeader, StopTTSButton, VoiceWaveform, haptics, telemetry, useVoiceAmplitude).
- TimerBar test Element|null type narrowing (5 assertions) — ubiquitous pattern across the cooking suite.

Logged in `.planning/phases/16-.../deferred-items.md` for 16-07 cleanup or follow-up.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **16-06 cook.tsx integration** is unblocked. It will:
  - Replace the no-op Phase 16 TranscriptDeps callbacks with real handlers:
    - `onCommandToast(msg)` → set `lastCommandToast` in cookingStore, render `<CommandToast />` inside cook.tsx.
    - `onCommandHaptic()` → `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`.
    - `onShowIngredients()` → `recipeRef.current.scrollToIngredients()` (ScrollableRecipe imperative API).
  - Wire SSE deltas from `streamAsk` (16-02) → AskSheet `answer` prop incrementally, and `error` prop on failure.
  - Swap `canGoBack`/`canGoNext` derivation for direct `disableBack`/`disableNext` prop forwarding (remove the `!` mapping).
  - Drop the temporary no-op callbacks and the mapping comment.

## Self-Check: PASSED

- File `apps/mobile/src/components/cooking/CommandToast.tsx` exists.
- File `apps/mobile/src/cooking/intentRouter.ts` modified with `show_ingredients` reference.
- File `apps/mobile/src/cooking/handleTranscript.ts` modified with 3 new deps + show_ingredients case.
- File `apps/mobile/src/types/cooking.ts` modified with show_ingredients variant.
- File `apps/mobile/src/components/cooking/StepNavButtons.tsx` rewritten at 72pt.
- File `apps/mobile/src/components/cooking/AskSheet.tsx` retokened with error state.
- Commit `cb3d1b3` present in log (Task 1).
- Commit `4c6610f` present in log (Task 2).
- No hardcoded hex in CommandToast/StepNavButtons/AskSheet (grep empty).
- `grep -n "72" StepNavButtons.tsx` → 7 hits (header doc + height literal ×2 + 3 comments + function doc).
- `grep -n "show_ingredients"` in intentRouter/handleTranscript/types/cooking → hits in all three.
- Task 1 targeted tests: 50/50 green (CommandToast ×4, intentRouter ×30, handleTranscript ×16).
- Task 2 targeted tests: StepNavButtons + AskSheet have no dedicated tests yet (plan-documented — exercised in 16-07 Maestro + 16-06 integration).
- Full cooking suite: 108/114 tests pass across 18/19 files. The 6 failing are pre-existing 16-04 ScrollableRecipe stubs deferred per SCOPE BOUNDARY.

---
*Phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display*
*Completed: 2026-04-22*
