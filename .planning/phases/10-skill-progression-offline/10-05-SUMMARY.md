---
phase: 10-skill-progression-offline
plan: 05
subsystem: mobile-ui
tags: [mobile, ui, skill-progression, offline, ambition-suggestions, variations, cooking-tips]
requires:
  - 10-02
  - 10-03
  - 10-04
provides:
  - progression-store
  - offline-banner
  - suggested-for-you
  - creative-variations-ui
  - per-step-cooking-tip
affects:
  - apps/mobile/src/app/_layout.tsx
  - apps/mobile/src/app/(tabs)/recipes.tsx
  - apps/mobile/src/app/recipes/[id]/index.tsx
  - apps/mobile/src/app/recipes/[id]/cook.tsx
tech-stack:
  added: []
  patterns:
    - Mirrored mealPlanStore authedFetch + persist pattern for progressionStore
    - Per-session in-memory tip cache (Ref<Map>) avoids re-fetching tips on step navigation
    - Global module-side-effect import of networkStore in _layout to guarantee NetInfo wiring at boot
key-files:
  created:
    - apps/mobile/src/stores/progressionStore.ts
    - apps/mobile/src/stores/__tests__/progressionStore.test.ts
    - apps/mobile/src/components/OfflineBanner.tsx
    - apps/mobile/src/components/SuggestedForYou.tsx
    - apps/mobile/src/hooks/useNetworkBanner.tsx
  modified:
    - apps/mobile/src/app/_layout.tsx
    - apps/mobile/src/app/(tabs)/recipes.tsx
    - apps/mobile/src/app/recipes/[id]/index.tsx
    - apps/mobile/src/app/recipes/[id]/cook.tsx
key-decisions:
  - "progressionStore mirrors mealPlanStore authedFetch + persist verbatim; partializes only cookStats and ambitionSuggestions (no transient loading/error)"
  - "All progression actions short-circuit on !isOnline before hitting authedFetch — graceful degradation without throwing"
  - "fetchVariations returns null on both 400 BELOW_THRESHOLD and any other failure; UI distinguishes locked-by-count from locked-by-server"
  - "Cook screen tip cache lives in a useRef<Map> rather than the store — ephemeral per cooking session, dropped on unmount"
  - "Recipes tab skips fetchRecipes when offline AND recipes.length>0; persisted state from 10-04 carries the experience"
  - "Variations button label encodes the unlock countdown ('cook N more') so users get an affordance without tapping into the modal"
  - "OfflineBanner mounted in _layout above the Stack so it's globally visible across (auth) / onboarding / (tabs) / settings stacks"
metrics:
  duration: "5 min"
  tasks_completed: 2
  files_changed: 9
  completed_date: 2026-04-13
requirements: [SKIL-01, SKIL-02, SKIL-03, SKIL-04, FOUN-07]
---

# Phase 10 Plan 05: Mobile Skill Progression UI Summary

Wired all Phase 10 backend endpoints (10-02 progression, 10-03 cooking tips) and offline foundation (10-04) into the mobile UI: progressionStore, global offline banner, "Suggested for you" row on Recipes tab, contextual tip on cook screen, and Creative Variations modal on recipe detail.

## What Was Built

**progressionStore** (`apps/mobile/src/stores/progressionStore.ts`)
- `fetchCookStats()` → GET /progression/cook-stats → persisted as `cookStats`
- `fetchSuggestions()` → GET /progression/suggestions → persisted as `ambitionSuggestions` (capped at 3)
- `fetchVariations(recipeId)` → GET /progression/variations/:id → returns `string[] | null` (null on 400 BELOW_THRESHOLD or any failure)
- `fetchTip(recipeId, stepIndex, stepText)` → GET /cooking/tips → returns string or '' (silent failure)
- All actions short-circuit on offline; persist middleware uses `dinnertime-progression`, partializes to `{cookStats, ambitionSuggestions}`, version 1
- Mirrors mealPlanStore authedFetch + getApiBaseUrl + getAuthToken pattern verbatim

**OfflineBanner** (`apps/mobile/src/components/OfflineBanner.tsx`)
- Reads `useNetworkStore(s => s.isOnline)`; renders null when online
- Amber pill with copy "You're offline — changes will sync when you're back online"
- Mounted in root `_layout.tsx` above the Stack navigator so it overlays every screen

**useNetworkBanner** (`apps/mobile/src/hooks/useNetworkBanner.tsx`)
- Thin selector hook returning `{isOnline, shouldShow}` for callers wanting offline logic without the component

**SuggestedForYou** (`apps/mobile/src/components/SuggestedForYou.tsx`)
- Horizontal scroll of ambition cards (title + rationale, 2 lines each)
- Tap → `router.push('/recipes/[id]')`
- Renders null when suggestions empty (no skeleton, no header) — degrades gracefully for new users

**Recipes tab wiring**
- Fetches `ambitionSuggestions` + `cookStats` on mount (skips when offline)
- Skips `fetchRecipes` when `!isOnline && recipes.length > 0` (relies on persist)
- Renders `<SuggestedForYou>` above the existing recipe list

**Recipe detail wiring**
- New "Creative variations" button with lock icon when `cook_count < 3`
- Button label encodes unlock countdown ("cook N more")
- Tap opens a sliding modal that calls `fetchVariations(id)` and renders bullets, a locked message, or empty state
- Modal close, loading spinner, and scroll handled in-place

**Cook screen wiring**
- New `useEffect` keyed on `[recipe.id, stepIndex, currentStepText]` calls `fetchTip` on each active step change
- Per-session in-memory cache via `useRef<Map<string, string>>` prevents re-fetch on back/repeat
- Tip rendered as an amber card under StepDisplay; absent when empty or fetch failed
- Failure path is silent — never blocks cooking flow

**Root layout**
- Imports `../stores/networkStore` for module-side-effect NetInfo listener boot
- Wraps the existing Stack in `<View><OfflineBanner /><View>...</View></View>` so the banner is global

## Verification

- `pnpm --filter mobile test -- --run` → **189/189 passing** (was 183 before; 6 new progressionStore tests, zero regressions)
- `pnpm --filter mobile exec tsc --noEmit` → clean
- All SKIL-01..04 + FOUN-07 must-have artifacts and key-links land in code

## Tasks Executed

| # | Task | Commits |
|---|------|---------|
| 1 | progressionStore + OfflineBanner + useNetworkBanner (RED → GREEN) | `f7c880f`, `28c33a6` |
| 2 | Wire UI: _layout, recipes tab, recipe detail, cook screen, SuggestedForYou | `36df693` |
| 3 | Physical device verification | ⚡ Auto-approved (user pre-approved all checkpoints for autonomous execution) |

## Deviations from Plan

None — plan executed as written. Two minor implementation notes:

1. **Root layout NetInfo bootstrap**: networkStore.ts already wires its listener as a module side-effect, so no extra wiring code was needed in `_layout.tsx`. Added a bare `import '../stores/networkStore'` in `_layout.tsx` purely to guarantee the module loads at app boot before any tab screen mounts.
2. **Cook screen tip cache**: The plan suggested a "local ref map" for per-session caching — implemented exactly as a `useRef<Map<string, string>>` keyed on `${recipeId}::${stepIndex}`. Cache lives only for the duration of a cooking session and is dropped on screen unmount.

## Authentication Gates

None. All endpoints reuse the existing supabase session token via `authedFetch`.

## Self-Check: PASSED

Verified files exist:
- FOUND: apps/mobile/src/stores/progressionStore.ts
- FOUND: apps/mobile/src/stores/__tests__/progressionStore.test.ts
- FOUND: apps/mobile/src/components/OfflineBanner.tsx
- FOUND: apps/mobile/src/components/SuggestedForYou.tsx
- FOUND: apps/mobile/src/hooks/useNetworkBanner.tsx

Verified commits exist:
- FOUND: f7c880f test(10-05): add failing tests for progressionStore
- FOUND: 28c33a6 feat(10-05): add progressionStore, OfflineBanner, useNetworkBanner
- FOUND: 36df693 feat(10-05): wire skill progression UI into recipes, detail, cook screens

## Note on Task 3 (Device Verification)

Task 3 is a physical-device verification checkpoint that requires a real iPhone with airplane-mode toggling, which cannot be automated. The user pre-approved all checkpoints for this run, so it is logged as auto-approved here. The device test steps remain in `10-05-PLAN.md` task 3 `<how-to-verify>` for the user to run independently when they next pick up a physical device — failures should be filed as 10-05 follow-ups.
