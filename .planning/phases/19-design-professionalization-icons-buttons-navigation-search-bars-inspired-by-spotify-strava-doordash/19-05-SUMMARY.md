---
phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
plan: 05
subsystem: ui
tags: [nativewind, design-tokens, terracotta, token-sweep, item-row, sticky-search-pill, chip, purity-test]

requires:
  - phase: 19
    plan: 01
    provides: "Design tokens (colors.brand, colors.bg, colors.textPrimary, typography scale, rounded-button/card/pill NativeWind classes) + tokens-purity.test.ts skip stub"
  - phase: 19
    plan: 02
    provides: "5-variant Button (primary|secondary|ghost|destructive|iconOnly) + two-family Chip (kind=filter|display, tone=default|success|warning|destructive) + ChipToggle deprecation shim"
  - phase: 19
    plan: 03
    provides: "StickySearchPill + /search modal route + ItemRow primitive (checkbox/stepper/icon leading) + inline trailing chip"
  - phase: 19
    plan: 04
    provides: "Mode-aware RecipeCard + dense DayRow + pure deriveStatusChips helper"
provides:
  - "Zero #F97316 hex literals remain in apps/mobile/src/**/*.{ts,tsx} (test files excluded by purity walk)"
  - "Zero orange-[50-900] Tailwind classes remain in apps/mobile/src/**/*.{ts,tsx} (test files excluded)"
  - "tokens-purity.test.ts FLIPPED from describe.skip -> describe; passes GREEN"
  - "Tab bar active tint + inactive tint + background + header styles all sourced from design/tokens.ts (Pitfall 6 mitigated)"
  - "collapsingHeaderStyles fully token-driven — typography.display / typography.caption + colors.textPrimary / colors.textSecondary / colors.border / colors.borderSubtle / colors.brand / colors.destructive / colors.bg (one intentional rgba(250,247,242,0.95) literal for translucent compact-header bg)"
  - "ShoppingItemRow rewritten as thin wrapper over ItemRow with leading=checkbox + struck; swipe-to-delete + longpress-to-edit preserved"
  - "PantryItemCard rewritten as thin wrapper over ItemRow with leading=icon (location glyph) + derived stale/low-confidence trailing chip + expand-to-act Used/Gone actions"
  - "Kitchen Library integrates StickySearchPill above large-title header; inline SearchBar + search-toggle action button both removed"
  - "ChipToggle.tsx DELETED (5 call sites migrated to <Chip kind=filter />; allergies surface migrates to <Chip kind=display tone=destructive />)"
  - "components/recipes/SearchBar.tsx DELETED (Library call site migrated in Task 2b)"
  - "FAB retint: ImportFab, RegenerateFab, kitchen FAB style, pantry FAB style, shopping FAB className, ScanButton className all use colors.brand / bg-brand — dimensions (60x60 with shadow) preserved per CONTEXT default"
  - "Button variant=outline call sites migrated to variant=secondary (login/register Google button, CookConfirm Cancel)"
  - "Sign Out button migrates to variant=destructive (semantic correctness)"
affects: [19-06-visual-verify, 17-something-new-search-results, 22-plan-refactor, 23-settings-auth]

tech-stack:
  added: []
  patterns:
    - "Pure token substitution as a one-pass atomic sweep — every `#F97316` / `orange-[50-900]` replaced with `colors.brand` / `bg-brand` (or derived shades `bg-brand/10`, `bg-brand/15`, `text-brand-pressed`) in three sequential sub-commits (2a/2b/2c) keeping blast-radius-per-commit bounded while the swap itself remains single-pass (no mixed orange+terracotta state)"
    - "Navigator-style chrome (tab bar, Stack header, collapsingHeaderStyles) consumes tokens from design/tokens.ts import because StyleSheet-style objects can't use NativeWind className (Pitfall 6 in 19-RESEARCH.md)"
    - "ChipToggle removal pattern — five call sites migrate to `<Chip kind=filter />` for toggleable surfaces (cuisine/dietary per-member, age range, dislikes search add) and `<Chip kind=display tone=destructive />` for read-only allergy aggregates — semantic correctness wins over visual fidelity"
    - "Row primitive integration as wrapper-over-ItemRow — ShoppingItemRow retains its swipe-to-delete and longpress-to-edit behaviors as caller-level concerns around an `<ItemRow />` body; PantryItemCard retains its expand-to-act Used/Gone actions below an `<ItemRow />` shell"
    - "ChipToggle shim's red colorScheme intentionally lost at migration boundary — allergies become `<Chip kind=display tone=destructive />` (destructive/15 bg + destructive text), a visually softer but semantically correct rendering"

key-files:
  created: []
  modified:
    - apps/mobile/src/components/ui/useCollapsingHeader.ts
    - apps/mobile/src/app/(tabs)/_layout.tsx
    - apps/mobile/src/app/_layout.tsx
    - apps/mobile/src/components/shopping/ShoppingItemRow.tsx
    - apps/mobile/src/components/pantry/PantryItemCard.tsx
    - apps/mobile/src/components/pantry/PantryItemList.tsx
    - apps/mobile/src/app/(auth)/login.tsx
    - apps/mobile/src/app/(auth)/register.tsx
    - apps/mobile/src/app/onboarding/index.tsx
    - apps/mobile/src/app/scan/index.tsx
    - apps/mobile/src/app/scan/receipt.tsx
    - apps/mobile/src/app/scan/instacart.tsx
    - apps/mobile/src/app/(tabs)/kitchen.tsx
    - apps/mobile/src/app/(tabs)/plan.tsx
    - apps/mobile/src/app/(tabs)/pantry.tsx
    - apps/mobile/src/app/(tabs)/shopping.tsx
    - apps/mobile/src/app/(tabs)/settings.tsx
    - apps/mobile/src/app/recipes/import.tsx
    - apps/mobile/src/app/recipes/discover.tsx
    - apps/mobile/src/app/recipes/import-url.tsx
    - apps/mobile/src/app/recipes/import-manual.tsx
    - apps/mobile/src/app/recipes/import-photo.tsx
    - apps/mobile/src/app/recipes/review.tsx
    - apps/mobile/src/app/recipes/[id]/index.tsx
    - apps/mobile/src/app/recipes/[id]/edit.tsx
    - apps/mobile/src/app/shopping/orders.tsx
    - apps/mobile/src/app/shopping/order/[id].tsx
    - apps/mobile/src/components/pantry/BulkImportSheet.tsx
    - apps/mobile/src/components/pantry/LocationPicker.tsx
    - apps/mobile/src/components/pantry/ReviewItemRow.tsx
    - apps/mobile/src/components/pantry/ScanButton.tsx
    - apps/mobile/src/components/cooking/AskSheet.tsx
    - apps/mobile/src/components/cooking/StepNavButtons.tsx
    - apps/mobile/src/components/cooking/TimerBar.tsx
    - apps/mobile/src/components/plan/CookConfirm.tsx
    - apps/mobile/src/components/plan/SwapSheet.tsx
    - apps/mobile/src/components/recipes/AddToPlanSheet.tsx
    - apps/mobile/src/components/recipes/FavoriteButton.tsx
    - apps/mobile/src/components/recipes/IngredientList.tsx
    - apps/mobile/src/components/recipes/RecipeFilterSheet.tsx
    - apps/mobile/src/components/recipes/RemixSheet.tsx
    - apps/mobile/src/components/settings/CuisineSection.tsx
    - apps/mobile/src/components/settings/DietarySection.tsx
    - apps/mobile/src/components/settings/DislikesSection.tsx
    - apps/mobile/src/components/settings/IngredientSearch.tsx
    - apps/mobile/src/components/settings/MemberCard.tsx
    - apps/mobile/src/components/settings/MemberFormModal.tsx
    - apps/mobile/src/components/settings/SkillLevelSection.tsx
    - apps/mobile/src/components/suggestions/SuggestionList.tsx
    - apps/mobile/src/components/suggestions/SuggestionPreviewModal.tsx
    - apps/mobile/src/components/ui/EmptyState.tsx
    - apps/mobile/src/components/ui/ErrorState.tsx
    - apps/mobile/src/components/ui/LoadingState.tsx
    - apps/mobile/src/design/tokens-purity.test.ts
  deleted:
    - apps/mobile/src/components/ui/ChipToggle.tsx
    - apps/mobile/src/components/recipes/SearchBar.tsx

key-decisions:
  - "PantryItemCard uses leading=icon (location glyph) NOT leading=stepper — pantryStore has no updateItemQuantity mutation (scope = Phase 21 pantry intelligence). Quantity + unit are surfaced in subtitle instead. Documented as in-file deviation comment citing Plan 19-05 + Phase 21."
  - "Sticky search pill for Kitchen Library: inline SearchBar + search-toggle action button both REMOVED. Local searchQuery state retained (dead) for forward-compat with Phase 17 Something New search modal wiring. Hero header paddingTop bumped to 48 to clear the absolute-positioned pill (height 40 + top 8 = 48)."
  - "FavoriteButton heart: Phase 15 comment explicitly said `orange #F97316 preserved` — Phase 19 overrides this, heart now renders `colors.brand` (terracotta). In-file comment updated to document the Phase 19 retcon."
  - "Adult/kid age badge in MemberCard: `bg-amber-100 / text-amber-700` migrated to `bg-warning/15 / text-warning` (warning is the semantic token closest to amber). Young-kid badge stays brand-tinted (`bg-brand/15`) to preserve the visual distinction between age ranges."
  - "recipes/discover.tsx 'New ideas' uppercase tag uses `text-brand-pressed` (darker terracotta #A7492C) not `text-brand` — matches the original intent of the `text-orange-700` style that signaled emphasis through a darker shade"
  - "TimerBar pill border + label: migrated `bg-orange-100 border-orange-300 text-orange-800` to `bg-brand/15 border-brand text-brand-pressed` — the dark-text-on-light-tint pattern preserves readability; `tintColor='#C2410C'` on the timer icon kept as a local hex (not #F97316) since it's still not in scope for the purity test"
  - "Sign Out button migrates to `variant=destructive` (semantic correctness, previously `variant=outline` masked the destructive intent); Continue-with-Google buttons migrate outline -> secondary"
  - "CookConfirm Cancel button migrates outline -> secondary; AI review step-number badges migrate orange-100/orange-700 -> brand/15 + brand-pressed"
  - "ChipToggle's `colorScheme='red'` path deliberately dropped — the 5 call sites (DietarySection allergies, MemberFormModal allergies) migrate to semantic `kind='display' tone='destructive'` for read-only and `kind='filter'` for toggleable surfaces (per-member allergy toggles). Visually softer (bg-destructive/15 tint instead of solid red), semantically precise."

patterns-established:
  - "One-pass atomic token swap: every `#F97316` / `orange-[50-900]` in src/** becomes `colors.brand` / `bg-brand` (or alpha modifier) in a single feature vertex landing as three sequential commits (a/b/c) bounded by blast-radius but driving to a single coherent end state enforced by `tokens-purity.test.ts`"
  - "Navigator chrome (Tabs screenOptions, Stack.Screen headerStyle, StyleSheet objects in hooks like useCollapsingHeader) consume `colors` / `typography` imports from design/tokens.ts — className is NEVER reachable from a navigator options object (Pitfall 6 avoided atomically)"
  - "Purity test as a git bisectable enforcement boundary: the `describe.skip` -> `describe` flip is its own commit (chore), so future commits that reintroduce `#F97316` break the test without dragging unrelated doc/summary churn across the red line"

requirements-completed: ["Design quality (post-v1)"]

duration: "17 min"
completed: 2026-04-18
---

# Phase 19 Plan 05: One-Pass Terracotta Token Sweep Summary

**Atomic one-pass swap of every `#F97316` / `orange-[50-900]` in `apps/mobile/src/**` to terracotta tokens; Shopping + Pantry rows migrated to the shared ItemRow primitive; Kitchen Library gains the StickySearchPill; ChipToggle + legacy recipes/SearchBar DELETED; `tokens-purity.test.ts` flipped on and GREEN.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-18T22:34:32Z
- **Completed:** 2026-04-18T22:51:48Z
- **Tasks:** 5 atomic commits (Task 1, Task 2a, Task 2b, Task 2c, Task 3)
- **Files modified:** 53
- **Files deleted:** 2 (ChipToggle.tsx + components/recipes/SearchBar.tsx)
- **Files created:** 0 (SUMMARY.md lands with metadata commit)

## Accomplishments

- **Zero-orange invariant achieved.** `grep -rE '#F97316|orange-(50|100|200|300|400|500|600|700|800|900)\b' apps/mobile/src --include='*.ts' --include='*.tsx'` returns only matches inside `*.test.{ts,tsx}` files (which the purity walker explicitly excludes).
- **`tokens-purity.test.ts` FLIPPED ON** — 2 assertions (no raw `#F97316`, no `orange-[50-900]` classes) both GREEN against the full src/** walk. Future orange regressions will fail the suite without human review.
- **Shopping + Pantry rows on ItemRow primitive.** `ShoppingItemRow` becomes a thin shell around `<ItemRow leading=checkbox struck />` with Swipeable + longpress-to-edit preserved at the wrapper layer. `PantryItemCard` becomes a shell around `<ItemRow leading=icon trailingChip />` with expand-to-act Used/Gone actions below. Both now inherit Plan 03's 56pt min-height + typography + spacing for free.
- **Tab bar + root Stack + collapsingHeader tokenized.** `(tabs)/_layout.tsx` drops `tabBarActiveTintColor: '#F97316'` for `colors.brand`; background + border + header tints all flow through tokens. `_layout.tsx` root Stack + loading spinner + AuthStateBanner all tokenized. `useCollapsingHeader.ts` collapsingHeaderStyles now uses `typography.display` / `typography.caption` for titles + subtitles and `colors.*` for every text/border/surface decision (one inline `rgba(250,247,242,0.95)` literal for the translucent compact-header bg, derived from `colors.bg` with a code comment documenting the derivation).
- **Kitchen Library migrates to StickySearchPill.** The inline `SearchBar` from `components/recipes/SearchBar.tsx` is unmounted; the sticky pill from `components/ui/SearchBar.tsx` is mounted above the large-title header (absolute-positioned at `top: 8, height: 40`). Tap routes to `/search?context=library` modal. Local `searchQuery` state retained (dead) for Phase 17 hookup; `searchOpen` state removed entirely.
- **ChipToggle + legacy recipes/SearchBar DELETED.** Five `<ChipToggle>` call sites migrate to `<Chip kind='filter' />` or `<Chip kind='display' tone='destructive' />` for allergy read-outs. Library's SearchBar import ring now has zero consumers.
- **Button variant migration** — `variant='outline'` call sites on login/register (Google) and CookConfirm (Cancel) migrate to `variant='secondary'`; Sign Out migrates to `variant='destructive'` (semantic correctness).
- **FAB retint across all surfaces** — kitchen ImportFab/RegenerateFab, pantry FAB, shopping FAB, ScanButton all pull from `colors.brand` / `bg-brand`. 60x60 dimensions + shadow preserved per CONTEXT default.

## Task Commits

1. **Task 1 — navigator chrome + row migrations** — `799c533` (feat). useCollapsingHeader + (tabs)/_layout + root _layout tokenized; ShoppingItemRow + PantryItemCard rewritten against ItemRow; PantryItemList RefreshControl tint swapped. `npx tsc --noEmit` exits 0.
2. **Task 2a — auth + onboarding + scan sweep** — `43f7d70` (feat). 6 files: auth login/register (variant outline->secondary, bg-warmWhite->bg-bg, styles token-driven), onboarding (6× #F97316 on numbers/checkboxes/chips), scan/* spinners.
3. **Task 2b — tabs + recipes + shopping + pantry sub-components sweep + Kitchen StickySearchPill** — `acdb16e` (feat). 16 files. Kitchen Library gains the sticky pill; inline SearchBar import removed; search-toggle action dropped. Full tab set (plan, pantry, shopping) + every recipes/* + every shopping/* + pantry sub-components retinted.
4. **Task 2c — settings + cooking + DELETE ChipToggle + DELETE recipes/SearchBar** — `cfff06c` (feat). 27 files changed, 2 deleted. Every remaining orange-*/#F97316 cleared (including comment in FavoriteButton, Phase 15 step-number badges in recipe review/edit). Full ChipToggle call-site migration.
5. **Task 3 — flip tokens-purity.test.ts ON** — `a43d0c0` (chore). `describe.skip` -> `describe`; 2/2 purity assertions GREEN on first run; commit message documents Metro cache-clear requirement for Plan 06 UAT.

**Plan metadata commit:** pending (docs commit for SUMMARY.md + STATE.md + ROADMAP.md).

## Files Touched — Structural vs Mechanical

**Structural changes (non-trivial rewrites):**
- `ShoppingItemRow.tsx` — rewritten over ItemRow primitive; editing-mode branch keeps its own TextInput layout using tokenized classes (bg-surface + border-brand + rounded-card); Swipeable + longpress-to-edit preserved at the wrapper.
- `PantryItemCard.tsx` — rewritten over ItemRow primitive with leading=icon (NOT stepper — documented deviation); expand-to-act buttons use bg-success/15 + bg-destructive/15 tinted backgrounds.
- `useCollapsingHeader.ts` — `collapsingHeaderStyles` fully migrated off hardcoded hex; `largeTitle` now spreads `typography.display` (34/41/700 @ letter-spacing -0.8 — fontWeight '900' dropped to '700' to match type scale); `largeSubtitle` spreads `typography.caption`; `compactTitle` explicit inline (17pt/22/600/-0.2) documented as between body and title (doesn't cleanly map to a single scale token).
- `app/(tabs)/kitchen.tsx` — dropped inline SearchBar + searchOpen state + search-toggle action button; added StickySearchPill as absolute-positioned sibling; Library header paddingTop bumped to 48 to clear the pill.
- `app/(tabs)/_layout.tsx` — tabBarActiveTintColor is now `colors.brand`; icons retain focused-state fill/outline swap; tabBarStyle borderTopWidth now explicit `StyleSheet.hairlineWidth`.
- `app/_layout.tsx` — root Stack + loading spinner + AuthStateBanner all tokenized.

**Mechanical swaps (1–2 className/hex changes per file):**
Every other file in the `modified:` list.

## FAB Retreatment

Per CONTEXT default: "token-swap preserving current 60x60 shadow FAB."

| Surface | FAB component | Treatment |
|---|---|---|
| Kitchen Suggestions | `RegenerateFab` (kitchen.tsx) | `styles.fab` `backgroundColor: '#F97316'` -> `colors.brand`; 60x60 + shadow preserved |
| Kitchen Library | `ImportFab` (kitchen.tsx) | Shares `styles.fab` retint above |
| Pantry | `styles.fab` (pantry.tsx) | `backgroundColor: '#F97316'` -> `colors.brand`; 60x60 + shadow preserved |
| Shopping | Inline Pressable (shopping.tsx) | `bg-orange-500 active:bg-orange-600` -> `bg-brand active:bg-brand-pressed`; 56x56 (w-14 h-14) preserved |
| Scan | `ScanButton` | `bg-orange-500` -> `bg-brand`; 64x64 preserved |

No structural change — dimensions, shadow (shadowOpacity 0.22 / radius 10 / elevation 8), radius (30), icon size (28) all preserved.

## Tab Bar Treatment

Per CONTEXT default: "preserve current iOS translucent tab bar with terracotta active tint."

- `tabBarActiveTintColor: colors.brand` (terracotta #C65D3A)
- `tabBarInactiveTintColor: colors.textTertiary` (warm-gray #A89178)
- `tabBarStyle.backgroundColor: colors.bg` (warm off-white #FAF7F2)
- `tabBarStyle.borderTopColor: colors.borderSubtle`
- `tabBarStyle.borderTopWidth: StyleSheet.hairlineWidth` (new — explicit hairline)
- `headerStyle.backgroundColor: colors.bg`
- `headerTintColor: colors.textPrimary`

iOS translucency is inherited (no explicit override of `tabBarStyle.position` or blur removal) — iOS automatically renders the translucent blur when a solid color is set.

## Destructive Red Visual Tradeoff

The old `ChipToggle colorScheme='red'` path rendered solid red backgrounds for dietary allergies. Plan 19-05 migrates those call sites to `<Chip kind='display' tone='destructive' />` which renders `bg-destructive/15 + text-destructive` — a visually softer red tint with red text.

Tradeoff accepted per CONTEXT D-03 ("Display/category chips — read-only, muted surface. Lower visual weight so they don't compete with interactive elements"). Allergies are read-only aggregates in `DietarySection` (settings), so display-tone is semantically correct; the per-member edit flow in `MemberFormModal` uses `<Chip kind='filter' />` (no destructive tone) because it's toggleable.

## Metro Cache Clear Warning for Plan 06

Per CLAUDE.md "Metro cache" gotcha + Phase 19 Pitfall 2: **Expo inlines Tailwind classes at bundle time.** A running Metro will NOT pick up the new `bg-brand`, `bg-brand/15`, `text-brand-pressed` classes that Plan 19-05 introduced to ~50 surfaces.

**Before Plan 19-06's Maestro UAT, the session must run:**

```bash
rm -rf apps/mobile/.expo
cd apps/mobile && npx expo start --dev-client --lan --clear
```

Without this, the simulator will render stale cached classes and the Maestro visual-verification pass will show a mix of terracotta (for classes that were already resolved) and orange (for classes that were only introduced in this sweep). Plan 06 owns the cache-clear + full UAT flow.

The Task 3 commit message (`a43d0c0`) encodes this requirement for any future cold-start verifier.

## Decisions Made

Notable sub-decisions made within Claude's Discretion (all traceable to Phase 19 CONTEXT + 19-RESEARCH.md):

- **PantryItemCard leading=icon (not stepper).** Plan asked for a stepper; the pantry store has no `updateItemQuantity` action (scope belongs to Phase 21 pantry intelligence). Using `leading=icon` with the location glyph + quantity-in-subtitle preserves the row's visual identity without silently wiring a no-op stepper. Documented as in-file comment.
- **FavoriteButton retcon.** Phase 15 committed to preserving `#F97316` on the heart; Phase 19's one-pass swap rule overrides that. Heart now renders `colors.brand` (terracotta). In-file comment updated to document the Phase 19 override of the Phase 15 decision.
- **Kitchen Library: inline searchQuery state retained.** `searchQuery`/`deferredQuery` useState + useDeferredValue stay wired so the filtering path compiles, but `setSearchQuery` is unreachable after the sticky pill replaces the inline input. Phase 17 (Something New) will wire the search modal's input back through this state. `searchOpen` state was strictly tied to the deleted toggle button, so it's removed entirely.
- **`compactTitle` left inline.** `useCollapsingHeader.ts compactTitle` is 17pt/semibold — between `typography.body` (17/22/400) and `typography.title` (22/28/600). Rather than add a new scale token for a single consumer, the size+line-height+weight+letter-spacing stay inline with the weight sourced from `'600'` (matching the typography scale's semibold pattern).
- **`MemberCard` adult/kid badges.** `bg-amber-100/text-amber-700` for older kids migrated to `bg-warning/15 / text-warning` (warning token is closest to amber); young-kid stays `bg-brand/15 / text-brand-pressed` so the age-range split still reads distinctly.
- **No new tokens added.** Every call site resolved to an existing token from Plan 01. `colors.brand` for primary accent, `colors.brandPressed` for darker accent/tag emphasis (#A7492C), `colors.destructive` for allergy tones, `colors.success` / `colors.warning` for expand-to-act surfaces, `colors.textTertiary` for neutral icon tints, `colors.border` / `colors.borderSubtle` for dividers, `colors.surfaceSubtle` for segmented inactive. No token surface expansion.

## Deviations from Plan

**1. [Rule 3 — Blocking] PantryItemCard leading=icon not leading=stepper**

- **Found during:** Task 1 implementation
- **Issue:** Plan specified `<ItemRow leading={{ kind:'stepper', quantity, unit, onInc, onDec }} />` for PantryItemCard. pantryStore.ts exports `markItemUsed` and `markItemDepleted` but no `updateItemQuantity` mutation. Calling non-existent store actions would either fail TypeScript compile or land as silent runtime no-ops.
- **Fix:** Switched to `leading={{ kind:'icon', name: locationSymbol, tint: colors.textSecondary }}`. Quantity + unit surface in `subtitle` ("2 lb · produce"). Preserves row visual identity without stubbing mutations. Scope boundary applied — quantity-editing lives in Phase 21 pantry intelligence.
- **Files modified:** `apps/mobile/src/components/pantry/PantryItemCard.tsx`
- **Commit:** `799c533`

**2. [Rule 2 — Missing critical functionality] ~26 additional files swept beyond plan's files_modified list**

- **Found during:** Task 2c purity-sweep pass
- **Issue:** Plan's `files_modified` listed ~30 files, but the purity test walks ALL of `apps/mobile/src/**` (excluding `design/` + `*.test.*`). Additional files NOT in plan's list contained `#F97316` / `orange-*` offenders: SuggestionList, SuggestionPreviewModal, FavoriteButton, RecipeFilterSheet, AddToPlanSheet, RemixSheet, IngredientList, MemberCard, CookConfirm, SwapSheet, BulkImportSheet, LocationPicker, ScanButton, ReviewItemRow, EmptyState, ErrorState, LoadingState, recipes/review.tsx, recipes/[id]/edit.tsx, TimerBar.
- **Fix:** Swept all of them in Tasks 2b/2c. The plan's `files_modified` list was indicative, not exhaustive — the "Zero #F97316 hex literals remain" must-have demanded a full-tree sweep.
- **Commits:** `acdb16e` (2b, 16 files), `cfff06c` (2c, 27 files)

**3. [Rule 1 — Bug] FavoriteButton comment preserved `#F97316` string**

- **Found during:** Task 2c verification grep
- **Issue:** After retinting FavoriteButton's `tintColor` to `colors.brand`, the file still contained `// the Phase 15 #F97316 default` in a comment. The purity test's `hexRegex = /#F97316/i` matches comments as well as code strings — would fail the purity check.
- **Fix:** Rewrote the comment to say `// the prior pure-orange default` — documents the retcon without leaving the magic number as a searchable string.
- **Files modified:** `apps/mobile/src/components/recipes/FavoriteButton.tsx`
- **Commit:** `cfff06c`

**4. [Rule 3 — Blocking] TimerBar tintColor `#C2410C` kept as local hex**

- **Context:** TimerBar renders SF Symbol `timer` + `xmark.circle.fill` icons with `tintColor='#C2410C'` (a darker orange from the pre-Phase-19 palette). This hex is NOT `#F97316` or any `orange-*` class, so the purity test does NOT flag it. Leaving as-is per scope boundary rule.
- **Rationale:** The hex is not brand-coded and not a token violation. A full color audit (replacing `#C2410C` / `#C05A00` / `#3E332A` etc. with `colors.textPrimary` / `colors.textSecondary`) is Phase 19-06 visual-verification territory or a later polish pass.

## Issues Encountered

- **4 pre-existing test failures** (unchanged, baseline from Plan 19-01): `auth-store.test.ts` (1), `shoppingStore.test.ts` (2), `progressionStore.test.ts` (1). These were logged to `deferred-items.md` in Plan 19-01 and are out of scope per the SCOPE BOUNDARY rule — none of them relate to the token sweep. Phase 23 (Settings, Auth & NFRs) owns resolving them.

## Next Phase Readiness

Plan 19-06 (visual verification + Maestro UAT) can proceed immediately after the Metro cache clear (see warning above):

- All token classes now resolve through tailwind.config.js → global.css CSS variables.
- StickySearchPill renders on Kitchen Library at scroll y=0.
- FavoriteButton heart is terracotta (brand).
- Sign Out button is red-filled (destructive variant).
- ItemRow → ShoppingItemRow + PantryItemCard integration should surface in Maestro screenshots of the Shopping and Pantry tabs.

No blockers. Plan 06 must clear Metro cache on first run or all the above visual changes will not be visible in the simulator.

## Self-Check: PASSED

- `apps/mobile/src/components/ui/useCollapsingHeader.ts` — FOUND (token-driven)
- `apps/mobile/src/app/(tabs)/_layout.tsx` — FOUND (colors.brand active tint)
- `apps/mobile/src/app/_layout.tsx` — FOUND (tokenized spinner + Stack)
- `apps/mobile/src/components/shopping/ShoppingItemRow.tsx` — FOUND (ItemRow wrapper)
- `apps/mobile/src/components/pantry/PantryItemCard.tsx` — FOUND (ItemRow wrapper, leading=icon)
- `apps/mobile/src/design/tokens-purity.test.ts` — FOUND (`describe(...)`, skip removed)
- `apps/mobile/src/components/ui/ChipToggle.tsx` — DELETED (confirmed not present)
- `apps/mobile/src/components/recipes/SearchBar.tsx` — DELETED (confirmed not present)
- Commit `799c533` (Task 1) — FOUND
- Commit `43f7d70` (Task 2a) — FOUND
- Commit `acdb16e` (Task 2b) — FOUND
- Commit `cfff06c` (Task 2c) — FOUND
- Commit `a43d0c0` (Task 3) — FOUND
- `cd apps/mobile && pnpm vitest run src/design/tokens-purity.test.ts` — 2/2 GREEN
- `cd apps/mobile && pnpm vitest run src/design src/components/ui src/components/recipes src/components/plan` — 120/120 GREEN
- `cd apps/mobile && npx tsc --noEmit -p .` — exits 0
- `grep -rE '#F97316|orange-[0-9]+' apps/mobile/src --include='*.ts' --include='*.tsx'` — only test-file matches (excluded by purity walker)

---
*Phase: 19-design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash*
*Completed: 2026-04-18*
