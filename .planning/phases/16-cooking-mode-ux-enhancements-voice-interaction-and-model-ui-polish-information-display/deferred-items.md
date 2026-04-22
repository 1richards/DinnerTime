# Phase 16 — Deferred Items

Items discovered during Phase 16 execution that were out of scope for the current plan.

## 2026-04-22 — During 16-05 execution

### Pre-existing red tests (out of scope for 16-05)

Wave 0 red test stubs belonging to other Wave 2 plans (16-03, 16-04) that are out of scope per the SCOPE BOUNDARY rule (test files not directly modified by 16-05 tasks):

- `src/components/cooking/__tests__/ScrollableRecipe.test.tsx` — 16-04 layout primitive. 6 failing cases: `scrollableRecipeRender` helper API mismatch with shipped component + `forwardRef` usage. Needs 16-04 follow-up or 16-06 integration retune.
- `src/components/cooking/__tests__/StickyCookingHeader.test.tsx` — 16-04 header (ts-expect-error unused after shipping).
- `src/components/cooking/__tests__/StopTTSButton.test.tsx` — 16-03 StopTTSButton (ts-expect-error unused).
- `src/components/cooking/__tests__/VoiceWaveform.test.tsx` — 16-03 VoiceWaveform (ts-expect-error unused).
- `src/components/cooking/__tests__/TimerBar.test.tsx` — Element|null type narrowing in 5 assertions. Pattern matches the test-harness shape across the cooking suite — not a shipped regression.
- `src/cooking/__tests__/haptics.test.ts`, `telemetry.test.ts`, `useVoiceAmplitude.test.ts` — ts-expect-error unused after shipping.

**Action:** Stale `@ts-expect-error` directives can be swept in 16-07 cleanup. The `ScrollableRecipe` test harness needs either the component to re-expose `scrollableRecipeRender` or the tests to be rewritten against the shipped default export. Revisit during 16-06 cook.tsx integration or as a dedicated cleanup plan in Wave 4 (16-07/08).
