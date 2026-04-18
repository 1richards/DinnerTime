---
phase: 12
slug: combine-home-recipes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (server) + Maestro (mobile UAT) |
| **Config file** | packages/server/vitest.config.ts, apps/mobile/.maestro/ |
| **Quick run command** | `cd apps/mobile && npx tsc --noEmit` |
| **Full suite command** | `maestro test apps/mobile/.maestro/smoke.yaml` |
| **Estimated runtime** | ~5s typecheck, ~60s Maestro smoke |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run the relevant Maestro flow
- **Before `/gsd:verify-work`:** Full Maestro smoke + segment-toggle flow must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | Create kitchen.tsx + segmented control | unit | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | Update tab layout, delete old tabs | manual | Visual + nav test | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | Update 4 route call sites | unit | `npx tsc --noEmit` + grep | ✅ | ⬜ pending |
| 12-03-01 | 03 | 3 | Update Maestro flows | e2e | `maestro test smoke.yaml` | ✅ | ⬜ pending |
| 12-03-02 | 03 | 3 | Add segment-toggle flow | e2e | `maestro test 20-kitchen-segment-toggle.yaml` | ❌ W0 | ⬜ pending |

---

## Wave 0 Requirements

- [ ] New Maestro flow `20-kitchen-segment-toggle.yaml` stub
- [ ] Audit of all `router.push|replace('/(tabs)')` call sites documented

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Segment state preservation | CONTEXT locked decision | Visual + gesture flow | Type in Library search → switch to Suggestions → switch back → verify search text persists |
| Hero image renders on Suggestions only | CONTEXT locked decision | Visual | Open Kitchen → see hero → tap Library → see plain "Kitchen/N recipes" header |
| Import FAB hides on Suggestions | CONTEXT locked decision | Visual | Default segment (Suggestions) shows no "+" FAB; Library shows orange "+" FAB |
| Regenerate FAB works | CONTEXT locked decision | End-to-end | Suggestions FAB taps fetchSuggestions and refreshes cards |
| Tab bar order | CONTEXT locked decision | Visual | Tab bar shows: Kitchen, Plan, Pantry, Shopping (4 tabs, Kitchen leftmost) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
