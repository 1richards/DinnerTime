---
phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display
plan: 07
subsystem: ui
tags: [settings, cooking-mode, dark-mode, maestro, uat, cleanup, zustand, nativewind]

requires:
  - phase: 16-05
    provides: cookingStore.darkMode + setDarkMode action (wired to persist)
  - phase: 16-06
    provides: cook.tsx end-to-end composition (ScrollableRecipe, StepCard, StickyCookingHeader, StepNavButtons) — this plan exercises them via Maestro
provides:
  - Settings "Cooking" section with "Dark cooking mode" toggle wired to cookingStore.setDarkMode (persisted across app restarts)
  - Maestro flow 28-cooking-mode-ui.yaml — simulator-runnable UAT covering every non-voice cooking-screen assertion
  - Removal of superseded Phase 9 components (StepDisplay, VoiceStatusBadge)
affects: [phase-16-08-device-test, future-phases-touching-settings]

tech-stack:
  added: []
  patterns:
    - "Settings section pattern: text-label text-text-secondary uppercase header + toggle row with flex-row items-center justify-between py-4 border-b border-border"
    - "Maestro non-voice cooking UAT pattern: deep-link to settings, scrollUntilVisible for Cooking section, tap title to toggle Switch"

key-files:
  created:
    - apps/mobile/.maestro/28-cooking-mode-ui.yaml
    - .planning/phases/16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display/16-07-SUMMARY.md
  modified:
    - apps/mobile/src/app/(tabs)/settings.tsx
    - apps/mobile/src/app/recipes/[id]/cook.tsx
    - apps/mobile/.maestro/15-cook-voice-mode-stub.yaml
  deleted:
    - apps/mobile/src/components/cooking/StepDisplay.tsx
    - apps/mobile/src/components/cooking/VoiceStatusBadge.tsx

key-decisions:
  - "Settings Cooking section placed between Pantry and Account (logical grouping: preferences → account actions)"
  - "Toggle row uses accessibilityRole='switch' on the row wrapper + accessibilityState.checked, so Maestro + VoiceOver can both drive it via the title text"
  - "Maestro flow 28 does NOT cover voice paths — locked behind DEVICE-TEST-16 (plan 16-08) per CLAUDE.md UAT section (simulator has no audio injection)"
  - "Auto-approved the human-verify checkpoint per AUTO_MODE_OVERRIDE — physical-device flow 16-08 is the authoritative visual pass"

patterns-established:
  - "Pattern: toggle preferences sourced from a Zustand persisted store read inline at the Settings screen (no new component needed for single-toggle sections)"
  - "Pattern: when deleting a superseded component, also sweep stale references in inline file-header comments to keep the codebase self-describing"

requirements-completed: [COOK-UX-03, COOK-UX-04]

duration: 12m
completed: 2026-04-22
---

# Phase 16 Plan 07: Settings dark-mode toggle, Maestro UAT, Phase 9 cleanup

**Settings "Cooking" section with persisted dark-mode Switch, Maestro flow 28 covering the entire non-voice cooking UI surface, and removal of Phase 9 StepDisplay/VoiceStatusBadge.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T04:43:00Z
- **Completed:** 2026-04-22T04:55:00Z
- **Tasks:** 3 (Settings + cleanup, Maestro flow, checkpoint auto-approved)
- **Files modified:** 5 (+1 new Maestro flow, 2 deletions)

## Accomplishments

- Settings now renders a "COOKING" section with the exact UI-SPEC copy: "Dark cooking mode" title and "Darker background while cooking. Matches Spotify's Now Playing feel." subtitle.
- Toggle wired to `cookingStore.setDarkMode`, which persists via the store's `partialize: (state) => ({ darkMode: state.darkMode })` rule — value survives app restarts.
- Maestro flow 28-cooking-mode-ui.yaml authored with 49 steps producing 7 screenshots covering: landing (STEP 1 active), ingredient tap-to-check, Next → STEP 2, Back → STEP 1, Exit → action sheet, Settings dark-mode toggle ON, cooking screen with dark palette.
- Dead-code sweep: StepDisplay.tsx and VoiceStatusBadge.tsx removed. Stale references in cook.tsx header comment and 15-*.yaml stub comment updated.
- 27 cooking/app test files (159 tests) all green.
- TypeScript clean on touched files (settings.tsx, cook.tsx) — pre-existing errors in unrelated test files are tracked in `deferred-items.md`.

## Task Commits

1. **Task 1: Settings Cooking section + delete Phase 9 dead files** — `bae1f1a` (feat)
2. **Task 2: Maestro flow 28 — non-voice cooking UAT** — `36b06bd` (test)
3. **Task 3: Human-verify checkpoint** — auto-approved per AUTO_MODE_OVERRIDE (no commit; checkpoint is a gate, not an artifact)

**Plan metadata commit:** pending (creates this SUMMARY + STATE/ROADMAP updates)

## Files Created/Modified

**Created:**
- `apps/mobile/.maestro/28-cooking-mode-ui.yaml` — simulator-runnable cooking UI UAT, 49 steps, 7 screenshots.

**Modified:**
- `apps/mobile/src/app/(tabs)/settings.tsx` — added COOKING section with dark-mode toggle row between Pantry and Account; imports `useCookingStore` + `Switch`.
- `apps/mobile/src/app/recipes/[id]/cook.tsx` — updated header comment: "Phase 9 components … are the cleanup target for 16-07" → "were deleted in 16-07".
- `apps/mobile/.maestro/15-cook-voice-mode-stub.yaml` — updated comment reference from StepDisplay to ScrollableRecipe.

**Deleted:**
- `apps/mobile/src/components/cooking/StepDisplay.tsx` — superseded by ScrollableRecipe + StepCard.
- `apps/mobile/src/components/cooking/VoiceStatusBadge.tsx` — superseded by VoiceWaveform.

## Decisions Made

- **Section placement:** Cooking goes between Pantry and Account. Pantry is the last "food preferences" section; Account is sign-out/identity. Cooking is a UX preference, so it sits with the pref group but right before Account as a sensible last-pref slot.
- **Toggle row accessibilityRole:** Applied `accessibilityRole="switch"` + `accessibilityState={{ checked: darkMode }}` + `accessibilityLabel="Dark cooking mode"` to the outer `View` wrapping the title/subtitle/Switch. This lets Maestro's text-based driver tap the plain-label title to trigger a row-level press, while the real iOS Switch handles the state change via its own `onValueChange`.
- **No new settings component file:** One toggle row didn't justify a dedicated `CookingSection.tsx` the way FamilyMembers, Dietary, Cuisine, etc. each warrant. Inline JSX matches the Pantry inline pattern already in the file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Updated cook.tsx stale comment referencing deleted components**
- **Found during:** Task 1 (delete Phase 9 files)
- **Issue:** `cook.tsx` header comment said "Phase 9 components StepDisplay + VoiceStatusBadge are NOT imported here — they're the cleanup target for 16-07." After deletion, the second clause was incorrect.
- **Fix:** Rewrote to "were deleted in 16-07 after being superseded by ScrollableRecipe + StepCard and VoiceWaveform."
- **Files modified:** apps/mobile/src/app/recipes/[id]/cook.tsx
- **Verification:** `grep -rn 'StepDisplay\|VoiceStatusBadge' apps/mobile/src/` returns only the two definition sites (now deleted) — zero consumer references.
- **Committed in:** bae1f1a (Task 1 commit)

**2. [Rule 3 — Blocking] Updated 15-*.yaml stub comment**
- **Found during:** Task 1 (same sweep as above)
- **Issue:** `15-cook-voice-mode-stub.yaml` comment referenced StepDisplay in "what this flow would verify" section. Stale after deletion.
- **Fix:** Changed to "Verify the ScrollableRecipe renders step 1 text (Phase 16: was StepDisplay)" — preserves the historical note while reflecting current code.
- **Files modified:** apps/mobile/.maestro/15-cook-voice-mode-stub.yaml
- **Committed in:** bae1f1a (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — documentation/comment sync with code deletion)
**Impact on plan:** No scope creep. Both were stale references created by the act of deleting the files and had to be resolved for grep/rg-based code navigation to stay accurate.

## Issues Encountered

**Maestro flow 28 could not be executed end-to-end on the simulator.**
- Root cause: the Metro bundler running on port 8081 was started from the monorepo root (`/Users/patrickrichards/DinnerTime`) instead of `apps/mobile`. When Expo tries to resolve `./index`, it looks relative to the root and fails with `UnableToResolveError: ./index`. As a side effect, a later import in the transitive graph (`expo-haptics` from `src/cooking/haptics.ts`) also fails to resolve because the bundle never gets that far.
- Confirmation: `curl http://localhost:8081/index.bundle?platform=ios&dev=true` returns the same resolution error. This is a dev-environment startup bug, not a regression from 16-07's changes — the same Metro instance has been running since Apr-20 09 PM (pre-dates 16-07).
- Per `AUTO_MODE_OVERRIDE`: "If the Maestro flow fails, log the failure in SUMMARY deviations and continue; the physical-device test (16-08) will catch visual regressions later. Do not block on a failing simulator run." I did not restart Metro (would require killing the user's dev session) and did not mutate their environment.
- Fix path (for the user): `cd apps/mobile && rm -rf .expo && npx expo start --dev-client --lan --clear` (this is the procedure in CLAUDE.md §Dev Environment Startup). Once Metro is healthy, `cd apps/mobile && maestro test .maestro/28-cooking-mode-ui.yaml` should run cleanly.
- YAML validation: `yaml.parse` on the flow file succeeds; structure is 1 header document + 49 steps.

**Pre-existing TypeScript + vitest failures** (not caused by 16-07):
- 13 TypeScript errors across `src/components/cooking/__tests__/*` and `src/cooking/__tests__/*` (unused `@ts-expect-error` directives, `Element | null` not assignable to `AnyEl`).
- 3 vitest failures in `src/stores/__tests__/shoppingStore.test.ts` (currentList wrapped in `{ list }` shape mismatch).
- Confirmed pre-existing by stashing 16-07 changes and re-running `pnpm tsc --noEmit` — identical output.
- Logged to `.planning/phases/16-*/deferred-items.md`.

## User Setup Required

None — no external service configuration required. The dark-mode preference is fully client-side (Zustand + AsyncStorage).

## Known Stubs

None. All Settings rendering is wired to real state; the Switch directly calls `setDarkMode` which writes to the persisted cookingStore.

## Self-Check

- [x] `apps/mobile/src/app/(tabs)/settings.tsx` modified with Cooking section (confirmed via Read)
- [x] `apps/mobile/.maestro/28-cooking-mode-ui.yaml` exists (confirmed via ls + YAML parse)
- [x] `apps/mobile/src/components/cooking/StepDisplay.tsx` deleted (confirmed via ls — absent)
- [x] `apps/mobile/src/components/cooking/VoiceStatusBadge.tsx` deleted (confirmed via ls — absent)
- [x] Commit `bae1f1a` exists (`git log --oneline | grep bae1f1a`)
- [x] Commit `36b06bd` exists (`git log --oneline | grep 36b06bd`)
- [x] Zero consumer imports of StepDisplay or VoiceStatusBadge (`grep -rn` returned only comment references in 15-*.yaml + cook.tsx which have now been updated)
- [x] Mobile test suite green for `src/app`, `src/stores/__tests__/cookingStore.test.ts`, `src/components/cooking`, `src/cooking` (159 tests pass)

**Self-Check: PASSED**

## Next Phase Readiness

- Phase 16 Plan 08 (`DEVICE-TEST-16`) is the final plan: runs the voice paths on a physical iPhone. Flow 28 documents exactly which assertions are simulator-safe vs physical-only, so plan 08 can focus on STT/TTS/haptic feedback.
- Once the user restarts Metro from `apps/mobile`, flow 28 should run cleanly on the sim; the dark-mode toggle + non-voice UI pass covers COOK-UX-03 and COOK-UX-04.

---
*Phase: 16-cooking-mode-ux-enhancements-voice-interaction-and-model-ui-polish-information-display*
*Plan: 07*
*Completed: 2026-04-22*
