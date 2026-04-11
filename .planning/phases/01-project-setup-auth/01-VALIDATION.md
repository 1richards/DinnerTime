---
phase: 1
slug: project-setup-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | packages/server/vitest.config.ts |
| **Quick run command** | `pnpm --filter server test` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter server test`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | FOUN-01 | integration | `pnpm --filter server test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FOUN-02 | integration | `pnpm --filter server test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | FOUN-06 | integration | `pnpm --filter server test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Vitest configuration for server package
- [ ] Test stubs for auth endpoints (FOUN-01)
- [ ] Test stubs for session persistence (FOUN-02)
- [ ] Test stubs for data sync (FOUN-06)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Session persists across app restart | FOUN-02 | Requires physical device/simulator app lifecycle | 1. Login 2. Kill app 3. Reopen — should be logged in |
| Data survives app reinstall | FOUN-06 | Requires device uninstall/reinstall cycle | 1. Create profile 2. Uninstall 3. Reinstall + login — profile data intact |
| Apple Sign In captures name | FOUN-01 | Requires Apple ID, first-time sign-in only | 1. Sign in with Apple 2. Verify display name captured |
| Google Sign In flow | FOUN-01 | Requires Google account, OAuth consent screen | 1. Sign in with Google 2. Verify account created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
