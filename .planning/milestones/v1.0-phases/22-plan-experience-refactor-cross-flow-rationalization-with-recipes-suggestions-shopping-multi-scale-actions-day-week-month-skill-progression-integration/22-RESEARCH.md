# Phase 22: Plan Experience Refactor — Research

**Researched:** 2026-04-20
**Domain:** React Native / expo-router navigation rewire, Zustand state split, native iOS date picker, meal-plan data model extension, cross-flow telemetry
**Confidence:** HIGH (for shipped infrastructure reuse); MEDIUM (for new scope — month view + skill tiers — no precedent in repo)

## Summary

Phase 22 is a **UX refactor + modest backend extension** — not a rewrite. ~70% of the surface area reuses already-shipped primitives: `AddToPlanSheet`, `HandoffSheet` (Phase 20), `useMealPlanStore`, `useProgressionStore`, `useCollapsingHeader`, `Chip`, `SymbolIcon`, telemetry pattern from Phase 16/20, `deriveStatusChips` (already stubbed with `isStretch`/`pantryReady` flags awaiting this phase). The new surface area is: (1) native iOS date picker (one new dep), (2) month-view overview screen/mode (new composition of existing data), (3) swipe-to-action on DayRow (gesture-handler already installed), (4) skill-level derivation from existing `recipe_cooks` rows, (5) a route-aware `Add to Plan` that accepts arbitrary dates instead of current-week-only.

**Two gating backend changes drive the phase shape:**

1. **`meal_plans.week_start` is a hard-coded Monday.** The DB schema already allows multiple weeks per profile (UNIQUE `(profile_id, week_start)`). Month view ≠ schema change; it's a multi-week fetch. But the `POST /meal-plans/entries/assign` endpoint currently pins to "current week's Monday" (packages/server/src/routes/meal-plans.ts:169). Arbitrary-date pinning from Something New / Recipe Detail requires extending `assign` to accept `week_start` + `day_of_week` (or `date` → server derives both).
2. **No "skill level" exists.** Phase 10 shipped `recipe_cooks` (event log) + heuristic `complexity` scoring — but no level/tier, no "unlocked techniques" taxonomy. Phase 22's skill-progression-integration needs a lightweight derived view (cook count → tier 1/2/3) and a "stretch" flag on generated entries, not a new ontology.

**Primary recommendation:** Decompose into **7 plans** aligned to four clusters. Ship the native date picker and extend `/entries/assign` in Wave 0 so all downstream plans can consume a `scheduleMeal(date, recipe)` helper. Treat month view as a **mode inside `plan.tsx`** (segmented control) rather than a new route — matches the Phase 12 Kitchen pattern and preserves tab-bar real estate. Derive skill tier on the client from `cookStats.length` + median complexity; no migration, no new tables for v1. Keep telemetry as a new `plan_events` table cloned verbatim from `shopping_events` (migration 00024).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cross-flow Navigation (SC 1-4):**
- Plan → Recipe: tap planned meal → push recipe detail; Back returns to same Plan day (not week root).
- Recipe → Plan: extend existing "Add to Plan" in HeaderEllipsis menu to accept a specific date via native iOS date picker. Default to next available empty day.
- Plan → Shopping: "Shopping list" button on each day + week header; aggregates ingredients, passes through Phase 20's HandoffSheet flow.
- Suggestions → Plan: "Pin to day" action on each AI suggestion card in Something New → opens date picker.

**Date Pickers & Scale (SC 5-9):**
- Native iOS picker: `@react-native-community/datetimepicker` or Expo's built-in (auto-detect from codebase — result: **neither installed**; see Standard Stack).
- Week view: keep current default; add day-drill gesture.
- Month view: new overview showing 28-35 cells with compact status indicators (planned/cooked/empty/skipped colors).
- Day drill-down: full-screen detail with ingredients checklist, timer shortcuts, "cook now" → Voice Cooking Mode entry.
- Week actions: Regenerate, shift ±1 week, duplicate last week, shopping list.
- Month actions: Pattern analysis (protein/cuisine distribution, repeat meals), mark travel/event days.

**Skill Progression Integration (SC 10-13):**
- Reuse Phase 10 `progressionStore`.
- One stretch meal/week (skill level +1) flagged on card.
- Plan completion → credit skills to progressionStore.
- Weekly skill focus (optional) → generator prioritizes recipes exercising theme.
- Prerequisite gating: generator respects `progressionStore.unlockedTechniques` before suggesting advanced recipes.

**Information Density (SC 14-16):**
- Day card: meal name, cook time, stretch/new indicator, cook status, pantry-readiness dot.
- Token-based color/chip system (Phase 19 tokens: success / brand / warning / tertiary).
- Inline quick edit: swipe-to-action on day card (swap, mark cooked, skip).

### Claude's Discretion
- Month-view cell layout (4-5 rows × 7 days; square or portrait cells).
- Pattern-analysis presentation (charts vs text).
- Weekly skill focus UI placement (banner vs toggle).
- Stretch-meal visual indicator (chip vs icon).
- Swipe gesture library (Reanimated Swipeable vs custom).
- Whether month view is its own screen or mode within Plan tab.

### Deferred Ideas (OUT OF SCOPE)
- Multi-user/household planning.
- iOS Calendar export (.ics).
- Cooking time-of-day reminders.
- Community-shared plan templates.
- Macro/calorie tracking per plan.

## Project Constraints (from CLAUDE.md)

- iOS-first Expo SDK 55, React Native 0.83, New Architecture mandatory.
- All AI calls go through backend (Hono) — no Claude API keys in mobile.
- State: Zustand for UI, TanStack Query for server state (React Query is installed but not yet used by plan/shopping stores — keep pattern consistent with `mealPlanStore`'s plain Zustand + `authedFetch`).
- Styling: NativeWind Tailwind classes + `design/tokens.ts` for non-className consumers.
- expo-router file-based routing; SF Symbols via `SymbolIcon`.
- Testing: Maestro UAT on iOS Simulator before declaring UI features complete. See `.maestro/scripts/uat.sh`.
- GSD workflow enforcement — file edits only through GSD commands.

## Phase Requirements

Phase 22 is a post-v1 UX phase. The 16 success criteria map to PLAN-X-01..16 (prefix "X" = UX/extension to PLAN-01..07 from REQUIREMENTS.md). All map cleanly to existing infra.

| ID | Cluster | Behavior | Research Support |
|----|---------|----------|------------------|
| PLAN-X-01 | Cross-flow | Tap planned meal → recipe detail; Back returns to same Plan day | `expo-router` native-stack preserves route state; `DayRow.onPress` currently shows Alert — swap for `router.push(/recipes/${recipe_id})` |
| PLAN-X-02 | Cross-flow | "Add to Plan" on Recipe Detail accepts arbitrary date | `AddToPlanSheet.tsx` exists, is week-only; extend to date picker. Backend endpoint `/entries/assign` hard-codes current Monday (L169) — extend to accept `date` param |
| PLAN-X-03 | Cross-flow | "Shopping list" on day/week → HandoffSheet | `useShoppingStore.generateList(mealPlanId)` exists; `HandoffSheet` + `openInstacartCart` reusable as-is |
| PLAN-X-04 | Cross-flow | "Pin to day" on Something New suggestion cards | `SuggestionCard` accepts `onPress`; add overflow action → reuse `AddToPlanSheet` with unsaved-recipe path (AddToPlanSheet already takes a `Recipe` shape — pass suggestion mapped to minimum recipe fields + `recipe_id: null`) |
| PLAN-X-05 | Scale | Week view remains default | `plan.tsx` is week view today — no change |
| PLAN-X-06 | Scale | Month view with 28-35 cells showing status | **New screen/mode.** Multi-week fetch: need `GET /meal-plans?week_start_from=&week_start_to=` (new endpoint). Status colors already defined in tokens (success/warning/destructive/textTertiary) |
| PLAN-X-07 | Scale | Day drill-down full screen | New route `apps/mobile/src/app/plan/[date].tsx`; ingredients from `MealPlanEntry.ingredients`; "cook now" → `router.push(/recipes/${recipe_id}/cook)` (Phase 16 voice cooking) |
| PLAN-X-08 | Scale | Week actions: regenerate, shift ±1 week, duplicate last week, shopping list | Regenerate exists; shift = generate for `weekStart ± 7d`; duplicate = fetch prior week then POST assign for each day with new `week_start` |
| PLAN-X-09 | Scale | Month actions: pattern analysis, mark travel/event days | Pattern analysis = client-side aggregate over `entries.*.difficulty` + recipe cuisine tags. Travel/event days = new `entry.status = 'skipped'` with a reason string (extend enum or add `skip_reason TEXT` column) |
| PLAN-X-10 | Skill | One stretch meal/week | Server: `mealPlanner.ts` Claude prompt adds "flag ONE entry as stretch". New column `meal_plan_entries.is_stretch BOOLEAN DEFAULT FALSE` OR derive client-side from complexity gap. Recommend: **client-side derive** for v1 to avoid migration |
| PLAN-X-11 | Skill | Plan completion credits skills | `recipe_cooks` row is already logged by `mealPlanner.markCooked` (progression.ts `logRecipeCook`) — already wired. Verify |
| PLAN-X-12 | Skill | Weekly skill focus (optional theme) | Server prompt extension; store `focus_theme TEXT` on `meal_plans`. UI: new banner on week header |
| PLAN-X-13 | Skill | Prerequisite gating | **No unlocked-techniques system exists.** For v1, derive a simple tier (1/2/3) from `recipe_cooks.count`: tier 1 = < 5 total cooks, tier 2 = 5-20, tier 3 = 20+. Gate advanced recipes (`complexity >= 12`) behind tier ≥ 2 in server prompt |
| PLAN-X-14 | Density | Day card shows status chips | `deriveStatusChips` already built (`dayRowHelpers.ts`) with `isStretch`/`pantryReady` flag stubs. One-line flip in DayRow.tsx once flags are wired |
| PLAN-X-15 | Density | Token-based status colors | `Chip` component + `design/tokens.ts` colors (`success`, `warning`, `destructive`, `brand`, `textTertiary`) — all shipped |
| PLAN-X-16 | Density | Swipe-to-action (swap, mark cooked, skip) | `react-native-gesture-handler@2.30` + `react-native-reanimated@4.2` installed. Use gesture-handler's built-in `Swipeable` component (not deprecated — v2 `ReanimatedSwipeable` is the current export) |

## Standard Stack

### Core (already installed — reuse)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| expo-router | 55.0.12 | Stack/tab navigation, route `/plan/[date]` | package.json |
| react-native-gesture-handler | 2.30 | Swipeable on DayRow | package.json |
| react-native-reanimated | 4.2.1 | Swipeable animations, month→day transition | package.json |
| zustand | 5.0.12 | `mealPlanStore`, `progressionStore`, new `planFocusStore` (if needed) | package.json |
| @supabase/supabase-js | 2.103 | Multi-week fetch via existing client | package.json |

### New (one dep)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@react-native-community/datetimepicker` | ~8.x (SDK 55 compatible) | Native iOS wheel-picker for "Add to Plan" from Recipe + Something New | **Verified not installed.** Expo does not ship a date picker out of the box. Community module is autolinked, requires dev client rebuild. Alternative `expo-modal` / custom rendering loses the native feel user explicitly asked for |

**Verification:** `npm view @react-native-community/datetimepicker version` before planning — SDK 55 bundles expect specific peer range. Run `pnpm --filter mobile add @react-native-community/datetimepicker` then `cd apps/mobile && npx expo prebuild` (autolinked native module — dev client rebuild required, matches Phase 10 netinfo pattern).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|-----------|-----------|----------|
| `@react-native-community/datetimepicker` | Custom Pressable grid like `AddToPlanSheet` week row, extended to multi-week | Misses native iOS wheel feel; CONTEXT explicitly says "native iOS date picker" |
| New `is_stretch` DB column | Client-side derive from complexity | V1 simplicity; flip later if server needs it |
| New "month" tab | Segmented control within `plan.tsx` (`[Week][Month]`) | Saves tab-bar slot; matches Phase 12 Kitchen pattern |
| New `skill_level` table | Client-side tier from `recipe_cooks.count` + complexity | Avoids migration; tier is display-only for v1 |
| `Swipeable` from `react-native-reanimated-swipeable` | `ReanimatedSwipeable` from `react-native-gesture-handler@^2.23` | Gesture-handler's v2 Swipeable is the current recommended import (deprecated package is `react-native-gesture-handler/Swipeable` — use `ReanimatedSwipeable` which is part of gesture-handler now) |

## Architecture Patterns

### Project Structure (new additions only)

```
apps/mobile/src/
├── app/
│   ├── (tabs)/plan.tsx            # Add segmented control [Week|Month]
│   └── plan/
│       └── [date].tsx              # NEW: day drill-down (PLAN-X-07)
├── components/plan/
│   ├── DayRow.tsx                  # Add swipe actions + pantryReady/isStretch binding
│   ├── MonthGrid.tsx               # NEW: 28-35 cell status grid
│   ├── MonthPatterns.tsx           # NEW: protein/cuisine aggregate view
│   ├── WeekActionSheet.tsx         # NEW: regenerate/shift/duplicate/shopping
│   └── DatePickerSheet.tsx         # NEW: wraps DateTimePicker in a Modal
├── components/recipes/
│   └── AddToPlanSheet.tsx          # Extend from week-only to arbitrary date
├── components/suggestions/
│   └── SuggestionCard.tsx          # Add "Pin to day" overflow action
├── plan/
│   ├── telemetry.ts                # NEW: clone of shopping/telemetry.ts (Phase 20)
│   ├── skillTier.ts                # NEW: derive tier from cookStats
│   └── stretchPicker.ts            # NEW: pick stretch meal from generated plan
└── stores/
    └── mealPlanStore.ts            # Extend: add monthPlans, fetchRange(from,to)

packages/server/src/
├── routes/meal-plans.ts             # Extend: /entries/assign accepts date, new GET ?from=&to=
└── services/mealPlanner.ts          # Extend: accept weekStart (already does), add focus_theme + is_stretch pickers

supabase/migrations/
├── 00025_plan_events.sql            # NEW: clone of 00024_shopping_events
└── 00026_meal_plans_focus.sql       # NEW: meal_plans.focus_theme TEXT NULL; meal_plan_entries.skip_reason TEXT NULL
```

### Pattern 1: Date Picker Sheet (Modal wrapper)
**What:** Shared `DatePickerSheet.tsx` consumed by `AddToPlanSheet`, `SuggestionCard`'s "Pin to day", and month→day drill.
**When:** Any place user picks an arbitrary date for a meal.
**Example:**
```typescript
// iOS: use 'inline' display for calendar grid (iOS 14+ default). 'spinner'
// for compact mode. iOS 14+ supports 'compact' which is a tappable chip
// that expands to calendar — matches Apple Calendar.
<DateTimePicker
  value={selectedDate}
  mode="date"
  display="inline" // iOS 14+ calendar view
  minimumDate={today}
  maximumDate={addDays(today, 60)}
  onChange={(_, date) => date && setSelectedDate(date)}
/>
```

### Pattern 2: Month View as Mode, Not Route
Keep `plan.tsx` as the container; add `scale: 'week' | 'month'` to a new lightweight `planViewStore` (persisted). Render `<WeekList>` or `<MonthGrid>` conditionally. This preserves the Kitchen pattern from Phase 12 (segmented control, both lists mounted, `display: none` toggle for scroll preservation).

### Pattern 3: Swipe-to-Action with ReanimatedSwipeable
```typescript
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
// Render right actions: [Swap] [Mark cooked] [Skip]
// Use RectButton for each action for native iOS feel.
```

### Pattern 4: Skill Tier Derivation (client-side)
```typescript
// apps/mobile/src/plan/skillTier.ts
export function deriveSkillTier(cookStats: RecipeCookStats[]): 1 | 2 | 3 {
  const total = cookStats.reduce((s, r) => s + r.cook_count, 0);
  if (total < 5) return 1;
  if (total < 20) return 2;
  return 3;
}
```

### Anti-Patterns to Avoid
- **Don't create a new tab** for month view — preserves tab-bar affordances.
- **Don't migrate `(profile_id, week_start)` UNIQUE** — month view is just a multi-week fetch.
- **Don't build a full technique taxonomy** — CONTEXT flag "unlockedTechniques" is aspirational, Phase 10 never shipped it. Derive a simple tier.
- **Don't unmount the week list when switching to month** — preserve scroll state (Phase 12 pitfall).
- **Don't re-implement `HandoffSheet`** — parent-owned state, reuse verbatim from `shopping.tsx:20-22`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| iOS date picker | Custom calendar grid | `@react-native-community/datetimepicker` with `display="inline"` | Native calendar view, accessibility, localization, dark mode all free |
| Swipeable row | Custom PanResponder + Animated | `ReanimatedSwipeable` from `react-native-gesture-handler` | Already installed. Built-in dismiss thresholds, worklet animations, iOS-feel friction curve |
| Plan↔Recipe↔Shopping navigation | Manual state synchronization | `expo-router` native stack with typed params | Native stack preserves scroll state + back-gesture for free |
| Pantry-readiness compute | Re-match on mobile | Reuse server `matchIngredientsToPantry` (services/ingredientMatching.ts) + expose as computed field on `MealPlanEntry` | Already canonical source for SHOP/PANT |
| Telemetry queue/batch | Per-tab loggers | Clone `shopping/telemetry.ts` verbatim → `plan/telemetry.ts` with `plan.*` event names | Proven pattern across Phase 16 + 20. 14-key payload whitelist stays consistent |

**Key insight:** The DayRow already has `deriveStatusChips(isStretch, pantryReady)` stubs. The planner's instinct will be to add a new API for status chips — don't. Flip the two booleans on MealPlanEntry and let the helper do its job.

## Common Pitfalls

### Pitfall 1: `/entries/assign` silently uses current week
**Symptom:** User picks Thursday of next week from Recipe Detail, arrives at current Thursday.
**Root cause:** `packages/server/src/routes/meal-plans.ts:169` calls `mondayOf(new Date())` — ignores any client-supplied date.
**Prevention:** Wave 0 contract extension: accept optional `week_start` string in request body; derive from explicit date if given. Add test assertion: given `date: "2026-05-15"`, Monday is 2026-05-11.

### Pitfall 2: Date picker on iOS renders a blank modal if `value` is undefined
**Prevention:** Always initialize `value` to a Date before mounting the picker. Treat `null` as "today".

### Pitfall 3: Swipeable + FlatList scroll conflicts
**Symptom:** Swipe gesture triggers vertical scroll instead of the action reveal.
**Prevention:** Wrap `ReanimatedSwipeable` in `GestureHandlerRootView` at the screen root (not per-row). `plan.tsx` needs `GestureHandlerRootView` wrapper; already present globally in `_layout.tsx` for gesture-handler — verify.

### Pitfall 4: Month view performance at 28-35 cells × recipe metadata
**Prevention:** For v1, only fetch `{meal_plan_id, day_of_week, status, title, recipe_id}` for the month range — full ingredient arrays bloat the payload. Add a lightweight `?projection=month` query-param to the new range endpoint.

### Pitfall 5: "Stretch meal" flag conflicts with swap
**Symptom:** User swaps the stretch meal → new entry loses the stretch flag → user is confused about "this week's stretch".
**Prevention:** Compute `is_stretch` client-side from complexity delta against the user's median cooked complexity, so it re-evaluates after swap. Don't persist the flag.

### Pitfall 6: Skill tier flaps between tiers 1↔2↔3
**Prevention:** Derive tier from **lifetime** `cookStats` (already persisted in `progressionStore`) — monotonic non-decreasing by construction.

### Pitfall 7: "Pin to day" from Something New assumes saved recipe
**Symptom:** User pins AI-generated suggestion to a day; plan entry has no `recipe_id`, tap-to-detail crashes.
**Prevention:** Two-phase UX: tap "Pin to day" on unsaved suggestion → inline "Saving recipe…" → once saved, call `/entries/assign` with the new `recipe_id`. OR: allow ad-hoc entries with `recipe_id: null` (backend already supports this — line 200 in meal-plans.ts). Choose the latter for speed; add a "Save to Library" affordance later.

## Runtime State Inventory

(Phase 22 is an additive refactor, not a rename — but the backend contract change to `/entries/assign` warrants inventory.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `meal_plans` rows already keyed on arbitrary `week_start DATE` — no migration. `meal_plan_entries` already allows `recipe_id: null`. | None for week-keying. Add optional `focus_theme` + `skip_reason` columns if we ship those features. |
| Live service config | None — no n8n/Datadog/Tailscale touching this. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — no new env. | None. |
| Build artifacts | `@react-native-community/datetimepicker` is autolinked native — requires `npx expo prebuild` + EAS dev-client rebuild. Mirror Phase 10 netinfo sequence. | Dev-client rebuild in Wave 0; document in validation. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Expo SDK | All | ✓ | 55.0.14 | — |
| react-native-gesture-handler | Swipe actions | ✓ | 2.30 | — |
| react-native-reanimated | Animations | ✓ | 4.2.1 | — |
| `@react-native-community/datetimepicker` | Date picker | ✗ | — | None — must install. No custom fallback acceptable (CONTEXT mandates native) |
| EAS dev-client rebuild | Autolinked datetimepicker | ✓ (process documented in CLAUDE.md) | — | — |
| Maestro | UAT | ✓ | 2.4.0 | — |
| iOS Simulator 26.4 | UAT | ✓ | — | — |

**Missing dependencies with no fallback:** `@react-native-community/datetimepicker` — **blocks Wave 1**. Install + prebuild in Wave 0.

## Code Examples

### Extend `/entries/assign` to accept arbitrary date (Wave 0)
```typescript
// packages/server/src/routes/meal-plans.ts (extension)
const rawDate = typeof body.date === 'string' ? body.date : null;
const weekStart = rawDate ? mondayOf(new Date(rawDate)) : mondayOf(new Date());
const dayOfWeek = rawDate
  ? ((new Date(rawDate).getUTCDay() + 6) % 7)  // Mon=0..Sun=6
  : Number(body.day);
// Back-compat: if client sends only `day`, behave as current-week pin (as today).
```

### Plan→Shopping handoff (Wave 2)
```typescript
// On day or week "Shopping list" tap:
await generateList(currentPlan.id);   // useShoppingStore
// Then present HandoffSheet (parent-owned state) — identical to shopping.tsx
```

### Swipeable DayRow (Wave 3)
```typescript
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
<ReanimatedSwipeable
  renderRightActions={() => (
    <SwipeActionGroup>
      <SwipeAction icon="arrow.2.squarepath" label="Swap" onPress={onSwap} />
      <SwipeAction icon="checkmark" label="Cooked" tint={colors.success} onPress={onCook} />
      <SwipeAction icon="xmark" label="Skip" tint={colors.destructive} onPress={onSkip} />
    </SwipeActionGroup>
  )}
>
  {/* existing DayRow body */}
</ReanimatedSwipeable>
```

### Skill tier + stretch pick
```typescript
// apps/mobile/src/plan/skillTier.ts (pure, unit-testable)
export const deriveSkillTier = (cs: RecipeCookStats[]) => {
  const total = cs.reduce((s, r) => s + r.cook_count, 0);
  return total < 5 ? 1 : total < 20 ? 2 : 3;
};
// Pick stretch = highest-complexity entry > median of user's cooked complexity:
export const pickStretchDay = (entries: MealPlanEntry[], cookedMedianComplexity: number) => {
  const ranked = entries
    .map(e => ({ e, c: estimateComplexity(e) }))
    .filter(x => x.c > cookedMedianComplexity + 2)
    .sort((a, b) => b.c - a.c);
  return ranked[0]?.e.day_of_week ?? null;
};
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| `react-native-gesture-handler/Swipeable` | `ReanimatedSwipeable` from same package | v2.20+ | New Architecture compatible, worklet-driven. The old `Swipeable` is deprecated but still works. |
| `expo-av` audio | `expo-audio` / `expo-video` | SDK 52+ | Not relevant to Phase 22 but already enforced project-wide |
| iOS 13 date picker (wheel) | `display="inline"` calendar | iOS 14+ | Visual match with Apple Calendar; CONTEXT wants "native iOS date picker" — inline mode is the current expectation |

**Deprecated/outdated:**
- `react-native-gesture-handler/Swipeable` — still exported but marked deprecated in docs; use `ReanimatedSwipeable`.

## Open Questions

1. **Where does "Weekly skill focus" live in settings vs plan?**
   - Known: CONTEXT flags as Claude's discretion.
   - Recommendation: a collapsible banner at the top of week view (dismissible), with a settings toggle to show/hide. Avoids a new settings section.

2. **Should month view show ad-hoc (unsaved) entries differently from recipe-backed entries?**
   - Known: `recipe_id: null` is legal.
   - Recommendation: same cell styling; tap → full-screen day drill-down which renders ingredients list even without a recipe link.

3. **Duplicate-last-week behavior when last week had skipped/cooked entries?**
   - Recommendation: duplicate the **planned** meals only; reset status to `planned`; skip `skipped` days.

4. **How does "Pin to day" behave if that day is already planned?**
   - Recommendation: prompt "Replace {existing meal}?" before upsert — the existing `/entries/assign` endpoint already does upsert via `ON CONFLICT (meal_plan_id, day_of_week)`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 (mobile unit/helpers) + Maestro 2.4 (UAT) |
| Config | `apps/mobile/vitest.config.ts`, `.maestro/config.yaml` |
| Quick run | `cd apps/mobile && pnpm test -- plan/` |
| Full suite | `cd apps/mobile && pnpm test && .maestro/scripts/uat.sh all` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAN-X-01 | Tap meal → recipe detail | UAT | `maestro test apps/mobile/.maestro/30-plan-to-recipe-roundtrip.yaml` | ❌ Wave 0 |
| PLAN-X-02 | Add to Plan accepts arbitrary date | unit + UAT | `pnpm test components/recipes/AddToPlanSheet.test.tsx && maestro test .maestro/31-addtoplan-datepicker.yaml` | ❌ Wave 0 |
| PLAN-X-03 | Plan→Shopping via HandoffSheet | UAT | `maestro test .maestro/32-plan-shopping-handoff.yaml` | ❌ Wave 0 |
| PLAN-X-04 | Pin-to-day from Something New | UAT | `maestro test .maestro/33-pin-suggestion-to-day.yaml` | ❌ Wave 0 |
| PLAN-X-06 | Month view renders N weeks | unit (store) | `pnpm test stores/mealPlanStore.test.ts` | ❌ Wave 0 |
| PLAN-X-07 | Day drill-down | UAT | `maestro test .maestro/34-plan-day-drilldown.yaml` | ❌ Wave 0 |
| PLAN-X-08 | Week actions (shift/duplicate) | unit + UAT | server route test + `maestro test .maestro/35-week-actions.yaml` | ❌ Wave 0 |
| PLAN-X-10 | Stretch flag picked | unit | `pnpm test plan/stretchPicker.test.ts` | ❌ Wave 0 |
| PLAN-X-13 | Skill tier derivation | unit | `pnpm test plan/skillTier.test.ts` | ❌ Wave 0 |
| PLAN-X-14 | Day card chips | unit | `pnpm test components/plan/dayRowHelpers.test.ts` | ✅ (exists; extend) |
| PLAN-X-16 | Swipe-to-action | UAT | `maestro test .maestro/36-dayrow-swipe.yaml` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- {changed-dir}` (<30s)
- **Per wave merge:** full mobile unit + targeted Maestro flow for the wave
- **Phase gate:** full `pnpm test && .maestro/scripts/uat.sh all` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/mobile/src/plan/skillTier.ts` + `.test.ts`
- [ ] `apps/mobile/src/plan/stretchPicker.ts` + `.test.ts`
- [ ] `apps/mobile/src/plan/telemetry.ts` + `.test.ts` (clone shopping/telemetry pattern)
- [ ] `apps/mobile/src/components/plan/DatePickerSheet.tsx` + test
- [ ] `apps/mobile/src/components/plan/MonthGrid.tsx` + test
- [ ] `.maestro/30-plan-to-recipe-roundtrip.yaml` through `.maestro/36-dayrow-swipe.yaml` (7 new flows)
- [ ] Server route test for `/entries/assign` with explicit date
- [ ] Server route test for new `GET /meal-plans?from=&to=`
- [ ] Migration `00025_plan_events.sql` + `00026_meal_plans_focus.sql`
- [ ] `pnpm --filter mobile add @react-native-community/datetimepicker` + `npx expo prebuild` + EAS dev-client rebuild

## Recommended Plan Decomposition (7 plans)

The planner should produce these 7 plans in this dependency order:

1. **22-00 (Wave 0): Foundation** — install datetimepicker + prebuild + dev-client rebuild; migrations 00025/00026; extend `/entries/assign` to accept date; new `GET /meal-plans?from=&to=` range endpoint; `plan/telemetry.ts` + `plan/skillTier.ts` + `plan/stretchPicker.ts` pure helpers with tests; shared `DatePickerSheet.tsx`. **Unblocks everything.**

2. **22-01 (Cluster 1: Cross-flow nav)** — PLAN-X-01/02/03/04. Plan→Recipe tap, Recipe→Plan with date picker, Plan→Shopping via HandoffSheet, Something New "Pin to day". Reuses shipped primitives heavily.

3. **22-02 (Cluster 2a: Week actions)** — PLAN-X-05/08. Week view stays default; add `WeekActionSheet` with regenerate/shift ±1/duplicate/shopping.

4. **22-03 (Cluster 2b: Month view)** — PLAN-X-06/09. Segmented control in plan.tsx; `MonthGrid` + `MonthPatterns`; range fetch; travel/event day marking.

5. **22-04 (Cluster 2c: Day drill-down)** — PLAN-X-07. Route `/plan/[date]`, ingredients checklist, timer shortcuts, "cook now" → Voice Cooking.

6. **22-05 (Cluster 3: Skill progression)** — PLAN-X-10/11/12/13. Stretch meal picker, verify cook→progression wiring already works, Weekly Skill Focus banner + settings toggle, tier-gated prompt in `mealPlanner.ts`.

7. **22-06 (Cluster 4: Info density + swipe)** — PLAN-X-14/15/16. Flip `isStretch`/`pantryReady` on `MealPlanEntry`, wire `deriveStatusChips`, add `ReanimatedSwipeable` wrapper around DayRow.

This keeps each plan in the 3-6 task range, avoids cross-wave contention, and lets Cluster 1 ship standalone (high user value) if scope pressure forces a cut.

## Sources

### Primary (HIGH confidence)
- Repo: `apps/mobile/src/app/(tabs)/plan.tsx`, `components/plan/*`, `stores/mealPlanStore.ts`, `stores/progressionStore.ts`, `components/recipes/AddToPlanSheet.tsx`, `components/shopping/HandoffSheet.tsx`, `shopping/telemetry.ts`
- Repo: `packages/server/src/routes/meal-plans.ts`, `services/mealPlanner.ts`, `services/progression.ts`
- Repo: `supabase/migrations/00006_meal_plans.sql`, `00008_skill_progression.sql`, `00024_shopping_events.sql`
- Repo: `apps/mobile/package.json` (installed deps), `design/tokens.ts`
- Prior phase research: `.planning/phases/10-skill-progression-offline/10-RESEARCH.md`, `.planning/phases/12-combine-home-recipes/12-RESEARCH.md`, `.planning/phases/17-.../17-RESEARCH.md`, `.planning/phases/20-.../20-RESEARCH.md`
- `./CLAUDE.md` (stack constraints, UAT, dev environment)

### Secondary (MEDIUM confidence)
- `@react-native-community/datetimepicker` is the de-facto Expo-compatible date picker (referenced in Expo SDK docs + common community usage). Exact version pin: verify `npm view @react-native-community/datetimepicker version` before install.
- `ReanimatedSwipeable` as the current non-deprecated swipeable: based on `react-native-gesture-handler` v2.20+ docs.

### Tertiary (LOW confidence)
- Exact skill-tier thresholds (5 cooks, 20 cooks) — heuristic; validate with real usage data post-ship.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps but one are already installed, verified against `package.json`.
- Architecture: HIGH — reuses the Phase 12 segmented-control + Phase 20 HandoffSheet + Phase 10 `deriveStatusChips` patterns already in the repo.
- Pitfalls: HIGH for backend contract (read route file directly), MEDIUM for month-view performance (unverified at scale).
- Skill tier approach: MEDIUM — v1 heuristic, not data-driven.

**Research date:** 2026-04-20
**Valid until:** ~2026-05-20 (30 days; SDK 55 is stable, but datetimepicker releases should be re-verified if planning slips)
