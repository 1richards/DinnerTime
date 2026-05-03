---
phase: quick/9-pre-launch-cooking-cleanup
plan: 9
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/app/recipes/[id]/cook.tsx
  - apps/mobile/src/components/cooking/StickyCookingHeader.tsx
  - apps/mobile/src/components/cooking/__tests__/StickyCookingHeader.test.tsx
  - apps/mobile/src/components/cooking/StepNavButtons.tsx
  - apps/mobile/src/stores/cookingStore.ts
  - apps/mobile/src/stores/__tests__/cookingStore.test.ts
  - apps/mobile/src/types/cooking.ts
  - apps/mobile/src/app/(tabs)/settings.tsx
  - apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts
autonomous: false
requirements:
  - QUICK-9-01  # Remove cooking dark-mode rendering path
  - QUICK-9-02  # Unwire on-device STT (useVoiceListener) from cook.tsx (keep scaffolding files)
  - QUICK-9-03  # Drop darkMode + voiceEnabled from cookingStore + types + tests, with safe rehydrate of old persisted blobs

must_haves:
  truths:
    - "Cooking screen renders in the light palette only — no dark background, no DARK_PALETTE constant left in cook.tsx"
    - "Tapping a step in cooking mode still SPEAKS the step (TTS via useStepSpeaker / ElevenLabs proxy / expo-speech fallback)"
    - "Cooking screen never calls useVoiceListener — the on-device STT module is not initialized during a cooking session"
    - "Settings screen renders without the 'Dark cooking mode' toggle and without any STT/voice-control toggle, while keeping the Cooking Voice picker (TTS)"
    - "Old AsyncStorage persisted state (with darkMode/voiceEnabled keys) does NOT crash store rehydration after this change"
    - "useVoiceListener.ts, useVoiceAmplitude.ts, VoiceWaveform.tsx, useVoiceAmplitude.test.ts still exist on disk untouched (backlog 999.1)"
  artifacts:
    - path: "apps/mobile/src/app/recipes/[id]/cook.tsx"
      provides: "Cooking screen with dark-mode + STT wiring removed; TTS preserved"
      forbids: ["DARK_PALETTE", "useVoiceListener", "voiceEnabled", "darkMode"]
    - path: "apps/mobile/src/stores/cookingStore.ts"
      provides: "Cooking store without darkMode/voiceEnabled fields; persist migration v1→v2 drops old keys"
      forbids: ["darkMode", "voiceEnabled", "setDarkMode"]
    - path: "apps/mobile/src/types/cooking.ts"
      provides: "CookingState type without darkMode/voiceEnabled"
      forbids: ["darkMode", "voiceEnabled"]
    - path: "apps/mobile/src/app/(tabs)/settings.tsx"
      provides: "Settings screen without dark-cooking-mode toggle; CookingVoiceSection (TTS) preserved"
      forbids: ["setDarkMode", "Dark cooking mode"]
    - path: "apps/mobile/src/cooking/useVoiceListener.ts"
      provides: "Untouched scaffolding file — kept on disk for backlog 999.1"
      preserved: true
    - path: "apps/mobile/src/cooking/useVoiceAmplitude.ts"
      provides: "Untouched scaffolding file — kept on disk for backlog 999.1"
      preserved: true
    - path: "apps/mobile/src/components/cooking/VoiceWaveform.tsx"
      provides: "Untouched scaffolding file — kept on disk for backlog 999.1"
      preserved: true
  key_links:
    - from: "cook.tsx"
      to: "useStepSpeaker"
      via: "import + invocation in CookScreen"
      verify: "stepSpeaker.speak/stop calls remain on Next/Back/Repeat/Done/Exit/jumpToStep"
    - from: "cookingStore persist middleware"
      to: "AsyncStorage 'dinnertime-cooking' blob"
      via: "version bump + migrate stripping unknown keys"
      verify: "rehydrate({ state: { darkMode: true, voiceEnabled: true }, version: 1 }) resolves without throwing and yields a clean state"
---

<objective>
Two surgical removals from the cooking surface so v1 ships clean:

1. Drop the cooking dark-mode rendering path entirely (cook.tsx + cookingStore + types + Settings toggle + tests).
2. Unwire on-device STT (`useVoiceListener` callsite) from cook.tsx and remove every `voiceEnabled` consumer (cook.tsx + StickyCookingHeader + StepNavButtons + cookingStore + types + tests).

KEEP all TTS playback (`useStepSpeaker`, `StopTTSButton`, ElevenLabs voice picker in Settings). KEEP scaffolding files for backlog 999.1: `useVoiceListener.ts`, `useVoiceAmplitude.ts`, `VoiceWaveform.tsx`, `useVoiceAmplitude.test.ts` — only the wiring in cook.tsx (and the StickyCookingHeader prop pass-through + Settings toggle) comes out.

Persisted-state safety: bump cookingStore persist `version: 1 → 2` with a `migrate` fn so old AsyncStorage blobs containing `darkMode: true` / `voiceEnabled: true` rehydrate cleanly.

Purpose: shrink launch QA surface area. Voice STT wasn't reliable in noisy kitchens; user dislikes the cooking dark-mode visual.
Output: a cooking screen that cooks (with TTS read-aloud) and nothing more. A settings screen with no dead toggles. A store that doesn't carry dead flags.
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@CLAUDE.md

@apps/mobile/src/app/recipes/[id]/cook.tsx
@apps/mobile/src/stores/cookingStore.ts
@apps/mobile/src/stores/__tests__/cookingStore.test.ts
@apps/mobile/src/types/cooking.ts
@apps/mobile/src/components/cooking/StickyCookingHeader.tsx
@apps/mobile/src/components/cooking/__tests__/StickyCookingHeader.test.tsx
@apps/mobile/src/components/cooking/StepNavButtons.tsx
@apps/mobile/src/app/(tabs)/settings.tsx
@apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase so no scavenger hunt is required. -->

CookingState (apps/mobile/src/types/cooking.ts) — currently has both `voiceEnabled: boolean` (line 28) AND `darkMode: boolean` (line 37). BOTH fields are removed in this plan.

CookingActions (apps/mobile/src/stores/cookingStore.ts):
- `setDarkMode: (on: boolean) => void` — REMOVE (line 22 declaration, line 163-165 impl).
- `setListening`, `setMicPermission` — KEEP (still used by useVoiceListener.ts which stays on disk).
- `setAssistantAnswer` — KEEP.
- All other actions (enter/exit/next/back/jumpToStep/repeat/addTimer/removeTimer/toggleIngredient/clearIngredientChecks/showCommandToast/clearCommandToast/startSession) — KEEP.

cookingStore persist config (lines 180-187):
- name: 'dinnertime-cooking'
- partialize: (state) => ({ darkMode: state.darkMode })  ← becomes (state) => ({}) after this plan
- version: 1  ← bump to 2
- ADD: migrate: (_persisted, _fromVersion) => ({}) so any v1 blob (with darkMode/voiceEnabled keys) maps to empty rehydrate.

cook.tsx destructure block (lines 122-144): currently includes `voiceEnabled`, `listening`, `darkMode`, `micPermission`. After removal:
- DROP: voiceEnabled, listening, darkMode, micPermission (the voice-banner block uses `listening` + `micPermission` only — that whole block is voice-gated and goes too).
- KEEP: stepIndex, timers, ttsEnabled, ingredientChecks, lastCommandToast, userNavigated, enter, exit, next, back, jumpToStep, repeat, addTimer, removeTimer, toggleIngredient, showCommandToast, clearCommandToast.

StickyCookingHeader props (apps/mobile/src/components/cooking/StickyCookingHeader.tsx):
```typescript
export interface StickyCookingHeaderProps {
  recipe: Recipe;
  timers: Timer[];
  voiceEnabled: boolean;     // REMOVE
  listening: boolean;         // REMOVE
  ttsSpeaking: boolean;       // KEEP
  onExit: () => void;
  onToggleVoice: () => void;  // REMOVE
  onStopTTS: () => void;      // KEEP
  onCancelTimer?: (id: string) => void;
}
```
After: `{ recipe, timers, ttsSpeaking, onExit, onStopTTS, onCancelTimer? }`. The body's `<View className="flex-row items-center gap-2">` action cluster (header lines 95-101) keeps `StopTTSButton` (gated on ttsSpeaking) and DROPS the `VoiceWaveform({...})` call. The `import { VoiceWaveform } from './VoiceWaveform'` (line 32) is removed.

StepNavButtons props (apps/mobile/src/components/cooking/StepNavButtons.tsx lines 30-51):
- `onToggleVoice?` and `voiceEnabled?` are OPTIONAL. After this plan, cook.tsx stops passing them; the `showVoice = typeof onToggleVoice === 'function'` (line 160) gate then renders nothing for voice. Component code itself can keep the optional props (zero-cost) OR have them removed for cleanliness — pick removal so the surface stays small.

useStepSpeaker (apps/mobile/src/cooking/useStepSpeaker.ts) — DO NOT MODIFY. It speaks via ElevenLabs/expo-speech, no STT coupling. Verified.

useVoiceListener (apps/mobile/src/cooking/useVoiceListener.ts) — DO NOT MODIFY (kept for backlog 999.1). It still references `useCookingStore.getState().setListening / setMicPermission / recipe / stepIndex / currentSessionId` — all of those store fields/actions remain after this plan.

settings.tsx — REMOVE: lines 35-36 (`darkMode` + `setDarkMode` selectors) and the entire dark-mode Switch row (lines 173-188 — the `<View ... accessibilityLabel="Dark cooking mode">` block). KEEP: the COOKING section header text + the `<CookingVoiceSection />` block (lines 190-197) — TTS picker survives.

ROADMAP backlog 999.1 (.planning/ROADMAP.md lines 30-47) already documents that the four scaffolding files stay on disk; do NOT delete them.

cookingStore.test.ts — currently has:
- `resetStore` seeds `voiceEnabled: true`, `darkMode: false` (lines 28, 34) — drop these keys.
- `initial state` test asserts `voiceEnabled === true`, `darkMode === false` (lines 54, 61) — drop both lines.
- `setDarkMode` describe block (lines 258-326) — DELETE the whole block (3 tests: set/reset, persists-with-partialize, rehydrates).
- ADD: a new persist-migration test that pre-seeds AsyncStorage with `{ state: { darkMode: true, voiceEnabled: true }, version: 1 }` then calls `persist.rehydrate()` and asserts the rehydrated state has NO darkMode/voiceEnabled keys leaking into the store and the store hasn't crashed.

cook.test.ts — line 85 seeds `voiceEnabled: true` in resetStore — drop it. No other darkMode/voiceEnabled refs in this test file.

StickyCookingHeader.test.tsx — `baseProps` (lines 34-43) carries `voiceEnabled: true`, `listening: false`, `onToggleVoice: vi.fn()`. After prop removal, drop those three keys from baseProps; the existing tests (title render, timer chip band, StopTTSButton conditional, no hardcoded hex) remain valid.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Remove darkMode + voiceEnabled from store, types, and tests (with persist migration v1→v2)</name>
  <files>apps/mobile/src/types/cooking.ts, apps/mobile/src/stores/cookingStore.ts, apps/mobile/src/stores/__tests__/cookingStore.test.ts</files>
  <behavior>
    Tests in cookingStore.test.ts after this task:
    - "initial state has expected defaults" no longer asserts on voiceEnabled or darkMode (those fields don't exist on the typed state).
    - The whole `describe('setDarkMode')` block (set/reset, persists-with-partialize, rehydrates-darkMode) is GONE.
    - NEW test: `describe('persist migration v1 → v2')` with one case:
        - Pre-seed AsyncStorage at key `dinnertime-cooking` with the legacy v1 blob:
          `{ state: { darkMode: true, voiceEnabled: true }, version: 1 }`.
        - Call `(useCookingStore as any).persist.rehydrate()`.
        - `await Promise.resolve()` twice (microtask flush, mirroring the previous persist test).
        - Assert: rehydrate did NOT throw; `useCookingStore.getState()` is a valid CookingState (recipe === null, stepIndex === 0, timers === [], ingredientChecks === {}); the state object has no `darkMode` or `voiceEnabled` keys (or, if TS allows them as `any`, they're undefined).
    - All other tests (enter, exit, next, back, jumpToStep, repeat, addTimer, removeTimer, setListening, setAssistantAnswer, toggleIngredient, clearIngredientChecks, showCommandToast/clearCommandToast, startSession) remain unchanged and still pass.
  </behavior>
  <action>
    1. **apps/mobile/src/types/cooking.ts** — Remove `voiceEnabled: boolean;` (line 28) and `darkMode: boolean;` (line 36-37 + its preceding `// Phase 16 additions` JSDoc on darkMode). Keep `ttsEnabled`, `listening`, and everything else. The "Phase 16 additions" comment header can stay (it now scopes only `ingredientChecks` / `lastCommandToast` / `currentSessionId` / `micPermission` / `userNavigated`).

    2. **apps/mobile/src/stores/cookingStore.ts** —
       - In `CookingActions` (lines 7-26): delete `setDarkMode: (on: boolean) => void;`.
       - In `initialState` (lines 28-42): delete `voiceEnabled: false,` and `darkMode: false,`.
       - In `enter` action (lines 58-73): delete the `voiceEnabled: false,` line from the `set({...})` call AND update the doc-comment that says "voiceEnabled resets to false every session…" — replace that comment paragraph with: `// userNavigated resets so the initial scroll position holds at the top (ingredients visible) until the user taps Back/Next.`
       - Delete the entire `setDarkMode` action body (lines 163-165 including the surrounding comment if any).
       - In the persist config (lines 180-187):
         - Change `partialize: (state) => ({ darkMode: state.darkMode })` to `partialize: () => ({})`.
         - Change `version: 1` to `version: 2`.
         - Add a `migrate` field BEFORE the closing `}`: `migrate: (_persistedState, _fromVersion) => ({})`. This drops legacy `darkMode` / `voiceEnabled` keys silently — old blobs hydrate to empty, which is correct because neither flag is reachable anymore.
       - Update the partialize comment from "Only persist the cooking-mode preferences (dark mode)…" to: `// Nothing persists across cooking sessions anymore — both cooking-mode preferences (darkMode, voiceEnabled) were removed pre-launch. Persist config is kept (vs. dropped entirely) so the v1→v2 migrate runs on existing installs.`

    3. **apps/mobile/src/stores/__tests__/cookingStore.test.ts** —
       - In `resetStore()` (lines 24-38): delete `voiceEnabled: true,` (line 28) and `darkMode: false,` (line 34).
       - In `describe('initial state') > it('has expected defaults')` (lines 49-65): delete `expect(s.voiceEnabled).toBe(true);` and `expect(s.darkMode).toBe(false);` lines.
       - DELETE the entire `describe('setDarkMode', () => { ... })` block (lines 258-326 — three `it()` blocks total: sets-and-resets, persists-with-partialize, rehydrates-from-storage).
       - ADD a new describe block (placed where `setDarkMode` used to be):
         ```ts
         describe('persist migration v1 → v2', () => {
           it('rehydrates legacy v1 blob (darkMode + voiceEnabled) without crashing and drops the unknown keys', async () => {
             // Pre-populate the AsyncStorage shim with a v1-shaped blob.
             await (AsyncStorage as unknown as {
               setItem: (k: string, v: string) => Promise<void>;
             }).setItem(
               'dinnertime-cooking',
               JSON.stringify({
                 state: { darkMode: true, voiceEnabled: true },
                 version: 1,
               }),
             );

             // Force re-hydrate.
             await (
               useCookingStore as unknown as {
                 persist: { rehydrate: () => Promise<void> };
               }
             ).persist.rehydrate();

             const s = useCookingStore.getState() as Record<string, unknown>;
             // Migration drops legacy keys — they should be undefined on the
             // rehydrated state (initialState shape doesn't include them).
             expect(s.darkMode).toBeUndefined();
             expect(s.voiceEnabled).toBeUndefined();
             // Non-persisted slices remain at their initial values.
             expect(s.recipe).toBeNull();
             expect(s.stepIndex).toBe(0);
             expect(s.timers).toEqual([]);
             expect(s.ingredientChecks).toEqual({});
           });
         });
         ```

    Run `pnpm vitest run apps/mobile/src/stores/__tests__/cookingStore.test.ts` from repo root (or `cd apps/mobile && pnpm vitest run src/stores/__tests__/cookingStore.test.ts`). Must be all-green. TypeScript compile (`pnpm tsc -p apps/mobile --noEmit` or whatever the project uses) must pass — no dangling refs to `voiceEnabled` / `darkMode` / `setDarkMode` on `CookingState` / `CookingActions`. Note: cook.tsx, StickyCookingHeader, settings.tsx still reference these — those are fixed in Task 2; expect cross-file TS errors at the END of Task 1 and clear them in Task 2.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm vitest run src/stores/__tests__/cookingStore.test.ts</automated>
  </verify>
  <done>
    - types/cooking.ts no longer mentions `voiceEnabled` or `darkMode`.
    - cookingStore.ts: `setDarkMode` gone, `initialState` carries no `voiceEnabled`/`darkMode`, persist `version: 2` + `migrate: () => ({})` + `partialize: () => ({})`.
    - cookingStore.test.ts: `setDarkMode` describe gone, `resetStore` + initial-state test free of those keys, new persist-migration test green.
    - `pnpm vitest run src/stores/__tests__/cookingStore.test.ts` exits 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Strip darkMode + STT wiring from cook.tsx, StickyCookingHeader, StepNavButtons, settings.tsx (and update affected tests)</name>
  <files>apps/mobile/src/app/recipes/[id]/cook.tsx, apps/mobile/src/components/cooking/StickyCookingHeader.tsx, apps/mobile/src/components/cooking/__tests__/StickyCookingHeader.test.tsx, apps/mobile/src/components/cooking/StepNavButtons.tsx, apps/mobile/src/app/(tabs)/settings.tsx, apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts</files>
  <behavior>
    After this task:
    - StickyCookingHeader.test.tsx existing 4 tests (title render, timer band conditional, StopTTSButton conditional, Phase-19 tokens only) all pass with the slimmed-down baseProps `{ recipe, timers, ttsSpeaking, onExit, onStopTTS }`.
    - cook.test.ts unchanged behavior (transcript dispatch + step nav store actions still pass) with `voiceEnabled: true` removed from its resetStore seed.
    - `pnpm vitest run` across `apps/mobile` is fully green.
    - TypeScript compile is clean — no dangling `voiceEnabled` / `darkMode` references anywhere.
    - useVoiceListener.ts, useVoiceAmplitude.ts, VoiceWaveform.tsx, VoiceWaveform.test.tsx, useVoiceAmplitude.test.ts files are all UNCHANGED on disk (verify via git status — they should not appear in the diff).
  </behavior>
  <action>
    1. **apps/mobile/src/app/recipes/[id]/cook.tsx** — Surgical removals:

       (a) **Imports:** Delete `import { useVoiceListener } from '../../../cooking/useVoiceListener';` (line 62). Keep `useStepSpeaker`. The `colors` import (line 92) is still used (toast/banner code paths drop with the voice banner; double-check `colors` is still referenced elsewhere — `colors.brand`, `colors.destructive`, `colors.bg`, `colors.textSecondary`, `colors.textTertiary`. After dropping the voice banner, `colors.bg` is only used in `rootStyle` which goes away too. Keep the `colors` import IF any usage remains; otherwise drop it. Concrete check: search the post-edit file for `colors\.` — if zero hits, drop the import.).

       (b) **DARK_PALETTE constant block** (lines 94-105): DELETE entirely, including the leading comment block.

       (c) **Top-of-file JSDoc** (lines 1-50): in the multi-line header comment, delete the bullet `Root wrapper SafeAreaView + inline `rootStyle` that applies a dark- palette override when `cookingStore.darkMode === true`. Scoped to cooking only per CONTEXT D-03.` (lines 10-13). Replace the bullet with: `Root wrapper SafeAreaView with no theme override — light palette only.`

       (d) **Destructure block** (lines 121-144): drop `voiceEnabled,`, `listening,`, `darkMode,`, `micPermission,` from the `const { ... } = cooking;` destructure.

       (e) **Hints memo** (lines 239-252): KEEP — it's only consumed by useVoiceListener which is going away. Remove the hints memo and its consumer-or-fallback list. Specifically: DELETE lines 238-252 (the entire `const hints = useMemo<string[]>(...)` block and its preceding `// --------------------------------------------------- Voice-recognition` comment).

       (f) **onTranscript callback** (lines 384-432): DELETE the entire `const onTranscript = useCallback(...)` block, including its useCallback deps. It's only consumed by useVoiceListener. The closures it references (next, back, repeat, addTimer, handleAsk, showCommandToast, stepSpeaker, recipe?.id, stepIndex) all remain in use elsewhere — no orphan-import worry.

       (g) **useVoiceListener invocation** (line 434): DELETE.

       (h) **Dark-mode palette comment + style derivation** (lines 543-556): DELETE the comment block AND `const rootStyle = …` AND `const scrollOverrideStyle = …`.

       (i) **Loading state** (lines 559-575): replace `<SafeAreaView ... style={rootStyle} edges={['top', 'bottom']}>` with `<SafeAreaView className="flex-1 items-center justify-center bg-bg" edges={['top', 'bottom']}>` (drop the `style={rootStyle}` prop — Tailwind `bg-bg` already paints the light bg). Inside, replace `<Text ... style={darkMode ? { color: DARK_PALETTE.textSecondary } : undefined}>` with `<Text className="text-body text-text-secondary">Loading recipe…</Text>` (drop the `style` prop).

       (j) **Render root** (line 578-582): drop `style={rootStyle}`. Keep `className="flex-1"` + `edges={['top', 'bottom']}`. Add `bg-bg` to the className → `className="flex-1 bg-bg"`.

       (k) **StickyCookingHeader call** (lines 588-604): drop the `voiceEnabled={voiceEnabled}`, `listening={listening}`, and `onToggleVoice={() => useCookingStore.setState({ voiceEnabled: !voiceEnabled })}` props. Keep `recipe`, `timers`, `ttsSpeaking={isSpeaking}`, `onExit={handleExit}`, `onStopTTS={...}`, `onCancelTimer={removeTimer}`.

       (l) **Voice-status banner blocks** (lines 614-658): DELETE the entire `{voiceEnabled && micPermission === 'denied' ? (...) : voiceEnabled ? (...) : null}` ternary including its leading comment block. After this delete, the next block is the `<View className="flex-1" style={scrollOverrideStyle}>` — change to `<View className="flex-1">` (drop the inline style).

       (m) **StepNavButtons call** (lines 692-732): drop the `onToggleVoice={...}` and `voiceEnabled={voiceEnabled}` props. Keep onBack/onRepeat/onNext/disableBack/disableNext/onDone.

       (n) **`Linking` import + `Pressable` import** (line 52): if `Linking` is now unused (it was only used in the mic-blocked banner that got deleted), drop it from the `react-native` import. Same for `Pressable` if unused after edits — currently `Pressable` is also used by the voice banner only (not used elsewhere in cook.tsx render), so verify by grep and drop if zero hits remain. Same check for `SymbolIcon` import (line 80) — only used in the voice banner; if zero remaining hits, drop.

    2. **apps/mobile/src/components/cooking/StickyCookingHeader.tsx** —
       - Drop `import { VoiceWaveform } from './VoiceWaveform';` (line 32).
       - In `StickyCookingHeaderProps` (lines 37-48): remove `voiceEnabled: boolean;`, `listening: boolean;`, `onToggleVoice: () => void;`.
       - In the function signature destructure (lines 50-60): remove `voiceEnabled`, `listening`, `onToggleVoice`.
       - In the render (lines 95-101): drop the `VoiceWaveform({ listening, enabled: voiceEnabled, onToggle: onToggleVoice })` call. The action cluster `<View>` then only contains the conditional `StopTTSButton`. If StopTTSButton is the sole child of that `<View>`, the wrapper `<View className="flex-row items-center gap-2">` is no longer required — collapse it to render `{ttsSpeaking ? StopTTSButton({ onPress: onStopTTS }) : null}` directly inline (or keep the wrapper for layout consistency — small hint: keep the wrapper, it preserves the right-side reservation slot so the title doesn't reflow when TTS toggles).
       - Update the file-header JSDoc: drop the `voiceEnabled, listening` mentions in the "Props shape" line (lines 22-25). New shape: `{ recipe, timers, ttsSpeaking, onExit, onStopTTS, onCancelTimer? }`. Also delete the "VoiceWaveform" reference in the rendering-note paragraph (lines 18-22) — replace with: `Sub-components (TimerBar, StopTTSButton) are invoked as functions rather than JSX elements so the unit-test tree-flattener (which only walks props.children) sees their descendant nodes.`
       - Top of file JSDoc layout description (lines 11-15): change "Base band: 64pt tall (`h-16`), row with Exit (left), recipe title (centred, 1-line truncate), action cluster (right: optional Stop reading, always Voice waveform)." to: "Base band: 64pt tall (`h-16`), row with Exit (left), recipe title (centred, 1-line truncate), action cluster (right: optional Stop reading)."
       - §Color comment (line 14-15): change "Accent color (`brand`) is RESERVED for the waveform mic fill + StopTTSButton, never for the header background" to "Accent color (`brand`) is RESERVED for StopTTSButton, never for the header background".

    3. **apps/mobile/src/components/cooking/__tests__/StickyCookingHeader.test.tsx** —
       In `baseProps` (lines 34-43): drop `voiceEnabled: true,`, `listening: false,`, `onToggleVoice: vi.fn(),`. New shape: `{ recipe: TEST_RECIPE, timers: [], ttsSpeaking: false, onExit: vi.fn(), onStopTTS: vi.fn() }`. The four existing tests don't assert on the dropped props, so they still pass.

    4. **apps/mobile/src/components/cooking/StepNavButtons.tsx** —
       - In `StepNavButtonsProps` (lines 30-51): remove `onToggleVoice?: () => void;` and `voiceEnabled?: boolean;` and the surrounding JSDoc paragraph (lines 42-50: `Voice toggle: cooking mode no longer auto-enables the mic. The user opts in via this button. …`).
       - In the function signature destructure (lines 149-158): remove `onToggleVoice`, `voiceEnabled`.
       - Body (line 160): remove `const showVoice = typeof onToggleVoice === 'function';`.
       - Render (lines 180-188): remove the `{showVoice ? (<NavButton label="Voice" .../>) : null}` block entirely.
       - Verify StepNavButtons.test.tsx still passes — it doesn't reference voice props per Wave 0 contract; if it does, drop those refs surgically.

    5. **apps/mobile/src/app/(tabs)/settings.tsx** —
       - Lines 35-36: delete `const darkMode = useCookingStore((s) => s.darkMode);` and `const setDarkMode = useCookingStore((s) => s.setDarkMode);`.
       - Lines 166-188: delete the entire dark-mode toggle `<View>` block, INCLUDING its leading comment (`{/* Phase 16-07: Cooking preferences — dark-mode toggle ... */}`). KEEP the `<Text className="text-label text-text-secondary uppercase mb-3">COOKING</Text>` header AND the `<CookingVoiceSection />` block (lines 190-197) — TTS picker survives.
       - The `<View className="mt-4">` wrapping `CookingVoiceSection` (lines 194-196) was added because the dark-mode row used `mb-3`. After removing dark-mode, change `<View className="mt-4">` to `<View>` (no top margin needed since the section header's `mb-3` already provides spacing) OR simpler: drop the wrapping View entirely and render `<CookingVoiceSection />` directly under the header.
       - Verify the `useCookingStore` import (line 7) is still used elsewhere in this file. Grep: after the edit it's not — drop the import.
       - Verify `Switch` (line 2 react-native import) is still used elsewhere — it IS (planFocusBannerEnabled at line 249, planCardDensity at line 273). Keep.

    6. **apps/mobile/src/app/recipes/[id]/__tests__/cook.test.ts** —
       Line 85 (inside `beforeEach`'s `useCookingStore.setState({...})`): delete `voiceEnabled: true,`. Other lines unchanged.

    7. **DO NOT TOUCH** these files (verify via `git status` they don't appear in the diff):
       - apps/mobile/src/cooking/useVoiceListener.ts
       - apps/mobile/src/cooking/useVoiceAmplitude.ts
       - apps/mobile/src/cooking/__tests__/useVoiceAmplitude.test.ts
       - apps/mobile/src/components/cooking/VoiceWaveform.tsx
       - apps/mobile/src/components/cooking/__tests__/VoiceWaveform.test.tsx
       - apps/mobile/src/cooking/useStepSpeaker.ts (TTS — no STT coupling, verified)
       - apps/mobile/src/components/cooking/StopTTSButton.tsx (no STT coupling, verified)

    Run `pnpm vitest run` from `apps/mobile` — full suite. Must be all-green. Run `pnpm tsc --noEmit` (or the project's typecheck command — check apps/mobile/package.json scripts for `typecheck` / `tsc`) — must be clean.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm vitest run && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>
    - cook.tsx: no occurrence of `darkMode`, `DARK_PALETTE`, `useVoiceListener`, `voiceEnabled`, `onTranscript`, `hints` (the voice-recognition memo). Mic banner gone. StepNavButtons + StickyCookingHeader called without voice props. TTS playback paths (stepSpeaker.speak/stop) untouched.
    - StickyCookingHeader.tsx: no `VoiceWaveform` import, no `voiceEnabled` / `listening` / `onToggleVoice` props.
    - StickyCookingHeader.test.tsx: baseProps slim; 4 tests still green.
    - StepNavButtons.tsx: no `voiceEnabled` / `onToggleVoice` props or the voice NavButton.
    - settings.tsx: no `darkMode` / `setDarkMode` selectors, no dark-mode Switch row, no `useCookingStore` import; `CookingVoiceSection` still renders under the COOKING header.
    - cook.test.ts: resetStore no longer seeds `voiceEnabled`.
    - All four scaffolding files (useVoiceListener.ts, useVoiceAmplitude.ts, VoiceWaveform.tsx, useVoiceAmplitude.test.ts) and VoiceWaveform.test.tsx are NOT modified.
    - `pnpm vitest run` green; `pnpm exec tsc --noEmit` exits 0.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human verify on iOS simulator — light palette, TTS speaks, no mic, settings clean</name>
  <files>(verification only — no files modified)</files>
  <action>Pause execution and surface the verification steps below to the user. Resume only on explicit "approved" signal or follow-up issue report.</action>
  <verify>
    <automated>Manual checkpoint — see how-to-verify steps below; resume signal gates progression.</automated>
  </verify>
  <done>User types "approved" after exercising the verification steps on the iOS simulator (or reports an issue that blocks approval).</done>
  <what-built>
    Cooking dark-mode rendering path is gone — cooking screen renders in the light palette only. On-device STT is unwired from cook.tsx — useVoiceListener never instantiates during a cooking session. TTS read-aloud (ElevenLabs proxy + expo-speech fallback) is preserved. Settings still has the Cooking Voice picker but no dark-mode toggle and no voice-control toggle. Old persisted state with darkMode/voiceEnabled silently migrates to empty.
  </what-built>
  <how-to-verify>
    1. **Boot the simulator + dev client + Metro:**
       ```bash
       cd /Users/patrickrichards/DinnerTime/apps/mobile
       xcrun simctl boot "iPhone 17 Pro" || true
       open -a Simulator
       xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
       npx expo start --dev-client --lan --clear
       ```
       The `--clear` flag is mandatory: we changed source files inside the bundle.

    2. **Backend up:**
       ```bash
       cd /Users/patrickrichards/DinnerTime
       set -a && source .env && set +a && cd packages/server && pnpm dev
       ```

    3. **Cooking screen — light palette only:**
       - Open the app, sign in, navigate to any recipe in the Recipe Box, tap Cook.
       - VERIFY: Background is the warm-white light palette (NOT dark `#141210`). Title, ingredients, step body all readable on light bg.
       - Tap Next, Back, Repeat — VERIFY: each step transitions still on the light bg.
       - Open Settings — VERIFY: there is NO "Dark cooking mode" toggle row under the COOKING section header. The Cooking Voice picker (Daniel / Oliver / etc.) IS still visible.
       - There should be NO toggle for "Voice control during cooking" anywhere.

    4. **TTS still speaks:**
       - Back in the cook screen, tap Next to advance one step. VERIFY: the step is read aloud via ElevenLabs (or expo-speech fallback if backend voice route is down).
       - Tap the Stop reading button (stop.circle icon) in the header — VERIFY: TTS halts within ~200ms.

    5. **No mic banner / no STT:**
       - Cook screen shows NO "Listening — say next/back/repeat…" banner near the top (this used to render whenever `voiceEnabled` was true).
       - Cook screen shows NO mic button in the bottom nav row (StepNavButtons used to render a mic toggle when voice was wired).
       - Microphone permission prompt does NOT trigger when entering cooking mode (it used to fire from useVoiceListener's startListening). Confirm by going to Settings.app → DinnerTime → Microphone — if access wasn't already granted, this entry should NOT exist (or stays at "Never asked").

    6. **Persisted-state migration smoke test:**
       - In an Xcode-attached or detox-attached scenario this would be scripted; for manual check:
         - On a build that previously had `darkMode: true` persisted (i.e. the user had toggled it on before), open the app fresh post-install.
         - VERIFY: app does NOT crash on launch. Cook screen still renders light. (The fact that the v1→v2 migration runs is implicit — the absence of a crash + light bg confirms it.)
       - For a clean simulator install this is a no-op; just confirm app launches cleanly.

    7. **Maestro smoke (if a cooking flow exists):**
       ```bash
       cd /Users/patrickrichards/DinnerTime/apps/mobile
       ls .maestro/ | grep -i cook
       # If a cook-related yaml exists:
       maestro test .maestro/<cooking-flow>.yaml
       ```
       If no cooking-specific maestro flow exists, run the existing smoke flow to confirm Settings + nav still load:
       ```bash
       maestro test .maestro/smoke.yaml
       ```

    8. **Scaffolding files preserved:**
       ```bash
       cd /Users/patrickrichards/DinnerTime
       git status apps/mobile/src/cooking/useVoiceListener.ts \
                  apps/mobile/src/cooking/useVoiceAmplitude.ts \
                  apps/mobile/src/cooking/__tests__/useVoiceAmplitude.test.ts \
                  apps/mobile/src/components/cooking/VoiceWaveform.tsx \
                  apps/mobile/src/components/cooking/__tests__/VoiceWaveform.test.tsx
       ```
       VERIFY: each file shows as unchanged (no `M` next to it). Backlog 999.1 still has its scaffolding.

    Expected outcome: cook screen is light, speaks aloud, has no mic affordance, no banner, no listening prompt; settings has no dark-mode toggle but keeps the voice picker; old persisted blobs don't crash; scaffolding files untouched.
  </how-to-verify>
  <resume-signal>Type "approved" to continue, or describe any issue (light-mode check failed / TTS broke / mic prompt fired / app crashed on launch / scaffolding file modified).</resume-signal>
</task>

</tasks>

<verification>
- All vitest suites in `apps/mobile` are green.
- `pnpm exec tsc --noEmit` clean across `apps/mobile`.
- No occurrences of `darkMode`, `DARK_PALETTE`, `useVoiceListener`, `voiceEnabled` in: cook.tsx, StickyCookingHeader.tsx, StepNavButtons.tsx, settings.tsx, cookingStore.ts, types/cooking.ts, cookingStore.test.ts (other than the one persist-migration test that intentionally seeds the legacy keys), cook.test.ts, StickyCookingHeader.test.tsx.
- Files preserved on disk (verified via `git status`): useVoiceListener.ts, useVoiceAmplitude.ts, VoiceWaveform.tsx, useVoiceAmplitude.test.ts, VoiceWaveform.test.tsx.
- Cooking screen renders light palette only on simulator. Step Next reads aloud (TTS works). No mic permission prompt on entering cooking mode. Settings shows Cooking Voice picker but no dark-mode toggle and no voice-control toggle.
- Migrating an old AsyncStorage blob `{state: {darkMode: true, voiceEnabled: true}, version: 1}` does NOT crash rehydrate (covered by the new unit test in Task 1).
</verification>

<success_criteria>
- Cooking dark mode is gone (no constant, no style, no toggle, no field on the store, no key persisted).
- On-device STT is unwired from cook.tsx — `useVoiceListener` is never invoked, mic permission is never requested by the cooking screen, no voice banner renders.
- TTS read-aloud during cooking still works (ElevenLabs primary, expo-speech fallback).
- Old persisted state blobs containing the dropped keys rehydrate cleanly via persist v1→v2 migration.
- Backlog 999.1 scaffolding files (useVoiceListener.ts, useVoiceAmplitude.ts, VoiceWaveform.tsx, plus their tests) are unchanged on disk.
- `pnpm vitest run` and `pnpm exec tsc --noEmit` both pass for `apps/mobile`.
</success_criteria>

<output>
After Task 2 completes (and the human-verify checkpoint approves), create `.planning/quick/9-pre-launch-cooking-cleanup-remove-dark-m/9-SUMMARY.md` documenting:
- Files modified vs. files preserved
- The persist-migration approach chosen (v1→v2 with `migrate: () => ({})`)
- Cross-references to ROADMAP backlog 999.1 (the kept scaffolding files)
- Confirmation that TTS pipeline is unaffected
</output>
