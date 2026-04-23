---
phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
plan: 02
subsystem: ui
tags: [nativewind, design-tokens, button, chip, input, vitest, tdd, terracotta]

requires:
  - phase: 19
    plan: 01
    provides: "Design-token substrate — CSS vars + tailwind tokens + typed colors/typography/icons exports"
provides:
  - "5-variant Button (primary/secondary/ghost/destructive/iconOnly), 44pt height, token-driven — ButtonVariant type exported from buttonStyles.ts"
  - "Two-family Chip (kind: filter|display, tone: default|success|warning|destructive), 32pt height — ChipKind + ChipTone types"
  - "Pure style resolvers (buttonStyles.ts variantStyles map + chipStyles.ts resolveChipClasses) — assertable in vitest without a React renderer"
  - "Input retheme using border/brand/destructive semantic tokens + placeholderTextColor sourced from colors.textTertiary"
  - "ChipToggle.tsx as ~30-LOC deprecation shim forwarding to Chip(kind='filter') — keeps existing 5 call sites compiling"
  - "Legacy 'outline' Button variant accepted as deprecated alias mapping to 'secondary' — keeps 23 existing call sites compiling until Plan 05 sweep"
  - "Pure-className test coverage: Button.test.ts (10 assertions) + Chip.test.ts (9 assertions) — both run under vitest node env without RNTL"
affects: [19-03-searchbar, 19-04-recipe-card, 19-05-token-sweep, 19-06-visual-verify]

tech-stack:
  added: []
  patterns:
    - "Variant styles as pure data (Record<Variant, Style>) exported from a separate pure file so style invariants (44pt height, token usage, no hex) can be asserted under vitest without importing React Native"
    - "Kind + tone resolver function (resolveChipClasses) instead of conditional classNames inside the component — isolates style decisions from JSX and keeps the JSX a thin renderer"
    - "Deprecation shims for API churn — both ChipToggle (old color-scheme API) and Button.outline (old 3-variant API) accept legacy shapes at the prop boundary and forward to the new tokens; Plan 05 sweep removes them"

key-files:
  created:
    - apps/mobile/src/components/ui/buttonStyles.ts
    - apps/mobile/src/components/ui/Button.test.ts
    - apps/mobile/src/components/ui/Chip.tsx
    - apps/mobile/src/components/ui/chipStyles.ts
    - apps/mobile/src/components/ui/Chip.test.ts
  modified:
    - apps/mobile/src/components/ui/Button.tsx
    - apps/mobile/src/components/ui/ChipToggle.tsx
    - apps/mobile/src/components/ui/Input.tsx

key-decisions:
  - "Button ButtonVariant exports exactly the 5 CONTEXT D-02 names (primary|secondary|ghost|destructive|iconOnly); 'outline' is accepted at the prop-type boundary as a deprecated alias mapping to 'secondary' internally — keeps 23 call sites compiling until Plan 05 sweep"
  - "ChipToggle kept as deprecation shim forwarding to Chip(kind='filter'); colorScheme='red' path intentionally degraded to default filter styling — flagged for Plan 05 to re-evaluate as display+destructive"
  - "vitest.config.ts NOT modified by this plan — the current exclusion ('src/components/!(ui)/**' from Plan 15-01, further narrowed by a concurrent plan to 'src/components/**/*.native.test.*') already admits pure ui .test.ts files. Plan's Task 1 step 4 assumed the pre-Phase-15 config; the intent is satisfied by the current state"
  - "Button and Chip style modules intentionally split into pure *.ts files (buttonStyles.ts, chipStyles.ts) — lets tests assert className invariants (44pt h-11, no-orange, tokenized spinner color, kind×tone matrix) without bringing React Native or a renderer into the test file"
  - "Input preserved its existing API exactly (label?, error?: string, containerClassName?) rather than introducing the error:boolean+errorText:string shape the plan proposed — existing 5 call sites (login/register/onboarding/import-url/scan-review) use error:string and the plan explicitly says to preserve existing API if different"
  - "Input border radius changed from rounded-xl to rounded-button — same 12pt value (Plan 01 set --radius-button=12), but sourcing from a named token"
  - "Button Pressable gains accessibilityRole='button' (was missing on the pre-Phase-19 Button)"

patterns-established:
  - "UI primitives with variant/kind APIs export their style-resolver logic as a pure sibling module (*Styles.ts) so tests live in *.test.ts next to them with no RN dependency"
  - "Deprecation shims for API changes keep Plan N's sweep decoupled from Plan N-1's callsite migration — intent recorded in a header comment citing the sweep plan"

requirements-completed: ["Design quality (post-v1)"]

duration: "4 min"
completed: 2026-04-18
---

# Phase 19 Plan 02: Button + Chip + Input Rewrite Summary

**Rewrote Button to a 5-variant 44pt token-driven system, added two-family Chip (filter + display with tone), rethemed Input to border/brand/destructive semantic tokens, and reduced ChipToggle to a deprecation shim — all with pure-className tests that run under vitest node env without a renderer.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-18T22:23:22Z
- **Completed:** 2026-04-18T22:27:19Z
- **Tasks:** 3 (all `type="auto" tdd="true"`)
- **Files created:** 5 (buttonStyles.ts, Button.test.ts, Chip.tsx, chipStyles.ts, Chip.test.ts)
- **Files modified:** 3 (Button.tsx, ChipToggle.tsx, Input.tsx)
- **Test assertions added:** 19 (10 Button + 9 Chip)
- **Total Plan 19-02 test suite:** 55/55 green (19 new + 36 Plan 19-01)

## Accomplishments

- **Button.tsx** accepts the full 5-variant API from CONTEXT D-02. Every variant resolves to `h-11` (44pt iOS tap target). Spinner color on loading + iconOnly SymbolView tintColor are sourced from the design token hex mirror. `variant="outline"` is accepted as a legacy alias that maps to `secondary` internally so the 23 existing call sites continue to compile.
- **Chip.tsx** renders both families via a single component driven by a `kind` prop. Filter kind has brand-terracotta active state + neutral inactive state; display kind has default + 3 tonal variants (success/warning/destructive) at 15% opacity backgrounds. Optional `leadingIcon` uses `iconPropsForText('caption')` from Plan 01 so icon weight matches the label weight.
- **chipStyles.ts** exports a single `resolveChipClasses(args)` pure function — the `kind × selected` + `kind × tone` matrix is expressed as data and asserted as data. No RN, no React, no renderer in the test.
- **buttonStyles.ts** exports a pure `Record<ButtonVariant, VariantStyle>` map. Every variant's container string is guaranteed to contain `h-11` via the test suite (9 tests pass the invariant).
- **Input.tsx** swapped `border-warmGray-200 / border-orange-400 / border-red-400` to `border-border / border-brand / border-destructive`; placeholderTextColor swapped from hardcoded `#9CA3AF` to `colors.textTertiary` token. Existing API preserved byte-for-byte (error still a string, containerClassName preserved, onFocus/onBlur pass-through untouched).
- **ChipToggle.tsx** reduced from a 42-LOC styled component to a ~30-LOC shim that forwards to `Chip(kind='filter')`. Deprecation comment cites Plan 05 as the sweep owner.

## Task Commits

| # | Task | Commit | Files |
|---|---|---|---|
| 1 | Button rewrite (5-variant, 44pt, token-driven) + pure variantStyles + test | `78b10bb` | Button.tsx, buttonStyles.ts, Button.test.ts |
| 2 | Chip (filter+display kinds) + chipStyles resolver + test; deprecate ChipToggle | `2479eff` | Chip.tsx, chipStyles.ts, Chip.test.ts, ChipToggle.tsx |
| 3 | Retheme Input.tsx with semantic tokens (border, focus, error) | `11e8e36` | Input.tsx |

**Plan metadata commit:** pending (commits SUMMARY.md + STATE.md + ROADMAP.md below).

## New API Surfaces

### Button (apps/mobile/src/components/ui/Button.tsx)

```typescript
import { Button, type ButtonVariant } from './Button';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'iconOnly';

// legacy 'outline' accepted at prop type, resolves to 'secondary' internally
<Button title="Save" variant="primary" />
<Button title="Cancel" variant="secondary" />           // new canonical name
<Button title="Cancel" variant="outline" />             // legacy alias, still compiles
<Button title="Dismiss" variant="ghost" />
<Button title="Delete" variant="destructive" />
<Button variant="iconOnly" icon="xmark" />              // SymbolView name required
<Button title="Save" loading />                          // ActivityIndicator in tokenized color
```

### Chip (apps/mobile/src/components/ui/Chip.tsx)

```typescript
import { Chip, type ChipKind, type ChipTone } from './Chip';

type ChipKind = 'filter' | 'display';
type ChipTone = 'default' | 'success' | 'warning' | 'destructive';

// interactive filter chip with active/inactive state
<Chip label="Italian" kind="filter" selected={isSelected} onPress={toggle} />

// read-only display chip
<Chip label="30 min" kind="display" tone="default" />
<Chip label="Cooked" kind="display" tone="success" />
<Chip label="Running low" kind="display" tone="warning" />
<Chip label="Expired" kind="display" tone="destructive" />

// with leading SF Symbol
<Chip label="Favorite" kind="filter" selected leadingIcon="heart.fill" onPress={toggle} />
```

## Deprecation Status

### ChipToggle (apps/mobile/src/components/ui/ChipToggle.tsx)

- **Status:** Deprecated shim
- **Shape:** ~30 LOC, forwards all props to `Chip(kind='filter', selected, onPress=onToggle)`
- **Call sites affected (5):** settings/IngredientSearch, DislikesSection, CuisineSection, DietarySection, MemberFormModal
- **Behavior note:** `colorScheme='red'` now renders identically to `colorScheme='orange'` (both map to the default filter styling — brand terracotta when selected, neutral when not). This is a deliberate visual regression until Plan 05 evaluates whether those call sites should migrate to `kind='display' tone='destructive'` (read-only status indicators) rather than stay as interactive filters.
- **Removal target:** Plan 19-05 sweep

### Button.outline variant

- **Status:** Deprecated alias
- **Mechanism:** `variant="outline"` accepted at prop type; `resolveVariant()` maps it to `'secondary'` before resolving against `variantStyles`
- **Call sites affected (23):** login, register, onboarding, scan/review, recipes/[id]/index, recipes/[id]/edit, recipes/review, recipes/import-url, recipes/import-photo, recipes/discover, settings, shopping/order/[id], suggestions/SuggestionList, suggestions/SuggestionPreviewModal, plan/CookConfirm, plan/SwapSheet, recipes/AddToPlanSheet, recipes/RemixSheet, settings/FamilyMembersSection, scan/index
- **Removal target:** Plan 19-05 sweep (migrate every `variant="outline"` → `variant="secondary"`; remove `outline` from `ButtonVariantInput` type; drop `resolveVariant()` helper)

## vitest.config.ts

**Not modified by this plan.** The plan's Task 1 step 4 assumed the pre-Phase-15 config (`exclude: ['src/components/**']`), which required narrowing to admit new pure ui tests. Phase 15-01 had already narrowed the exclusion to `'src/components/!(ui)/**'` (admits all ui tests). A concurrent Plan 19-0x (appears to be 19-04 based on the commit comment) further narrowed the exclusion to `'src/components/**/*.native.test.*'`. Both states already admit pure `src/components/ui/*.test.ts` files — the intent of the plan's Task 1 step 4 is satisfied without additional edits from 19-02.

## Decisions Made

All decisions trace to Phase 19 CONTEXT D-02 + D-05 + Claude's Discretion on Input styling, 19-RESEARCH.md Patterns 4 + 5, and 19-01 token foundation.

Notable sub-decisions within Claude's Discretion:

- **`outline` alias at Button.tsx vs Plan 02 sweep.** The plan says Plan 05 owns the orange→terracotta call-site sweep. The alternative — migrate 23 call sites inside Plan 02 — would bloat this plan's scope and conflict with Plan 05's mandate. Shim is the minimum-touch path that keeps the compile green.
- **`colorScheme='red'` on ChipToggle treated as default filter styling, not destructive.** The shim is a text replacement, not a design decision. Plan 05 should decide whether those sites want the new filter's brand-terracotta selected state (keep as filter) or a read-only destructive tone (migrate to `kind='display' tone='destructive'`). Flagged under Deprecation Status above.
- **Input API preserved byte-for-byte.** Plan 02 Task 3 proposed `error?: boolean; errorText?: string`, but existing call sites use `error?: string`. The plan itself explicitly says "If the existing Input has different props/shape, preserve them and only swap color/border/text classes to tokens" — honored the latter directive.
- **Button gained `accessibilityRole='button'`.** Was missing on the pre-Phase-19 Button. Bonus a11y improvement required by 19-VALIDATION.md Per-Task row 4 ("a11y: every button variant rendered with accessibilityRole='button'"). Classified under Rule 2 (auto-add missing critical functionality) but also called out by the plan's success criteria indirectly.
- **Label text class on Input changed from `text-sm` to `text-caption`.** Part of the token substrate — Plan 01 defined `text-caption` as the 13pt semibold scale step; `text-sm` is Tailwind's default 14pt. Matches the new type scale.

## Deviations from Plan

### Rule 3 - Blocking Issue: vitest.config.ts already in target state

- **Found during:** Task 1 setup
- **Issue:** Plan Task 1 step 4 prescribes narrowing the exclusion from `'src/components/**'` to `'src/components/**/*.native.test.*'`. On disk the exclusion was already `'src/components/!(ui)/**'` (Phase 15-01 narrowed it to admit ui tests), and was further narrowed to `'src/components/**/*.native.test.*'` by a concurrent plan's commit mid-execution.
- **Fix:** No-op. Both states admit pure `src/components/ui/*.test.ts`, which is the actual invariant the plan needed. Button.test.ts + Chip.test.ts run successfully under either config.
- **Files modified:** None
- **Commit:** N/A (no change required)

### Rule 2 - Missing Critical Functionality: Button needed accessibilityRole

- **Found during:** Task 1 implementation
- **Issue:** Pre-Phase-19 Button.tsx did not set `accessibilityRole`. 19-VALIDATION.md Per-Task row 4 requires every button variant to render with `accessibilityRole="button"` for tap-target a11y verification.
- **Fix:** Added `accessibilityRole="button"` to the Pressable in Button.tsx.
- **Files modified:** apps/mobile/src/components/ui/Button.tsx
- **Commit:** `78b10bb`

### API preservation: Input.tsx kept `error: string` shape

- **Found during:** Task 3 implementation
- **Issue:** Plan Task 3's proposed snippet used `error?: boolean; errorText?: string`, but existing call sites (login, register, onboarding, import-url, scan/review) pass `error={authError}` where `authError` is a `string | undefined`.
- **Fix:** Kept existing `error?: string` API; a truthy value triggers destructive border + renders the error string below the input. This is what the plan's Task 3 `<action>` block explicitly permits ("If the existing Input has different props/shape, preserve them and only swap color/border/text classes to tokens").
- **Files modified:** apps/mobile/src/components/ui/Input.tsx
- **Commit:** `11e8e36`

### Scope boundary: `outline` alias preserved at Button type boundary

- **Found during:** Task 1 typecheck
- **Issue:** Rewriting Button to the exact 5-variant `ButtonVariant` type triggered 23 TS2322 errors across `variant="outline"` call sites (login, register, onboarding, and 20 more).
- **Fix:** Introduced `type ButtonVariantInput = ButtonVariant | 'outline'` as the Button prop type, with an internal `resolveVariant()` that maps `'outline'` to `'secondary'`. ButtonVariant (exported type) remains exactly the 5 canonical names. Plan 05 sweep removes the alias.
- **Classification:** This is NOT strictly a Rule 2 deviation — it's the plan's own directive ("ChipToggle.tsx becomes a thin re-export of Chip with a deprecation comment — Plan 05's sweep removes the last call sites"). The same principle applied to Button.outline for symmetry.
- **Files modified:** apps/mobile/src/components/ui/Button.tsx
- **Commit:** `78b10bb`

## Issues Encountered

### Pre-existing mobile test failures (not caused by Plan 19-02)

- **Discovered during:** Task 3 full-suite regression check (`pnpm test --run`)
- **Failures:** 4 tests across 3 files — same 4 failures already logged in Plan 19-01's `deferred-items.md`:
  - `__tests__/auth-store.test.ts > Auth Store > initialize > should set isOnboarded based on profile.onboarding_complete`
  - `src/stores/__tests__/shoppingStore.test.ts > generateList > POSTs meal_plan_id and populates currentList + items`
  - `src/stores/__tests__/shoppingStore.test.ts > fetchCurrent > populates list + items on 200`
  - `src/stores/__tests__/progressionStore.test.ts > fetchVariations returns string[] on 200`
- **Verification:** Test failures are bit-identical to the baseline Plan 19-01 documented on 2026-04-18. Plan 19-02 touched zero store code.
- **Resolution:** Out of scope per SCOPE BOUNDARY rule; remains logged in phase's `deferred-items.md` for Phase 23 (Settings/Auth/NFRs).

### Concurrent execution context

- **Observation:** At the moment this plan started executing, `git status` showed uncommitted changes and untracked files from a concurrently-running Plan 19-03 or 19-04 executor (notably `SearchBar.tsx`, `RecipeCard.test.ts`, `recipeCardStyles.ts`, `search.tsx`, `_layout.tsx`, and a recent `test(19-03)` commit).
- **Action:** This plan committed ONLY its own plan-19-02 files (Button.tsx, buttonStyles.ts, Button.test.ts, Chip.tsx, chipStyles.ts, Chip.test.ts, ChipToggle.tsx, Input.tsx). The other files were left untouched and not staged.
- **Impact:** None on this plan's success criteria. If the concurrent plan commits before this one completes, both plans' files will merge cleanly — they touch disjoint file sets.

## Verification Results

- [x] **Full Plan 19-02 test suite green:** `pnpm test src/components/ui/Button.test.ts src/components/ui/Chip.test.ts src/design/tokens.test.ts src/design/icons.test.ts --run` → **55 passed, 0 failed** (10 Button + 9 Chip + 30 tokens parity + 6 icons).
- [x] **Full mobile test suite:** 301/307 passed, 4 pre-existing failures unchanged from baseline, 2 skipped (the purity guard Plan 01 deferred to Plan 05).
- [x] **TypeScript clean:** `npx tsc --noEmit -p .` exit 0.
- [x] **No orange in plan-touched files:** `grep -rEn "orange-[0-9]|F97316" src/components/ui/{Button,Chip,Input,ChipToggle}.tsx src/components/ui/{button,chip}Styles.ts` → zero matches.
- [x] **Existing ChipToggle call sites compile:** confirmed by `tsc` exit 0 across all 5 call sites (settings/IngredientSearch, DislikesSection, CuisineSection, DietarySection, MemberFormModal).
- [x] **Existing Input call sites compile:** confirmed by `tsc` exit 0 across all 5 call sites (login, register, onboarding, import-url, scan/review).
- [x] **Existing Button `variant="outline"` call sites compile:** confirmed by `tsc` exit 0 across all 23 call sites via the shim.

## Next Plan Readiness

Plan 19-03 (StickySearchPill — already partially in flight based on the `test(19-03)` commit observed during execution) can continue consuming:

- `colors.brand`, `colors.textSecondary`, `colors.textTertiary`, `colors.surface` for ActivityIndicator / shadow / Animated styles.
- `iconPropsForText('body')` for the magnifying-glass SymbolView.
- Chip `kind='filter'` for any filter chip row below the pill.
- Button `variant="iconOnly"` for a cancel/clear X affordance inside the expanded search modal.

Plan 19-04 (Recipe card mode-aware treatment) can consume:

- Chip `kind='display' tone=default|success|warning` for cook time / difficulty / skill-gate indicators.
- Button `variant="primary"` / `"ghost"` for card-level CTAs.

Plan 19-05 (token-sweep + purity-guard flip) should migrate:

1. All `<Button variant="outline" />` → `variant="secondary"`, then drop `ButtonVariantInput`/`resolveVariant()` helper from Button.tsx.
2. All `<ChipToggle ... />` call sites → `<Chip kind="filter" ... />` or, where the old colorScheme='red' meant "this is a warning state", `<Chip kind="display" tone="destructive" />`.
3. Delete ChipToggle.tsx.
4. Flip `tokens-purity.test.ts` from `describe.skip` to `describe`.

Plan 19-06 (visual verify) should:

- Re-baseline Maestro screenshots — every button render changes (terracotta vs orange) and every chip render changes (rounded-pill vs rounded-full, caption font, new tones).

## Known Stubs

None introduced by this plan. Button, Chip, and Input all render real data from their props; ChipToggle's shim path is functionally equivalent to the old behavior for `colorScheme='orange'` and is intentionally degraded for `colorScheme='red'` (documented).

## Self-Check: PASSED

- `apps/mobile/src/components/ui/Button.tsx` — FOUND
- `apps/mobile/src/components/ui/buttonStyles.ts` — FOUND
- `apps/mobile/src/components/ui/Button.test.ts` — FOUND
- `apps/mobile/src/components/ui/Chip.tsx` — FOUND
- `apps/mobile/src/components/ui/chipStyles.ts` — FOUND
- `apps/mobile/src/components/ui/Chip.test.ts` — FOUND
- `apps/mobile/src/components/ui/ChipToggle.tsx` — FOUND (modified to shim)
- `apps/mobile/src/components/ui/Input.tsx` — FOUND (retheme only)
- Commit `78b10bb` (Task 1 Button) — FOUND in `git log`
- Commit `2479eff` (Task 2 Chip) — FOUND in `git log`
- Commit `11e8e36` (Task 3 Input) — FOUND in `git log`

---
*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Completed: 2026-04-18*
