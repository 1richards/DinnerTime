---
phase: 09-voice-cooking-mode
plan: 01
subsystem: voice-cooking
tags: [foundation, zustand, expo, speech]
requires: []
provides:
  - "useCookingStore (Zustand) — client-only voice cooking session state"
  - "CookingIntent union, Timer, CookingState types"
  - "expo-speech, expo-keep-awake, @jamsch/expo-speech-recognition installed"
  - "iOS speech recognition + microphone permission strings via expo config plugin"
affects:
  - apps/mobile/package.json
  - apps/mobile/app.json
tech-stack:
  added:
    - expo-speech (~55.0.13)
    - expo-keep-awake (~55.0.6)
    - "@jamsch/expo-speech-recognition (0.2.15 exact pin)"
  patterns:
    - Zustand create<State & Actions>() (matches shoppingStore convention)
    - RN-safe timer id via Date.now + Math.random (no crypto.randomUUID reliance)
key-files:
  created:
    - apps/mobile/src/types/cooking.ts
    - apps/mobile/src/stores/cookingStore.ts
    - apps/mobile/src/stores/__tests__/cookingStore.test.ts
  modified:
    - apps/mobile/package.json
    - apps/mobile/app.json
decisions:
  - "Pinned @jamsch/expo-speech-recognition to 0.2.15 exact (Pitfall 7 — pre-1.0 ecosystem)"
  - "Timer id uses Date.now().toString(36) + Math.random() — crypto.randomUUID not reliable across RN runtimes"
  - "repeat() is a no-op on state; downstream effects dispatch TTS re-read imperatively"
  - "next() is a no-op when recipe is null (prevents step drift outside cooking session)"
metrics:
  duration: "~3 min"
  tasks: 2
  files: 5
  tests_added: 15
  tests_total: 119
  completed: "2026-04-10"
---

# Phase 09 Plan 01: Foundation (deps, types, cookingStore) Summary

Installed voice cooking native dependencies and built the Zustand cookingStore with full action coverage — foundation plan with no user-visible changes, but downstream plans can now import `useCookingStore` and `CookingIntent`/`Timer` types without further wiring.

## What Was Built

### Task 1 — Native modules + iOS permissions
- `pnpm add` via `npx expo install` for expo-speech (~55.0.13) and expo-keep-awake (~55.0.6).
- Exact pin `@jamsch/expo-speech-recognition@0.2.15` via `pnpm add --save-exact` (Pitfall 7 — pre-1.0 churn).
- `app.json` `expo.plugins` array extended with `@jamsch/expo-speech-recognition` plugin carrying `microphonePermission` and `speechRecognitionPermission` strings. Without these iOS STT silently fails on device (Pitfall 1).
- Verified via `node -e` probes of parsed package.json / app.json (plan's automated verify step passed).
- **No EAS build attempted** — per plan, that's a later manual step.

### Task 2 — Cooking types + cookingStore (TDD)
**RED:** Wrote `cookingStore.test.ts` first — 15 tests covering initial state, `enter`, `exit`, `next` (advance + clamp at last + no-op when no recipe), `back` (decrement + clamp at 0), `repeat` (no state change), `addTimer` (shape, label rounding, append semantics), `removeTimer`, `setListening`, `setAssistantAnswer`. Tests failed because store didn't exist.

**GREEN:** Implemented:
- `src/types/cooking.ts` — `CookingIntent` discriminated union (`next`/`back`/`repeat`/`timer`/`pause`/`resume`/`ask`), `Timer`, `CookingState`.
- `src/stores/cookingStore.ts` — Zustand `create<CookingState & CookingActions>()` with all documented actions. Matches `shoppingStore` file/structure conventions. Timer id uses `tmr-${Date.now()36}-${Math.random()36}` slice.

**REFACTOR:** Not needed — implementation was already minimal and clear.

Final run: `vitest run --passWithNoTests cookingStore` — 12 test files passed, 119 tests total (15 new), duration ~320ms. `tsc --noEmit` clean.

## Store API (for downstream plans)

```ts
import { useCookingStore } from '@/stores/cookingStore';
import type { CookingIntent, Timer } from '@/types/cooking';

// State: recipe, stepIndex, voiceEnabled, ttsEnabled, listening, timers, lastAssistantAnswer
// Actions: enter(recipe), exit(), next(), back(), repeat(),
//          addTimer(ms), removeTimer(id), setListening(bool), setAssistantAnswer(str|null)
```

## Deviations from Plan

**None.** Plan executed exactly as written.

One minor note: plan frontmatter listed `apps/mobile/vitest.setup.ts` in `files_modified`, but no setup file change was needed — existing vitest config in this workspace already handles the new tests without additional globals. Not creating unused infrastructure.

## Verification

- [x] `package.json` contains `expo-speech`, `expo-keep-awake`, `@jamsch/expo-speech-recognition` at exact `0.2.15`
- [x] `app.json` plugin entry includes both `microphonePermission` and `speechRecognitionPermission`
- [x] `cookingStore` tests green (15/15, 119/119 total suite)
- [x] `tsc --noEmit` clean
- [x] Downstream import contract works: `useCookingStore` + `CookingIntent`/`Timer` exported

## Commits

- `726e18e` — chore(09-01): install voice deps and configure iOS speech plugin
- `2c4c748` — test(09-01): add failing tests for cookingStore (RED)
- `00e6097` — feat(09-01): implement cookingStore for voice cooking session (GREEN)

## Self-Check: PASSED

- FOUND: apps/mobile/src/types/cooking.ts
- FOUND: apps/mobile/src/stores/cookingStore.ts
- FOUND: apps/mobile/src/stores/__tests__/cookingStore.test.ts
- FOUND commit: 726e18e
- FOUND commit: 2c4c748
- FOUND commit: 00e6097
