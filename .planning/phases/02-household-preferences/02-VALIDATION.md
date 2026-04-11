---
phase: 2
slug: household-preferences
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/mobile/vitest.config.ts, packages/server/vitest.config.ts |
| **Quick run command** | `pnpm --filter @dinnertime/mobile vitest run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @dinnertime/mobile vitest run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FOUN-03 | unit | `pnpm --filter @dinnertime/mobile vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FOUN-04 | unit | `pnpm --filter @dinnertime/mobile vitest run` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FOUN-05 | unit | `pnpm --filter @dinnertime/mobile vitest run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for preferences store (FOUN-03, FOUN-04, FOUN-05)
- [ ] Test stubs for household member CRUD operations (FOUN-04)
- [ ] Test stubs for ingredient search/filter logic (FOUN-05)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings screen accessible from Home tab gear icon | FOUN-03 | UI navigation | 1. Open app 2. Tap gear icon on Home 3. Settings screen appears |
| Auto-save persists preferences | FOUN-03 | Requires Supabase + device | 1. Change dietary pref 2. Kill app 3. Reopen — change persisted |
| Family member profiles display correctly | FOUN-04 | Visual layout | 1. Add member 2. Verify name, type badge, dietary icons show |
| Ingredient search/autocomplete UX | FOUN-05 | Interaction quality | 1. Type ingredient 2. Results appear 3. Tap to add as chip |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
