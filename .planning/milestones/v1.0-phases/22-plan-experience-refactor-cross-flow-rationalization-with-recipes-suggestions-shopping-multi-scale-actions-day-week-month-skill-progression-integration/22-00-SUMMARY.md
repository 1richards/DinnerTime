---
phase: 22-plan-experience-refactor
plan: 00
subsystem: infra
tags: [datetimepicker, telemetry, migrations, hono, vitest, maestro, supabase, plan-events, meal-plans-range]

# Dependency graph
requires:
  - phase: 20-shopping-draft-cart-handoff
    provides: shopping_events append-only telemetry table + client batcher + HandoffSheet primitive (cloned for plan_events + plan/telemetry + DatePickerSheet styling)
  - phase: 16-cooking-mode-conversational
    provides: /api/v1/telemetry/cooking schema-light pattern (reused verbatim for /telemetry/plan)
  - phase: 10-skill-progression-offline
    provides: RecipeCookStats shape (consumed by deriveSkillTier) + progressionStore event-log precedent (consumed by stretch picker)
  - phase: 07-meal-planning
    provides: meal_plans/meal_plan_entries tables + POST /entries/assign handler (extended with date param) + mondayOf helper
provides:
  - supabase/migrations/00025_plan_events.sql (append-only plan telemetry table, RLS select+insert, indexes on profile+ts and session_id)
  - supabase/migrations/00026_meal_plans_focus.sql (nullable meal_plans.focus_theme + meal_plan_entries.skip_reason)
  - packages/server/src/routes/meal-plans.ts — POST /entries/assign accepts body.date (YYYY-MM-DD) with precedence over day; new GET /meal-plans?from=&to=&projection= range endpoint (|to-from| ≤ 70d cap)
  - packages/server/src/routes/telemetry.ts — POST /telemetry/plan sibling of /cooking + /shopping; writes to plan_events
  - apps/mobile/src/plan/skillTier.ts — deriveSkillTier(cookStats): 1 | 2 | 3
  - apps/mobile/src/plan/stretchPicker.ts — estimateComplexity + pickStretchDay pure helpers
  - apps/mobile/src/plan/telemetry.ts — batched plan-event logger, 14-key whitelist, POSTs to /api/v1/telemetry/plan
  - apps/mobile/src/components/plan/DatePickerSheet.tsx — Modal wrapper around DateTimePicker inline calendar; default bounds today..today+60d
  - apps/mobile/src/types/mealPlan.ts — MealPlanEntry.{skip_reason,is_stretch,pantry_ready}? optional fields + MealPlan.focus_theme? + PlanViewScale type
  - 7 Maestro red-stub flows (30..36) tagged phase-22 for downstream plans to fill in
affects: [22-01-cross-flow-nav, 22-02-week-actions, 22-03-month-view, 22-04-day-drilldown, 22-05-skill-progression, 22-06-info-density-swipe]

# Tech tracking
tech-stack:
  added:
    - "@react-native-community/datetimepicker@8.6.0 (autolinked native module; Expo config plugin registered)"
  patterns:
    - "Telemetry channel add: third POST handler on routes/telemetry.ts, mirrors /shopping 1:1 with swapped FK fields (list/order → meal_plan/meal_plan_entry) and target table (shopping_events → plan_events). Single router stays mounted at /telemetry."
    - "Range endpoint contract: GET /meal-plans?from=&to=&projection= with bounded range (|to-from| ≤ 70d) + optional lightweight projection=month entry shape to keep month payloads small."
    - "Back-compat contract extension: POST /entries/assign accepts body.date (new) with deterministic precedence over body.day (legacy). No breaking change for existing Phase 7 callers."
    - "Client-side derived plan fields: is_stretch + pantry_ready live as optional MealPlanEntry fields, computed per render by pickStretchDay + (future) pantry matcher. Avoids the swap-loses-stretch bug (22-RESEARCH Pitfall 5)."

key-files:
  created:
    - supabase/migrations/00025_plan_events.sql
    - supabase/migrations/00026_meal_plans_focus.sql
    - apps/mobile/src/plan/skillTier.ts
    - apps/mobile/src/plan/skillTier.test.ts
    - apps/mobile/src/plan/stretchPicker.ts
    - apps/mobile/src/plan/stretchPicker.test.ts
    - apps/mobile/src/plan/telemetry.ts
    - apps/mobile/src/plan/telemetry.test.ts
    - apps/mobile/src/components/plan/DatePickerSheet.tsx
    - apps/mobile/src/components/plan/DatePickerSheet.test.ts
    - apps/mobile/.maestro/30-plan-to-recipe-roundtrip.yaml
    - apps/mobile/.maestro/31-addtoplan-datepicker.yaml
    - apps/mobile/.maestro/32-plan-shopping-handoff.yaml
    - apps/mobile/.maestro/33-pin-suggestion-to-day.yaml
    - apps/mobile/.maestro/34-plan-day-drilldown.yaml
    - apps/mobile/.maestro/35-week-actions.yaml
    - apps/mobile/.maestro/36-dayrow-swipe.yaml
  modified:
    - apps/mobile/package.json (added @react-native-community/datetimepicker@8.6.0)
    - apps/mobile/app.json (Expo config plugin registered)
    - pnpm-lock.yaml
    - packages/server/src/__tests__/migrations.test.ts (2 new describe blocks, 17 new assertions)
    - packages/server/src/routes/meal-plans.ts (GET /meal-plans range + POST /entries/assign date param)
    - packages/server/src/routes/__tests__/meal-plans.test.ts (mock extension + 2 new describe blocks, 10 new cases)
    - packages/server/src/routes/telemetry.ts (third channel: POST /plan)
    - packages/server/src/routes/__tests__/telemetry.test.ts (1 new describe block, 5 new cases)
    - apps/mobile/src/types/mealPlan.ts (optional extension fields + PlanViewScale)

key-decisions:
  - "native iOS date picker: @react-native-community/datetimepicker@8.6.0 with display='inline' (iOS 14+ calendar), minimumDate=today, maximumDate=today+60d"
  - "plan telemetry mirrors Phase 20 shopping pattern 1:1 — 14-key whitelist (9 parity + meal_plan_id + meal_plan_entry_id + variant + date + week_start), queue cap 200, flush at size 10 or every 30s"
  - "POST /entries/assign: body.date takes precedence over body.day when both supplied (deterministic contract, prevents silent 'which wins?' bugs)"
  - "GET /meal-plans range cap: |to-from| ≤ 70 days. Month view needs ~35d; 70 is headroom for 2-month projection without pagination"
  - "skill tier thresholds: <5 cooks = tier 1, <20 = tier 2, else 3. Monotone non-decreasing by summing lifetime cook_count"
  - "stretch day ties broken by lowest day_of_week (Monday first) — deterministic + nudges early-week motivation"
  - "is_stretch and pantry_ready declared as OPTIONAL on MealPlanEntry — no breaking change for existing consumers; derived client-side each render in Waves 5 and 6"
  - "iOS dev-client rebuild documented but NOT executed in autonomous mode — existing ios/build artifact preserved; downstream UAT on physical device will validate the autolinked native module"

patterns-established:
  - "Telemetry channel extension: add a new POST /{channel} handler on packages/server/src/routes/telemetry.ts with its own z.object schema (name+session_id+timestamp+channel-specific FKs+payload) + dedicated target table (channel_events). profile_id injected server-side from authed user, never trusted from body."
  - "Server range endpoint: bounded time-window query with optional lightweight projection param. Guards against unbounded scans; projection shrinks payload when consumers don't need full object graphs."
  - "Contract extension without breaking changes: accept a richer input (body.date) that supersedes the legacy input (body.day) when present. Error message teaches the new path: 'day must be an integer 0..6 (or provide date)'."
  - "Optional type fields for client-derived state: MealPlanEntry.is_stretch?, pantry_ready?, skip_reason? — TypeScript consumers can reference them without runtime presence, helpers attach them per-render. Zero migration."

requirements-completed: [PLAN-X-02, PLAN-X-05, PLAN-X-06, PLAN-X-08, PLAN-X-09, PLAN-X-10, PLAN-X-12, PLAN-X-13, PLAN-X-16]

# Metrics
duration: 16min
completed: 2026-04-20
---

# Phase 22 Plan 00: Wave 0 Foundation Summary

**Datetimepicker installed + 2 Supabase migrations shipped + /entries/assign date-param + GET /meal-plans range + POST /telemetry/plan + skillTier/stretchPicker/plan.telemetry helpers + DatePickerSheet primitive + 7 Maestro red stubs — every downstream plan 22-01..06 can now import these artifacts without further research.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-20 (session)
- **Completed:** 2026-04-20
- **Tasks:** 4
- **Files created:** 17
- **Files modified:** 8
- **Tests added:** 60 new test cases (17 migrations + 10 meal-plans + 5 telemetry/plan + 8 skillTier + 11 stretchPicker + 7 plan/telemetry + 2 DatePickerSheet)

## Accomplishments

- **Native date picker wave 0 gate opened.** `@react-native-community/datetimepicker@8.6.0` is pinned in `apps/mobile/package.json`, Expo config plugin is registered, and every downstream import of `DatePickerSheet` resolves without a second research pass.
- **Two Supabase migrations shipped as static-contract tested files.** `00025_plan_events.sql` clones the Phase 20 shopping_events append-only pattern verbatim (BIGSERIAL PK, RLS select+insert keyed on `auth.uid() = profile_id`, two indexes). `00026_meal_plans_focus.sql` adds nullable `meal_plans.focus_theme` + `meal_plan_entries.skip_reason` with no new indexes and no destructive change. `migrations.test.ts` grew 2 describe blocks with 17 assertions covering the entire contract — green on static inspection (no live DB required).
- **Server contracts extended without breaking changes.** `POST /meal-plans/entries/assign` now accepts optional `body.date: 'YYYY-MM-DD'` which derives `week_start = mondayOf(date)` and `day_of_week = (utcDay + 6) % 7`. When `date` is absent, legacy `body.day` + current-week behavior is preserved (back-compat). When both are supplied, `date` wins (deterministic precedence).
- **New range endpoint.** `GET /meal-plans?from=YYYY-MM-DD&to=YYYY-MM-DD&projection=month?` returns `{ data: Array<{ id, week_start, generated_at, entries }> }`. Bounded at `|to-from| ≤ 70 days` (400 otherwise). `projection=month` narrows the entry column list to `id, meal_plan_id, day_of_week, status, title, recipe_id, estimated_time_minutes, difficulty` — skips `ingredients` arrays for fast month payloads.
- **Third telemetry channel.** `POST /api/v1/telemetry/plan` is a sibling of `/cooking` and `/shopping`, structured 1:1 with `/shopping` (zod schema + profile_id server-injected + writes to `plan_events`).
- **Three pure helpers + 1 primitive shipped with vitest coverage.**
  - `deriveSkillTier(cookStats)` bands lifetime `cook_count` sum (<5 = 1, <20 = 2, else 3). Monotone non-decreasing by construction.
  - `estimateComplexity` + `pickStretchDay` score entries (difficulty band + minutes/10) and pick the highest non-cooked entry above `cookedMedian + 2`. Ties break by lowest `day_of_week`. Returns `null` when no entry qualifies.
  - `logPlanEvent` / `flushPlanTelemetry` / `sanitizePayload` / `wireSupabaseAuth` — batched telemetry (queue cap 200, flush at size 10 or every 30s) with a 14-key payload whitelist. Fetch failures re-queue the batch once.
  - `DatePickerSheet` — Modal wrapper around inline `DateTimePicker`. Default bounds today (UTC midnight) → today+60d. Parent-owned state; emits ISO date on confirm.
- **7 Maestro red stubs** (30-36) tagged `phase-22`, each documenting the behavior its downstream plan owns. Smoke loop stays green; downstream plans fill in the steps.

## Task Commits

1. **Task 1: Install datetimepicker + ship migrations + extend migrations.test.ts** — `61dadf9` (feat)
2. **Task 2: Extend server — /entries/assign accepts date, new /meal-plans range + /telemetry/plan** — `267bcc5` (feat)
3. **Task 3: Three pure helpers + DatePickerSheet primitive** — `e872231` (feat)
4. **Task 4: 7 Maestro red-stub flows (30-36)** — `afe6f82` (test)

## Files Created/Modified

### Created

- `supabase/migrations/00025_plan_events.sql` — append-only plan telemetry (BIGSERIAL, profile_id FK cascade, meal_plan_id/meal_plan_entry_id FK set-null, RLS select+insert, 2 indexes)
- `supabase/migrations/00026_meal_plans_focus.sql` — nullable `focus_theme` + `skip_reason` columns
- `apps/mobile/src/plan/skillTier.ts` — `export function deriveSkillTier(cookStats: RecipeCookStats[]): SkillTier` where `SkillTier = 1 | 2 | 3`
- `apps/mobile/src/plan/stretchPicker.ts` — `export function estimateComplexity(e)` + `export function pickStretchDay(entries, median): number | null`
- `apps/mobile/src/plan/telemetry.ts` — `export function logPlanEvent(e)` + `export function flushPlanTelemetry(): Promise<void>` + `export function sanitizePayload(dirty)` + `export function wireSupabaseAuth(getter)` + `export const __resetForTests`
- `apps/mobile/src/components/plan/DatePickerSheet.tsx` — `export function DatePickerSheet(props: DatePickerSheetProps)` + exported pure helpers `todayUtcMidnight()`, `addDays(d, days)`, `toIso(d)`
- `apps/mobile/.maestro/30..36-*.yaml` — 7 red stubs mapping 1:1 to PLAN-X-01/02/03/04/07/08/16

### Modified

- `apps/mobile/package.json` + `pnpm-lock.yaml` — add `@react-native-community/datetimepicker@8.6.0`
- `apps/mobile/app.json` — Expo config plugin auto-registered by `expo install`
- `packages/server/src/__tests__/migrations.test.ts` — 2 new describe blocks (17 assertions) for 00025/00026
- `packages/server/src/routes/meal-plans.ts` — GET / range handler + POST /entries/assign accepts `body.date`
- `packages/server/src/routes/__tests__/meal-plans.test.ts` — mock extension (`.gte().lte().order()`, `.in().order()`, `.upsert()`) + 2 new describe blocks (10 cases)
- `packages/server/src/routes/telemetry.ts` — POST /plan handler + PlanEventSchema + PlanBatchSchema
- `packages/server/src/routes/__tests__/telemetry.test.ts` — POST /telemetry/plan describe block (5 cases)
- `apps/mobile/src/types/mealPlan.ts` — optional `skip_reason`, `is_stretch`, `pantry_ready` on `MealPlanEntry`; optional `focus_theme` on `MealPlan`; new `PlanViewScale = 'week' | 'month'`

## Interface Contracts (for downstream Waves 1-6)

**Imports that Waves 1-6 can now resolve without research:**

```typescript
// Plan 22-01 (AddToPlanSheet, SuggestionCard "Pin to day"):
import { DatePickerSheet } from '@/components/plan/DatePickerSheet';
import { logPlanEvent } from '@/plan/telemetry';
// POST /api/v1/meal-plans/entries/assign accepts { date: 'YYYY-MM-DD', ... }

// Plan 22-02 (WeekActionSheet):
import { logPlanEvent } from '@/plan/telemetry';
// logPlanEvent({ name: 'plan.week_regenerated' | 'plan.week_shifted' | 'plan.week_duplicated', ... })

// Plan 22-03 (MonthGrid + MonthPatterns):
// GET /api/v1/meal-plans?from=YYYY-MM-DD&to=YYYY-MM-DD&projection=month
import type { PlanViewScale } from '@/types/mealPlan';
// MealPlanEntry.skip_reason for month-view chips

// Plan 22-04 (/plan/[date]):
import { logPlanEvent } from '@/plan/telemetry';
// logPlanEvent({ name: 'plan.day_drill_opened', meal_plan_entry_id, payload: { date } })

// Plan 22-05 (Skill progression):
import { deriveSkillTier, type SkillTier } from '@/plan/skillTier';
import { pickStretchDay, estimateComplexity } from '@/plan/stretchPicker';
// MealPlan.focus_theme for Weekly Skill Focus banner

// Plan 22-06 (DayRow swipe + chips):
import type { MealPlanEntry } from '@/types/mealPlan';
// MealPlanEntry.is_stretch, pantry_ready for deriveStatusChips
// logPlanEvent({ name: 'plan.swipe_action', payload: { variant: 'swap' | 'cook' | 'skip' } })
```

## Decisions Made

- **Skipped the iOS dev-client rebuild** despite datetimepicker being autolinked. Rationale: per autonomous-mode instructions ("log but don't block — the test infra uses mocks"), the existing `ios/build/Build/Products/Debug-iphonesimulator/DinnerTime.app/Info.plist` is still present and the Maestro stubs (30-36) don't exercise the native picker yet. **Downstream plan 22-01 — which wires the picker into AddToPlanSheet — MUST run `cd apps/mobile && npx expo prebuild --platform ios --clean && cd ios && pod install && cd .. && xcodebuild -workspace ios/DinnerTime.xcworkspace -scheme DinnerTime -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build build` before its Maestro flow 31 runs on the simulator.** This mirrors the Phase 10 netinfo sequence.
- **Removed the stub's literal day-number comment.** PLAN.md line 305 said `day_of_week=3 (Thursday=3 under Mon=0 convention)` for `date='2026-05-15'`. Under Mon=0, 2026-05-15 is a Friday (day_of_week=4). The math is correct; the stub's day-name description was off by one. Test `22-D1` asserts day_of_week=4 as the handler derives it; added an additional `22-D1b` case asserting date='2026-05-14' (a true Thursday) produces day_of_week=3 to cover the scenario the plan authors intended.
- **DatePickerSheet tests pivoted to pure-helper coverage.** PLAN.md called for a static-tree renderer test mirroring `HandoffSheet.test.tsx`. But `HandoffSheet` is stateless — `DatePickerSheet` uses `useState`/`useEffect` which cannot run outside a React renderer under vitest-node. Pivoted: exported the three pure helpers (`todayUtcMidnight`, `addDays`, `toIso`) from `DatePickerSheet.tsx` and wrote unit tests for them (7 cases) plus a module-shape check. The full interactive coverage lives in Maestro flow 31 (red stub now, green after plan 22-01).

## Deviations from Plan

**1. [Rule 3 - Blocking] Hono route ordering requires no trailing slash on `/meal-plans`**

- **Found during:** Task 2 (adding the range endpoint tests)
- **Issue:** Test URL `/meal-plans/?from=...` returned 404 under Hono — `app.route('/meal-plans', sub)` + `sub.get('/')` matches `/meal-plans` but NOT `/meal-plans/` (verified via a standalone probe).
- **Fix:** Updated all new Phase 22 test URLs to drop the trailing slash before the query string: `/meal-plans?from=...&to=...`
- **Files modified:** `packages/server/src/routes/__tests__/meal-plans.test.ts`
- **Verification:** 10/10 new cases green; no existing tests affected.
- **Committed in:** `267bcc5` (Task 2)

**2. [Rule 3 - Blocking] Hoisted supabase mock needed range-query + upsert chains**

- **Found during:** Task 2 (extending meal-plans.test.ts)
- **Issue:** The existing mock only supported `.eq().eq().maybeSingle()` and `.eq().order()` chains. The new route needed `.gte().lte().order()` (range query) and `.in().order()` (entries lookup). The `/entries/assign` path also needed `.insert().select().single()` + `.upsert().select().single()` which the mock didn't model.
- **Fix:** Extended the `from('meal_plans')` builder to expose `gte/lte/order/single/insert`, extended `from('meal_plan_entries')` to expose `in/order/upsert`. Also extended hoisted state with `rangePlans`, `rangeEntries`, `assignInsertedPlan`, `assignUpsertedEntry`, `lastUpsertPayload`, `lastRangeQuery` for per-test seeding.
- **Files modified:** `packages/server/src/routes/__tests__/meal-plans.test.ts`
- **Verification:** Both old (8 tests) and new (10 tests) describe blocks green.
- **Committed in:** `267bcc5` (Task 2)

**3. [Rule 3 - Blocking] DatePickerSheet test pivoted to pure-helper coverage**

- **Found during:** Task 3 (writing the component test)
- **Issue:** PLAN.md called for a static-tree renderer pattern mirroring `HandoffSheet.test.tsx`. But `DatePickerSheet` uses `useState`/`useEffect`, which can't execute outside a React renderer under vitest's node env. The HandoffSheet test works because HandoffSheet is a pure function of its props — no hooks.
- **Fix:** Exported the three pure helpers (`todayUtcMidnight`, `addDays`, `toIso`) from `DatePickerSheet.tsx` and wrote unit tests for them (7 cases covering: UTC-midnight semantics, non-mutating addDays, ISO slicing, default max derivation, bounds sanity) plus a module-shape check.
- **Files modified:** `apps/mobile/src/components/plan/DatePickerSheet.tsx`, `apps/mobile/src/components/plan/DatePickerSheet.test.ts`
- **Verification:** 8/8 cases green.
- **Committed in:** `e872231` (Task 3)

**4. [Rule 2 - Missing Critical] Added 22-D1b test for plan comment off-by-one**

- **Found during:** Task 2 (writing POST /entries/assign date tests)
- **Issue:** PLAN.md Task 2 behavior line 305 says `date: '2026-05-15'` produces `day_of_week=3 (Thursday=3 under Mon=0)`. But 2026-05-15 is a Friday (day_of_week=4) under Mon=0. The handler's math is correct; the plan's day-name was off.
- **Fix:** Test `22-D1` asserts the actual handler-derived day (4) for `date='2026-05-15'`. Added additional `22-D1b` asserting `date='2026-05-14'` (true Thursday) produces day_of_week=3 to cover the scenario the plan authors intended.
- **Files modified:** `packages/server/src/routes/__tests__/meal-plans.test.ts`
- **Verification:** Both cases green.
- **Committed in:** `267bcc5` (Task 2)

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 missing-critical test-coverage)
**Impact on plan:** All auto-fixes unblock testing the shipped contracts; no scope creep. The DatePickerSheet test pivot preserves coverage intent (helpers and bounds) via a different mechanism; interactive behavior moves to Maestro flow 31 where it belongs.

## Issues Encountered

- **Pre-existing test failures (unrelated).** Full server suite shows 2 pre-existing failures in `src/ai/__tests__/taskRouting.test.ts` (GOOGLE_API_KEY env-var probe fires even when unset). Full mobile suite shows 4 pre-existing failures across `__tests__/auth-store.test.ts`, `src/stores/__tests__/progressionStore.test.ts`, `src/stores/__tests__/shoppingStore.test.ts`. Stash-then-rerun confirmed these fail on `main` prior to this plan. **Not introduced here.** Tracking continues in `deferred-items.md`.
- **Pre-commit hook flagged `git config`.** Commits succeeded but printed a warning about missing global user.name/email. Not a blocker; commits went through with the machine default identity.

## User Setup Required

**iOS dev-client rebuild required before plan 22-01 can run Maestro flow 31 (addtoplan-datepicker) on the simulator.** The `@react-native-community/datetimepicker` module autolinks native code; the existing ios/build artifact does not include it.

From `apps/mobile/`:

```bash
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..
xcodebuild -workspace ios/DinnerTime.xcworkspace -scheme DinnerTime \
  -configuration Debug -sdk iphonesimulator \
  -derivedDataPath ios/build build
```

This is a ~5-minute one-time operation. Mirrors the Phase 10 netinfo sequence. No EAS cloud build needed — local simulator build is sufficient for downstream Maestro flows.

## Next Phase Readiness

- **All Wave 0 gates open.** Plans 22-01..06 can now start in parallel (waves 1-3) with no further foundational blockers. The dependency graph in RESEARCH.md §Recommended Plan Decomposition is fully unblocked.
- **Downstream imports already resolvable.** Waves 1-6 can reference `DatePickerSheet`, `deriveSkillTier`, `pickStretchDay`, `logPlanEvent`, and the new server endpoints by reading ONLY this SUMMARY (not source).
- **7 Maestro red stubs in place.** Each downstream plan has a YAML skeleton tagged `phase-22` ready to fill in with real selectors + assertions.

---

## Self-Check: PASSED

All 13 expected artifact files present on disk. All 4 task commits (`61dadf9`, `267bcc5`, `e872231`, `afe6f82`) resolvable via `git log`. Server test suite (3 relevant files: migrations + meal-plans + telemetry): 132/132 green. Mobile test suite (6 relevant files: skillTier + stretchPicker + plan/telemetry + DatePickerSheet + plan/types + existing plan components): 44/44 green.

---

*Phase: 22-plan-experience-refactor*
*Completed: 2026-04-20*
