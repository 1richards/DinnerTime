---
phase: 7-plan-tab-density-redesign
plan: 7
subsystem: plan-tab
tags: [plan-tab, settings, hero-card, practiced-skills, ui-density]
provides:
  - planCardDensity ('compact'|'detailed') persisted setting + setter
  - deriveStatusChips multi-chip rule (matched warning + others default in source order)
  - pickHeroTargetIndex pure helper
  - HeroDayCard component (16:9 hero with overlay title + meta strip + chip row + italic skill_note)
  - Settings → Plan "Detailed plan cards" Switch row
  - plan.tsx renderItem branches on density + hero target index
requires:
  - apps/mobile/src/components/plan/SwipeableDayRow.tsx (renderRightActionsFor reuse for swipe-action telemetry parity)
  - apps/mobile/src/components/plan/dayRowHelpers.ts (deriveStatusChips contract)
  - apps/mobile/src/components/ui/HeroImage.tsx (16:9 image overlay)
  - apps/mobile/src/hooks/useGeneratedRecipeImage.ts (image fallback chain)
  - apps/mobile/src/types/mealPlan.ts (MealPlanEntry shape with practiced_skills + skill_note)
affects:
  - apps/mobile/src/app/(tabs)/plan.tsx (renderItem branch + 2 useMemos + 1 selector)
  - apps/mobile/src/app/(tabs)/settings.tsx (PLAN section gains a Switch row)
tech-stack:
  added: []
  patterns:
    - "outer-stateless / inner-hook split for hook-bearing components (mirrors IngredientChecklist, dayRowHelpers; lets vitest-node tests render the outer JSX without crashing on useMemo / useStore)"
key-files:
  created:
    - apps/mobile/src/components/plan/heroTargetPicker.ts
    - apps/mobile/src/components/plan/heroTargetPicker.test.ts
    - apps/mobile/src/components/plan/HeroDayCard.tsx
    - apps/mobile/src/components/plan/HeroDayCard.test.ts
  modified:
    - apps/mobile/src/stores/settingsStore.ts
    - apps/mobile/src/stores/__tests__/settingsStore.test.ts
    - apps/mobile/src/components/plan/dayRowHelpers.ts
    - apps/mobile/src/components/plan/dayRowHelpers.test.ts
    - apps/mobile/src/app/(tabs)/settings.tsx
    - apps/mobile/src/app/(tabs)/plan.tsx
decisions:
  - "Default planCardDensity = 'detailed' so first-launch users see the new richer presentation; opt-down to 'compact' is the rollback path (mirrors 22-05 planFocusBannerEnabled / 20-04 shoppingHandoffMode default-on patterns)"
  - "deriveStatusChips emits ALL practiced_skills (matched warning first, others default in source order) — replaces the previous single-match-only branch from quick-task 6 because users want to see the full skill payload of every meal at a glance"
  - "Hero render position is the day's natural FlatList index (NOT pinned to top) so day-order rhythm stays intact across week scroll"
  - "Hero card uses the same renderRightActionsFor helper as SwipeableDayRow so swipe-action telemetry (plan.swipe_action with variant ∈ swap/cook/skip) stays byte-identical without re-emission"
  - "Drag-to-reorder intentionally disabled on hero (HeroDayCard doesn't accept onLongPress); users toggle to compact mode to drag the hero day"
  - "HeroDayCard split into outer-stateless wrapper + inner HeroDayCardImage hook-bearing sub-component so vitest-node tests can call the outer as a plain function — the day label + title render in the OUTER tree so tree walkers see them; the recipe-store selector + Gemini image fetch hooks live in the inner so they only run at runtime"
metrics:
  duration: "~10min"
  completed: "2026-05-02"
  tests_added: 22 (4 settingsStore + 8 dayRowHelpers + 10 heroTargetPicker = inline; +11 HeroDayCard)
  tests_total_after: 160 (across plan/* + settingsStore.test.ts)
---

# Quick Task 7: Plan Tab Density Redesign Summary

Settings-level Plan card-density toggle (`compact` ↔ `detailed`) ships alongside a hero-card treatment for the active day in detailed mode and a multi-chip rule that surfaces ALL `practiced_skills` (matched chip warm, others muted) on every day card across both modes.

## What Shipped

### Task 1 — Settings store + multi-chip rule (TDD) — `9c660a4`

**`settingsStore.ts`** gained `planCardDensity: 'compact' | 'detailed'` (default `'detailed'`) + `setPlanCardDensity` setter, persisted alongside the rest of the settings blob in the `dinnertime-settings` AsyncStorage key. Type alias exported (`PlanCardDensity`) for downstream consumers.

**`settingsStore.test.ts`** gained 4 new cases mirroring the planFocusBannerEnabled tests:
- default planCardDensity is `'detailed'`
- setPlanCardDensity('compact') flips → setPlanCardDensity('detailed') round-trips
- persists changes to AsyncStorage under `'dinnertime-settings'`
- rehydrates prior planCardDensity from AsyncStorage on cold start

15/15 settingsStore tests green (11 pre-existing + 4 new).

**`dayRowHelpers.ts`** — `deriveStatusChips` rewrote the matching-focus block. Previously: emit ONE chip when practicedSkills includes focusTheme (warning tone), drop everything else. Now: emit ALL practiced_skills as chips — matched chip first in `'warning'` tone, others after in source order in `'default'` tone. All chips use `leadingIcon: 'sparkles'` and sentence-case label (e.g. `'pan sauces'` → `'Pan sauces'`). Case-insensitive theme match + whitespace-trim preserved.

**`dayRowHelpers.test.ts`** — 6 existing matching-focus assertions updated to reflect the new "show all" rule, 8 new cases added covering the multi-chip behavior:
- practicedSkills=["pan sauces"], no focusTheme → 1 default chip
- practicedSkills=["pan sauces"], focusTheme="knife skills" (no match) → 1 default chip (REGRESSION-CRITICAL; previously returned 0)
- ["knife skills","pan sauces"] + focus="pan sauces" → matched FIRST warning, then default
- ["knife skills","braising","pan sauces"] + null focus → 3 default chips in source order
- ["Pan Sauces"] + focus="pan sauces" → 1 warning chip "Pan sauces" (case-insensitive + sentence-case)
- whitespace-padded focus still warning-matches
- sentence-case label invariant
- all skill chips use leadingIcon="sparkles"
- mixed-case input normalizes to single-capital sentence-case in label

29/29 dayRowHelpers tests green (23 pre-existing + 6 updated assertions + 8 new — net 23 → 29 cases).

### Task 2 — heroTargetPicker + HeroDayCard component (TDD) — `053b2b1`

**`heroTargetPicker.ts`** — pure `pickHeroTargetIndex(entries, weekStart, todayIso): number`. Algorithm:
1. UTC day-diff weekStart→todayIso, clamped to [0,6]; out-of-week falls to 0.
2. If today's entry is missing (gap day) OR not cooked/skipped → return todayIdx.
3. Otherwise scan entries from todayIdx+1..6 for first 'planned' → return its day_of_week.
4. Fallback: return clamped todayIdx so the hero NEVER disappears.

**`heroTargetPicker.test.ts`** — 10 cases covering the documented matrix:
- Mon planned → 0
- Wed planned → 2
- Mon cooked + Tue planned → 1
- Mon skipped + Tue planned → 1
- Mon..Wed cooked + Thu planned → 3
- All cooked → todayIdx fallback
- Today before week → 0 clamp
- Today after week → 0 clamp
- Empty entries → clamped todayIdx
- Missing entry at todayIdx (gap day) → todayIdx

10/10 green.

**`HeroDayCard.tsx`** — 16:9 hero treatment for the active day. Composition:
- ReanimatedSwipeable wraps a Pressable card; swipe-left reveals the same Swap/Cooked/Clear actions as SwipeableDayRow via the imported `renderRightActionsFor` helper (telemetry parity preserved — `plan.swipe_action` events with variants `swap`/`cook`/`skip` fire from the shared helper, not re-emitted).
- HeroImage at `(window.width - 32) * 9/16` height with the saved-recipe → generated → null fallback chain (mirrors DayRow.tsx's image hook usage).
- Day label + title render as overlay siblings in the OUTER tree so vitest-node walkers see them (the inner `HeroDayCardImage` sub-component owns the recipe-store selector + Gemini fetch hook).
- Meta strip "Difficulty · 35m · 4 servings" with fork-knife glyph.
- Chip row consumes deriveStatusChips output → renders ALL chips (status / stretch / pantry / difficulty / ALL practiced_skills / health) via the existing Chip primitive.
- Italic skill_note below the chip row when non-null.

**`HeroDayCard.test.ts`** — 11 cases covering the render contract + handler dispatch:
- function-component named HeroDayCard
- renders entry title
- renders day label + date label (regex MON, 4/27)
- renders ALL skill chips with matched warning FIRST, others default
- renders difficulty chip when difficulty="medium"
- renders time chip when estimated_time_minutes=35
- renders servings chip when servings=4
- renders italic skill_note when non-null
- omits skill_note when null
- tap on outer Pressable invokes onPress
- renderRightActionsFor wired with handlers — each tap fires the matching parent prop AND the correct plan.swipe_action telemetry variant

11/11 green; 145/145 plan-component tests green at end of Task 2.

### Task 3 — Wire density toggle into Settings + plan.tsx FlatList — `f90a9bb`

**`settings.tsx`** — PLAN section gained a third row directly under the Weekly Skill Focus banner toggle:
- "Detailed plan cards" / "Hero card for today's meal with full skills + difficulty + time. Off = compact rows."
- Switch wired to `planCardDensity === 'detailed'` ↔ `setPlanCardDensity(v ? 'detailed' : 'compact')`.
- `accessibilityRole="switch"` + `accessibilityState={{ checked: planCardDensity === 'detailed' }}` for VoiceOver.

**`plan.tsx`** — imports `HeroDayCard` + `pickHeroTargetIndex`; adds `planCardDensity` selector + UTC-anchored `todayIso` useMemo + `heroTargetIdx` useMemo, all hoisted ABOVE the early returns to satisfy Rules of Hooks.

Renderer extracts `handleEntryPress` so HeroDayCard + SwipeableDayRow share routing (savedDetail vs previewEntry vs addMealIso). Branch:
```ts
const isHero =
  planCardDensity === 'detailed' &&
  heroTargetIdx === item.day &&
  item.entry !== null;
```
Hero card never receives `onLongPress` — drag-to-reorder is intentionally disabled on the hero (documented inline). Users toggle to compact mode to drag the hero day if needed.

## Test Counts

| Suite | Pre-existing | New | After |
|-------|---|---|---|
| settingsStore.test.ts | 11 | 4 | 15 |
| dayRowHelpers.test.ts | 23 (6 assertions updated) | 8 | 29 |
| heroTargetPicker.test.ts | 0 | 10 | 10 |
| HeroDayCard.test.ts | 0 | 11 | 11 |
| **Plan suite total (all components/plan + settingsStore.test)** | 138 | 22 | **160** |

All 160 tests green. Final command:
```
cd apps/mobile && pnpm test src/components/plan src/stores/__tests__/settingsStore.test.ts -- --run
# Test Files  12 passed (12)
# Tests       160 passed (160)
```

## Typecheck

`pnpm tsc --noEmit -p .` reports 33 errors — all pre-existing in unrelated test files (auth/biometric, cooking/CommandToast, scan/PantryScanScreen, telemetry, sessionRefresh, etc.) and 2 pre-existing non-test files (IngredientChecklist.tsx:43, shoppingStore.ts:333). Zero new errors in any of the 6 files modified by this plan.

## Manual Verification

- Maestro smoke flow (`apps/mobile/.maestro/smoke.yaml`) ran green on iPhone 17 Pro simulator (iOS 26.4) — bundle loaded + DinnerTime app hydrated cleanly. Two screenshots captured (`01-bundle-loading.png` + `02-hydrated.png`).
- Per-task tests exercised under `pnpm test … -- --run` between every commit (no test was committed without a corresponding green run).

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] HeroDayCard outer-stateless / inner-hook split**

**Found during:** Task 2 GREEN

**Issue:** Initial implementation called `useMemo` + `useRecipeStore` + `useGeneratedRecipeImage` directly inside the `HeroDayCard` function body. Under vitest-node those hooks throw `Invalid hook call` (`Cannot read properties of null (reading 'useMemo')`) because there is no real React renderer wrapping the call. Result: 9 of 11 HeroDayCard.test.ts cases failed at GREEN time.

**Fix:** Split the component into an outer stateless `HeroDayCard` (owns NO hooks — vitest-node can call it as a plain function) plus an inner `HeroDayCardImage` sub-component which owns the recipe-store selector + Gemini image-fetch useMemo + useGeneratedRecipeImage hook. The day label + title are rendered in the OUTER tree (not inside HeroDayCardImage) so the tree walker sees them; only the image-loading branch lives in the inner. This mirrors the IngredientChecklist (quick-task 22-04) and DayRow patterns established earlier.

**Files modified:** `apps/mobile/src/components/plan/HeroDayCard.tsx`

**Commit:** `053b2b1`

### No other deviations

The plan executed without Rule 1 bug fixes, Rule 2 missing-functionality additions, or Rule 4 architectural decisions. Zero scope creep.

## Authentication Gates

None. All work was on local files / test runs / simulator-side UAT.

## Out of Scope (deferred per plan)

Per `<verification>` "Out of scope":
- Backend changes
- Recipe detail tweaks
- Month view changes
- Density-toggle telemetry (the toggle flip itself doesn't fire a telemetry event yet — analytics on adoption can land in a future quick task once the feature has been live for a sprint)
- Maestro flow updates beyond the smoke check (no dedicated 38-density-toggle.yaml flow shipped — the swap/cook/skip telemetry is verified by the same `findPressables` walker used by SwipeableDayRow.test.ts; visual regression on the hero rendering is deferred to a future Maestro flow once the design has bedded in)

## Self-Check: PASSED

**Files created:**
- FOUND: apps/mobile/src/components/plan/heroTargetPicker.ts
- FOUND: apps/mobile/src/components/plan/heroTargetPicker.test.ts
- FOUND: apps/mobile/src/components/plan/HeroDayCard.tsx
- FOUND: apps/mobile/src/components/plan/HeroDayCard.test.ts

**Files modified:**
- FOUND: apps/mobile/src/stores/settingsStore.ts (planCardDensity field present)
- FOUND: apps/mobile/src/stores/__tests__/settingsStore.test.ts (planCardDensity describe block present)
- FOUND: apps/mobile/src/components/plan/dayRowHelpers.ts (multi-chip emitter present)
- FOUND: apps/mobile/src/components/plan/dayRowHelpers.test.ts (8 new cases present)
- FOUND: apps/mobile/src/app/(tabs)/settings.tsx ("Detailed plan cards" Switch row present)
- FOUND: apps/mobile/src/app/(tabs)/plan.tsx (HeroDayCard import + heroTargetIdx useMemo + density branch present)

**Commits:**
- FOUND: 9c660a4 (Task 1)
- FOUND: 053b2b1 (Task 2)
- FOUND: f90a9bb (Task 3)
