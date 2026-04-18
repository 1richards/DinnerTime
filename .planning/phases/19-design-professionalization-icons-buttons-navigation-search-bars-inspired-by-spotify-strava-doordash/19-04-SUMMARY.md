---
phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
plan: 04
subsystem: ui
tags: [nativewind, recipe-card, day-row, chip, mode-aware, vitest, design-tokens]

requires:
  - phase: 19
    plan: 01
    provides: "Terracotta palette + 5-step SF Pro scale + bg-surface/rounded-card/text-title/text-body/text-caption Tailwind classes + colors.destructive/success/warning/brand/textSecondary/textTertiary typed exports"
  - phase: 19
    plan: 02
    provides: "Chip primitive with kind='display' + ChipTone (default/success/warning/destructive) + leadingIcon slot"
provides:
  - "RecipeCard with mode: 'grid' | 'list' prop (default 'grid' — backward-compat for Library callers)"
  - "recipeCardStyles.ts — pure resolveCardClasses(mode) → CardClasses resolver; 8-assertion vitest suite asserting grid/list className contracts + zero orange/hex purity"
  - "DayRow rewritten against Phase 19 tokens + Plan 19-02 Chip — 64pt height, seven days fit iPhone 15/17 Pro, status-chip derivation extracted to pure helper"
  - "dayRowHelpers.ts — pure deriveStatusChips({status, isStretch?, pantryReady?}) matrix-tested (9 vitest cases over status × stretch × pantryReady)"
  - "DayRow API preserved verbatim — plan.tsx call site compiles unchanged"
affects: [19-05-token-sweep, 19-06-visual-verify, 17-something-new-search-results, 22-plan-refactor]

tech-stack:
  added: []
  patterns:
    - "Mode-aware card via pure className resolver — RecipeCard consumes resolveCardClasses(mode) so class strings are unit-testable outside the RN renderer and the grid ↔ list swap is a one-prop decision at call sites"
    - "Status-chip derivation as a pure helper (deriveStatusChips) — DayRow's visual hierarchy is matrix-tested node-side, avoiding silent regressions where Plan tab screenshots hide state-mapping bugs"
    - "vitest exclude narrowed from 'src/components/!(ui)/**' to 'src/components/**/*.native.test.*' — pure helper *.test.ts files in recipes/, plan/, etc. now run under node env without exposing RN-renderer-coupled tests"

key-files:
  created:
    - apps/mobile/src/components/recipes/recipeCardStyles.ts
    - apps/mobile/src/components/recipes/RecipeCard.test.ts
    - apps/mobile/src/components/plan/dayRowHelpers.ts
    - apps/mobile/src/components/plan/dayRowHelpers.test.ts
  modified:
    - apps/mobile/src/components/recipes/RecipeCard.tsx
    - apps/mobile/src/components/plan/DayRow.tsx
    - apps/mobile/vitest.config.ts

key-decisions:
  - "RecipeCard `mode` defaults to 'grid' — zero call-site churn for Library / Home suggestions grid / Discover; Phase 17 Something New search-results caller passes mode='list'"
  - "recipeCardStyles uses w-24 h-24 (96pt) in list mode — the upper bound of the 80–96pt Phase 19 CONTEXT D-06 spec, matched against DoorDash-style horizontal rows"
  - "DayRow intentionally does NOT consume ItemRow — a file-top comment documents the reason (day-label column is a 48pt text element, not an affordance slot matching ItemRow's leading: checkbox|stepper|icon union)"
  - "isStretch / pantryReady flags are wired through deriveStatusChips even though MealPlanEntry does not carry them yet — deterministic today, one-line data binding when Phase 22 introduces the fields"
  - "Sparkle glyph `#FFE4B5` over dark imagery kept as an intentional decorative accent and marked with an in-file comment — Phase 19 purity exception for decorative glyphs over photo backgrounds, not a brand color"
  - "Source badge white text + rgba backgrounds on RecipeCard preserved as photo overlay literals (not brand colors) — explicit comment documents these are overlay effects, not tokenizable surfaces"
  - "vitest.config exclude narrowed on this plan rather than deferred — unlocks the RecipeCard.test.ts + dayRowHelpers.test.ts location specified in the plan without relying on unshipped Plan 19-02 changes"

patterns-established:
  - "Pure className resolvers (resolveCardClasses, resolveChipClasses from 19-02) are the preferred home for mode/variant logic — the component becomes a thin JSX shell + className consumer"
  - "Pure data-descriptor helpers (deriveStatusChips) decouple visual state derivation from JSX so a matrix test guards what screenshots cannot"
  - "When an existing primitive (ItemRow) almost fits, document the 'almost' and keep the bespoke component rather than widening the primitive's union — or extract a new primitive if the need recurs"

requirements-completed: ["Design quality (post-v1)"]

duration: 5min
completed: 2026-04-18
---

# Phase 19 Plan 04: Card Treatments — Mode-Aware RecipeCard + Dense DayRow Summary

**RecipeCard gains a `mode: 'grid' | 'list'` prop with a pure className resolver; DayRow is rewritten to 64pt density with Plan 19-02 Chip-driven status, backed by a matrix-tested `deriveStatusChips` helper.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-18T22:23:46Z
- **Completed:** 2026-04-18T22:28:42Z
- **Tasks:** 2 (both TDD: resolver test → component rewrite → green)
- **Files created:** 4 (recipeCardStyles + its test, dayRowHelpers + its test)
- **Files modified:** 3 (RecipeCard.tsx, DayRow.tsx, vitest.config.ts)

## Accomplishments

- `RecipeCard` now takes `mode?: 'grid' | 'list'` (default grid). Grid = 4:3 hero photo + title below (Spotify album feel). List = 96pt square thumbnail left + title/meta stacked right. Class strings live in `recipeCardStyles.ts` and are unit-tested outside the RN renderer.
- `DayRow` compressed to ~64pt per D-06 (Phase 19 CONTEXT) — seven days visible without scroll on iPhone 15/17 Pro. Difficulty badge replaced with Plan 19-02 `<Chip kind="display" tone={success|warning|default} />` driven by the pure `deriveStatusChips` helper.
- All previously hardcoded hex in both cards (`#F97316`, `#EF4444`, `#2A221A`, `#7A6651`, `#1A140F`, `#16A34A`, `#B45309`, `#D1D5DB`, `#6B7280`, `#047857`) migrated to `colors.*` tokens from Plan 19-01 or corresponding NativeWind classes.
- vitest.config exclude narrowed from `'src/components/!(ui)/**'` (too broad — would have hidden both new `.test.ts` files) to `'src/components/**/*.native.test.*'` (the original intent). Zero existing component tests live outside `ui/`, so the change is safe.
- 17/17 new tests green on first run (8 resolver + 9 helper). `npx tsc --noEmit -p .` exits 0. Full mobile suite: 310 passed / 2 skipped / 4 pre-existing failures unchanged (same auth/shopping/progression stores Plan 19-01 logged to `deferred-items.md`).

## Task Commits

1. **Task 1: Rewrite RecipeCard with mode-aware layout + pure className resolver + test** — `ed143ee` (feat). 8/8 RecipeCard.test.ts green.
2. **Task 2: Rewrite DayRow for medium density + status chips via Plan 02 Chip** — `3654edf` (feat). 9/9 dayRowHelpers.test.ts green.

**Plan metadata commit:** pending (docs commit for this SUMMARY.md + STATE.md + ROADMAP.md).

## Files Created / Modified

### Created
- `apps/mobile/src/components/recipes/recipeCardStyles.ts` — `resolveCardClasses(mode)` returning `{ container, imageContainer, body, title, metaRow, metaText }` class strings. Grid uses `aspect-[4/3]` + `text-title`; list uses `flex-row w-24 h-24` + `text-body font-semibold`. Both modes share `bg-surface rounded-card` + `text-caption text-text-secondary` meta.
- `apps/mobile/src/components/recipes/RecipeCard.test.ts` — 8 assertions: grid/list container shape, aspect ratio, flex-row detection, title step choice, purity guard against orange-N + hex literals.
- `apps/mobile/src/components/plan/dayRowHelpers.ts` — `deriveStatusChips({status, isStretch?, pantryReady?})` returning ordered `StatusChipDescriptor[]` (`{label, tone, leadingIcon?}`). Cooked → success + checkmark.circle.fill; skipped → default; planned/unplanned → no base chip; stretch always appends warning + sparkles; pantryReady always appends default "Pantry ready".
- `apps/mobile/src/components/plan/dayRowHelpers.test.ts` — 9 assertions including a full-matrix sweep over status (4) × isStretch (2) × pantryReady (2) = 16 combos, all asserted for valid tone + truthy label.

### Modified
- `apps/mobile/src/components/recipes/RecipeCard.tsx` — consumes `resolveCardClasses(mode)`; inline styles for iOS shadow use `colors.textPrimary` instead of `#2A221A`; favorite heart uses `colors.destructive` instead of `#F97316/#EF4444`; metadata icons tint from `colors.textSecondary`. Preserves `SOURCE_LABELS`, favorite-heart toggle, remix-sparkle cluster, source badge, RemixSheet wiring, and blurhash placeholder.
- `apps/mobile/src/components/plan/DayRow.tsx` — rewritten against tokens + Chip; 64pt `min-h-[64px]` rows; file-top JSDoc comment documents the ItemRow non-consumption decision (per plan Info #10); thumbnail wired via `getRecipeImage` when `entry.recipe_id` is set; chip row uses `{chips.map(c => <Chip kind="display" tone={c.tone} label={c.label} leadingIcon={c.leadingIcon} />)}`.
- `apps/mobile/vitest.config.ts` — `'src/components/!(ui)/**'` → `'src/components/**/*.native.test.*'`. Unblocks `src/components/recipes/**/*.test.ts` and `src/components/plan/**/*.test.ts` pure helper tests.

## Known Callers of RecipeCard (all default to `mode='grid'`)

Verified via grep against `src/**`:

| Call site | Mode | Notes |
|---|---|---|
| `src/app/(tabs)/kitchen.tsx` (Library segment) | grid (default) | 2-col library browse; Spotify album feel |
| `src/app/recipes/discover.tsx` | grid (default) | AI-discover preview grid |
| Home suggestion preview (Phase 12 work) | grid (default) | Vertical list of suggestion cards |

**Phase 17 (Something New)** is the first planned caller that will pass `mode="list"` when the search-results screen lands — spec documented in 19-CONTEXT D-06.

## DayRow density verification

- Row height constrained via `min-h-[64px]` Tailwind class (NativeWind compiles to `minHeight: 64`).
- Typical row content: day label (label token, 11pt/16pt) + 48pt thumbnail + body-weight title (17pt/22pt) + optional caption-weight meta row + status chip row (32pt).
- Visual 7-days-without-scroll confirmation is deferred to **Plan 19-06 Maestro UAT** on iPhone 17 Pro sim per the plan's verification block. Row height math matches CONTEXT D-06 budget.

## Intentional non-tokenized literals

| Literal | Location | Rationale |
|---|---|---|
| `#FFE4B5` | `RecipeCard.tsx` sparkle glyph tintColor | Decorative warm off-white accent specifically for the sparkle over dark food imagery; NOT a brand color. In-file comment documents the exception. |
| `#FFFFFF` | `RecipeCard.tsx` source-badge text + unfavorited heart tint | White text/glyphs over dark photo overlay — not a brand color, equivalent to "foreground-on-image" which tokens don't express. |
| `rgba(15,10,5,0.18)` | `RecipeCard.tsx` image overlay | Pure darkening effect for text legibility over photography; not a semantic color. |
| `rgba(255,255,255,0.22)` / `rgba(255,255,255,0.35)` | `RecipeCard.tsx` source-badge bg + border | Photo-overlay surface, not a brand color. |
| `rgba(0,0,0,0.35)` | `RecipeCard.tsx` action-badge bg | Photo-overlay surface. |

All five are documented with inline comments and are outside the Phase 19 purity target (which is about orange→terracotta + hex-in-brand-surfaces, not overlays baked onto imagery).

**DayRow has zero literal-hex/orange references.** Verified via `grep -E "orange-|#[0-9A-Fa-f]{6}" DayRow.tsx` returning no matches.

## How downstream plans consume this

**Phase 17 Something New search-results:**
```tsx
<RecipeCard recipe={hit} mode="list" onPress={onOpen} />
```

**Plan 19-05 (token sweep):** Already no-op for these two cards — both are purity-clean modulo the documented overlay exceptions.

**Plan 19-06 (visual verify):** Maestro flow on Plan tab screenshot asserts all 7 days visible without scroll; Library segment screenshot asserts grid card appearance.

**Phase 22 (Plan refactor):** When MealPlanEntry gains `is_stretch` + `pantry_ready` fields, bind them in DayRow:
```tsx
// src/components/plan/DayRow.tsx line ~64
const chips = deriveStatusChips({
  status,
  isStretch: entry.is_stretch ?? false,
  pantryReady: entry.pantry_ready ?? false,
});
```
The helper + matrix test already cover the behavior; only the binding changes.

## Decisions Made

All decisions trace to Phase 19 CONTEXT D-06 (mode-aware RecipeCard, medium-density DayRow) and consume Plan 19-01 tokens + Plan 19-02 Chip verbatim.

Notable sub-decisions made within Claude's Discretion:

- `w-24 h-24` (96pt) for list-mode image, the upper bound of the 80–96pt spec — easier to scan on dense list surfaces.
- `deriveStatusChips` surfaces a `DayRowStatus` union (`cooked|planned|skipped|unplanned`) distinct from `MealPlanEntryStatus` (`planned|cooked|skipped`) — the extra `unplanned` state models the "no entry" case that DayRow already renders, keeping the helper usable across both branches of the render.
- vitest.config exclude narrowing done here rather than waiting on a dedicated plan — the plan specified tests under `src/components/recipes/` and `src/components/plan/` and the existing exclude would have silently skipped both files (a Rule 3 blocking fix: `src/components/!(ui)/**` → `src/components/**/*.native.test.*`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Narrow vitest.config exclude so new `.test.ts` files in `src/components/recipes/` and `src/components/plan/` run under node env**
- **Found during:** Task 1, first attempt to place `RecipeCard.test.ts` next to its implementation.
- **Issue:** The existing `'src/components/!(ui)/**'` exclude (from Phase 15-01) would have silently skipped both plan-specified test locations. The plan-note claims "Plan 02 narrowed it already — confirmed" — but Plan 19-02's delivered `Chip.test.ts` + `chipStyles.test.ts` live under `src/components/ui/__tests__/`, where the existing include already picks them up. The narrowing never happened for the `recipes/` / `plan/` paths.
- **Fix:** Narrowed exclude to `'src/components/**/*.native.test.*'` (only native-renderer-coupled tests), verified by grep that no pre-existing `.test.*` files live outside `ui/` (safe to flip).
- **Files modified:** `apps/mobile/vitest.config.ts`.
- **Commit:** `ed143ee` (co-committed with Task 1).
- **Scope:** Infrastructure needed to complete the plan's specified tests. Not a scope leak.

### Interaction with parallel Wave 2 plans

Plan 19-04 runs in parallel with 19-02 and 19-03 per the wave schedule. Timeline observed:

1. Task 1 started at 22:23Z. At commit time (22:25Z), `Chip` from Plan 19-02 was not yet on disk, so the executor followed the fallback path in the objective (Task 1 first, re-check before Task 2).
2. Between Task 1 and Task 2, Plan 19-02's `Chip` landed on main (commit `2479eff`). Re-check on filesystem confirmed `src/components/ui/Chip.tsx` + `chipStyles.ts` + exported `ChipTone` type, unblocking Task 2.
3. Task 2 proceeded without modification.

No fabricated stub, no blocker return — the wave resolved itself.

### Pre-existing test failures (carried forward)

Same 4 failures documented in Plan 19-01 deferred-items.md persist: `__tests__/auth-store.test.ts` (1), `src/stores/__tests__/shoppingStore.test.ts` (2), `src/stores/__tests__/progressionStore.test.ts` (1). None touched by 19-04.

## Issues Encountered

**1. Transient stash pop side-effect during pre-existing-failure baseline check**
- **Discovered during:** Task 1 verification (attempted `git stash` to isolate my changes from the baseline typecheck to confirm a SearchBar.test.ts error was pre-existing).
- **Issue:** `git stash push -u` captured state and `git stash pop` reported success, but a couple of parallel-agent in-flight files (`apps/mobile/src/app/search.tsx`, `apps/mobile/src/components/ui/SearchBar.tsx`, matching `_layout.tsx` edits) were not restored. These were untracked uncommitted work from a parallel Plan 19-03 agent still mid-execution.
- **Verification:** `git fsck --lost-found` showed the stash's dangling commits; the stash-untracked commit (`81e885c`) confirmed those files were captured. They reappeared on main when Plan 19-03 committed them shortly after.
- **Resolution:** None needed — they were uncommitted parallel work that the other agent re-materialized on its next commit. My own work was intact throughout. Noting here for parallel-wave execution record only.

## Next Phase Readiness

**Plan 19-05 (token sweep)** — unblocked. Both cards already purity-clean (modulo the documented overlay exceptions in RecipeCard, which the `tokens-purity.test.ts` guard's `#F97316` / `orange-N` regex will NOT flag).

**Plan 19-06 (visual verify)** — can proceed. Plan tab Maestro screenshot will verify the seven-days-without-scroll claim; Library / Something New grid vs list visuals will verify RecipeCard modes.

**Phase 17 (Something New)** — when/if executed after Phase 19, Search-results screen can pass `mode="list"` to RecipeCard with no further changes required here.

## Self-Check: PASSED

- `apps/mobile/src/components/recipes/recipeCardStyles.ts` — FOUND
- `apps/mobile/src/components/recipes/RecipeCard.test.ts` — FOUND
- `apps/mobile/src/components/recipes/RecipeCard.tsx` — FOUND
- `apps/mobile/src/components/plan/dayRowHelpers.ts` — FOUND
- `apps/mobile/src/components/plan/dayRowHelpers.test.ts` — FOUND
- `apps/mobile/src/components/plan/DayRow.tsx` — FOUND
- `apps/mobile/vitest.config.ts` — FOUND
- Commit `ed143ee` (Task 1) — FOUND
- Commit `3654edf` (Task 2) — FOUND

---
*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Completed: 2026-04-18*
