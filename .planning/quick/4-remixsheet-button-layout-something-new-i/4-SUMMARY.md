---
phase: 4-remixsheet-button-layout-something-new-i
plan: 01
subsystem: [recipes/remix, suggestions/something-new, hooks]
tags: [quick, ui-polish, ux, hook-rework, asyncstorage, maestro]
dependency-graph:
  requires:
    - "apps/mobile/src/hooks/useGeneratedRecipeImage.ts (existing hook)"
    - "@react-native-async-storage/async-storage (already in deps)"
    - "apps/mobile/.maestro/_ensure-logged-in.yaml (existing helper)"
  provides:
    - "Status-aware useGeneratedRecipeImage (url + status: loading|resolved|failed)"
    - "Session-sticky failed semantics (no retry loop on null resolve)"
    - "Cross-session persistence via AsyncStorage key 'dinnertime-image-cache'"
    - "Centered Cook now CTA + inline More actions pill in VariationCard"
    - "Gray skeleton tile for PreviewRecipeCard first-paint"
  affects:
    - "RemixSheet.tsx (VariationCard + RemixVariationPreview)"
    - "SomethingNewResults.tsx (PreviewRecipeCard)"
    - "SuggestionCard.tsx"
tech-stack:
  added:
    - "AsyncStorage key 'dinnertime-image-cache' (hook-internal, not in stores/)"
  patterns:
    - "Fire-and-forget module-level hydration with listener notification queue"
    - "Attempted-but-null entry for session-sticky failed state"
    - "Regex wildcard Maestro selectors for AX-tree-brittle Text matches"
key-files:
  created:
    - ".planning/quick/4-remixsheet-button-layout-something-new-i/4-PLAN.md"
    - ".planning/quick/4-remixsheet-button-layout-something-new-i/4-SUMMARY.md"
    - ".planning/quick/4-remixsheet-button-layout-something-new-i/deferred-items.md"
    - "apps/mobile/.maestro/quick-4-button-skeleton-shot.yaml"
  modified:
    - "apps/mobile/src/hooks/useGeneratedRecipeImage.ts"
    - "apps/mobile/src/components/recipes/RemixSheet.tsx"
    - "apps/mobile/src/components/suggestions/SomethingNewResults.tsx"
    - "apps/mobile/src/components/suggestions/SuggestionCard.tsx"
decisions:
  - "Kept the hook's module-level Map cache (not lifted to Zustand) — session scope is correct; AsyncStorage hydration covers cross-session."
  - "Failed (null) Gemini resolves intentionally NOT persisted so retry is possible next session; within-session stickiness comes from `attempted: true`."
  - "Skeleton tile rendered as a sibling `previewSkeletonStyles.card` (not wrapping RecipeCard) — reuses RecipeCard grid margins visually but avoids touching RecipeCard per plan constraint."
  - "Wrapped More actions icon+text in an inner `<View>` instead of restructuring Pressable — preserves existing handler/disabled logic untouched."
metrics:
  duration_min: 18
  tasks_completed: 3
  completed_date: "2026-04-23"
---

# Phase 4 Plan 01: RemixSheet Button Layout + Something New Image Flash Summary

**One-liner:** Status-aware `useGeneratedRecipeImage` with AsyncStorage cross-session cache + per-card skeleton fallback eliminates Something New stock-photo flash; Cook-now and More-actions pills in VariationCard now center/row-align correctly.

## Scope

Two coordinated UI/hook fixes in one quick plan. Both are user-visible quality issues on currently-shipped flows (Phase 3a-UI polish and Phase 17 Something New).

## What Shipped

### Part A — RemixSheet VariationCard button layout (Task 1)

`apps/mobile/src/components/recipes/RemixSheet.tsx`

- **Cook now pill centering** — `actionBtnCookFullInner` style: replaced `flex: 1` with explicit `height: '100%', width: '100%'`. The outer `actionBtnCookFull` View has a fixed 50pt height but no flex container, so `flex: 1` on the inner Pressable had nothing to stretch into. Explicit 100% dimensions let the Pressable fill the parent and `alignItems: 'center' + justifyContent: 'center'` centers the row.
- **More actions inline layout** — Wrapped the ellipsis `<SymbolIcon>` + label `<Text>` in an inner `<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>`. Pressable-as-layout-container occasionally fails to flex its own children on iOS; the inner View guarantees a row.

No handler/disabled logic changes. `styles.moreActionsPill` definition unchanged (still provides pill chrome).

### Part B — Status-aware hook + AsyncStorage + skeleton (Task 2)

`apps/mobile/src/hooks/useGeneratedRecipeImage.ts` (rewritten hook body; helpers preserved):

- **Return shape changed** from `string | null` to `{ url: string | null, status: 'loading' | 'resolved' | 'failed' }`.
- **Status derivation** (exact rules per plan):
  - No title OR skip=true → `{ url: null, status: 'resolved' }` (nothing to wait on)
  - Cache hit with url → `{ url, status: 'resolved' }`
  - Cache hit with `attempted: true, url: null` → `{ status: 'failed' }`
  - Cache hit with inflight → `{ status: 'loading' }`, subscribed to resolve
  - No entry (or pre-hydration) → `{ status: 'loading' }`, fetch kicked off after hydration
- **Session-sticky failed state** — added `attempted: boolean` to the internal `Entry` type. A completed fetch that returned null sets `attempted: true, url: null`. Subsequent mounts for the same key short-circuit to status='failed' without re-fetching.
- **AsyncStorage persistence** — new module-level `hydrateFromStorage()` fires on module load (fire-and-forget, no await). `persistToStorage()` writes only non-null URLs on successful resolve. Failed attempts are NOT persisted so retry is possible next session. Hooks that mount before hydration completes queue their `evaluate()` via a `hydrationListeners` Set — avoids firing an HTTP call for a title that's about to be found on disk.
- **Storage key:** `'dinnertime-image-cache'`, shape `Record<string, { url: string }>`.

`apps/mobile/src/components/suggestions/SomethingNewResults.tsx`:
- Updated PreviewRecipeCard destructure to `{ url: generatedUri, status }`.
- **Skeleton branch** — early-return before the main JSX when `status === 'loading' && !recipe.image_url`. Renders a `<Pressable>` wrapping gray hero tile + two bars (title/subtitle) matching RecipeCard grid dimensions. Prevents `RecipeCard`'s keyword-stock fallback from flashing during Gemini resolve.
- **New StyleSheet `previewSkeletonStyles`** appended to the bottom of the file — flat `#F1EAE0` tone (same as variationHero), no animation, marginHorizontal: 16, 140pt hero, identical shadow/radius to RecipeCard preview mode so the resolve is a content swap (no layout reflow).

`apps/mobile/src/components/recipes/RemixSheet.tsx` call sites (RemixVariationPreview line 532, VariationCard line 636):
- Destructure updated: `const { url: generatedUri } = useGeneratedRecipeImage(...)`.

`apps/mobile/src/components/suggestions/SuggestionCard.tsx` (line 139):
- Same destructure update.

### Task 3 — Maestro iOS-sim UAT

New flow `apps/mobile/.maestro/quick-4-button-skeleton-shot.yaml` — captures both fixes in one run:

**Shot A (`quick-4-a-skeleton.png`)**
- Landed on Kitchen → Something New post-login.
- Tapped search pill, typed `"zaatar eggplant shakshuka fresh-1776975959"` (timestamp-nonced query to force Gemini cache miss), pressed Enter.
- Waited on `".*ideas for.*"` (results toolbar text — distinct from loading-message phrasing).
- Screenshot shows "3 ideas for "zaatar eggplant shakshuka fresh-1776975959"" toolbar and **TWO gray PreviewRecipeCard skeleton tiles** (hero + title/subtitle bars). No keyword-stock photos visible.

**Shot B (`quick-4-b-remix-buttons.png`)**
- Switched to Recipe Box segment, tapped "Lemon Garlic Butter Shrimp with Rice and Broccoli".
- Opened hero-right `More options` overflow → tapped `Remix` → tapped `Surprise me` → waited for variations.
- Screenshot shows VariationCard with:
  - Orange Cook now pill: flame icon + "Cook now" label **centered both axes** ✓
  - More actions pill: ellipsis (•••) + "More actions" label **inline on a single row** ✓

Both screenshots saved to `apps/mobile/.maestro/screenshots/quick-4/` (directory is gitignored per existing project convention).

## Verification

- `cd apps/mobile && npx tsc --noEmit` — 0 errors in any of the 4 edited files. Pre-existing test-file errors logged to `deferred-items.md` (out of scope — not caused by this plan).
- Maestro flow: all 23 steps COMPLETED on the final run.
- All 3 visual UAT criteria verified by Claude via screenshot inspection — auto-approved in auto mode.

## Deviations from Plan

### Adjustments during execution

**1. [Rule 3 — Blocking: Maestro selector quirk] Used regex wildcards on Text matchers**
- **Found during:** Task 3 first Maestro run.
- **Issue:** Bare-literal `assertVisible: "Surprise me"` and `"More actions"` failed the visibility assertion even when the text was clearly rendered in the screenshot. Maestro's AX tree sometimes doesn't expose plain Text node labels as exact-match selectors.
- **Fix:** Switched to regex substring form (`.*Surprise me.*`, `.*More actions.*`, `.*Cook now.*`) — same pattern CLAUDE.md's Maestro selector notes document and that existing flows (quick-3, 27) rely on.
- **Commit:** d75e8d4 (Task 3 flow)

**2. [Rule 3 — Blocking: Maestro selector correction] Recipe Detail Remix trigger lives in ellipsis sheet**
- **Found during:** Task 3 Maestro run #1.
- **Issue:** Plan asked to open Remix from the recipe detail screen; initially assumed a plain-text "Remix" button. The actual UI exposes Remix via the hero-right `HeaderEllipsis` overflow (Phase 15 D-05).
- **Fix:** Tap `"More options"` (accessibility label), then tap `"Remix"` row in the ActionSheet. Matched the pattern used by flow 31 (`31-addtoplan-datepicker.yaml`).
- **Commit:** d75e8d4

**3. [Rule 3 — Blocking: Maestro wait anchor] Skeleton screenshot wait anchor**
- **Found during:** Task 3 Maestro runs #1 and #2.
- **Issue:** `".*ideas.*"` matched the empty-state landing message and `".*zaatar eggplant.*"` also matched the loading-message text `…finding <query> recipes…`, so the screenshot fired during SuggestionSkeleton's outer skeleton (pre-search-resolve) rather than PreviewRecipeCard's per-card skeleton (post-search-resolve, during Gemini fetch).
- **Fix:** Anchored on `".*ideas for.*"` — distinct phrasing that only appears in the results toolbar ("N ideas for "query""), not in the loading message.
- **Commit:** d75e8d4

No architectural changes. No scope expansion. All auto-fixes stayed within the 4-file constraint.

### Skipped work

None.

### Deferred (out of scope)

Pre-existing typecheck errors in test files (`*.test.ts`, `__tests__/*.tsx`) — logged to `.planning/quick/4-remixsheet-button-layout-something-new-i/deferred-items.md`. Not caused by this plan's changes; plan's typecheck gate is implicitly scoped to production code (all 4 edited files compile cleanly).

## Known Stubs

None. The hook + skeleton wiring is fully functional. Data flows through real endpoints (`/api/v1/recipes/generate-image`) and real AsyncStorage persistence.

## Requirements Satisfied

- [x] **A-BTN-LAYOUT** — Cook now centered + More actions inline (verified via quick-4-b-remix-buttons.png)
- [x] **B1-HOOK-STATUS** — Hook returns `{ url, status: 'loading' | 'resolved' | 'failed' }`
- [x] **B2-SKELETON** — PreviewRecipeCard renders gray skeleton on status='loading' (verified via quick-4-a-skeleton.png)
- [x] **B3-ASYNCSTORAGE** — Resolved URLs persisted to `'dinnertime-image-cache'`, hydrated on module load, failed attempts not persisted
- [x] **UAT-SCREENSHOT** — Maestro flow runs end-to-end; 2 screenshots captured, all 3 visual criteria pass

## Commits

| Task | Commit  | Message                                                                                                      |
| ---- | ------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | 444a5db | fix(quick-4): center Cook now pill + inline More actions layout in VariationCard                             |
| 2    | 24172d3 | feat(quick-4): status-aware useGeneratedRecipeImage + AsyncStorage + skeleton                                |
| 3    | d75e8d4 | test(quick-4): add Maestro iOS-sim UAT flow with 2-shot coverage                                             |

## Metrics

- **Duration:** ~18 minutes (automated execution + Maestro iteration)
- **Tasks completed:** 3/3
- **Files modified:** 4 production files + 1 Maestro yaml (exactly the allowed set)
- **Lines changed:** +212 / -50 across 4 production files
- **Maestro iterations:** 5 (selector tuning — expected for new flows per CLAUDE.md guidance)

## Self-Check: PASSED

All created files exist on disk; all per-task commits (444a5db, 24172d3, d75e8d4) verified in `git log`. Both UAT screenshots present in gitignored screenshots dir for human review.
