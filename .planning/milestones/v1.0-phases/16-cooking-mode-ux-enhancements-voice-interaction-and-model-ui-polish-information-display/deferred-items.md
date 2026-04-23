# Deferred Items — Phase 16

Items discovered during phase execution that are out-of-scope for the current plan but should be tracked.

## Pre-existing TypeScript/Test Errors (discovered in 16-07)

These errors exist in the repo **before 16-07 changes** and are not caused by this plan's work. Scope boundary: do not fix.

**TypeScript (`pnpm tsc --noEmit` in apps/mobile):**
- `src/components/cooking/__tests__/CommandToast.test.tsx:67` — `Element | null` not assignable to `AnyEl`
- `src/components/cooking/__tests__/StickyCookingHeader.test.tsx:12` — unused `@ts-expect-error`
- `src/components/cooking/__tests__/StopTTSButton.test.tsx:11` — unused `@ts-expect-error`
- `src/components/cooking/__tests__/TimerBar.test.tsx` (multiple lines) — `Element | null` not assignable
- `src/components/cooking/__tests__/VoiceWaveform.test.tsx:12` — unused `@ts-expect-error`
- `src/cooking/__tests__/haptics.test.ts:27` — unused `@ts-expect-error`
- `src/cooking/__tests__/telemetry.test.ts:13,70` — unused `@ts-expect-error`
- `src/cooking/__tests__/useVoiceAmplitude.test.ts:12` — unused `@ts-expect-error`

All are in test files shipped by earlier Phase 16 plans (16-03/04/05/06). Type errors do not fail vitest (runtime type erasure).

**Vitest (`pnpm test --run src/stores`):**
- `src/stores/__tests__/shoppingStore.test.ts` — 3 failures, `currentList` now wrapped in `{ list }` shape. Pre-existing mismatch between store implementation and test expectations. Unrelated to cooking.

None block Phase 16 closeout. Surface for Phase 17 or a dedicated test-hygiene plan.
