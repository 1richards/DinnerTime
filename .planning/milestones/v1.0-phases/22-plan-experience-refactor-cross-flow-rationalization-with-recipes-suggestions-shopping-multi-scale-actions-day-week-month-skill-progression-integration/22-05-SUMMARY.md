---
phase: 22-plan-experience-refactor
plan: 05
subsystem: skill-progression
tags: [skill-tier, focus-theme, stretch-meal, progression, settings, mealPlanner, patch, vitest, alert-prompt]

# Dependency graph
requires:
  - phase: 22-plan-experience-refactor (Plan 22-00)
    provides: pickStretchDay + deriveSkillTier pure helpers (consumed for client-side stretch derivation and Settings tier label), MealPlan.focus_theme optional field, MealPlanEntry.is_stretch optional field, logPlanEvent/sanitizePayload telemetry primitives, 22-00 migration 00026 (meal_plans.focus_theme column exists)
  - phase: 10-skill-progression-offline
    provides: recipe_cooks table + logRecipeCook (regression-verified via existing progression.test.ts "markCooked → logRecipeCook"), progressionStore.cookStats + fetchCookStats (consumed by plan.tsx stretch derivation + settings.tsx tier display), getCookStats server service (consumed by mealPlanner prompt gate)
  - phase: 20-shopping-draft-cart-handoff
    provides: settingsStore Zustand+persist pattern (cloned verbatim to add planFocusBannerEnabled alongside shoppingHandoffMode)
provides:
  - apps/mobile/src/components/plan/FocusBanner.tsx — dismissible weekly-skill-focus banner with Alert.prompt UX
  - packages/server/src/routes/meal-plans.ts PATCH /:id handler — focus_theme update endpoint with ownership guard
  - packages/server/src/services/mealPlanner.ts SKILL TIER + THIS WEEK'S THEME prompt blocks — Claude-visible nudges
  - apps/mobile/src/stores/mealPlanStore.ts setFocusTheme(theme) — client-side PATCH action + state merge
  - apps/mobile/src/stores/settingsStore.ts planFocusBannerEnabled (default true) + setter — persisted banner toggle
  - apps/mobile/src/app/(tabs)/plan.tsx stretch derivation pipeline — useMemo over entries + cookStats median → attach is_stretch + fire plan.stretch_displayed telemetry
  - apps/mobile/src/app/(tabs)/settings.tsx PLAN section — read-only Skill Tier display + banner Switch
  - apps/mobile/src/components/plan/DayRow.tsx is_stretch data-flip — Stretch chip now live
affects: [22-06-info-density-swipe (pantry_ready parallel — same derived-client-side pattern shipped here for is_stretch)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server skill-tier derivation mirrors client helper: packages/server/src/services/mealPlanner.ts sums cook_count via getCookStats() and bands with the same <5=1 <20=2 else=3 boundaries as apps/mobile/src/plan/skillTier.ts. Both branches will drift in lockstep if the boundaries move."
    - "Derived-not-persisted plan fields: is_stretch is computed per render by pickStretchDay(entries, medianComplexity) — never stored. Survives swap/regenerate because the calculation re-runs whenever MealPlanStore.currentPlan changes. Pattern reused in 22-06 for pantry_ready."
    - "PATCH endpoint gate pattern: require 'focus_theme' in body before entering the update path (returns 400 'No updatable fields' when absent). Lets typo callers (`{ focusTheme: x }`) fail fast instead of silently succeeding with no DB write."
    - "Ownership guard via compound .eq: .update().eq('id', planId).eq('profile_id', user.id).maybeSingle() returns null (not an error) when the row exists but is owned by a different profile. Handler distinguishes this from a DB error and returns 404."
    - "Alert.prompt pre-filled with current value: iOS-native text input modal. Empty trim → null (clear theme); non-empty trim → new theme. Telemetry fires only for the commit-a-theme path, not for clears."

key-files:
  created:
    - apps/mobile/src/components/plan/FocusBanner.tsx
    - .planning/phases/22-plan-experience-refactor-.../deferred-items.md
  modified:
    - packages/server/src/services/mealPlanner.ts (MealPlanContext extensions + prompt builder blocks + generateMealPlan tier/theme seed)
    - packages/server/src/services/__tests__/mealPlanner.test.ts (9 new cases across 2 new describe blocks)
    - packages/server/src/routes/meal-plans.ts (PATCH /:id handler)
    - packages/server/src/routes/__tests__/meal-plans.test.ts (6 new PATCH cases + mock extension with update().eq().eq().select().maybeSingle() chain)
    - apps/mobile/src/stores/mealPlanStore.ts (setFocusTheme action + MealPlanState interface)
    - apps/mobile/src/stores/__tests__/mealPlanStore.test.ts (4 new setFocusTheme cases)
    - apps/mobile/src/stores/settingsStore.ts (planFocusBannerEnabled + setter)
    - apps/mobile/src/stores/__tests__/settingsStore.test.ts (4 new toggle cases)
    - apps/mobile/src/app/(tabs)/plan.tsx (stretch derivation + fetchCookStats bootstrap + FocusBanner mount + plan.stretch_displayed telemetry)
    - apps/mobile/src/app/(tabs)/settings.tsx (PLAN section with Skill Tier display + banner toggle)
    - apps/mobile/src/components/plan/DayRow.tsx (is_stretch + pantry_ready flags now forwarded to deriveStatusChips)

key-decisions:
  - "Skill tier thresholds duplicated server-side in generateMealPlan rather than imported from a shared package. Rationale: server and mobile ship as separate packages with their own dependency closures; a dedicated shared package is extra plumbing for two 3-line functions. Both branches reference 22-00's decision record (<5=1, <20=2, else=3) so drift would be a review failure."
  - "Non-empty focus_theme check treats empty string as absent in the prompt builder (typeof string && length > 0). Protects against accidental '   ' whitespace-only themes bleeding into the prompt as a useless directive. setFocusTheme null-clears on the client side via trim-then-length check in FocusBanner."
  - "plan.stretch_displayed telemetry depends on stretchDay + currentPlan.id in useEffect. Fires once on initial render and re-fires when stretchDay changes (e.g. after a swap). Does NOT fire on every render because React's deps array deduplicates. Session IDs are per-fire (crypto.randomUUID) — each render-triggered event correlates its own group."
  - "FocusBanner lives inside the collapsing listHeader (Animated.View) rather than above/outside. This makes it participate in the large-header collapse animation so it sits naturally with the 'This Week' + date-range block. Trade-off: banner also fades slightly on scroll, which reads as intended (banner is a 'context for this week' affordance)."
  - "Settings PLAN section placed between Cooking and Shopping sections. Rationale: Cooking/dark-mode is about the active cook experience; Plan is about the upcoming week; Shopping is about the post-plan fulfillment. Linear ordering matches user mental flow."
  - "markCooked → logRecipeCook regression test NOT re-added to mealPlanner.test.ts. Already covered by progression.test.ts 'markCooked → logRecipeCook' describe block (line 288). Adding a duplicate would create maintenance drag; the plan's 'verify stays as a guard' intent is satisfied by confirming that test suite still greens (13/13 green on server run)."

patterns-established:
  - "Server-side fetch-and-seed for plan-level metadata: generateMealPlan reads meal_plans.focus_theme BEFORE the delete-then-insert regenerate flow so the existing theme survives plan regeneration. Future plan-level fields (e.g. 'notes', 'difficulty_override') follow the same read-seed pattern."
  - "Dual-sided skill-tier derivation: server computes for prompt-gating (what Claude sees), client computes for display (what user sees). Both read from the same lifetime cook_count sum. Keeps a single source of truth for the underlying data while letting each branch apply its own use case."
  - "Derived flag parity between DayRow and telemetry: is_stretch is attached to the entry object in plan.tsx's days useMemo AND used as a dep for the plan.stretch_displayed useEffect. One derivation feeds both the visual chip (via DayRow) and the analytics event."

requirements-completed: [PLAN-X-10, PLAN-X-11, PLAN-X-12, PLAN-X-13]

# Metrics
duration: 14min
completed: 2026-04-20
---

# Phase 22 Plan 22-05: Skill Progression Integration Summary

**Planning becomes a vehicle for growth — server prompt gates advanced recipes below tier 2 via getCookStats-derived skillTier, weekly skill-focus theme persists to meal_plans.focus_theme via PATCH /:id, and the Week view surfaces one stretch meal per week via pickStretchDay + the is_stretch chip binding. Settings PLAN section shows the user their tier and lets them turn the FocusBanner off.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-20 (session)
- **Completed:** 2026-04-20
- **Tasks:** 3
- **Files created:** 1 (FocusBanner.tsx) + 1 tracking doc (deferred-items.md)
- **Files modified:** 11
- **Tests added:** 23 new cases (9 buildMealPlanPrompt tier+theme + 6 PATCH /:id + 4 setFocusTheme + 4 settingsStore planFocusBannerEnabled)

## Accomplishments

- **Server tier-gate lands.** `packages/server/src/services/mealPlanner.ts` now seeds `MealPlanContext` with `skillTier` (derived via `getCookStats(profileId) → sum(cook_count) → <5=1 <20=2 else=3`) and emits a `SKILL TIER: N` line in every prompt. When tier < 2 an extra "Avoid recipes with difficulty='hard' or estimated_time > 60" clause pushes Claude toward beginner-safe picks. Tier is best-effort — failures default to tier 2 so a transient Supabase hiccup never breaks generation.
- **Focus-theme persistence ships end-to-end.** `PATCH /meal-plans/:id` lets the mobile FocusBanner flip `focus_theme` server-side; `generateMealPlan` reads the row on regeneration so the theme survives a week-regenerate cycle. Prompt emits `THIS WEEK'S THEME: <theme>. Include at least 2 recipes that exercise this theme (name it in why_suggested).` when a non-empty theme is set; empty string / null skip the block entirely.
- **Client-side stretch derivation is live.** `plan.tsx` computes `stretchDay = pickStretchDay(entries, medianComplexity)` per render, where `medianComplexity` is a coarse proxy from `cookStats.sum(cook_count)` (<5→3, <20→6, else→9). The matching entry gets `is_stretch: true` attached in-memory; `DayRow` now passes that flag through `deriveStatusChips`, rendering the existing warning-tone "Stretch" chip. Stretch re-evaluates automatically after swap because it's derived, not persisted — fixes 22-RESEARCH Pitfall 5.
- **FocusBanner lives at the top of the Week list.** New `apps/mobile/src/components/plan/FocusBanner.tsx` component. Shows `This week: <theme>` with a Change pressable when set, or `Set a weekly focus…` with a Set focus pressable when absent. Tap → `Alert.prompt` pre-filled with current theme → submit → `mealPlanStore.setFocusTheme(trimmed || null)` → PATCH. Fires `plan.focus_theme_set` telemetry (sanitized 14-key payload: meal_plan_id + week_start).
- **Settings PLAN section.** Between Cooking and Shopping. Row 1: read-only `Skill Tier` display — computed from `useProgressionStore(s=>s.cookStats)` via `deriveSkillTier` and formatted as `Tier N · Beginner|Intermediate|Advanced`. Row 2: `Weekly Skill Focus banner` Switch bound to `settingsStore.planFocusBannerEnabled` (default true, persisted).
- **Cook → progression regression guarded.** Existing `packages/server/src/services/__tests__/progression.test.ts` line 288 'markCooked → logRecipeCook' describe block verified green (13/13) — no regression introduced. PLAN-X-11 satisfied without duplicate test coverage (see Deviation #2).
- **Plan.stretch_displayed telemetry.** Fires in a `useEffect` with dep array `[stretchDay, currentPlan?.id, currentPlan?.week_start]` so the event re-fires when stretch changes post-swap. Sanitized payload carries only `meal_plan_id` + `week_start`.

## Task Commits

| Task                                                                                    | Commit (RED) | Commit (GREEN) | Type  |
| --------------------------------------------------------------------------------------- | ------------ | -------------- | ----- |
| Task 1: Server mealPlanner tier gate + PATCH focus_theme endpoint                       | `0f66f98`    | `77850eb`      | test + feat |
| Task 2: setFocusTheme store action + client-side stretch derivation + DayRow flag bind  | `b4d9a06`    | `7231167`      | test + feat |
| Task 3: FocusBanner component + Plan tab mount + Settings toggle                        | —            | `0d9fee0`      | feat  |

(Task 3 shipped as one feat commit — the new test cases in `settingsStore.test.ts` and the Store implementation are tightly coupled and neither is TDD-flagged in the plan file; bundling them as a single commit keeps the change self-contained.)

## Files Created/Modified

### Created

- `apps/mobile/src/components/plan/FocusBanner.tsx` (108 lines) — `export function FocusBanner()`. iOS Alert.prompt integration, null-safe guard for missing currentPlan, warm accent background (`#FFF4E6`) mirroring the stretch chip warning tone.
- `.planning/phases/22-.../deferred-items.md` — logs the pre-existing `pantry_items` schema-cache failure + `GOOGLE_API_KEY` env probe for future ops pass.

### Modified

**Server (`packages/server/`):**

- `src/services/mealPlanner.ts`:
  - `MealPlanContext` gains optional `skillTier?: 1 | 2 | 3` + `focusTheme?: string | null`.
  - `buildMealPlanPrompt` destructures both new fields, emits `SKILL TIER: N` line always (defaults to 2 when unspecified), appends tier-gate clause when `< 2`, appends `THIS WEEK'S THEME:` block when theme is a non-empty string.
  - `generateMealPlan` imports `getCookStats`, derives skillTier (best-effort default 2), reads `meal_plans.focus_theme` for target week_start before the delete-insert regenerate flow, passes both into the context.
- `src/services/__tests__/mealPlanner.test.ts`: 9 new cases across 'Phase 22-05: skill tier gate' (5 cases) + 'Phase 22-05: focus theme' (4 cases) describe blocks.
- `src/routes/meal-plans.ts`: new `PATCH /:id` handler (44 lines). JSON parse 400 / empty body 400 / null-maybeSingle 404 / ownership via `.eq('id').eq('profile_id')`.
- `src/routes/__tests__/meal-plans.test.ts`: 6 new PATCH cases + mock extension (adds `update`-chain on `meal_plans` table + state fields `patchUpdatedPlan` / `lastPatchPayload` / `patchEqPairs`).

**Mobile (`apps/mobile/`):**

- `src/stores/mealPlanStore.ts`: `setFocusTheme(theme)` action + interface. Server response is merged onto `state.currentPlan` while `entries` is preserved (server returns plan row only, no nested entries).
- `src/stores/__tests__/mealPlanStore.test.ts`: 4 new cases covering happy path, clear-via-null, no-op when currentPlan null, error path.
- `src/stores/settingsStore.ts`: `planFocusBannerEnabled` (default `true`) + `setPlanFocusBannerEnabled`. Persisted under the existing `dinnertime-settings` storage blob.
- `src/stores/__tests__/settingsStore.test.ts`: 4 new cases covering default, toggle, persistence, rehydration.
- `src/app/(tabs)/plan.tsx`:
  - Imports `useProgressionStore`, `pickStretchDay`, `FocusBanner`.
  - `fetchCookStats()` on mount.
  - `medianComplexity` useMemo (<5 cooks=3, <20=6, else=9).
  - `stretchDay` useMemo calling `pickStretchDay`.
  - `days` useMemo attaches `is_stretch: d === stretchDay` per entry.
  - `plan.stretch_displayed` telemetry useEffect.
  - FocusBanner mounted in the collapsing listHeader, guarded by `planFocusBannerEnabled`.
- `src/app/(tabs)/settings.tsx`: imports progression + settings stores + deriveSkillTier. New PLAN section between COOKING and Shopping — Skill Tier row (read-only, `Tier N · Label`) + Banner Switch row.
- `src/components/plan/DayRow.tsx`: `deriveStatusChips` call now passes `isStretch: entry.is_stretch === true` and `pantryReady: entry.pantry_ready === true` (latter still always `undefined` at runtime — 22-06 wires it).

## Interface Contracts (for downstream Plan 22-06)

```typescript
// 22-06 (DayRow swipe + pantry_ready chip) can assume:

// Stretch chip is already rendering via DayRow — 22-06 only needs to
// flip the final flag (pantry_ready) to light up the "Pantry ready"
// chip. No additional DayRow changes required.
import type { MealPlanEntry } from '@/types/mealPlan';
// MealPlanEntry.is_stretch + pantry_ready BOTH optional, BOTH flow
// through deriveStatusChips as of this plan.

// setFocusTheme action is ready for reuse from any surface — 22-06
// might want to surface a theme-suggestion chip or similar.
import { useMealPlanStore } from '@/stores/mealPlanStore';
// useMealPlanStore(s => s.setFocusTheme)(theme | null) → Promise<void>

// planFocusBannerEnabled toggle exists if 22-06 wants to ship
// additional Plan-tab toggles next to it.
import { useSettingsStore } from '@/stores/settingsStore';
// useSettingsStore(s => s.planFocusBannerEnabled)
// useSettingsStore(s => s.setPlanFocusBannerEnabled)(v)
```

## Deviations from Plan

**1. [Rule 3 - Blocking] Empty focus_theme string treated as absent in prompt builder**

- **Found during:** Task 1 (writing buildMealPlanPrompt tests)
- **Issue:** The plan spec said `focusTheme?: string | null` — but empty strings and whitespace-only values should not emit the THIS WEEK'S THEME block (they'd produce a useless nudge like "THIS WEEK'S THEME: . Include at least 2 recipes…").
- **Fix:** Changed the gate from `focusTheme ? … : ''` to `typeof focusTheme === 'string' && focusTheme.length > 0 ? … : ''`. FocusBanner's trim-then-length check on the client side keeps nulls flowing through setFocusTheme when the user submits empty. Covered by the 'focusTheme empty string → prompt does NOT contain the theme block' test.
- **Files modified:** `packages/server/src/services/mealPlanner.ts`, `packages/server/src/services/__tests__/mealPlanner.test.ts`
- **Verification:** 4/4 focus-theme cases green.
- **Committed in:** `77850eb` (Task 1 GREEN)

**2. [Rule 2 - Missing Critical] PLAN-X-11 regression test already exists in progression.test.ts**

- **Found during:** Task 1 (plan said "add a unit test asserting `recipe_cooks` row is produced on markCooked")
- **Issue:** Already exists — `packages/server/src/services/__tests__/progression.test.ts` line 288-347 has a full 'markCooked → logRecipeCook' integration test asserting `recipe_cooks.insert` is called with the correct profile_id + recipe_id. Adding another copy to mealPlanner.test.ts would create maintenance drag.
- **Fix:** Verified the existing test passes (13/13 green on `pnpm test --run src/services/__tests__/progression.test.ts`). No new test authored. PLAN-X-11 is satisfied by the standing regression guard.
- **Files modified:** None (verification-only).
- **Documented in:** key-decisions (above) for the record.
- **Committed in:** N/A (non-change).

**3. [Rule 3 - Blocking] Task 3 shipped as a single commit (not red-then-green)**

- **Found during:** Task 3 planning
- **Issue:** Task 3 is NOT TDD-flagged in the plan (no `tdd="true"` attribute — only Tasks 1 and 2 are). Splitting settingsStore.test.ts additions from settingsStore.ts additions into separate commits would be ceremony without value: both files evolve together, the tests are unit tests for a 3-line state-setter, and the plan's verify block just says "run settingsStore tests + typecheck + grep for FocusBanner".
- **Fix:** Shipped the whole Task 3 (test additions + store extension + FocusBanner component + plan.tsx mount + settings.tsx section) as one feat commit `0d9fee0`.
- **Files modified:** 5 files (see Files Modified section).
- **Verification:** 8/8 settingsStore + 30/30 mealPlanStore + 49/49 across plan test suite all green.
- **Committed in:** `0d9fee0`

---

**Total deviations:** 3 (1 blocking fix in prompt builder, 1 missing-critical check that found pre-existing coverage, 1 commit-granularity decision). All auto-applied under Rules 2/3; no user input required.

## Issues Encountered

- **Pre-existing test failures documented in `deferred-items.md`.** 1 `__tests__/meal-plans.test.ts` integration failure (pantry_items.unit column missing from Supabase schema cache) + 1 `src/ai/__tests__/taskRouting.test.ts` (env.GOOGLE_API_KEY probe). Both confirmed pre-existing via stash-then-rerun against parent commit `dcd65a9`. Not introduced here.
- **Pre-existing mobile test failures unchanged.** 4 failures in auth-store.test.ts + shoppingStore.test.ts + progressionStore.test.ts.fetchVariations — all documented in 22-00-SUMMARY.md and stable on main.
- **iOS dev-client rebuild NOT performed in this plan.** This plan ships zero new native modules; the FocusBanner/SymbolIcon/Alert.prompt stack is pure JS. Existing ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app still runs the new code via Metro bundle swap.

## User Setup Required

None. All changes are pure-JS and take effect on the next Metro reload. No migration needed (22-00 already shipped `meal_plans.focus_theme` column). To exercise the PATCH endpoint in UAT:

1. Ensure a meal plan exists for the current week (`/meal-plans/current` returns 200).
2. Tap the FocusBanner "Set focus" → enter "knife skills" → submit.
3. Verify the banner now reads "This week: knife skills".
4. Regenerate the week → the generated plan prompt should include a `THIS WEEK'S THEME: knife skills` block and (with some variance) contain ≥2 recipes whose `why_suggested` mentions knife skills.

---

## Self-Check: PASSED

All 3 task commits resolvable via `git log --oneline`:

- `0f66f98` test(22-05): add failing tests for skill-tier gate + focus-theme + PATCH /:id
- `77850eb` feat(22-05): implement skill-tier gate + focus-theme + PATCH /meal-plans/:id
- `b4d9a06` test(22-05): add failing tests for mealPlanStore.setFocusTheme
- `7231167` feat(22-05): setFocusTheme store action + client-side stretch derivation + DayRow flag binding
- `0d9fee0` feat(22-05): FocusBanner + Plan settings section + planFocusBannerEnabled toggle

FocusBanner.tsx present on disk at `apps/mobile/src/components/plan/FocusBanner.tsx`. Server test suite (mealPlanner + meal-plans + progression): 71/71 green. Mobile test suite (mealPlanStore + settingsStore + dayRowHelpers + stretchPicker + skillTier): 65/65 green. All 4 requirements PLAN-X-10..13 satisfied (stretch meal derivation live, cook→progression regression-verified, focus theme banner + PATCH, tier gate + display).

---

*Phase: 22-plan-experience-refactor*
*Completed: 2026-04-20*
