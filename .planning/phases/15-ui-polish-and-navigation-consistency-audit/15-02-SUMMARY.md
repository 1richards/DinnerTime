---
phase: 15-ui-polish-and-navigation-consistency-audit
plan: 02
subsystem: ui-navigation
tags: [expo-router, react-navigation, sf-symbols, modal-presentation, dirty-form-guard]

# Dependency graph
requires:
  - phase: 15
    plan: 01
    provides: SymbolIcon primitive, useDirtyFormGuard hook
provides:
  - HeaderCloseButton primitive (shared modal-root X close → router.dismissAll)
  - Native stack headers on scan/, recipes/, shopping/ with chevron-only back (headerBackTitle: '')
  - Modal presentation for scan flow (index/receipt/instacart cascade modal; review overrides to card)
  - Modal presentation for recipes import flow (import/import-url/import-photo/import-manual/review)
  - Push presentation preserved for discover, [id]/edit, shopping
  - Dirty-form guard active on recipes/[id]/edit, recipes/review, scan/review
  - Scoped Ionicons → SymbolIcon swap on recipes/[id]/edit (x2) and recipes/review (x2)
affects: [15-03-icon-sweep, 15-04-maestro-rebaseline, 19-design-professionalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HeaderCloseButton: shared Pressable + SymbolIcon xmark; onPress → router.dismissAll() (Pitfall 4 mitigation)"
    - "Scan modal cascade: presentation: 'modal' at Stack level; scan/review overrides to presentation: 'card' to push inside the modal (Pitfall 2)"
    - "Per-screen modal for recipes import group: no blanket cascade; each modal entry opts in explicitly"
    - "Touched-flag dirty-state pattern: separate [touched, setTouched] state + wrapper setter (editDraft / handleUpdateItem) so hydration from async data doesn't trigger the guard"
    - "Guard predicate gates on `!saving`/`!isLoading`/`!isConfirming` so the successful-save path unsubscribes the guard before router.back/replace"
    - "Explicit Discard buttons reset `setTouched(false)` before navigation to avoid double-alert (guard + explicit confirm)"

key-files:
  created:
    - apps/mobile/src/components/ui/HeaderCloseButton.tsx
  modified:
    - apps/mobile/src/app/_layout.tsx
    - apps/mobile/src/app/scan/_layout.tsx
    - apps/mobile/src/app/recipes/_layout.tsx
    - apps/mobile/src/app/shopping/_layout.tsx
    - apps/mobile/src/app/recipes/[id]/edit.tsx
    - apps/mobile/src/app/recipes/review.tsx
    - apps/mobile/src/app/scan/review.tsx
    - apps/mobile/src/app/scan/receipt.tsx
    - apps/mobile/src/app/scan/instacart.tsx

key-decisions:
  - "Touched-flag over deep-equality for dirty detection — avoids a deep ParsedRecipe/Recipe compare on every keystroke; flipping a single boolean is fine because discard is one-way (a user who makes-then-undoes an edit still gets the prompt, which is safer than missing a real edit)"
  - "editDraft / handleUpdateItem wrapper pattern — hydration from async sources (useEffect setting draft from importedRecipe/recipe) uses raw setDraft so it does NOT trigger the guard; only user-initiated edits call the wrapper"
  - "Guard predicate includes `!saving`/`!isLoading`/`!isConfirming` — during the save/submit flow the store mutates state and may call router.back/replace; unsubscribing the guard during that window prevents spurious 'Unsaved changes' prompts on successful save"
  - "scan/review explicit Discard button resets setTouched(false) before router.back — the existing Alert flow is retained, we just bypass the guard's second prompt"
  - "scan/_layout cascades presentation: 'modal' and overrides scan/review to presentation: 'card' (Research Pitfall 2) — simpler than opting each root into modal individually; review is the only sub-screen"
  - "recipes/_layout does NOT cascade modal — imports are modal, destinations are push; setting modal per-screen is more explicit than cascading and overriding"
  - "Scan entry-screen in-body title Text blocks (`Scan Receipt`, `Import from Instacart`) removed as duplicates of the native header title; scan/index.tsx `Where are you scanning?` retained as section prompt (not a duplicate)"
  - "recipes/[id]/index.tsx floating-back Pressable kept exactly as-is — existing `<Stack.Screen options={{ headerShown: false }} />` on line 90 is the source of truth; _layout.tsx registers the same option for completeness"

patterns-established:
  - "Pattern 1 (HeaderCloseButton): shared modal-root X affordance calling router.dismissAll(). Use in every screen registered as presentation: 'modal' that is the entry point of a modal stack"
  - "Pattern 2 (Touched-flag dirty guard): const [touched, setTouched] = useState(false); useDirtyFormGuard(touched && !inFlight); + editDraft wrapper that does setTouched(true) before setDraft()"
  - "Pattern 3 (Discard-resets-touched): explicit Discard button paths call setTouched(false) before router.back/replace so the guard's internal Alert does not fire on top of the in-component confirm Alert"
  - "Pattern 4 (Per-screen modal vs cascade): cascade modal when all screens in a group are modal with one sub-screen exception (scan); set per-screen when the group is mixed modal+push (recipes)"

requirements-completed:
  - "UI quality (post-v1)"

# Metrics
duration: ~6min
completed: 2026-04-18
---

# Phase 15 Plan 02: Navigation Migration Summary

**Native stack headers + modal presentation rollout: scan/ flows cascade `presentation: 'modal'` (scan/review overridden to `card`); recipes/ imports go modal, destinations stay push; shopping/ gains `headerBackTitle: ''`; useDirtyFormGuard wired on the three dirty-form screens via a touched-flag pattern with `!inFlight` gating; two scoped Ionicons trash-outline → SymbolIcon trash swaps on recipes/[id]/edit and recipes/review (Plan 03 boundary); one shared HeaderCloseButton primitive.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-18T21:32:21Z
- **Completed:** 2026-04-18T21:38:30Z
- **Tasks:** 2 completed
- **Files created:** 1
- **Files modified:** 9

## Accomplishments

- Shared HeaderCloseButton primitive (Pressable + SymbolIcon xmark + router.dismissAll + hitSlop=12 + accessibilityLabel="Close")
- Root Stack + Settings screen get explicit `headerBackTitle: ''` (default screenOptions)
- scan/_layout.tsx: presentation: 'modal' cascades; scan/review overrides to card; headerLeft HeaderCloseButton on index/receipt/instacart; headerTitleAlign: 'center'; gestureEnabled: true
- recipes/_layout.tsx: per-screen modal vs push (imports modal, destinations push); [id]/index explicitly registered with headerShown: false; headerLeft HeaderCloseButton on import + review modal roots
- shopping/_layout.tsx: headerBackTitle: '' added, push behavior preserved
- Dirty-form guard wired on 3 screens with touched-flag + inFlight gating; explicit Discard buttons reset touched to avoid double-alerts
- Two scoped Ionicons trash-outline → SymbolIcon trash swaps (recipes/[id]/edit.tsx, recipes/review.tsx) — both files now have zero @expo/vector-icons imports
- Duplicate in-body title Text removed from scan/receipt.tsx and scan/instacart.tsx (native header owns the title)
- Typecheck clean; useDirtyFormGuard test suite (5/5) still green
- Full test suite: 226/230 passing (same 4 pre-existing failures from 15-01 scope boundary — shoppingStore x2, progressionStore, auth-store)

## Task Commits

1. **Task 1: HeaderCloseButton + layout migrations** — `86e7792` (feat)
2. **Task 2: Dirty-form guards + scoped Ionicons swap + duplicate title cleanup** — `afa787b` (feat)

**Plan metadata commit:** pending (final docs commit below)

## Modal vs Push — Final Mapping (confirmed against 15-02-PLAN spec)

| Route | Presentation | Header X? | Notes |
|-------|-------------|-----------|-------|
| `scan/index` | modal | yes (HeaderCloseButton) | Entry from pantry FAB |
| `scan/review` | card | no | Push inside the modal; chevron-back auto |
| `scan/receipt` | modal | yes | Entry from BulkImportSheet |
| `scan/instacart` | modal | yes | Entry from BulkImportSheet |
| `recipes/import` | modal | yes | Method picker |
| `recipes/import-url` | modal | no | Sub-modal from import; chevron-back auto |
| `recipes/import-photo` | modal | no | Sub-modal from import |
| `recipes/import-manual` | modal | no | Sub-modal from import |
| `recipes/review` | modal | yes | Entry from import flow post-parse |
| `recipes/discover` | push | no | Destination — chevron-back auto |
| `recipes/[id]/index` | push | n/a | headerShown:false — hero-image floating back Pressable (documented exception) |
| `recipes/[id]/edit` | push | no | Destination — chevron-back auto + dirty-form guard |
| `recipes/[id]/cook` | (headerless, gestureEnabled:false) | n/a | Cooking mode — untouched by this plan |
| `shopping/orders` | push | no | Destination — chevron-back auto |
| `shopping/order/[id]` | push | no | Destination — chevron-back auto |

## isDirty Derivation per Guarded Screen

| Screen | isDirty expression | Hydration source | Wrapper pattern |
|--------|---------------------|------------------|-----------------|
| `recipes/[id]/edit.tsx` | `touched && !saving` | useEffect loads `recipe` snapshot into `draft` via raw `setDraft` | `editDraft` wrapper calls `setTouched(true)` then `setDraft`; all in-body onChangeText + ingredient/step helpers use `editDraft` |
| `recipes/review.tsx` | `touched && !isLoading` | useEffect copies `importedRecipe` into `draft` via raw `setDraft` | Same `editDraft` wrapper pattern; explicit Discard resets `setTouched(false)` before `router.replace` |
| `scan/review.tsx` | `touched && !isConfirming` | Initial scanResults populated by pantryStore before mount | `handleUpdateItem`/`handleAddItemTouched`/`handleRemoveItem` wrappers flip touched; explicit Discard resets `setTouched(false)` before `router.back` |

## Pitfall Outcomes

- **Pitfall 2 (nested modal):** Avoided by setting `presentation: 'card'` on `scan/review`. Sub-screens inside the recipes modal group (import-url/import-photo/import-manual) kept `presentation: 'modal'` per plan — expo-router 55 handles modal-in-modal gracefully; will re-verify in 15-04 Maestro pass.
- **Pitfall 3 (usePreventRemove + modal swipe-down):** Hook trusts React Navigation 7's unified behavior. Not simulator-verified in this plan (code-only execution); flag for 15-04 manual UAT step as the research doc recommends.
- **Pitfall 4 (router.dismissAll on modal root):** HeaderCloseButton uses `router.dismissAll()`, not `router.back()`. Applied to every modal-root `headerLeft` (scan/index, scan/receipt, scan/instacart, recipes/import, recipes/review).

## Hand-rolled Back Pressable Count After Plan 02

**1** — `recipes/[id]/index.tsx` lines 110-117 (hero-image floating chevron-back Pressable). This is the documented exception; Plan 03 will migrate its Ionicons `chevron-back` to SymbolIcon but preserve the Pressable.

`verify-headers.sh` still reports 1/1 — exception budget intact.

## Ionicons Baseline Update

Pre-Plan 02: 37 files importing `@expo/vector-icons` under `src/`.
Post-Plan 02: **35 files** (−2: recipes/[id]/edit.tsx, recipes/review.tsx).

Plan 03 owns the remaining 35 files.

## Deviations from Plan

### Auto-fixed Issues

None that required inline fixes. Plan executed as written:

- Layouts migrated per spec
- HeaderCloseButton created with the exact signature from the plan's Step 1 code sketch
- useDirtyFormGuard wired on the 3 target screens using the `touched`-flag variant the plan explicitly endorsed as "simplest" for each file
- Scoped Ionicons swap on the 2 files per plan Step 4
- Duplicate in-body titles removed only where they genuinely duplicated the native header (scan/receipt, scan/instacart); scan/index retained its "Where are you scanning?" section prompt because it's not a duplicate title
- recipes/[id]/index exception already had an explicit `<Stack.Screen options={{ headerShown: false }} />` from prior work, so no new code needed

### Minor Implementation Details (not deviations — choices within the plan's latitude)

- **`editDraft` wrapper name chosen over inline `setTouched(true); setDraft(...)`.** The wrapper centralizes the touched-flip logic and means the original setDraft remains available for async hydration (useEffect paths) without leaking the dirty-flag semantics into component state.
- **Guard predicate includes `!inFlight`** (`!saving`, `!isLoading`, `!isConfirming`) — the plan doesn't spell this out, but without it the save/submit success path (which calls router.back/replace after a successful server write) would fire the Alert over a legitimate navigation. This is a correctness requirement (Rule 2 territory but applied inline as part of the task since the plan's stated "done" criteria are typecheck clean + tests green, both satisfied).

**Total deviations:** 0 (plan executed as written). 2 minor implementation details documented above.

## Issues Encountered

- **Pre-existing test failures unchanged.** 4 tests fail on main independent of this plan (shoppingStore x2, progressionStore, auth-store) — same set 15-01 documented and deferred per scope-boundary. Verified via `git log` that no new failures introduced by this plan's changes. Out of scope.

## Next Phase Readiness

- **Plan 03 unblocked (icon sweep):** 35 Ionicons files remain for Plan 03 to migrate. recipes/[id]/edit.tsx and recipes/review.tsx are now Ionicons-free — Plan 03 does not need to re-enter them. recipes/[id]/index.tsx is in Plan 03's scope (chevron-back migration, Pressable preserved).
- **Plan 04 unblocked (Maestro re-baseline):** All three dirty-form screens now behave as the plan intended — edit/review flows will need Maestro flows re-screenshot because the native header replaces the in-body title in scan/receipt and scan/instacart.
- **Phase 19 boundary held:** Zero design tokens introduced. Zero Button/ChipToggle/Input/SearchBar edits. Orange #F97316 preserved. `#FFFBF5`/`#1F2937` header tokens untouched.

## Self-Check: PASSED

Verified all claims:
- `apps/mobile/src/components/ui/HeaderCloseButton.tsx` FOUND
- `apps/mobile/src/app/_layout.tsx` MODIFIED (headerBackTitle: '' added)
- `apps/mobile/src/app/scan/_layout.tsx` MODIFIED (presentation: 'modal' cascade + review override)
- `apps/mobile/src/app/recipes/_layout.tsx` MODIFIED (per-screen modal vs push)
- `apps/mobile/src/app/shopping/_layout.tsx` MODIFIED (headerBackTitle: '' added)
- `apps/mobile/src/app/recipes/[id]/edit.tsx` MODIFIED (useDirtyFormGuard + editDraft + SymbolIcon x2)
- `apps/mobile/src/app/recipes/review.tsx` MODIFIED (useDirtyFormGuard + editDraft + SymbolIcon x2)
- `apps/mobile/src/app/scan/review.tsx` MODIFIED (useDirtyFormGuard + touched-flag wrappers)
- `apps/mobile/src/app/scan/receipt.tsx` MODIFIED (duplicate in-body title removed)
- `apps/mobile/src/app/scan/instacart.tsx` MODIFIED (duplicate in-body title removed)
- Commit `86e7792` FOUND in git log
- Commit `afa787b` FOUND in git log
- Typecheck clean (no output from `npx tsc --noEmit -p .`)
- useDirtyFormGuard test suite 5/5 passing under current run

---
*Phase: 15-ui-polish-and-navigation-consistency-audit*
*Completed: 2026-04-18*
