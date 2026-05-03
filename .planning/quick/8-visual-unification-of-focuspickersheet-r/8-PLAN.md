---
phase: quick-8
plan: 8
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/mobile/src/components/ui/PickerSheet.tsx
  - apps/mobile/src/components/ui/OptionCard.tsx
  - apps/mobile/src/components/ui/__tests__/PickerSheet.test.tsx
  - apps/mobile/src/components/ui/__tests__/OptionCard.test.tsx
  - apps/mobile/src/components/plan/FocusPickerSheet.tsx
  - apps/mobile/src/components/recipes/RemixSheet.tsx
autonomous: true
requirements:
  - QUICK-8-01-shared-pickersheet-shell
  - QUICK-8-02-shared-optioncard-primitive
  - QUICK-8-03-focus-refactor-no-alertprompt
  - QUICK-8-04-remix-mode-picker-2col-parity
must_haves:
  truths:
    - "FocusPickerSheet and RemixSheet's mode picker share the same modal shell, header structure, and tile primitive"
    - "Both pickers render their options on a 2-column grid via the new OptionCard primitive"
    - "Selecting Custom in FocusPickerSheet captures free-form text inline (no Alert.prompt) using the same TextInput pattern as Remix's customInputRow"
    - "FocusBanner.handleSelect contract is unchanged: onSelect(theme: string|null) → Promise<void>; sheet stays open until parent toggles visible=false"
    - "RemixSheet still exports RemixSource and RemixSheet with identical signatures; Surprise me hero card + customInstructions TextInput + nested remix flow all still work"
    - "FocusPickerSheet drops the per-card 'examples' italic line"
    - "Both screens render with no new design tokens — only colors.brand / surface / textPrimary / textSecondary / border / success / warning / destructive from existing tokens"
    - "PickerSheet + OptionCard unit tests pass; existing plan + recipes test suites still pass"
    - "Maestro screenshots prove visual parity: focus picker and remix mode picker both render as 2-col grids of OptionCards with matching headers"
  artifacts:
    - path: "apps/mobile/src/components/ui/PickerSheet.tsx"
      provides: "Shared modal shell — handle, header (kicker/title/subtitle/close), heroSlot, body, footerSlot"
      exports: ["PickerSheet"]
      min_lines: 80
    - path: "apps/mobile/src/components/ui/OptionCard.tsx"
      provides: "2-col grid tile primitive — tinted icon chip, title, optional sub, selected/disabled/dashed-custom variants"
      exports: ["OptionCard"]
      min_lines: 80
    - path: "apps/mobile/src/components/ui/__tests__/PickerSheet.test.tsx"
      provides: "Unit tests — header rendering, slot composition, close button, Modal visibility binding"
      min_lines: 60
    - path: "apps/mobile/src/components/ui/__tests__/OptionCard.test.tsx"
      provides: "Unit tests — default/selected/disabled/dashed variants, press handler, tint resolution, optional sub line"
      min_lines: 60
    - path: "apps/mobile/src/components/plan/FocusPickerSheet.tsx"
      provides: "Refactored to consume PickerSheet + OptionCard 2-col grid; inline custom-input row replaces Alert.prompt; examples line dropped"
      contains: "PickerSheet"
    - path: "apps/mobile/src/components/recipes/RemixSheet.tsx"
      provides: "Mode picker section refactored to consume PickerSheet + OptionCard on a 2-col grid; Surprise me hero retained; customInstructions row retained"
      contains: "PickerSheet"
  key_links:
    - from: "apps/mobile/src/components/plan/FocusPickerSheet.tsx"
      to: "apps/mobile/src/components/ui/PickerSheet.tsx"
      via: "import + render"
      pattern: "from '\\.\\./ui/PickerSheet'"
    - from: "apps/mobile/src/components/plan/FocusPickerSheet.tsx"
      to: "apps/mobile/src/components/ui/OptionCard.tsx"
      via: "import + render in 2-col grid"
      pattern: "from '\\.\\./ui/OptionCard'"
    - from: "apps/mobile/src/components/recipes/RemixSheet.tsx"
      to: "apps/mobile/src/components/ui/PickerSheet.tsx"
      via: "import + render mode picker section"
      pattern: "from '\\.\\./ui/PickerSheet'"
    - from: "apps/mobile/src/components/recipes/RemixSheet.tsx"
      to: "apps/mobile/src/components/ui/OptionCard.tsx"
      via: "import + render GRID_MODES.map"
      pattern: "from '\\.\\./ui/OptionCard'"
    - from: "apps/mobile/src/components/plan/FocusBanner.tsx"
      to: "apps/mobile/src/components/plan/FocusPickerSheet.tsx"
      via: "FocusPickerSheet props (visible / currentTheme / onSelect / onClose) — unchanged"
      pattern: "FocusPickerSheet"
---

<objective>
Visually unify the two "pick a steering option for the AI" surfaces — `FocusPickerSheet` (weekly skill focus) and `RemixSheet`'s mode picker (recipe variation modes) — by extracting a shared `PickerSheet` shell + `OptionCard` primitive and rendering both screens through them on a 2-column grid.

Purpose: The two screens are siblings in product role but render in inconsistent visual languages today (Focus = vertical list of tall cards w/ italic examples, Remix = hero + 3-col tile grid). After this plan they read as a coherent family.

Output:
- New `PickerSheet` and `OptionCard` primitives + unit tests (`apps/mobile/src/components/ui/`)
- Refactored `FocusPickerSheet` (drops examples line, drops `Alert.prompt` for inline custom card)
- Refactored `RemixSheet` mode picker (2-col grid for parity with Focus, hero + custom-instructions retained)
- Maestro UAT screenshots (focus picker + remix mode picker) saved to `/tmp/` for visual review
</objective>

<execution_context>
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/workflows/execute-plan.md
@/Users/patrickrichards/DinnerTime/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@apps/mobile/src/components/plan/FocusPickerSheet.tsx
@apps/mobile/src/components/recipes/RemixSheet.tsx
@apps/mobile/src/components/plan/FocusBanner.tsx
@apps/mobile/src/components/ui/SymbolIcon.tsx
@apps/mobile/src/components/ui/Button.tsx
@apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx
@apps/mobile/src/design/tokens.ts
@apps/mobile/.maestro/qa-remix-grid.yaml
@apps/mobile/.maestro/scripts/uat.sh

<interfaces>
<!-- Tokens (apps/mobile/src/design/tokens.ts) — use these, do NOT introduce new colors -->
```typescript
colors.brand        // '#C65D3A' — kicker tint, selected border
colors.surface      // '#FFFFFF' — card surface
colors.surfaceSubtle // '#F1EAE0' — close-button bg, hairline border
colors.bg           // '#FAF7F2' — sheet background (Focus uses '#FFFBF5'; switch to bg for parity)
colors.textPrimary  // '#1C1917' — title color
colors.textSecondary // '#5C4D3D' — subtitle / sub copy
colors.textTertiary // '#A89178' — placeholder + disabled
colors.success      // '#16A34A' — checkmark on selected
colors.warning      // '#D97706' — braising / harder / decadent tint
colors.destructive  // '#DC2626' — wok tint
colors.border       // '#E5D9CA' — surface borders
colors.borderSubtle // '#F1EAE0' — header hairline
```
NOTE: Tile selected backgrounds use the documented `#FFF4E6` cream — that is brand at low opacity; keep it inline in styles (the existing FocusPickerSheet + Remix code already uses it; this is intentional pre-existing usage and not a new token).

<!-- SymbolIcon (apps/mobile/src/components/ui/SymbolIcon.tsx) -->
```typescript
type SymbolIconSize = 'body' | 'action' | 'title' | 'largeTitle';
// body=17, action=26, title=22, largeTitle=34
function SymbolIcon(props: { name: SymbolViewProps['name']; size?: SymbolIconSize | number; weight?: 'regular' | 'semibold'; tintColor?: string }): JSX.Element;
```

<!-- FocusBanner caller contract (must NOT change) -->
```typescript
<FocusPickerSheet
  visible={pickerVisible}
  currentTheme={theme}            // string | null
  onSelect={handleSelect}         // (theme: string | null) => Promise<void>
  onClose={() => setPickerVisible(false)}
/>
// handleSelect awaits PATCH then opens Alert.alert; the SHEET STAYS OPEN
// (parent flips `visible=false` later). DO NOT auto-close on select.
```

<!-- RemixSheet exports (must NOT change) -->
```typescript
export type RemixSource =
  | { kind: 'saved'; recipeId: string }
  | { kind: 'inline'; context: VariationContext };

export function RemixSheet(props: {
  visible: boolean;
  recipeTitle: string;
  source: RemixSource;
  baseForSave?: { title: string; description?: string | null; ingredients?: Array<string | BaseIngredient>; steps?: string[]; total_time_minutes?: number | null };
  onClose: () => void;
}): JSX.Element;
```

<!-- Test pattern (mirrors apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx) -->
```typescript
import { describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_p: unknown) => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));
// Then call the component as a plain function: const el = MyComponent({ ... });
// Assert el!.type and el!.props directly. No React Testing Library.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build PickerSheet + OptionCard primitives + unit tests</name>
  <files>
    apps/mobile/src/components/ui/PickerSheet.tsx,
    apps/mobile/src/components/ui/OptionCard.tsx,
    apps/mobile/src/components/ui/__tests__/PickerSheet.test.tsx,
    apps/mobile/src/components/ui/__tests__/OptionCard.test.tsx
  </files>
  <behavior>
    PickerSheet:
    - Renders a `Modal` with `animationType="slide"` and `presentationStyle="pageSheet"`
    - When `visible=false`, the underlying Modal's `visible` prop is `false` (test by inspecting element tree)
    - Renders kicker text, title text, and (optional) subtitle text from props
    - Renders a 36pt circular close button with an `xmark` SymbolIcon; `onClose` fires when pressed
    - Renders the 12×4pt drag-indicator pill above the header
    - Renders `heroSlot` (if provided) above `children`
    - Renders `footerSlot` (if provided) below `children`
    - Applies `colors.bg` to the sheet container and `colors.surfaceSubtle` to the close-button bg

    OptionCard:
    - Default variant: white surface, rounded-16, 1pt `colors.border` hairline, soft shadow, vertical stack of (icon chip 40pt, title, optional sub)
    - Tint prop drives icon chip background (`${tint}1A`) and SymbolIcon tintColor
    - When `selected=true`: applies `#FFF4E6` background + 2pt `colors.brand` border + renders bottom-right `checkmark.circle.fill` overlay (in `colors.success`)
    - When `disabled=true`: opacity 0.45, Pressable's `disabled` prop is true
    - When `variant="custom"`: dashed border (`borderStyle: 'dashed'`), no shadow
    - `onPress` fires when pressed and not disabled
    - `sub` prop is optional — if absent, no sub line is rendered
    - Title uses `numberOfLines={1}` + `adjustsFontSizeToFit` + `minimumFontScale={0.9}`
    - Sub uses `numberOfLines={1}` + ellipsize tail

    Test cases (~6 each, mirroring SymbolIcon.test.tsx pattern — direct function call, no RTL):

    PickerSheet:
    1. Renders a Modal element with the supplied `visible` prop
    2. Modal carries animationType=slide + presentationStyle=pageSheet
    3. Header renders the kicker + title strings from props (walk the children tree and assert text presence)
    4. Subtitle is omitted when `subtitle` prop is undefined
    5. Close button invokes `onClose` when its onPress is called
    6. heroSlot + footerSlot are rendered in tree when provided

    OptionCard:
    1. Default variant renders title + tint-chip + (no sub) when sub absent
    2. Sub line is rendered when `sub` prop is provided
    3. selected=true renders the success checkmark overlay
    4. disabled=true sets the Pressable's disabled prop and opacity 0.45
    5. variant=custom uses dashed borderStyle
    6. onPress fires when the Pressable is invoked (and does NOT fire when disabled=true)
  </behavior>
  <action>
    Create both primitives following the visual contract from `<task_context>` in the planning brief. Match the existing FocusPickerSheet/RemixSheet inline values (paddings, radii, font sizes) so the refactored callers in Task 2 get pixel-equivalent output. Use `colors.bg` for the sheet body for parity (the old FocusPickerSheet `'#FFFBF5'` was a one-off — switching to `colors.bg='#FAF7F2'` brings both screens onto the canonical app background; verify visually in Task 3 that this still reads warm).

    PickerSheet props:
    ```typescript
    interface PickerSheetProps {
      visible: boolean;
      kicker: string;             // e.g. "WEEKLY FOCUS" / "REMIX"
      title: string;              // e.g. "Pick a skill to practice"
      subtitle?: string;
      onClose: () => void;
      heroSlot?: React.ReactNode;
      footerSlot?: React.ReactNode;
      children: React.ReactNode;  // grid body — caller renders OptionCards in a flex-row-wrap container with rowGap 12 and justifyContent space-between
    }
    ```

    OptionCard props:
    ```typescript
    interface OptionCardProps {
      label: string;
      sub?: string;
      symbol: SymbolViewProps['name'];
      tint: string;
      selected?: boolean;
      disabled?: boolean;
      variant?: 'default' | 'custom';   // 'custom' = dashed border, no shadow
      onPress: () => void;
      accessibilityLabel?: string;
      // Width is owned by the parent grid via flex/wrap. OptionCard sets
      // its own min height + padding; caller wraps in a `width: '48%'`
      // outer view OR OptionCard accepts a `style` override prop for
      // the rare case where 3-col layouts return.
      style?: StyleProp<ViewStyle>;
    }
    ```

    Tests: mirror `apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx`:
    - vi.hoisted + vi.mock for `expo-symbols`
    - Call components as plain functions (`OptionCard({...})`)
    - Walk the returned element tree manually to find specific child elements (`Pressable`, `Text`, `Modal`)
    - For onPress assertions, find the Pressable and invoke its `onPress` prop directly with `{ nativeEvent: {} } as never`
    - For child-tree text assertions, write a small `findTextInTree(el, predicate)` helper that recursively walks `props.children`

    Do NOT use react-test-renderer or React Testing Library — neither is set up for this package and adding a test runtime is out of scope.
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm vitest run src/components/ui/__tests__/PickerSheet.test.tsx src/components/ui/__tests__/OptionCard.test.tsx</automated>
  </verify>
  <done>
    Both primitives compile under TypeScript strict, both test files pass with ≥6 cases each, no new dependencies added to package.json, components import only from `react`, `react-native`, `expo-symbols`, `./SymbolIcon`, and `../../design/tokens`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Refactor FocusPickerSheet + RemixSheet to consume PickerSheet + OptionCard</name>
  <files>
    apps/mobile/src/components/plan/FocusPickerSheet.tsx,
    apps/mobile/src/components/recipes/RemixSheet.tsx
  </files>
  <action>
    **FocusPickerSheet.tsx** — full refactor:
    1. Import `PickerSheet` from `../ui/PickerSheet` and `OptionCard` from `../ui/OptionCard`. Remove direct `Modal`, `ScrollView`, `Pressable` (header), and `Alert` imports if unused after the refactor. Keep `useState`/`useEffect`, `View`, `Text`, `TextInput` (for the new inline custom row).
    2. Drop the `examples: string` field from `FocusOption` and from every entry in `FOCUS_OPTIONS`.
    3. Drop the `cardExamples` style.
    4. Replace the entire `<Modal>...<ScrollView>` body with:
       - `<PickerSheet visible={visible} kicker="WEEKLY FOCUS" title="Pick a skill to practice" subtitle="We'll bias this week's meals toward recipes that stretch you in this direction." onClose={onClose} footerSlot={currentTheme ? <Button title="Clear focus for this week" variant="outline" ... /> : undefined}>`
       - Inside: a `View` with `flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12` containing FOCUS_OPTIONS.map → `<OptionCard label={opt.label} sub={opt.blurb} symbol={opt.symbol} tint={opt.tint} selected={optimisticTheme===opt.key} disabled={committing!==null && committing!==opt.key} onPress={()=>void commit(opt.key)} accessibilityLabel={'Focus on '+opt.label} style={{width: '48%'}} />`
       - Plus a final `<OptionCard variant="custom" label="Custom" sub="Type your own…" symbol="pencil" tint={colors.textPrimary} onPress={()=>setCustomOpen(true)} style={{width: '48%'}} />` whose onPress toggles a local `customOpen` state.
    5. Replace `Alert.prompt` flow entirely. Add a sibling row that mounts when `customOpen` is true, modeled on RemixSheet's `customInputRow`:
       - `View` with `flexDirection: 'row', alignItems: 'center', gap: 10, padding 14/10, backgroundColor: colors.surface, border 1pt colors.border, radius 14, marginTop: 12`
       - `SymbolIcon name="pencil" size={18} tintColor={colors.textSecondary} weight="semibold"`
       - `TextInput` with `placeholder="Type your own focus…"`, `placeholderTextColor={colors.textTertiary}`, `value={customDraft}`, `onChangeText={setCustomDraft}`, `returnKeyType="go"`, `onSubmitEditing={submitCustom}`, autoFocus
       - clear button (xmark.circle.fill) when `customDraft.length > 0`
       - submit button (arrow.up.circle.fill, 28pt, tint colors.brand) → `submitCustom`
       - `submitCustom = () => { const t = customDraft.trim(); if (!t) return; void commit(t); setCustomOpen(false); setCustomDraft(''); }`
    6. Reset `customOpen`/`customDraft` in the same `useEffect` that resets `optimisticTheme` when `visible` flips.
    7. Keep the `commit` function as-is — its non-closing behavior is the FocusBanner contract.
    8. Drop the obsolete styles: `sheet`, `header`, `kicker`, `title`, `subtitle`, `closeBtn`, `list`, `card`, `cardSelected`, `cardCustom`, `cardChip`, `cardBody`, `cardTitle`, `cardBlurb`, `cardExamples`. Keep only the styles needed by the new custom-input row + clear-button container.

    **RemixSheet.tsx** — surgical refactor of ONLY the mode-picker block (do not touch results/expand/cook/save logic):
    1. Import `PickerSheet` and `OptionCard`. Keep all existing imports including `Modal` (used for the nested expand preview + nested remix sheets — those modals stay).
    2. Convert the mode-picker outer wrapper. Currently the mode picker lives inside the top-level `<Modal>...<View><Header/><ScrollView>...</ScrollView>...</View></Modal>`. Refactor so:
       - When `!selectedMode`, render a `<PickerSheet>` block with `visible={visible} kicker="REMIX" title={recipeTitle} onClose={onClose} heroSlot={<SurpriseHero/> + <CustomInputRow/>}>` containing a 2-col grid of `GRID_MODES.map` → `<OptionCard label={m.label} sub={m.sub} symbol={m.symbol} tint={m.tint} onPress={()=>handleMode(m.mode)} style={{width:'48%'}} />`.
       - When `selectedMode` is non-null (loading / error / variations) — RETAIN the existing `<Modal>` wrapper with the original `<View style={styles.sheet}>` + custom header. The post-pick states have a different layout (results list), so they keep their dedicated Modal. The PickerSheet only owns the picker step.
       - This means the file now has TWO top-level conditional Modal trees: PickerSheet (when !selectedMode) + the existing Modal (when selectedMode). Both are siblings in the return JSX and only one renders at a time based on `selectedMode`.
    3. Move the existing `customInputRow` JSX into the `heroSlot` (or render it as the first child of PickerSheet's body wrapper — pick whichever reads cleaner; `heroSlot` is the right semantic home since it sits above the grid).
    4. Move the `surpriseCard` JSX into the same `heroSlot` as a sibling under the customInputRow. Both stay full-width above the 2-col grid.
    5. Switch `GRID_MODES` rendering from the old 3-col `modeTile` Pressables to the 2-col `OptionCard` instances. Drop the now-unused styles: `modeGrid`, `modeTile`, `modeTileChip`, `modeTileLabel`, `modeTileSub`, `modeRow`, `modeChip`, `modeRowText`. KEEP styles still in use by the post-pick / nested preview / VariationCard sections.
    6. The `GRID_MODES = MODES.slice(1)` slice is a 2-col layout now (was 3-col). 8 tiles ÷ 2 = 4 rows — fits cleanly above the fold.
    7. Surprise hero retains its full-width brand-tinted card look. Custom-input row is the canonical inline custom UX (Focus references this same pattern).
    8. Do NOT change `RemixSource`, `RemixSheet`, `VariationCard`, `RemixVariationPreview`, or any handler function. Their signatures are part of the public surface used by callers.

    Self-check before commit:
    - `import { PickerSheet }` appears in both files
    - `import { OptionCard }` appears in both files
    - `Alert.prompt` no longer appears in FocusPickerSheet
    - `examples` no longer appears in FocusPickerSheet
    - `onSelect`/`currentTheme`/`visible`/`onClose` prop names on FocusPickerSheet unchanged
    - `RemixSheet` export signature unchanged (props interface byte-equivalent)
    - No new color hex values introduced — only tokens.ts colors + the pre-existing `#FFF4E6` selected fill + the pre-existing `#F1EAE0` hairline (already in tokens as borderSubtle)
    - Both files type-check (`pnpm tsc --noEmit` from apps/mobile)
  </action>
  <verify>
    <automated>cd /Users/patrickrichards/DinnerTime/apps/mobile && pnpm tsc --noEmit && pnpm vitest run src/components/ui/__tests__/PickerSheet.test.tsx src/components/ui/__tests__/OptionCard.test.tsx src/components/recipes/__tests__ src/components/plan/__tests__</automated>
  </verify>
  <done>
    Both files import the new primitives and render through them. FocusPickerSheet no longer references `Alert.prompt` or `examples`. RemixSheet's pre-pick mode picker is rendered via PickerSheet with a 2-col OptionCard grid + retained Surprise hero + retained customInputRow. RemixSheet's post-pick states (loading/error/results/expand/nested-remix) are unchanged. TypeScript compiles, all existing unit tests still pass, no new test failures introduced.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Maestro UAT — boot simulator, install dev client, screenshot both pickers</name>
  <files>/tmp/quick-8-focus-picker.png, /tmp/quick-8-remix-mode-picker.png</files>
  <action>
    Drive the iOS Simulator end-to-end and capture screenshots proving visual parity. Use the prebuilt dev client at `apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app`.

    Steps (run from `apps/mobile/`):
    1. Boot the simulator if not already booted:
       ```
       xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || true
       open -a Simulator
       ```
    2. Install the dev client (idempotent):
       ```
       xcrun simctl install booted ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app
       ```
    3. Confirm Metro is running in `--lan` mode. If not, start it in the background:
       ```
       npx expo start --dev-client --lan &
       ```
       Wait ~6s for the manifest to come up. (Skip this step if Metro is already serving — the user may have it running in another shell. Check `lsof -i :8081` first.)
    4. Launch the app:
       ```
       xcrun simctl launch booted com.dinnertime.app
       ```
    5. Sign in if needed using the existing `_ensure-logged-in.yaml` helper. If the sentinel banner already shows `loggedIn=true`, skip.
    6. Write a one-shot Maestro flow at `/tmp/quick-8-pickers.yaml` that:
       - Launches app
       - Navigates to Plan tab and taps "Set focus" or "Change" on the FocusBanner
       - `extendedWaitUntil` visible "Pick a skill to practice"
       - `takeScreenshot: /tmp/quick-8-focus-picker`
       - Dismisses the sheet (close button)
       - Navigates to Recipe Box → first recipe → tap "Remix"
       - `extendedWaitUntil` visible "Surprise me"
       - `takeScreenshot: /tmp/quick-8-remix-mode-picker`
    7. Run: `maestro test /tmp/quick-8-pickers.yaml`
    8. Maestro saves screenshots into `~/.maestro/tests/<run-id>/`. Locate the latest run and copy the two screenshots to `/tmp/quick-8-focus-picker.png` and `/tmp/quick-8-remix-mode-picker.png` so the orchestrator can `Read` them.

    If the FocusBanner is not visible (no current meal plan exists), generate a plan first via the Plan tab "Generate week" CTA. If a saved recipe is not in the library, save one from "Something New" / Discover. These are env preconditions, not bugs.

    If Maestro selectors fail (e.g. text-matcher regex collision), fall back to coordinate taps and `xcrun simctl io booted screenshot /tmp/quick-8-{name}.png` after each navigation step.

    Visual parity check (manual review by orchestrator after this task):
    - Both screenshots show a kicker (WEEKLY FOCUS / REMIX) above a bold dark title and a soft body background
    - Both show a 2-col grid of white tiles with rounded corners, tinted icon chips top, bold title, sub line, and a soft shadow
    - The tiles look like siblings — same width ratio, same chip size, same typography
    - Focus has no italic "examples" line under the blurb
    - Tapping "Custom" on Focus reveals an inline TextInput (no Alert popover)
  </action>
  <verify>
    <automated>test -f /tmp/quick-8-focus-picker.png && test -f /tmp/quick-8-remix-mode-picker.png && file /tmp/quick-8-focus-picker.png | grep -q PNG && file /tmp/quick-8-remix-mode-picker.png | grep -q PNG</automated>
  </verify>
  <done>
    Two PNG screenshots exist at `/tmp/quick-8-focus-picker.png` and `/tmp/quick-8-remix-mode-picker.png`. Both render the new shared shell with a 2-col OptionCard grid. Orchestrator can `Read` them inline for visual review.
  </done>
</task>

</tasks>

<verification>
End-to-end checks after all three tasks:

1. **Type-check:** `cd apps/mobile && pnpm tsc --noEmit` — clean
2. **Unit tests:** `cd apps/mobile && pnpm vitest run src/components/ui/__tests__ src/components/plan/__tests__ src/components/recipes/__tests__` — green
3. **Existing maestro flows still pass (smoke level):** `cd apps/mobile && maestro test .maestro/qa-remix-grid.yaml` — passes (Surprise me text still present, takes the screenshot)
4. **Visual artifacts:** `/tmp/quick-8-focus-picker.png` and `/tmp/quick-8-remix-mode-picker.png` exist and render the unified shell
5. **No new tokens:** `grep -E '#[0-9A-Fa-f]{6}' apps/mobile/src/components/ui/PickerSheet.tsx apps/mobile/src/components/ui/OptionCard.tsx` — only colors that already exist in tokens.ts or the pre-existing `#FFF4E6` selected fill
6. **Caller contract intact:** `grep -n 'FocusPickerSheet' apps/mobile/src/components/plan/FocusBanner.tsx` shows the same prop names (visible/currentTheme/onSelect/onClose). Same for RemixSheet's call sites.
</verification>

<success_criteria>
- PickerSheet + OptionCard primitives committed at `apps/mobile/src/components/ui/`
- Both primitives have unit tests with ≥6 cases each, all passing
- FocusPickerSheet refactored: drops examples line, drops Alert.prompt, renders 2-col OptionCard grid, inline custom-input row matches Remix's customInputRow visual language
- RemixSheet's pre-pick mode picker refactored: renders 2-col OptionCard grid via PickerSheet, hero (Surprise + customInstructions) retained, post-pick states untouched
- FocusBanner.handleSelect keeps the same async `(theme: string|null) => Promise<void>` contract; the sheet still stays open until parent toggles visible
- All existing tests still pass (`apps/mobile/src/components/recipes/__tests__`, `apps/mobile/src/components/plan/__tests__`)
- TypeScript compiles clean across `apps/mobile`
- Maestro screenshots prove visual parity: both pickers render as 2-col OptionCard grids with matching kicker/title/close-button headers
- No new design tokens introduced; only `colors.brand / surface / textPrimary / textSecondary / textTertiary / border / borderSubtle / success / warning / destructive / bg` referenced
</success_criteria>

<output>
After completion, create `.planning/quick/8-visual-unification-of-focuspickersheet-r/8-SUMMARY.md` summarizing:
- New primitives (PickerSheet + OptionCard) — file paths, exports, public API
- Refactor deltas in FocusPickerSheet (Alert.prompt → inline TextInput; examples line dropped; vertical list → 2-col grid)
- Refactor deltas in RemixSheet (3-col → 2-col; mode picker now rendered via PickerSheet; post-pick states untouched)
- Visual parity screenshots paths
- Any deviations from the plan + why
</output>
