---
phase: 22
slug: plan-experience-refactor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 22 — Validation Strategy

> Operational contract for feedback sampling. Authoritative test-to-requirement mapping in `22-RESEARCH.md` §Validation Architecture.

## Test Infrastructure

| Property | Value |
|----------|-------|
| Frameworks | vitest (mobile), jest (server), maestro (iOS UAT) |
| Quick run | `cd apps/mobile && pnpm test --run src/stores src/components/plan src/app/plan` |
| Full suite | `pnpm -r test --run && bash apps/mobile/.maestro/scripts/uat.sh smoke` |
| Runtime | ~25s unit · ~60s Maestro |

## Sampling Rate

- After every task: scoped unit tests.
- After every wave: full suite.
- Before verify-work: Maestro flows 30+31 (plan + month) green.

## Per-Task Verification Map

Authoritative table in `22-RESEARCH.md` §Validation Architecture. Planner derives per-task `<automated>` commands from it.

## Wave 0 Requirements

Per `22-RESEARCH.md` §Wave 0 — install `@react-native-community/datetimepicker`, add migrations 00025 (plan_events) + 00026 (weekly_skill_focus), extend `/meal-plans/entries/assign` with date param, add `GET /meal-plans?from=&to=` range endpoint, ship `skillTier`/`stretchPicker` pure helpers, ship shared `DatePickerSheet`, create red stubs for Waves 1-6 test files.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|--------------|
| Native iOS date picker UX feels native | PLAN-X-05 | Simulator differs from device feel | Physical iPhone: invoke picker from 3 entry points, validate spinner/calendar modes |
| Swipe-to-action gestures feel smooth | PLAN-X-16 | Reanimated 4 gestures need real device frame budget | Physical iPhone: swipe day cards, verify 60fps, haptic on action |
| Month view performance with 28-35 days populated | PLAN-X-06, PLAN-X-09 | Need real data volume | Physical iPhone: populate 1 month, verify scroll perf + compute |

## Validation Sign-Off

- [ ] Every plan has `<automated>` or Wave 0 dep
- [ ] Wave 0 red stubs turn green across Waves 1-6
- [ ] Maestro flow 30 (week) + flow 31 (month) green on simulator
- [ ] `nyquist_compliant: true` after Wave 0

**Approval:** pending
