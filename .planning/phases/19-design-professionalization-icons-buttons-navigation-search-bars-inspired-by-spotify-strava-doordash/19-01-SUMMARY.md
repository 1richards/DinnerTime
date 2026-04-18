---
phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
plan: 01
subsystem: ui
tags: [nativewind, tailwind, design-tokens, terracotta, typography, sf-symbols, expo-symbols, vitest]

requires:
  - phase: 15
    provides: "SF Symbols migration complete — SymbolIcon + expo-symbols in src/components/ui/**; chevron-only back + modal/push rules; tab-root collapsing large-title pattern"
provides:
  - "CSS variables (space-separated RGB) for 14 semantic color tokens in apps/mobile/src/global.css — backing source for every Phase 19+ NativeWind class"
  - "tailwind.config.js theme extension: 14 semantic colors via rgb(var(--color-*) / <alpha-value>), 5-step fontSize scale (display/title/body/caption/label), 4 borderRadius tokens (button/card/chip/pill); warmWhite + warmGray preserved for migration safety"
  - "Typed token mirror at apps/mobile/src/design/tokens.ts (colors, typography, spacing, radius, ColorToken, TypographyToken) for non-className consumers"
  - "SF Symbol sizing helper apps/mobile/src/design/icons.ts (iconSize map + iconPropsForText(scale) → { size, weight } matching typography fontWeight)"
  - "Typed TextStyle mirror apps/mobile/src/design/typography.ts (textStyles) for StyleSheet.create / native header consumers"
  - "Vitest parity + shape guards (tokens.test.ts: 30 assertions, icons.test.ts: 6 assertions) and Plan 19-05 purity guard stub (tokens-purity.test.ts, describe.skip)"
affects: [19-02-button-rewrite, 19-03-chip-rewrite, 19-04-searchbar-cards, 19-05-token-sweep, 19-06-visual-verify]

tech-stack:
  added: []
  patterns:
    - "CSS-variable-backed NativeWind tokens — rgb(var(--color-X) / <alpha-value>) pattern lets className opacity modifiers (`bg-brand/15`) compose with dark-mode-ready palette swap (Pitfall 1 avoided)"
    - "Parallel hex mirror (tokens.ts) for non-className consumers — parity guarded by vitest text-parse of global.css + tailwind.config.js (NO Node require of tailwind.config.js, which would false-RED because nativewind/preset doesn't resolve outside Metro)"
    - "Icon weight derived from typography token — iconPropsForText(scale) pulls fontWeight from typography[scale] so SF Symbol weight always matches adjacent text weight"

key-files:
  created:
    - apps/mobile/src/design/tokens.ts
    - apps/mobile/src/design/icons.ts
    - apps/mobile/src/design/typography.ts
    - apps/mobile/src/design/tokens.test.ts
    - apps/mobile/src/design/icons.test.ts
    - apps/mobile/src/design/tokens-purity.test.ts
    - .planning/phases/19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash/deferred-items.md
  modified:
    - apps/mobile/src/global.css
    - apps/mobile/tailwind.config.js

key-decisions:
  - "Brand anchor = terracotta #C65D3A (RGB 198 93 58), pressed = #A7492C — confirms Phase 19 CONTEXT D-06"
  - "Typography scale fixed at display 34/41/700, title 22/28/600, body 17/22/400, caption 13/18/400, label 11/16/600 letter-spacing 0.6 (uppercase applied in textStyles)"
  - "Icon sizes tied to type scale: caption 14, body 18, title 22, display 28 — weight always matches typography.fontWeight"
  - "CSS vars use space-separated RGB channels (not hex) so Tailwind <alpha-value> modifiers like bg-brand/15 work (Pitfall 1)"
  - "warmWhite + warmGray legacy palette preserved — Plan 19-05 owns the atomic token-swap sweep"
  - "tokens.test.ts text-parses tailwind.config.js rather than require()-ing it — nativewind/preset doesn't resolve outside Metro and would false-RED"
  - "tokens-purity.test.ts authored as describe.skip — Plan 19-05 flips it on once orange→terracotta sweep completes"
  - "Dark mode: prefers-color-scheme @media block scaffolded as comment only — no dark UI ships in Phase 19, but palette structure is dark-ready"

patterns-established:
  - "NativeWind class names resolve semantic tokens (bg-brand, text-title, rounded-button) — never hardcode hex or pixel values in components after this plan"
  - "SF Symbols rendered via <SymbolView {...iconPropsForText('body')} /> — icon weight always inherits from matching typography step"
  - "Parity tests (design/tokens.test.ts) guard hex/RGB drift between global.css and tokens.ts automatically — pre-commit net for palette edits"

requirements-completed: ["Design quality (post-v1)"]

duration: 3min
completed: 2026-04-18
---

# Phase 19 Plan 01: Design-Token Foundation Summary

**Terracotta (#C65D3A) + cream (#FAF7F2) semantic palette + 5-step SF Pro scale + SF Symbol weight mapping, wired as CSS-variable-backed NativeWind tokens with hex mirror and vitest parity guard.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-18T22:16:20Z
- **Completed:** 2026-04-18T22:19:55Z
- **Tasks:** 4 (1 pre-flight + 3 build)
- **Files modified:** 2 (`global.css`, `tailwind.config.js`)
- **Files created:** 7 (3 typed exports + 3 tests + deferred-items.md)

## Accomplishments

- 14 semantic color tokens available as both NativeWind classes (`bg-brand`, `text-text-primary`, …) and typed hex (`colors.brand`) with vitest-enforced parity.
- 5-step type scale (`text-display`/`title`/`body`/`caption`/`label`) available as Tailwind fontSize and as typed `typography` + `textStyles` for RN StyleSheet consumers.
- `iconPropsForText(scale)` helper returns SymbolView `{ size, weight }` tied to the typography token — Plan 19-02's Button iconOnly + 19-03's Chip leading icon + 19-04's StickySearchPill all pull from this.
- Purity guard test (`tokens-purity.test.ts`) authored but skipped; Plan 19-05 flips it on after the orange→terracotta sweep completes.
- 36/36 Phase 19 design tests green; 4 pre-existing mobile test failures (unrelated stores) confirmed baseline and logged to `deferred-items.md`.

## Task Commits

1. **Task 0: Pre-flight — SF Symbols check** — no commit (read-only gate; PASSED: SymbolView in src/components/ui/** + expo-symbols ~55.0.7 in package.json).
2. **Task 1: global.css + tailwind.config.js token extension** — `f205584` (feat).
3. **Task 2: tokens.ts + icons.ts + typography.ts typed exports** — `409b9ad` (feat). `npx tsc --noEmit -p .` exits 0.
4. **Task 3: tokens.test.ts + tokens-purity.test.ts + icons.test.ts** — `b43a387` (test). 36 passed, 2 skipped (purity guard).

**Plan metadata commit:** pending (docs commit for SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created / Modified

### Modified
- `apps/mobile/src/global.css` — Declares all 14 `--color-*` CSS variables inside `@layer base { :root { ... } }` using space-separated RGB channels (Pitfall 1). Commented-out `prefers-color-scheme: dark` block scaffolds future dark palette.
- `apps/mobile/tailwind.config.js` — `theme.extend.colors` adds 14 semantic tokens in `rgb(var(--color-X) / <alpha-value>)` form; `fontSize` adds 5-step scale; `borderRadius` adds button/card/chip/pill. `warmWhite` + `warmGray` preserved for migration safety.

### Created
- `apps/mobile/src/design/tokens.ts` — `colors` (14 hex), `typography` (5 steps), `spacing` (8pt grid: 4/8/12/16/24/32/48), `radius` (button=12, card=16, chip=16, pill=9999), plus `ColorToken` + `TypographyToken` types.
- `apps/mobile/src/design/icons.ts` — `iconSize` (caption 14, body 18, title 22, display 28), `iconPropsForText(scale)` returning `{ size, weight }` with weight sourced from `typography[scale].fontWeight`.
- `apps/mobile/src/design/typography.ts` — `textStyles` map keyed by typography token (`display`/`title`/`body`/`caption`/`label`) returning full `TextStyle` with `color` + `textTransform` (uppercase on label) for RN StyleSheet consumers.
- `apps/mobile/src/design/tokens.test.ts` — 30 assertions: parity (global.css RGB → tokens.ts hex), tailwind.config.js text-parse shape (14 colors + 5 fontSize + 4 radius), typography 5-key shape, spacing 8pt grid, radius key shape.
- `apps/mobile/src/design/icons.test.ts` — 6 assertions: iconPropsForText per scale + iconSize shape + positive-integer values.
- `apps/mobile/src/design/tokens-purity.test.ts` — `describe.skip` guard for Plan 19-05 orange→terracotta sweep (checks zero `#F97316` hex + zero `orange-[0-9]+` classnames in src/**).

## How downstream plans consume tokens

**NativeWind (preferred, the 95% case):**
```tsx
<Pressable className="bg-brand rounded-button px-4 py-3" />
<Text className="text-title text-text-primary" />
<View className="bg-brand/15 border border-border-subtle" />  {/* opacity modifiers work */}
```

**Typed imports (for StyleSheet.create, native header options, ActivityIndicator, etc.):**
```tsx
import { colors, typography, spacing, radius } from '@/design/tokens';
import { textStyles } from '@/design/typography';
import { iconPropsForText } from '@/design/icons';

<ActivityIndicator color={colors.brand} />
<SymbolView name="magnifyingglass" {...iconPropsForText('body')} tintColor={colors.textSecondary} />
<Text style={textStyles.caption}>metadata</Text>
```

## Exact hex values chosen

Matches 19-RESEARCH.md Pattern 1 defaults with zero deviation. RGB channels in `global.css` are the authoritative source; `tokens.ts` is the hex mirror enforced by `tokens.test.ts` parity assertions.

| Token | Hex | RGB |
|---|---|---|
| brand | `#C65D3A` | 198 93 58 |
| brand-pressed | `#A7492C` | 167 73 44 |
| bg | `#FAF7F2` | 250 247 242 |
| surface | `#FFFFFF` | 255 255 255 |
| surface-subtle | `#F1EAE0` | 241 234 224 |
| text-primary | `#1C1917` | 28 25 23 |
| text-secondary | `#5C4D3D` | 92 77 61 |
| text-tertiary | `#A89178` | 168 145 120 |
| success | `#16A34A` | 22 163 74 |
| warning | `#D97706` | 217 119 6 |
| destructive | `#DC2626` | 220 38 38 |
| info | `#2563EB` | 37 99 235 |
| border | `#E5D9CA` | 229 217 202 |
| border-subtle | `#F1EAE0` | 241 234 224 |

## Metro cache reminder for Plans 02–06

Expo inlines Tailwind output at **bundle time**. A running Metro will NOT pick up `global.css` or `tailwind.config.js` edits. After any downstream plan touches these files (or merely consumes the new classes in a new surface), downstream agents must run:

```bash
rm -rf apps/mobile/.expo && (cd apps/mobile && npx expo start --dev-client --lan --clear)
```

CLAUDE.md "Metro cache" gotcha + 19-RESEARCH.md Pitfall 2 both call this out. Plan 19-06 owns the full sweep checklist.

## Decisions Made

All decisions trace to Phase 19 CONTEXT D-01 through D-07 and 19-RESEARCH.md Pattern 1–3. Zero deviations; hex values match research defaults exactly.

Notable sub-decisions made within Claude's Discretion:

- `label` token uses `textTransform: 'uppercase'` in `textStyles` (not in raw `typography`) so the numeric scale stays a pure size/weight source and text-transform can be toggled per call site via NativeWind.
- `tokens-purity.test.ts` walks files via a plain `fs` recursion rather than a glob lib — avoids adding a new dev dep just for the Plan 19-05 guard, and the walk excludes `design/` itself so this test's own regex literals can't cause a self-hit.
- Dark-mode `@media` block scaffolded as a comment rather than an active selector. Palette is structurally dark-ready, but nothing renders until Phase 23+ chooses to ship it.

## Deviations from Plan

None — plan executed exactly as written. All 4 tasks landed on the first green run, grep smoke-check + TypeScript + vitest all exited 0 on first attempt.

## Issues Encountered

**1. Pre-existing mobile test failures** (not caused by Plan 19-01)
- **Discovered during:** Task 3 regression check (`pnpm test --run`)
- **Failures:** 4 tests across 3 files — `__tests__/auth-store.test.ts` (1), `src/stores/__tests__/shoppingStore.test.ts` (2), `src/stores/__tests__/progressionStore.test.ts` (1).
- **Baseline verification:** `git stash` + `pnpm test --run` reproduced the same 4 failures on clean `main`. Confirmed pre-existing, not caused by Plan 19-01.
- **Resolution:** Logged to `.planning/phases/19-.../deferred-items.md`. Candidate for Phase 23 (Settings, Auth & NFRs) where the auth/shopping/progression store stability lives.
- **Scope decision:** Out of scope for this plan per SCOPE BOUNDARY rule — Plan 19-01 did not touch these stores.

## Next Phase Readiness

Plan 19-02 (Button rewrite) can proceed immediately:

- `bg-brand` / `bg-surface` / `bg-destructive` / etc. classes available.
- `rounded-button` (12pt) available.
- `iconPropsForText('body')` available for iconOnly variant SymbolView props.
- Typography scale available for button labels (`text-body` recommended for primary/secondary/ghost/destructive; `text-caption` for dense contexts if we add one later).
- `colors.brand` typed export available for any StyleSheet-only consumer inside the new Button that can't go through className (e.g., ActivityIndicator spinner tint on loading state).

No blockers. Downstream plans must clear Metro cache on first run per the reminder above.

## Self-Check: PASSED

- `apps/mobile/src/global.css` — FOUND
- `apps/mobile/tailwind.config.js` — FOUND
- `apps/mobile/src/design/tokens.ts` — FOUND
- `apps/mobile/src/design/icons.ts` — FOUND
- `apps/mobile/src/design/typography.ts` — FOUND
- `apps/mobile/src/design/tokens.test.ts` — FOUND
- `apps/mobile/src/design/icons.test.ts` — FOUND
- `apps/mobile/src/design/tokens-purity.test.ts` — FOUND
- Commit `f205584` (Task 1) — FOUND
- Commit `409b9ad` (Task 2) — FOUND
- Commit `b43a387` (Task 3) — FOUND

---
*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Completed: 2026-04-18*
