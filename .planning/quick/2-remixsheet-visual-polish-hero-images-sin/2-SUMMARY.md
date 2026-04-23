---
phase: quick-2-remixsheet-visual-polish
plan: 1
subsystem: mobile/recipes/remix-ui
tags: [mobile, remix, visual-polish, action-sheet, hero-images, expo-image]
requires: []
provides:
  - VariationCard (private, same-file)
  - ActionSheet-driven overflow for Expand / Save / Modify
affects:
  - apps/mobile/src/components/recipes/RemixSheet.tsx
tech-stack:
  added:
    - expo-image Image component (already in SDK 55 stack — first use in RemixSheet)
    - react-native ActionSheetIOS (new import in this file)
  patterns:
    - Hook-at-top-level via extracted sub-component (same pattern as
      dayRowHelpers + IngredientChecklistRows — pull the map-body into a
      component so useGeneratedRecipeImage can fire per card)
    - Keyword fallback → Gemini swap (getRecipeImage(seed, generatedUri,
      title) — stock photo wins while generatedUri is null, Gemini URL
      takes priority once resolved)
    - View-wraps-Pressable for reliable backgroundColor on CTA
key-files:
  modified:
    - apps/mobile/src/components/recipes/RemixSheet.tsx
decisions:
  - "VariationCard declared in same file (below RemixVariationPreview)
    rather than a separate module — both helpers are only used by
    RemixSheet and share the styles object; extracting would force a
    styles-file split."
  - "No `ingredients` forwarded to useGeneratedRecipeImage — RemixVariation
    carries only {title, description}. Plan prose explicitly called this
    out; enforced in the hook call."
  - "Wrapped Cook-now Pressable in an outer View owning the
    backgroundColor/height/radius after visual UAT showed the Pressable
    failing to paint its backgroundColor. Press/disabled feedback stays on
    the inner Pressable via opacity transforms."
  - "ActionSheetIOS destructiveButtonIndex intentionally unset — none of
    the overflow actions (Expand / Save / Modify) are destructive; Modify
    overwrites but the PreviewSheet flow surfaces that separately."
metrics:
  duration: 33min
  tasks_completed: 2
  completed_date: 2026-04-23
---

# Phase quick-2 Plan 1: RemixSheet Visual Polish Summary

**One-liner:** Added hero images atop each RemixSheet variation card and
collapsed the four-button action row into a single flame-orange
full-width "Cook now" CTA plus an iOS-native ActionSheet overflow, all
inside a same-file `VariationCard` subcomponent so per-card image
generation hooks fire correctly.

## What changed

- **New component:** `VariationCard` (same file, below
  `RemixVariationPreview`) — takes 17 props derived from the parent's
  closures, owns the hero-image hook call, and renders the card body.
- **Hero images (REMIX-VIS-01):** expo-image with `transition={200}`
  crossfade + `cachePolicy: 'memory-disk'`. First render paints a
  keyword-matched Unsplash fallback via `getRecipeImage(seed, null,
  title)`; once `useGeneratedRecipeImage(title, { description })`
  resolves, heroUri flips to the Gemini URL without remount.
- **Collapsed action row (REMIX-VIS-02):** Single primary
  `#B85C2E` full-width 50pt Cook-now CTA (flame icon + 16pt/800 label);
  muted-text "More actions" trigger 12pt below opens an iOS
  ActionSheetIOS with options in stable order: Expand preview / Save as
  new recipe / Modify existing (saved source only) / Cancel
  (cancelButtonIndex). No destructiveButtonIndex.
- **Style cleanup:** Removed unused `actionRow`, `actionBtn`,
  `actionBtnPrimary`, `actionBtnPrimaryText`, `actionBtnOutline`,
  `actionBtnOutlineText`, `actionBtnCook`. Added `variationHero`,
  `variationBody`, `actionBtnCookFull`, `actionBtnCookFullInner`,
  `actionBtnCookFullText`, `moreActionsBtn`, `moreActionsText`. Tweaked
  `variationCard` (removed `padding: 16`, added `overflow: 'hidden'`).
- **Imports:** Added `ActionSheetIOS` from `react-native`; added
  `import { Image } from 'expo-image'`.

## File metrics

- `apps/mobile/src/components/recipes/RemixSheet.tsx`
  - Starting line count (plan reference): **884 lines**
  - Final line count: **927 lines** (+43 net)
  - Commits: 3 (refactor, feat, fix)

## Removed auxiliary styles

All unused after the action-row collapse:

- `actionRow` (was `flexWrap: 'wrap'` + `gap: 8` container)
- `actionBtn` (base button shared by all 4 actions)
- `actionBtnPrimary` (blue primary — used by Expand)
- `actionBtnPrimaryText`
- `actionBtnOutline` (cream-on-orange — Save / Modify)
- `actionBtnOutlineText`
- `actionBtnCook` (flame-orange — now superseded by
  `actionBtnCookFull`)

## Commits

| Task      | Type       | Hash      | Message                                                                       |
|-----------|------------|-----------|-------------------------------------------------------------------------------|
| 1         | refactor   | `d2d4a6a` | `refactor(quick-2): extract VariationCard + add hero image to RemixSheet`     |
| 2         | feat       | `5127aa4` | `feat(quick-2): collapse RemixSheet action row to Cook-now CTA + ActionSheet` |
| follow-up | fix        | `1b099c9` | `fix(quick-2): wrap Cook-now Pressable in backgroundColor View`               |

## UAT screenshots

Captured on iPhone 17 Pro (iOS 26.4 simulator) via the existing dev
client at `apps/mobile/ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app`
with Metro re-started from `apps/mobile/` using `--lan --clear`.

- `/tmp/remix-hero-cards.png` — Variation card 1 with hero image,
  title+badge, description, full-width orange Cook-now CTA, "More
  actions" trigger. **Canonical screenshot for this checkpoint.**
- `/tmp/remix-actionsheet.png` — iOS ActionSheet open showing `Expand
  preview / Save as new recipe / Cancel` (Modify existing correctly
  absent because source is an inline Something-New suggestion).
- `/tmp/remix-cards-2and3.png` — Scrolled down to show cards 2 and 3
  confirming all three variations render the same pattern.

### Pass criteria (all held)

- [x] Each of the 3 cards shows a hero image (~170pt, top corners
      rounded via parent `overflow: hidden` + `borderRadius: 16`).
- [x] First render paints keyword-matched Unsplash fallbacks
      (tagine/pasta/soup — Gemini in these shots had already resolved
      for most cards; the fallback-first invariant is guaranteed by
      `getRecipeImage(seed, null, title)` receiving null until the hook
      completes).
- [x] The [1] / [2] / [3] number badges remain visible in each header.
- [x] Each card shows exactly ONE dominant button: full-width orange
      (#B85C2E), 50pt tall, flame icon + 16pt/800 "Cook now" label.
- [x] "More actions" muted-text trigger sits 12pt below the CTA.
- [x] Tap "More actions" opens iOS ActionSheetIOS with options in
      stable order; Cancel is last and is the cancelButtonIndex.
- [x] Modify existing absent on inline (Something-New) source.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 – Blocking] Cook-now backgroundColor required outer View**

- **Found during:** Task-3 simulator UAT (checkpoint execution)
- **Issue:** Declaring `backgroundColor: '#B85C2E'` directly on the
  `Pressable` left a correctly-sized 50pt gap but no visible orange
  surface. The Pressable reserved layout but did not paint the color.
  Repro was deterministic across multiple bundle reloads.
- **Fix:** Split the CTA into an outer `<View>` that owns
  `backgroundColor + height + borderRadius + overflow:'hidden'` and an
  inner `<Pressable>` with `flex: 1` laying out the flame icon + label
  row. Press/disabled opacity stays on the Pressable.
- **Files modified:** `apps/mobile/src/components/recipes/RemixSheet.tsx`
- **Commit:** `1b099c9`

**2. [Rule 3 – Blocking] Metro running from wrong cwd blocked verification**

- **Found during:** Task-3 simulator UAT
- **Issue:** The running Metro bundler had been launched from the repo
  root instead of `apps/mobile/`, causing bundle requests to fail with
  `Unable to resolve module ./index from /Users/patrickrichards/DinnerTime/.`.
  The dev client was serving a stale cached JS bundle from before this
  plan's code changes — every one of my post-edit screenshots reflected
  old code.
- **Fix:** Killed the bad Metro (PIDs 92175/92155), restarted it from
  `apps/mobile/` with `--dev-client --lan --clear` per CLAUDE.md's Dev
  Environment Startup guidance. This is an environment remediation, not
  a code change — it doesn't affect `apps/mobile/src`.
- **Note:** The constraint said to not restart the backend, which I
  didn't; I only restarted Metro, which is the mobile dev tooling.
  Backend server on port 3000 remained untouched.

### No Rule-1 / Rule-2 / Rule-4 deviations

Zero scope creep. No architectural changes. No extra files touched. No
new dependencies. `git diff --stat HEAD~3..HEAD` shows exactly one
file: `apps/mobile/src/components/recipes/RemixSheet.tsx` (+216 / -172).

## Known stubs

None. All data paths are wired end-to-end:

- Hero image: real `useGeneratedRecipeImage` + `getRecipeImage` fallback
  chain (not a placeholder component).
- Cook now: dispatches to unchanged `handleCookNow(i, v)` which does
  the real updateRecipe/saveRecipe + router.push to cooking flow.
- ActionSheet options dispatch to unchanged `handleExpand`,
  `handleSaveAsNew`, `handleModifyExisting`.

## Verification

- `cd apps/mobile && npx tsc --noEmit` — zero new errors introduced in
  RemixSheet.tsx (checked after each commit).
- Biome not configured in this repo (`pnpm --filter mobile lint` resolves
  to `expo lint`; no biome config found). Skipped per the plan's
  "or no new violations vs baseline" allowance.
- Simulator UAT walked all pass criteria with 3 screenshots saved to
  `/tmp`.
- `git diff --stat` confirms only `apps/mobile/src/components/recipes/RemixSheet.tsx`
  changed.

## Requirements completed

- **REMIX-VIS-01** — Hero images on every variation card (non-blocking
  render with keyword fallback → Gemini swap).
- **REMIX-VIS-02** — Single primary Cook-now CTA + iOS ActionSheet
  overflow for Expand / Save / Modify.

## Self-Check: PASSED

- [x] `apps/mobile/src/components/recipes/RemixSheet.tsx` present and
      modified (927 lines).
- [x] Commit `d2d4a6a` present (`git log --oneline | grep d2d4a6a`).
- [x] Commit `5127aa4` present.
- [x] Commit `1b099c9` present.
- [x] `/tmp/remix-hero-cards.png` present (1.8MB PNG).
- [x] `/tmp/remix-actionsheet.png` present (1.8MB PNG).
- [x] `/tmp/remix-cards-2and3.png` present (1.1MB PNG).
- [x] Typecheck clean for this file.
- [x] `grep -n "import { Image } from 'expo-image'" RemixSheet.tsx` →
      line 14.
- [x] `grep -n "ActionSheetIOS" RemixSheet.tsx` → import at line 11,
      usage at `ActionSheetIOS.showActionSheetWithOptions(...)` inside
      `VariationCard.openOverflow`.
- [x] `grep -n "function VariationCard" RemixSheet.tsx` → line 588.
- [x] `useGeneratedRecipeImage(variation.title, { description: variation.description })`
      present, no `ingredients` access.
