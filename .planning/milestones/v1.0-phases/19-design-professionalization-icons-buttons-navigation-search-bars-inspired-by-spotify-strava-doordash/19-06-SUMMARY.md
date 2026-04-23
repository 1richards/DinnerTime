---
phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
plan: 06
subsystem: uat
tags: [maestro, visual-regression, terracotta, sticky-search-pill, recipe-box-rename, gate-a]

requires:
  - phase: 19
    plan: 01
    provides: "Design tokens + terracotta palette + typography scale"
  - phase: 19
    plan: 02
    provides: "5-variant Button (destructive Sign Out rendering) + Chip kind=filter|display"
  - phase: 19
    plan: 03
    provides: "StickySearchPill on Kitchen Library + ItemRow primitive"
  - phase: 19
    plan: 04
    provides: "Mode-aware RecipeCard + dense DayRow with status chips"
  - phase: 19
    plan: 05
    provides: "Zero-orange invariant; tokens-purity.test.ts GREEN; Kitchen Library renders StickySearchPill; ItemRow integration on Shopping + Pantry"
provides:
  - "18-recipe-search-favorite.yaml — rebased to sticky-pill + /search modal round-trip + Recipe Box selector; passes green on iPhone 17 Pro simulator"
  - "20-kitchen-segment-toggle.yaml — rebased to new StickySearchPill behavior (tap pill -> modal -> swipe-dismiss -> back on Library, no z-order flash); passes green"
  - "23-design-buttons-visual.yaml (NEW) — tours every FAB + CTA + destructive surface capturing 9 screenshots for Gate A; passes green"
  - "08-home-suggestions.yaml, 09-meal-plan-generate.yaml, 11-shopping-list-generate.yaml, 07-pantry-add.yaml — headers annotated for Phase 19 terracotta retint; selectors unchanged; screenshot baselines re-captured by run"
  - "Gate A auto-approved under auto-chain mode: Phase 19 design system visually verified against 9 named screenshots captured from a live sim session — terracotta palette, sticky pill, dense DayRow, destructive Sign Out all render correctly"
  - "Pre-existing .*Library.* -> .*Recipe Box.* selector regressions in 5 flows (03, 04, 05, 06, 22) + flow 21 scan-empty-state copy drift logged to deferred-items.md as out-of-scope"
  - "apps/mobile/.gitignore extended to exclude stray named screenshots 13-*.png through 23-*.png from Maestro runs executed from apps/mobile/ CWD"
  - "launchApp: clearState: true prelude added to flows 18/20/23 — immunizes them from upstream modal bleed (flow 19 bulk-import-sheet leaves Import from Instacart modal open otherwise)"
affects: [20-shopping-refactor, 21-pantry-intelligence, 22-plan-refactor, 23-settings-auth]

tech-stack:
  added: []
  patterns:
    - "Maestro flow self-healing pattern: prefix with launchApp clearState: true + openLink to dev-client url — makes flow resilient to upstream flows' leftover modal state (Phase 19-06 fix for flow 20 being blocked by flow 19's open Instacart modal)"
    - "Visual-regression flow pattern: new 23-design-buttons-visual.yaml exercises every button variant surface (primary FAB, secondary, destructive, icon-only) as a named screenshot tour — Maestro cannot inspect variant props programmatically, so screenshots ARE the assertion"
    - "Flow numbering deviation: plan asked for 21-design-buttons-visual.yaml but slot 21 is taken by Phase 15's modal-dismiss flow. Numbered 23 to preserve history, documented in-file and in SUMMARY so future readers find it"

key-files:
  created:
    - apps/mobile/.maestro/23-design-buttons-visual.yaml
  modified:
    - apps/mobile/.maestro/07-pantry-add.yaml
    - apps/mobile/.maestro/08-home-suggestions.yaml
    - apps/mobile/.maestro/09-meal-plan-generate.yaml
    - apps/mobile/.maestro/11-shopping-list-generate.yaml
    - apps/mobile/.maestro/18-recipe-search-favorite.yaml
    - apps/mobile/.maestro/20-kitchen-segment-toggle.yaml
    - apps/mobile/.maestro/README.md
    - apps/mobile/.gitignore
    - .planning/phases/19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash/deferred-items.md
  deleted: []

key-decisions:
  - "Flow numbered 23-design-buttons-visual.yaml (not 21 per plan) — slots 21/22 already taken by Phase 15's modal-dismiss and dirty-form-guard flows. Renumbering existing Phase 15 artifacts is a higher risk than using an unused integer."
  - "Scope boundary held on .*Library.* -> .*Recipe Box.* selector rebase: Plan 19-06 owns 7 Maestro files per frontmatter; fixed the 3 touched (18, 20, 23) and deferred the 5 out-of-scope (03, 04, 05, 06, 22). Recipe Box rename was a post-2026-04-14 out-of-band commit, not a Phase 19 change."
  - "Gate A auto-approved under auto-chain mode (`_auto_chain_active=true`) rather than blocking orchestrator. The live simulator run produced 9 named screenshots proving the terracotta + sticky-pill + dense-DayRow + destructive-Sign-Out design system renders correctly — Gate A's visual subjective calls all pass."
  - "Added launchApp: clearState: true + openLink dev-client URL prelude to flows 18/20/23 — root-cause fix for flow 20 being blocked by flow 19's leftover Import-from-Instacart modal. Pattern matches flow 11's existing self-heal. Fixes the flake without touching flow 19."
  - "Re-baselined flows kept headers-only annotation (no selector changes for 07, 08, 09, 11) — those flows don't depend on Library/Recipe Box text, only on tab + CTA selectors that survived Phase 19. Their screenshot baselines get regenerated implicitly on next Maestro run."
  - "Skipped the explicit bulk Metro cache clear step in Task 1 — Metro was already running with `--clear` flag (PID 32290) from an earlier session, confirmed via `ps aux | grep expo start`. The actual Phase 19 terracotta bundle was confirmed rendering in the live sim screenshots, which is the real gate (not the cache-clear ritual itself)."

patterns-established:
  - "Stray screenshot gitignore: extend `/NN-*.png` rules in apps/mobile/.gitignore whenever a new Maestro flow slot is used. Maestro writes `takeScreenshot: NAME.png` files to `pwd` not to `.maestro/screenshots/`."
  - "Maestro flow self-heal prelude: `launchApp: clearState: true` + `openLink` + 3 optional taps (Open / Continue / close-button) + `runFlow: _ensure-logged-in.yaml` makes a flow immune to upstream modal state leakage."
  - "Visual regression flow as its own .yaml: one flow that walks every variant-surface, captures named screenshots, no programmatic assertions. Screenshots ARE the contract; diffs get reviewed by Gate A human (or auto-approved under auto-chain)."

requirements-completed: ["Design quality (post-v1)"]

duration: "24 min"
completed: 2026-04-18
---

# Phase 19 Plan 06: Maestro flow rebase + Phase 19 visual regression flow + Gate A

**Updated 3 at-risk flows and 3 re-baseline-only flows, authored the new `23-design-buttons-visual.yaml`, documented pre-existing Recipe Box selector regressions as deferred, and verified Phase 19 design renders correctly via live iPhone 17 Pro simulator screenshots — Gate A auto-approved under auto-chain mode.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-04-18T22:55:18Z (immediately after 19-05 completion)
- **Completed:** 2026-04-18T23:18:50Z
- **Tasks:** 2 (Task 1 atomic Maestro-flow-update commit + Task 2 Gate A auto-approval)
- **Files created:** 1 (`apps/mobile/.maestro/23-design-buttons-visual.yaml`)
- **Files modified:** 9 (6 Maestro flows + README + .gitignore + deferred-items.md)
- **Files deleted:** 0

## Accomplishments

### Maestro flow updates (Task 1)

- **20-kitchen-segment-toggle.yaml** — rewritten against Phase 19 surface:
  - Asserts StickySearchPill (`"Search recipes"` placeholder/accessibility label) is visible on Recipe Box segment
  - Taps pill -> `/search` modal opens with title "Search"
  - Swipe-dismisses modal (Phase 19 Pitfall 4 mitigation — no z-order flash)
  - Round-trips Suggestions <-> Recipe Box to verify display:none dual-mount preserves state
  - Passes green on iPhone 17 Pro simulator (iOS 26.4) with Metro serving Phase 19 bundle

- **18-recipe-search-favorite.yaml** — rewritten to use sticky pill + /search modal dismissal instead of deleted inline SearchBar + "Toggle search" action button; retains Favorites chip + heart-toggle assertions. Passes green.

- **23-design-buttons-visual.yaml (NEW)** — visual-regression flow tours 9 surfaces:
  1. Kitchen Suggestions default (RegenerateFab + hero CTA)
  2. Kitchen Recipe Box (StickySearchPill + ImportFab)
  3. Back to Suggestions
  4. Plan tab (dense DayRow + Regenerate CTA)
  5. Pantry tab (ScanButton terracotta FAB)
  6. Shopping tab (FAB + primary CTAs)
  7. Settings tab top
  8. Settings Sign Out (destructive red variant)
  9. Return to Kitchen
  Passes green. Screenshots captured to `apps/mobile/{23-01..23-09}-*.png`.

### Re-baseline-only flow annotations

- **08-home-suggestions.yaml** — `tags: [phase-19]` + note that RegenerateFab retinted terracotta
- **09-meal-plan-generate.yaml** — `tags: [phase-19]` + note DayRow density + terracotta CTAs
- **11-shopping-list-generate.yaml** — `tags: [phase-19]` + note FAB retint + ItemRow integration
- **07-pantry-add.yaml** — `tags: [phase-19]` + note ScanButton retint + PantryItemCard over ItemRow

All 4 re-baseline flows have no selector changes; their screenshot baselines regenerate on every run against the new terracotta bundle.

### Gate A auto-approval (Task 2)

Auto-approved under auto-chain mode (`_auto_chain_active=true`). The live simulator run produced 9 named screenshots confirming:

- **Terracotta palette reads premium not generic SaaS:** Recipe Box segment pill, ImportFab, Get Dinner Ideas CTA, active tab icon tint all render as terracotta (~#C65D3A). Cream bg (#FAF7F2) reads warm.
- **Typography hierarchy clear:** Large-title "Kitchen" (display scale) + muted subtitle ("12 recipes in your recipe box" / caption scale) + bold recipe titles + muted metadata.
- **Sticky pill feels DoorDash-like:** Pill sits above large-title header with light shadow; taps route to `/search?context=library` modal; swipe-dismiss returns cleanly with no z-order flash.
- **Dense DayRow renders all 7 days without scroll on iPhone 17 Pro:** Day label + thumbnail + meal name + status chips (Cooked green tick, sparkle action chip, swap chip, flame chip) packed at Strava-level density.
- **Destructive Sign Out is unmistakably red:** Solid red button at bottom of Settings.
- **No orange leaks:** Cross-verified — no `#F97316` / `orange-*` residuals visible in any of the 9 screenshots (backstopped by `tokens-purity.test.ts` GREEN from Plan 19-05).

All Gate A Manual-Only Verifications from 19-VALIDATION.md visually satisfied. No defects to trigger gap closure.

## Deviations from Plan

**1. [Rule 3 - Blocking] Flow named 23-design-buttons-visual.yaml, not 21-design-buttons-visual.yaml**

- **Found during:** Task 1 initial file creation
- **Issue:** Plan's `files_modified` frontmatter listed the new flow at path `apps/mobile/.maestro/21-design-buttons-visual.yaml`. But slots 21 (modal-dismiss) and 22 (dirty-form-guard) are already occupied by Phase 15 flows. Overwriting 21 would have destroyed a Phase 15 visual regression artifact.
- **Fix:** Named new flow `23-design-buttons-visual.yaml`. Documented decision in-file and in SUMMARY's `key-decisions`.
- **Files modified:** `apps/mobile/.maestro/23-design-buttons-visual.yaml` (created at 23 not 21)
- **Commit:** `691cd30`

**2. [Rule 1 - Bug] Flows 18, 20 + new 23 used stale `.*Library.*` + `.*in your library.*` selectors**

- **Found during:** Full Maestro suite run post-initial-edit (9/24 failures)
- **Issue:** The Kitchen tab's Library segment was renamed to "Recipe Box" in an out-of-band commit (likely during the 2026-04-14 polish work documented in STATE.md). The old selectors `.*Library.*` + `.*in your library.*` no longer resolve. My initial flow edits inherited the stale selectors from the pre-existing files.
- **Fix:** Replaced all `.*Library.*` → `.*Recipe Box.*` and `.*in your library.*` → `.*in your recipe box.*` across flows 18, 20, 23. Verified against source: `apps/mobile/src/app/(tabs)/kitchen.tsx` line 181 `Recipe Box` and line 323 `in your recipe box`.
- **Files modified:** `18-recipe-search-favorite.yaml`, `20-kitchen-segment-toggle.yaml`, `23-design-buttons-visual.yaml`
- **Commit:** `691cd30`

**3. [Rule 3 - Blocking] Flows 18/20/23 poisoned by flow 19's leftover Import-from-Instacart modal**

- **Found during:** Full Maestro suite run — flow 20 failed on `.*What should we cook tonight.*` assertion; screenshot showed "Import from Instacart" modal still open from flow 19
- **Issue:** Flow 19 (`19-receipt-scan-stub.yaml`) opens a deep-linked `/scan/instacart` modal and never closes it. The `_ensure-logged-in.yaml` helper only cares about auth state — it doesn't reset the app. So flows running after 19 inherit the open modal.
- **Fix:** Added `launchApp: clearState: true` + `openLink: exp+dinnertime://...` + 3 optional onboarding-tap lines as a prelude to flows 18, 20, 23. Mirrors flow 11's existing self-heal. Fixes the flake without touching flow 19.
- **Files modified:** `18-recipe-search-favorite.yaml`, `20-kitchen-segment-toggle.yaml`, `23-design-buttons-visual.yaml`
- **Commit:** `691cd30`

**4. [Rule 2 - Missing critical functionality] apps/mobile/.gitignore missing rules for 13-*.png through 23-*.png stray screenshots**

- **Found during:** Task 1 post-commit `git status` showed 9 untracked `apps/mobile/23-*.png` files
- **Issue:** Maestro writes `takeScreenshot: NAME` artifacts to the process CWD, not to `.maestro/screenshots/`. Existing `.gitignore` covered `/01-*.png` through `/12-*.png` plus `/20-*.png` but was silent on 13-19 and 21-23.
- **Fix:** Extended `.gitignore` with `/13-*.png` through `/23-*.png` entries. Future phase additions can simply bump the upper bound.
- **Files modified:** `apps/mobile/.gitignore`
- **Commit:** `691cd30`

## Auth Gates

None encountered. Maestro's `_ensure-logged-in.yaml` handles login via UAT test credentials; auth token persists across flows via Zustand + AsyncStorage.

## Issues Encountered

### In-scope and fixed

Covered in Deviations 1-4 above.

### Out-of-scope (logged to deferred-items.md)

- **5 Maestro flows (03, 04, 05, 06, 22) broken by Recipe Box rename:** Same `.*Library.*` / `.*in your library.*` selector issue that affected Plan 19-06's flows. Pre-existing regression from the out-of-band Recipe Box rename. Per scope boundary, Plan 19-06 owns only the 7 files in its `files_modified`. A `/gsd:quick` pass can mass-rebase these 6 flows in ~5 minutes.
- **Flow 21 (`21-modal-dismiss.yaml`) broken by scan empty-state copy drift:** The selector `.*Ready to scan your kitchen.*|.*photo.*ready.*` doesn't resolve against current `scan/index.tsx`. Pre-existing, out of scope. Also logged for follow-up.
- **4 pre-existing mobile test failures** in auth-store / shoppingStore / progressionStore (documented in deferred-items.md from Plan 19-01). Unchanged by this plan.

### Fix attempt tracking

- 1 auto-fix attempt on flow 20's selector — passed on retry
- 1 auto-fix attempt on flow 23's selector + prelude — passed on retry
- 1 auto-fix attempt on flow 18's selector + prelude — passed on retry
- 0 auto-fix attempts on out-of-scope flows (correctly deferred)

## Maestro Suite Status — Final

**Targeted flows (Plan 19-06 scope, 7 files):**

| Flow | Status | Notes |
|---|---|---|
| 07-pantry-add.yaml | PASSED (pre-annotation) | No selector change; re-baselined. |
| 08-home-suggestions.yaml | PASSED | RegenerateFab terracotta verified by screenshot. |
| 09-meal-plan-generate.yaml | PASSED | DayRow density verified; 7 days no-scroll. |
| 11-shopping-list-generate.yaml | PASSED | FAB + CTA terracotta; ItemRow rows rendered. |
| 18-recipe-search-favorite.yaml | **PASSED (post-fix)** | Sticky pill modal round-trip verified. |
| 20-kitchen-segment-toggle.yaml | **PASSED (post-fix)** | Sticky pill + no z-order flash verified. |
| 23-design-buttons-visual.yaml | **PASSED (new flow)** | 9 named screenshots captured for Gate A. |

**Full suite status:** 15/24 passed on first run pre-fix; Plan 19-06's 3 targeted failures all fixed on retry (18, 20, 23). Remaining 5 failures (03, 04, 05, 06, 22) and 1 additional (21) are pre-existing regressions from the Recipe Box rename / scan-copy drift, logged to deferred-items.md. Not in Plan 19-06's scope.

**Expected post-deferred-cleanup state:** 24/24 green after a ~5-min follow-up quick pass rebases the 6 deferred flow selectors.

## Known Stubs

None introduced by Plan 19-06.

The `apps/mobile/src/app/search.tsx` route is a placeholder per Plan 19-03 (full search UI ships in Phase 17 "Something New") — flow 20 verifies only that the modal opens + title renders + dismisses cleanly. This was an intentional Plan 19-03 decision (not a stub introduced here).

## Next Phase Readiness

- **Block A complete per EXECUTION-PLAN.md:** Phase 15 (structural) + Phase 19 (aesthetic) both closed; tokens-purity invariant enforced. All subsequent phases (18, 20, 21, 22) can build on the terracotta design system without orange bleed.
- **Handoff to Block B (Phase 18 AI auto-location):** Design tokens are the single source of truth. New components must add semantic tokens to `global.css` + `src/design/tokens.ts` — the purity test in `src/design/tokens-purity.test.ts` will fail on raw `#F97316` or `orange-*` reintroduction.
- **Visual debt to address in Phase 23 (Settings/Auth/NFRs):** Flows 03/04/05/06/21/22 selector rebase; 4 pre-existing store test failures.
- **Phase 17 (Something New) owns:** Wiring the `/search` modal's TextInput back into Kitchen's searchQuery state (currently dead per Plan 19-05 deviation).

## Self-Check: PASSED

- `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml` — FOUND (sticky pill selectors)
- `apps/mobile/.maestro/18-recipe-search-favorite.yaml` — FOUND (sticky pill modal round-trip)
- `apps/mobile/.maestro/08-home-suggestions.yaml` — FOUND (phase-19 tag)
- `apps/mobile/.maestro/11-shopping-list-generate.yaml` — FOUND (phase-19 tag)
- `apps/mobile/.maestro/07-pantry-add.yaml` — FOUND (phase-19 tag)
- `apps/mobile/.maestro/09-meal-plan-generate.yaml` — FOUND (phase-19 tag)
- `apps/mobile/.maestro/23-design-buttons-visual.yaml` — FOUND (new flow, 9 named screenshots captured)
- `apps/mobile/.maestro/README.md` — FOUND (flow 23 added to inventory table)
- `apps/mobile/.gitignore` — FOUND (extended through /23-*.png)
- `.planning/phases/19-.../deferred-items.md` — FOUND (Maestro section appended)
- Commit `691cd30` (Task 1) — FOUND on current HEAD
- 9 screenshots at `apps/mobile/23-*.png` — FOUND (confirmed Phase 19 visual render: terracotta CTAs, cream bg, sticky pill, dense DayRow, destructive Sign Out)
- Gate A auto-approved under `_auto_chain_active=true` — logged in key-decisions

---
*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Completed: 2026-04-18*
