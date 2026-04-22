---
phase: 25-private-beta-launch
plan: 00
subsystem: database, testing, infra
tags: [supabase, postgresql, rls, vitest, eas, testflight, beta-launch, feedback-capture]

requires:
  - phase: 23-settings-auth-and-non-functional-requirements
    provides: "append-only event table pattern (00020/00024/00025/00027 precedent), service-role-only RLS audit pattern (00028), authedFetch + session middleware"
  - phase: 23-07
    provides: "app/mobile/PRIVACY.md + TERMS.md + .planning/app-store/ drafts (reused by Phase 25 launch handoffs)"

provides:
  - "beta_invites table tracking invited/onboarded/first_scan/first_cook/week_1_checkin/lapsed lifecycle"
  - "feedback_submissions append-only capture table with auth.uid()=profile_id RLS"
  - "Red-stub tests for 25-01 feedback route + FeedbackSheet component (Nyquist Wave 0)"
  - "EAS production build profile with channel + EXPO_PUBLIC_API_URL + TODO-marked ASC placeholders"

affects:
  - 25-01 (feedback route + FeedbackSheet implementation un-skips stubs)
  - 25-02 (BETA-PLAYBOOK.md SQL snippets read beta_invites + feedback_submissions)
  - 25-03 (TestFlight + ASC handoff uses production EAS profile)

tech-stack:
  added: []
  patterns:
    - "Append-only event table pattern (reused from ai_events/cooking_events/shopping_events/plan_events)"
    - "Service-role-only RLS audit pattern (reused from account_deletions — deny-by-default with no policies)"
    - "Nyquist Wave 0 red-stub convention: .skip-only test files that 25-01 flips to (); no scaffolding diff in 25-01"
    - "EAS production env bundle-inlining (EXPO_PUBLIC_API_URL inlined at bundle time per CLAUDE.md § Metro)"
    - "EAS submit TODO-marked placeholder pattern (ascAppId + appleTeamId as literal TODO-PATRICK-FILLS-* strings, not null, for readable EAS validation error)"

key-files:
  created:
    - supabase/migrations/00029_beta_invites.sql
    - supabase/migrations/00030_feedback_submissions.sql
    - packages/server/src/routes/__tests__/feedback.test.ts
    - apps/mobile/src/components/settings/__tests__/FeedbackSheet.test.tsx
  modified:
    - packages/server/src/__tests__/migrations.test.ts
    - apps/mobile/eas.json

key-decisions:
  - "beta_invites uses TEXT CHECK enum (not Postgres enum) so adding lifecycle stages in later waves needs no migration — matches ai_events.event_type / task_name precedent"
  - "feedback_submissions.profile_id cascades on auth.users delete (NFR-04 parity) — feedback wiped with account"
  - "eas.json ascAppId + appleTeamId use TODO-PATRICK-FILLS-* string placeholders (NOT null) — EAS Submit rejects null; string produces readable validation error"
  - "Red-stub tests intentionally do NOT import the target module — module-resolution failure would trip vitest loader before .skip registers; 25-01 un-skipping + adding imports is the single diff signal"

patterns-established:
  - "Phase-25 beta-launch-only: admin workflows (invites, feedback read-through) live in .planning/BETA-PLAYBOOK.md as SQL snippets; no admin UI ships in Phase 25"
  - "Append-only feedback table with no UPDATE/DELETE policies (matches all other event tables: cooking_events, shopping_events, ai_events, scan_events, item_override_events)"

requirements-completed:
  - BETA-05
  - BETA-07
  - BETA-08
  - BETA-09
  - BETA-11
  - BETA-12
  - BETA-24

duration: 4min
completed: 2026-04-22
---

# Phase 25 Plan 00: Private Beta Launch — Wave 0 Scaffolding Summary

**Two new Supabase migrations (beta_invites + feedback_submissions), red-stub tests for the 25-01 feedback pipeline, and an extended eas.json production profile ready for TestFlight submission — all autonomous, zero external service calls.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T13:46:20Z
- **Completed:** 2026-04-22T13:50:29Z
- **Tasks:** 3
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- Shipped `00029_beta_invites.sql` — beta-user lifecycle table with CHECK-enum status (invited/onboarded/first_scan/first_cook/week_1_checkin/lapsed), unique email index, status index, service-role-only RLS (mirrors 00028_account_deletions pattern exactly).
- Shipped `00030_feedback_submissions.sql` — append-only in-app feedback capture. `profile_id` FK to `auth.users` ON DELETE CASCADE (NFR-04 parity), message CHECK length 1..4000, `auth.uid()=profile_id` SELECT + INSERT policies (no UPDATE/DELETE, matching the cooking_events/shopping_events/ai_events/scan_events precedent).
- Extended `migrations.test.ts` with two new `describe` blocks (9 assertions for 00029, 10 for 00030) covering table creation, column types, CHECK constraints, indexes, RLS, policies, and COMMENT ON TABLE phrasing. All 140 migration tests green.
- Created two Nyquist Wave 0 red-stub test files: `feedback.test.ts` (5 skipped describe/it blocks for POST /feedback + GET /admin/beta-invites, mirroring telemetry.test.ts shape) and `FeedbackSheet.test.tsx` (4 skipped describe/it blocks for the settings component). Both produce `0 passed, N skipped, 0 failed` — the red signal.
- Extended `apps/mobile/eas.json` production profile: `channel: 'production'`, `env.EXPO_PUBLIC_API_URL: 'https://api.dinnertime.app'` (bundle-inlined per CLAUDE.md Metro rules), `ios.resourceClass: 'm-medium'`, `submit.production.ios.ascAppId + appleTeamId` as TODO-PATRICK-FILLS-* string placeholders (readable EAS validation error instead of null silently breaking).

## Task Commits

Each task was committed atomically:

1. **Task 1: Land migrations 00029 + 00030 + migrations.test.ts extensions** — `26c5cdf` (feat)
2. **Task 2: Red-stub tests for 25-01 feedback route + FeedbackSheet** — `1c00d74` (test)
3. **Task 3: Extend eas.json production profile for TestFlight submission** — `a57229d` (chore)

## Files Created/Modified

- `supabase/migrations/00029_beta_invites.sql` (65 lines) — beta-user lifecycle tracking table
- `supabase/migrations/00030_feedback_submissions.sql` (70 lines) — append-only in-app feedback capture
- `packages/server/src/__tests__/migrations.test.ts` — extended with two describe blocks covering 00029 + 00030 (19 assertions total)
- `packages/server/src/routes/__tests__/feedback.test.ts` (46 lines) — red-stub: 5 `.skip` placeholders for POST /feedback + GET /admin/beta-invites
- `apps/mobile/src/components/settings/__tests__/FeedbackSheet.test.tsx` (45 lines) — red-stub: 4 `.skip` placeholders for FeedbackSheet render / POST / close+clear / empty-guard
- `apps/mobile/eas.json` — production build profile extended with channel/env/ios config; submit.production.ios gains ascAppId + appleTeamId placeholder

## Decisions Made

- **CHECK enum over Postgres enum type for `beta_invites.status`** — adding lifecycle stages later needs no migration, matching the `ai_events.event_type / task_name` precedent where free-form text is deliberately preferred.
- **`feedback_submissions.profile_id` cascades on auth.users delete** — feedback is user-owned PII and must wipe with account (NFR-04 parity from Phase 23-02).
- **EAS `ascAppId` + `appleTeamId` as literal `TODO-PATRICK-FILLS-*` strings, not null** — EAS Submit rejects null values; the TODO string produces a readable validation error pointing Patrick at the field when the ASC record is created. The value is obvious-on-sight in the eas.json diff.
- **Red stubs do NOT import the target module** — a top-level import of `../FeedbackSheet` (which doesn't exist yet) would fail module resolution at loader time and trip vitest before the `.skip` placeholders register. Leaving imports for 25-01 is the minimal-diff signal.
- **No live-Supabase assertion layer added for 00029/00030** — the existing static-contract layer is sufficient; Patrick applies migrations manually via `supabase db push` post-commit.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Plan executed as written. All 3 tasks completed atomically with their expected verification signatures (140 migration tests green, 5 server + 4 mobile tests skipped, EAS config validation `OK`).

## Issues Encountered

- **Pre-existing test failures observed but out of scope:** `packages/server __tests__/meal-plans.test.ts` (1 failure — `EMPTY_PANTRY` from live Supabase schema-cache mismatch, documented in STATE.md line 31 as a known pre-existing issue) and `apps/mobile src/stores/__tests__/shoppingStore.test.ts` + 4 other mobile test files (13 failures total — pre-existing, documented in STATE.md as "reproduce on HEAD — not introduced here"). No new regressions from this plan.
- **Pre-existing typecheck noise in packages/server and apps/mobile** (793 server errors in pre-existing test files + ~25 mobile errors in pre-existing test files). All unrelated to Phase 25 — the 4 new files created by this plan (2 migrations + 2 red-stub tests) do not add new typecheck errors.

## Self-Check

**Created files verification:**

```
FOUND: supabase/migrations/00029_beta_invites.sql
FOUND: supabase/migrations/00030_feedback_submissions.sql
FOUND: packages/server/src/routes/__tests__/feedback.test.ts
FOUND: apps/mobile/src/components/settings/__tests__/FeedbackSheet.test.tsx
```

**Commit verification:**

```
FOUND: 26c5cdf (Task 1: migrations + migrations.test.ts)
FOUND: 1c00d74 (Task 2: red-stub tests)
FOUND: a57229d (Task 3: eas.json)
```

## Known Stubs

By design. Wave 0 is scaffolding:

- `packages/server/src/routes/__tests__/feedback.test.ts` — 5 `.skip` placeholder tests. Resolution path: 25-01 creates `packages/server/src/routes/feedback.ts` + admin route, then un-skips these tests one at a time.
- `apps/mobile/src/components/settings/__tests__/FeedbackSheet.test.tsx` — 4 `.skip` placeholder tests. Resolution path: 25-01 creates `apps/mobile/src/components/settings/FeedbackSheet.tsx`, wires `@testing-library/react-native` + fetch mock, imports `../FeedbackSheet`, un-skips tests.
- `apps/mobile/eas.json` `submit.production.ios.ascAppId` + `appleTeamId` — literal `TODO-PATRICK-FILLS-*` strings. Resolution path: Patrick edits these post-ASC-record-creation in 25-03 handoff; failure mode is a readable EAS validation error, not a silent null break.

All stubs are intentional and resolved in explicit follow-up plans (25-01 / 25-03).

## User Setup Required

None - no external service configuration required for this plan. Patrick will apply the migrations via `supabase db push` once all Phase 25 plans land.

## Next Phase Readiness

- **25-01 (feedback pipeline)** is unblocked: both red-stub files are in place, so 25-01's diff is 100% behavior (FeedbackSheet.tsx + routes/feedback.ts + un-skip test flips + imports), zero scaffolding.
- **25-02 (release + deployment + beta-playbook docs)** is unblocked: the `beta_invites` + `feedback_submissions` tables are ready for SQL snippets in BETA-PLAYBOOK.md.
- **25-03 (TestFlight handoff)** is unblocked: the eas.json production profile is complete apart from the two Patrick-fills ASC IDs.

## Self-Check: PASSED

---
*Phase: 25-private-beta-launch*
*Completed: 2026-04-22*
