---
phase: 25
slug: private-beta-launch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 25 — Validation Strategy

> Launch-readiness phase. Most success criteria are human-verified (TestFlight uploads, real kitchen data, App Store submission).

## Test Infrastructure

| Property | Value |
|----------|-------|
| Frameworks | vitest, jest, maestro (simulator) |
| Quick run | `cd apps/mobile && pnpm test --run src/components/settings src/feedback` |
| Full suite | `pnpm -r test --run` |
| Runtime | ~15s unit |

## Manual-Only Verifications (Human Required)

| Behavior | SC | Why Manual | Instructions |
|----------|-----|------------|--------------|
| Real pantry scanned on physical iPhone | SC-1 | Patrick's kitchen | See BETA-PLAYBOOK.md |
| 30 recipes imported | SC-2 | Requires user curation | User action |
| 1 full week cooked | SC-3 | Takes 7 days | User action |
| Non-builder onboards unassisted | SC-6 | Requires observer | 5-min test, see BETA-PLAYBOOK.md |
| TestFlight upload | SC-8 | Requires ASC credentials | EAS Submit, see RELEASE.md |
| App Store form filling | SC-13..20 | ASC form only on web | See `.planning/app-store/` + RELEASE.md |
| Backend prod deployment | SC-22, 23 | Requires cloud account | See DEPLOYMENT.md |
| Beta user check-ins | SC-24 | Real user interviews | See BETA-PLAYBOOK.md |

## Automated Verifications (Wave 0-2)

- Feedback form component tests
- Feedback server endpoint tests
- Migration contract tests (beta_invites, feedback_submissions)
- Maestro screenshot flow (simulator captures shot-list)

## Validation Sign-Off

Phase 25 is considered COMPLETE when:
- [ ] Automatable artifacts landed (feedback infra + release/deployment/beta-playbook docs)
- [ ] Patrick has TestFlight build uploaded AND at least 1 non-builder tester has onboarded successfully

**Approval:** pending
