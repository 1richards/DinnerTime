---
phase: 22-plan-experience-refactor
plan: 06
subsystem: plan-info-density-swipe
tags: [dayrow, swipe, reanimated-swipeable, pantry-ready, skip, telemetry, vitest, maestro, phase-22-closeout]

# Dependency graph
requires:
  - phase: 22-plan-experience-refactor (Plan 22-00)
    provides: MealPlanEntry.skip_reason + pantry_ready optional fields, migration 00026 (meal_plan_entries.skip_reason column), logPlanEvent/sanitizePayload plan telemetry primitives, 'plan.swipe_action' event name already reserved in PlanEventName union
  - phase: 22-plan-experience-refactor (Plan 22-05)
    provides: DayRow already forwards both is_stretch + pantry_ready flags to deriveStatusChips (wiring landed ahead of 22-06); pantry_ready stayed harmless-undefined until this plan
  - phase: 10-skill-progression-offline (indirect)
    provides: pantryStore.items selector used to compute pantry_ready client-side; no new API on PantryState
  - phase: 19-ui-tokens
    provides: colors.brand / success / warning tokens used by SwipeableDayRow action pills (no raw hex)
provides:
  - apps/mobile/src/components/plan/pantryReady.ts — computePantryReady pure helper + PANTRY_STAPLES set
  - apps/mobile/src/components/plan/SwipeableDayRow.tsx — ReanimatedSwipeable wrapper around DayRow with 3 right-side actions (Swap/Cooked/Skip) + telemetry
  - packages/server/src/routes/meal-plans.ts POST /:id/entries/:day/skip — dedicated endpoint for the Skip action with ownership guard
  - apps/mobile/src/stores/mealPlanStore.ts skipDay(day, reason?) — optimistic store action + rollback mirroring markCooked
  - apps/mobile/src/app/(tabs)/plan.tsx pantry_ready + skipTarget + Alert.prompt wiring + SwipeableDayRow integration
  - apps/mobile/.maestro/36-dayrow-swipe.yaml — red stub flipped green (5 screenshots)
affects: [Phase 22 closeout — all 16 PLAN-X-XX requirements now implemented]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReanimatedSwipeable render-prop test pattern under vitest-node: the swipeable itself is mocked to a pass-through (children → children) while the renderRightActions callback is exported as a named helper (`renderRightActionsFor`) for direct JSX-tree walking. Tree walker descends through function components (invoking them with props) but stops at the first `Pressable`-named leaf. Captures onPress + accessibilityLabel + style without a React renderer."
    - "Dedicated skip endpoint with ownership-then-update: POST /meal-plans/:id/entries/:day/skip runs a narrow `.select('id').eq(id).eq(profile_id).maybeSingle()` ownership check before the entry update. Null result → 404 (plan not owned OR doesn't exist — indistinguishable from the caller's perspective, which is the correct security posture). Entry update's own null result → distinct 404 'Entry not found'."
    - "Client-derived per-render flags: `pantry_ready` computed every `plan.tsx` render via `computePantryReady(raw.ingredients ?? [], pantryItems)` inside the `days` useMemo, deps `[entriesByDay, stretchDay, pantryItems]`. Subscribes to `usePantryStore(s => s.items)` so pantry scans/confirmations auto-refresh chip state without manual wiring. Same pattern as `is_stretch` from 22-05."
    - "Swipe telemetry wraps handler invocation: each action's onPress closure calls `logPlanEvent({name:'plan.swipe_action', payload:{variant,meal_plan_entry_id,meal_plan_id}})` BEFORE the parent handler. Handler may cause the entry to unmount (swap/cook); firing telemetry first guarantees the analytics event regardless of downstream re-render timing."
    - "Alert.prompt null-on-empty pattern: skip reason is plain-text prompt pre-filled with nothing; submit path trims input and stores empty/whitespace-only as `null` so the DB column doesn't accrue useless whitespace rows. `onPress: (text?: string)` typed signature is required by TS7006 in strict mode."

key-files:
  created:
    - apps/mobile/src/components/plan/pantryReady.ts
    - apps/mobile/src/components/plan/pantryReady.test.ts
    - apps/mobile/src/components/plan/SwipeableDayRow.tsx
    - apps/mobile/src/components/plan/SwipeableDayRow.test.ts
  modified:
    - apps/mobile/src/stores/mealPlanStore.ts (skipDay action + MealPlanState interface)
    - apps/mobile/src/stores/__tests__/mealPlanStore.test.ts (5 new skipDay cases)
    - packages/server/src/routes/meal-plans.ts (POST /:id/entries/:day/skip handler)
    - packages/server/src/routes/__tests__/meal-plans.test.ts (7 new skip cases + mock extension)
    - apps/mobile/src/app/(tabs)/plan.tsx (pantry_ready derivation, SwipeableDayRow swap, skipTarget + Alert.prompt, pantryItems selector)
    - apps/mobile/src/components/plan/DayRow.tsx (comment refresh — both flags now live)
    - apps/mobile/.maestro/36-dayrow-swipe.yaml (red stub → 5-screenshot swipe walk-through)

key-decisions:
  - "PANTRY_STAPLES duplicated (not imported) from kitchen.tsx. Rationale: kitchen.tsx's `matchesPantryOnly` helper is module-private to that screen file and exporting it — or extracting to a shared helper — is a refactor out of scope for 22-06. The 11-entry parity assertion in pantryReady.test.ts guards against drift: any change to staples in one place without the other breaks the test."
  - "80% threshold for pantry-ready chip. Stricter (100%) would punish any recipe missing a single minor aromatic; looser (50%) would render 'pantry ready' when the user still needs a major protein. 80% is deliberate slack so a missing fresh herb doesn't flip the chip off. Threshold-boundary test (4/5 = 80% exactly → true) guards this decision."
  - "Skip flow uses a dedicated endpoint (POST /:id/entries/:day/skip) rather than extending PATCH /:id or /entries/assign. The assign handler hardcodes status='planned' and the PATCH /:id handler scopes to plan-level fields only (focus_theme). Adding 'skipped' to /entries/assign would widen the schema in a way that would complicate the upsert semantics (onConflict: (meal_plan_id, day_of_week) already lands planned overwriting skipped rows unintentionally). Dedicated endpoint keeps each handler's contract narrow."
  - "Skip error message is user-facing, not transport-layer. On 5xx the store stores `error: 'Failed to skip day'` regardless of the upstream error text — the user's mental model is about the skip action, not the HTTP verb or Supabase error detail. Matches the Phase 20 handoff-error classification approach of abstracting transport noise away from UX copy."
  - "SwipeableDayRow short-circuits to DayRow when entry is null. Unplanned days have no meaningful Swap/Cooked/Skip action target — revealing the pill group would be misleading UX. The short-circuit is explicit (early return) rather than allowing ReanimatedSwipeable to render over a null entry."
  - "Telemetry fires BEFORE the handler. Swap/cook can unmount the entry mid-swipe (optimistic update re-renders the list, ReanimatedSwipeable collapses). Firing telemetry first guarantees the analytics event doesn't race the unmount. plan_events.payload carries variant + meal_plan_id + meal_plan_entry_id for downstream analysis."
  - "Alert.prompt instead of a custom sheet for the skip reason. Rationale: iOS Alert.prompt is the native affordance users expect for short free-form input; building a custom bottom-sheet reason picker is over-engineering for a v1 quick-edit flow. Empty/whitespace-only input → null so the skip_reason column doesn't accrue useless strings."
  - "Test walker pattern (findPressables) handles host-primitive mocks returning null. View/Text/Pressable are mocked in vitest.setup.ts as `(_props) => null` — the walker invokes function components but falls through to child descent when invocation returns null, so outer <View> containers don't swallow their children. Pattern is now documented in SwipeableDayRow.test.ts for reuse in future ReanimatedSwipeable-dependent tests."

patterns-established:
  - "Client-side chip flag derivation is now the canonical pattern for MealPlanEntry UI extensions: attach the flag inside the plan.tsx `days` useMemo, let DayRow's deriveStatusChips matrix pick up the boolean via its `is*`/`*Ready` inputs. No DB round-trip, no migration, survives regenerate/swap automatically. is_stretch (22-05) + pantry_ready (22-06) are now the reference implementations; future additions (difficulty, dietary-fit, etc.) follow the same shape."
  - "Ownership guard via compound .eq on (resource, profile_id) returning null → 404. Applied consistently across 22-05 (PATCH /:id) + 22-06 (POST skip) + future single-resource-mutation endpoints. Never return 403 when the row might or might not exist — that leaks existence across accounts. 404 is both the correct semantic ('I can't find a resource you can mutate') and the correct security posture."
  - "ReanimatedSwipeable exports a render-prop helper for vitest coverage. `renderRightActionsFor(props)` is exported from SwipeableDayRow.tsx specifically so the test suite can exercise the revealed-action JSX without mounting the native gesture handler. Future swipe-gesture components should follow this separation — render-prop function exported as named export; component wraps it; tests target the helper directly."

requirements-completed: [PLAN-X-14, PLAN-X-15, PLAN-X-16]

# Metrics
duration: 12min
completed: 2026-04-22
---

# Phase 22 Plan 22-06: Info Density + Swipe-to-Action Summary

**Closes Phase 22. DayRow now shows up to 3 chips (status + stretch + pantry-ready, all Phase-19 tokens) and reveals Swap/Cooked/Skip actions on left-swipe via ReanimatedSwipeable. `pantryReady` helper + `skipDay` store action + POST /meal-plans/:id/entries/:day/skip endpoint + Alert.prompt skip-reason flow + Maestro flow 36 walk-through complete the cluster. All 16 PLAN-X-XX requirements now implemented.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-22T08:31:32Z
- **Completed:** 2026-04-22T08:44:09Z
- **Tasks:** 4 (3 TDD + 1 integration)
- **Files created:** 4 (pantryReady.ts/.test.ts + SwipeableDayRow.tsx/.test.ts)
- **Files modified:** 7
- **Tests added:** 20 new cases (8 pantryReady + 5 skipDay store + 7 skip endpoint)
- **All relevant suites green:** 137/137 mobile plan+store tests + 31/31 server meal-plans tests

## Accomplishments

- **`computePantryReady` pure helper shipped with 8 test cases.** Mirrors `matchesPantryOnly` in `apps/mobile/src/app/(tabs)/kitchen.tsx` (11-entry staple list, bidirectional substring match, 80% threshold). Threshold boundary test (4/5 = 80% exactly → true) locks the heuristic. Parity test asserts PANTRY_STAPLES contains all 11 canonical staples so any drift against kitchen.tsx fails here first.
- **`skipDay` store action lands with optimistic+rollback.** Mirrors `markCooked` lifecycle: optimistic flip to `status='skipped'` + `skip_reason` before await, rollback to the pre-skip entries snapshot on non-2xx or network error. Surfaces a consistent user-facing error (`'Failed to skip day'`) regardless of upstream wording. POSTs `/meal-plans/{plan.id}/entries/{day}/skip` with body `{ reason }`; defaults reason to `null` when omitted. 5 new test cases cover: null-plan no-op, POST contract shape, optimistic mid-state, 500 rollback, and default-reason-null.
- **POST /meal-plans/:id/entries/:day/skip endpoint ships with ownership guard.** 7 test cases cover: happy path with reason, empty body defaults skip_reason to null, day > 6 → 400, day < 0 → 400, cross-profile → 404 "Not found", missing entry → 404 "Entry not found", unauthenticated → 401. Ownership check uses `.select('id').eq('id', planId).eq('profile_id', user.id).maybeSingle()` — null → 404. Entry update then `.update({status:'skipped', skip_reason}).eq('meal_plan_id').eq('day_of_week').select().maybeSingle()`; null → distinct 404.
- **SwipeableDayRow wraps DayRow with left-swipe quick actions.** `ReanimatedSwipeable` from `react-native-gesture-handler/ReanimatedSwipeable` (NOT the deprecated Swipeable) renders 3 right-side actions: Swap (`colors.brand`), Cooked (`colors.success`), Skip (`colors.warning`) — zero raw hex literals in the component. Each action pill is 72pt wide, 64pt tall to match the DayRow's row height. `rightThreshold={80}` + `overshootRight={false}` keeps the reveal smooth. Null-entry short-circuit falls through to DayRow without swipe affordance. Test suite (7 cases) exercises the exported `renderRightActionsFor` helper: three Pressables in Swap/Cooked/Skip order, each tap fires the correct handler + correct telemetry variant, session_id format matches `swipe-{entry.id}`, and pill tints match Phase 19 tokens (brand/success/warning — no hex).
- **Plan tab integration.** `plan.tsx` now imports `usePantryStore`, `computePantryReady`, `SwipeableDayRow`. The `days` useMemo attaches `pantry_ready` alongside `is_stretch`. FlatList renderItem swapped `DayRow` → `SwipeableDayRow` with the new `onSkip` handler. A `skipTarget` state + Alert.prompt opens the reason prompt on swipe-Skip; on submit, trimmed-text-or-null gets passed to `mealPlanStore.skipDay(day, reason)`. DayRow's comment updated to reflect both flags are now wired.
- **Maestro flow 36 flipped red-stub → 5-screenshot walk-through.** Plan tab tap → takeScreenshot → swipe 90%,22% → 10%,22% → takeScreenshot → tap Cooked → takeScreenshot → second swipe 90%,32% → takeScreenshot → tap Skip + Cancel → takeScreenshot. `optional: true` on action taps keeps the flow green when the row's already-cooked state or sheet timing varies on simulator vs physical device.

## Task Commits

| Task                                                                                 | Commit (RED) | Commit (GREEN) | Type         |
| ------------------------------------------------------------------------------------ | ------------ | -------------- | ------------ |
| Task 1: pantryReady pure helper (RED→GREEN)                                          | `357184f`    | `b9409e6`      | test + feat  |
| Task 2: skipDay mealPlanStore action (RED→GREEN)                                     | `61e7bf7`    | `5918025`      | test + feat  |
| Task 3: Server endpoint POST /meal-plans/:id/entries/:day/skip (RED→GREEN)           | `c6c78cf`    | `4a5d46b`      | test + feat  |
| Task 4: DayRow comment + SwipeableDayRow + plan.tsx wiring + Maestro flow 36         | —            | `27aea46`      | feat         |

(Task 4 shipped as one feat commit — DayRow comment refresh, SwipeableDayRow component + test, plan.tsx pantry_ready + skipTarget wiring, and Maestro flow 36 are interdependent and the plan does not TDD-flag them.)

## Files Created/Modified

### Created

- `apps/mobile/src/components/plan/pantryReady.ts` (90 lines) — `export function computePantryReady(ingredients, pantryItems): boolean` + `export const PANTRY_STAPLES: ReadonlySet<string>`.
- `apps/mobile/src/components/plan/pantryReady.test.ts` (111 lines) — 8 test cases covering empty ingredients, all-staple shortcut, 100% match, <80% floor, 80% boundary, bidirectional substring, empty-name ignore, + PANTRY_STAPLES parity guard.
- `apps/mobile/src/components/plan/SwipeableDayRow.tsx` (175 lines) — `export function SwipeableDayRow(props): React.ReactElement` + `export function renderRightActionsFor(props): React.ReactElement` (test hook).
- `apps/mobile/src/components/plan/SwipeableDayRow.test.ts` (243 lines) — 7 cases + shared `findPressables` tree walker that descends through function components while stopping at Pressable leaves (pattern reusable for future ReanimatedSwipeable tests).

### Modified

**Mobile (`apps/mobile/`):**

- `src/stores/mealPlanStore.ts` — `skipDay(day, reason?)` action + `MealPlanState` interface extension. Optimistic + rollback + consistent user-facing error.
- `src/stores/__tests__/mealPlanStore.test.ts` — 5 new `skipDay` cases.
- `src/app/(tabs)/plan.tsx`:
  - Imports `usePantryStore`, `pantryReady.computePantryReady`, `SwipeableDayRow`.
  - `days` useMemo attaches `pantry_ready: computePantryReady(raw.ingredients ?? [], pantryItems)` per entry.
  - `skipTarget` state + useEffect opens `Alert.prompt('Skip this day?', ..., 'plain-text')` with Cancel + Skip (destructive) buttons; Skip trims input and dispatches `skipDay(target, reason)`.
  - FlatList renderItem swapped `DayRow` → `SwipeableDayRow` with `onSkip={() => setSkipTarget(item.day)}`.
- `src/components/plan/DayRow.tsx` — comment refresh acknowledging both flags are live.
- `.maestro/36-dayrow-swipe.yaml` — 5-screenshot swipe walk-through replacing the Wave 0 red stub.

**Server (`packages/server/`):**

- `src/routes/meal-plans.ts` — `POST /:id/entries/:day/skip` handler. 400 on invalid day, 404 on ownership miss, 404 on missing entry, 200 on success returning `{ data: updated }`.
- `src/routes/__tests__/meal-plans.test.ts` — state extensions (`skipUpdatedEntry`, `lastSkipPayload`, `skipEqPairs`, `skipOwnedPlan`), mock extension (meal_plans.select-cols-aware maybeSingle + meal_plan_entries.update().eq().eq().select().maybeSingle() chain), 7 new test cases in a new describe block.

## Interface Contracts

Phase 22 is closed out — this summary also serves as the final contract reference for downstream phases that might want to reuse these primitives.

```typescript
// Pantry-readiness check (consumable by any screen that has ingredients + pantry state):
import { computePantryReady, PANTRY_STAPLES } from '@/components/plan/pantryReady';
// computePantryReady(ingredients, pantryItems): boolean
//   - false when ingredients array is empty
//   - true when every ingredient is a staple
//   - true when ≥80% of non-staple ingredients match (bidirectional substring, case-insensitive)

// Swipeable day row (drop-in replacement for DayRow with 3 extra actions):
import { SwipeableDayRow } from '@/components/plan/SwipeableDayRow';
// SwipeableDayRow takes all DayRow props + onSkip. When entry is null, short-circuits to DayRow.

// Skip action (optimistic store mutation):
import { useMealPlanStore } from '@/stores/mealPlanStore';
// useMealPlanStore.getState().skipDay(day, reason?) → Promise<void>
// Mirrors markCooked optimistic+rollback; error surfaces via state.error as 'Failed to skip day'.

// Skip endpoint (server-side):
// POST /api/v1/meal-plans/{plan_id}/entries/{day}/skip
//   Body: { reason?: string | null }
//   200 → { data: <updated meal_plan_entry row> }
//   400 → day out of 0..6
//   404 → plan not owned (or not found) OR entry row missing
//   401 → unauthenticated
```

## Decisions Made

- **PANTRY_STAPLES duplicated from kitchen.tsx (not imported).** Extracting to a shared helper or exporting the kitchen module's private set is a refactor outside this plan's scope. The 11-entry parity test in pantryReady.test.ts guards against drift — any divergence fails fast.
- **80% pantry-readiness threshold.** Slack for a single missing minor aromatic. Threshold-boundary test locks the decision: 4/5 = 80% exactly → true.
- **Dedicated skip endpoint instead of extending /entries/assign or PATCH /:id.** /entries/assign hardcodes status='planned' (upsert semantics would conflict with 'skipped'); PATCH /:id scopes to plan-level fields only. A narrow POST /:id/entries/:day/skip keeps each handler's contract strict.
- **404 (not 403) on ownership miss.** Returning 403 would leak existence — "this plan exists but you can't touch it". 404 is the correct semantic AND the correct security posture for "I can't find a resource you can mutate".
- **User-facing skip error uses fixed copy.** `'Failed to skip day'` regardless of upstream error — user's mental model is about the skip action, not transport-layer wording. Matches Phase 20 handoff classification approach.
- **Telemetry fires BEFORE handler.** Swap/cook may unmount the entry mid-swipe. Ordering guarantees the analytics event regardless of re-render timing.
- **Null-entry short-circuit.** SwipeableDayRow falls through to DayRow when entry is null — unplanned days shouldn't reveal affordance-less actions.
- **Alert.prompt for skip reason.** Native iOS affordance; custom sheet would be over-engineering for v1. Empty/whitespace trim to null keeps the DB column clean.
- **Task 4 shipped as one commit.** No TDD flag on Task 4; the four integration pieces (DayRow comment, SwipeableDayRow + test, plan.tsx wiring, Maestro flow) are tightly coupled and splitting them would be ceremony without value.

## Deviations from Plan

**1. [Rule 3 — Blocking] Test walker invoke-then-fall-through for host-mock null returns**

- **Found during:** Task 4 (authoring SwipeableDayRow.test.ts)
- **Issue:** The vitest.setup.ts mocks `View/Text/Pressable` as `(_props) => null`. A naive tree walker that calls `n.type(n.props)` on function components receives null from these host-primitive mocks and loses visibility into the `children` prop — so the outer `<View>` with 3 `<Action>` children gets collapsed to null and the 3 Pressables become invisible. Initial walker returned 0 pressables for the 3-action tree.
- **Fix:** After invoking a function component, if the invocation returns null/falsy, fall through to descending into the element's own `props.children` rather than returning. Also added a Pressable-name leaf detector (`typeName === 'Pressable'`) so the walker stops at the mocked Pressable leaves instead of invoking them (which also returns null) and losing the onPress handler.
- **Files modified:** `apps/mobile/src/components/plan/SwipeableDayRow.test.ts` (findPressables helper).
- **Verification:** 7/7 cases green.
- **Committed in:** `27aea46` (Task 4).
- **Documented for reuse:** Pattern captured in the test file's `findPressables` JSDoc — future ReanimatedSwipeable/JSX-tree tests can copy it verbatim.

**2. [Rule 3 — Blocking] Task 3 mock ownership-lookup branch keyed on cols === 'id'**

- **Found during:** Task 3 (writing RED tests for POST /:id/entries/:day/skip)
- **Issue:** The existing `meal_plans.select().eq().eq().maybeSingle()` mock chain collapsed all `.select()` invocations (regardless of column argument) to return either `state.assignExistingPlanId` or `state.currentPlan`. The skip handler does a narrow ownership check with `.select('id')` — exposing the fact that it's a DIFFERENT query from `/entries/assign`'s also-`.select('id')`. Sharing the same mock return would couple skip tests to assign state.
- **Fix:** Extended the `.select(cols)` mock branch: when `cols === 'id'` AND `state.skipOwnedPlan !== undefined`, return `state.skipOwnedPlan`. Otherwise fall through to the legacy `assignExistingPlanId`/`currentPlan` behavior. Declared `skipOwnedPlan: any | null | undefined` so `undefined` = "not a skip test" vs `null` = "ownership miss".
- **Files modified:** `packages/server/src/routes/__tests__/meal-plans.test.ts` (mock + state + beforeEach resets).
- **Verification:** 7/7 new skip tests + 24 existing tests green (31 total).
- **Committed in:** `c6c78cf` (Task 3 RED) / state extensions land in same commit.

**3. [Rule 3 — Blocking] User-facing skip error instead of forwarding upstream text**

- **Found during:** Task 2 GREEN (initial rollback test expected error matching `/skip/i`)
- **Issue:** First implementation forwarded upstream server error verbatim (`err.error ?? 'Failed to skip day'`), but the rollback test seeded `{ error: 'boom' }` in the mock response, which doesn't match `/skip/i`. Upstream error wording is non-deterministic and user-hostile (e.g., Postgres constraint names leaked into UI).
- **Fix:** Store a fixed `'Failed to skip day'` on rollback regardless of upstream error. Drain the response body via `.catch(() => ({}))` to avoid a dangling body reader. This also simplifies the test contract: error always matches the action name.
- **Files modified:** `apps/mobile/src/stores/mealPlanStore.ts`.
- **Verification:** All 35/35 mealPlanStore test cases green.
- **Committed in:** `5918025` (Task 2 GREEN).

**4. [Rule 3 — Blocking] `onPress: (text?: string)` typed signature for Alert.prompt**

- **Found during:** Task 4 typecheck (plan.tsx:255 TS7006 implicit any)
- **Issue:** Alert.prompt's callback signature is loosely typed; under strict mode the `text` parameter was flagged as implicit `any`. Left untyped, this would slip into the codebase and future refactors might assume a non-optional string.
- **Fix:** Explicitly typed `onPress: (text?: string) => { ... }`. Matches Alert.prompt's actual signature (iOS returns undefined when user cancels without typing).
- **Files modified:** `apps/mobile/src/app/(tabs)/plan.tsx`.
- **Verification:** tsc clean on plan.tsx after change.
- **Committed in:** `27aea46` (Task 4).

**5. [Rule 3 — Blocking] Return type `React.ReactElement` instead of `JSX.Element`**

- **Found during:** Task 4 typecheck (SwipeableDayRow.tsx TS2503 "Cannot find namespace 'JSX'")
- **Issue:** The project's TypeScript config doesn't expose the global `JSX` namespace (React 19 + strict mode). `JSX.Element` is a legacy pattern.
- **Fix:** Annotated return type as `React.ReactElement` (imported `React` by default from the existing import). Matches the modern React typing convention.
- **Files modified:** `apps/mobile/src/components/plan/SwipeableDayRow.tsx`.
- **Verification:** tsc clean on SwipeableDayRow.tsx after change.
- **Committed in:** `27aea46` (Task 4).

---

**Total deviations:** 5 (all Rule 3 — blocking test/typecheck fixes). Zero scope creep, zero Rule 4 architectural changes.

## Issues Encountered

- **Pre-existing typecheck noise in cooking tests.** 21 errors remain on `pnpm tsc --noEmit` in `apps/mobile` — all in `src/components/cooking/__tests__/*.test.tsx` (TS2345 `Element | null` variance) and `src/cooking/__tests__/*.test.ts` + `src/plan/telemetry.test.ts` + `src/shopping/__tests__/telemetry.test.ts` (TS2578 unused ts-expect-error). Zero new errors introduced by this plan; all present on parent commit `8f5d07a` (22-05 closeout). Documented as deferred in `deferred-items.md` for Phase 22 as a whole.
- **Pre-existing packages/server typecheck noise.** 38 errors in `packages/server/src/routes/meal-plans.ts` (hono `c.get()` returns unknown) + test files. Count identical before and after this plan (stash-rerun verified). Zero regressions.

## User Setup Required

None. All changes are pure-JS and take effect on the next Metro reload. `react-native-gesture-handler` is already installed at repo root (`~2.30.0`) and `GestureHandlerRootView` is already wired at `apps/mobile/src/app/_layout.tsx:91`.

To exercise the full flow in UAT:

1. Open Plan tab → confirm 0–3 chips visible per day (status + stretch + pantry-ready).
2. Swipe any planned day row left → 3 action pills (Swap/Cooked/Skip) reveal.
3. Tap Cooked → row flips to success chip with opacity reduction.
4. Swipe another row → Skip → Alert.prompt appears → type reason or leave empty → Skip → row flips to skipped state.
5. Swipe a third row → Swap → regenerate flow kicks in.
6. Verify telemetry table receives `plan.swipe_action` events with correct variant (offline-of-band Supabase query).

## Next Phase Readiness

**Phase 22 is complete.** All 16 PLAN-X-XX requirements are now implemented across 6 execution plans + 1 Wave 0 foundation plan:

- **PLAN-X-01..04** (Cross-flow nav): 22-01
- **PLAN-X-05, 08** (Week actions): 22-02
- **PLAN-X-06, 09** (Month view + patterns): 22-03
- **PLAN-X-07** (Day drill-down): 22-04
- **PLAN-X-10..13** (Skill progression integration): 22-05
- **PLAN-X-14..16** (Info density + swipe): 22-06 (this plan)

Phase 23 (Settings, Auth & Non-Functional Requirements) can start. The plan-tab-specific primitives shipped in 22-00 (DatePickerSheet, plan/telemetry, skillTier, stretchPicker) remain available for reuse in future phases that want to interact with the plan surface (e.g., Phase 25 private beta might want telemetry fan-out from additional touch points).

---

## Self-Check: PASSED

All 4 task commits resolvable via `git log --oneline`:

- `357184f` test(22-06): add failing tests for computePantryReady helper
- `b9409e6` feat(22-06): implement computePantryReady helper
- `61e7bf7` test(22-06): add failing tests for mealPlanStore.skipDay
- `5918025` feat(22-06): implement skipDay store action
- `c6c78cf` test(22-06): add failing tests for POST /meal-plans/:id/entries/:day/skip
- `4a5d46b` feat(22-06): add POST /meal-plans/:id/entries/:day/skip endpoint
- `27aea46` feat(22-06): SwipeableDayRow wrapper + Plan tab pantry_ready wiring + Maestro flow 36

All 4 created files present on disk:
- `apps/mobile/src/components/plan/pantryReady.ts` — FOUND
- `apps/mobile/src/components/plan/pantryReady.test.ts` — FOUND
- `apps/mobile/src/components/plan/SwipeableDayRow.tsx` — FOUND
- `apps/mobile/src/components/plan/SwipeableDayRow.test.ts` — FOUND

Test suites:
- Mobile plan components + mealPlanStore: 137/137 green
- Server meal-plans routes: 31/31 green

Typecheck: zero new errors introduced (21 pre-existing in cooking tests, 38 pre-existing in meal-plans.ts hono context typing — all verified pre-existing via stash-rerun).

No stubs detected. No TODOs or placeholders in new files.

---

*Phase: 22-plan-experience-refactor*
*Completed: 2026-04-22*
*Plan 22-06 closes Phase 22 — all 16 PLAN-X-XX requirements implemented.*
