---
phase: 13
slug: receipt-scan-and-instacart-import-for-bulk-pantry-loading
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 |
| **Config file** | packages/server/vitest.config.ts |
| **Quick run command** | `cd packages/server && npx vitest run src/services/__tests__/vision.test.ts` |
| **Full suite command** | `cd packages/server && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run targeted test file with `--reporter=verbose`
- **After every plan wave:** Run full backend suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | Receipt service | unit | `npx vitest run src/services/__tests__/vision.test.ts` | ✅ (extend) | ⬜ pending |
| 13-01-02 | 01 | 1 | Routes + dedup | integration | `npx vitest run src/routes/__tests__/pantry.test.ts` | ✅ (extend) | ⬜ pending |
| 13-02-01 | 02 | 2 | Mobile store | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 13-02-02 | 02 | 2 | Capture UI | manual | Physical device verification | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 2 | Bottom sheet launcher | manual | Visual + tap verification | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `identifyReceiptItems` unit test fixtures in `vision.test.ts` (receipt image, denylist, non-food exclusion, variant flag)
- [ ] `POST /scan-receipt` route test in `pantry.test.ts` (auth, shape, existing-pantry dedup)
- [ ] `POST /import-instacart` route test in `pantry.test.ts` (same pattern, different variant)
- [ ] Mobile `startReceiptScan` store test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Thermal receipt recognition | Receipt success criterion 1 | Real-world image quality varies | Photograph 3 real grocery receipts, verify extraction accuracy |
| Instacart screenshot parsing | Instacart success criterion 2 | UI layouts change across Instacart app versions | Test with screenshots from iOS Instacart app order history |
| Bottom sheet launcher UX | Success criterion 4 | Visual + flow | Launch from Pantry FAB, verify three options (Camera, Receipt, Instacart), each routes correctly |
| Review screen with receipt items | Success criterion 1, 3 | End-to-end flow | Submit receipt → review items → confirm → verify in pantry with correct location |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
