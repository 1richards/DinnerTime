---
phase: 14
slug: multi-photo-pantry-scan-with-smarter-item-filtering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | packages/server/vitest.config.ts |
| **Quick run command** | `cd packages/server && npx vitest run src/services/__tests__/vision.test.ts` |
| **Full suite command** | `cd packages/server && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/server && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/server && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | P14-05 | unit | `npx vitest run src/ai/__tests__/anthropicAdapter.test.ts` | ✅ (extend) | ⬜ pending |
| 14-01-02 | 01 | 1 | P14-01 | unit | `npx vitest run src/services/__tests__/vision.test.ts` | ✅ (extend) | ⬜ pending |
| 14-01-03 | 01 | 1 | P14-02 | unit | `npx vitest run src/routes/__tests__/pantry.test.ts` | ✅ (extend) | ⬜ pending |
| 14-01-04 | 01 | 1 | P14-03 | unit | `npx vitest run src/services/__tests__/vision.test.ts` | ✅ (extend) | ⬜ pending |
| 14-02-01 | 02 | 2 | P14-04 | manual | Maestro / manual verification | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | P14-01 | manual | Visual UI verification | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `identifyFoodItemsBatch` test cases in `vision.test.ts`
- [ ] Route test for POST `/scan-batch` (or extended `/scan`) in `pantry.test.ts`
- [ ] `AnthropicAdapter.analyzeImagesStructured` test in `anthropicAdapter.test.ts`

*Existing infrastructure covers framework install — Vitest already configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Thumbnail strip UI | P14-01 | Visual component layout | Take 3 photos, verify thumbnails appear horizontally, tap to preview/remove |
| Multi-photo submission flow | P14-01 | End-to-end UX flow | Take 3+ photos of fridge, submit, verify merged results on review screen |
| No vague items in results | P14-03 | AI output quality | Scan a fridge with leftovers/packets visible, verify none appear in results |
| Confidence-based defaults | P14-04 | Review screen behavior | Submit scan, verify low-confidence items default to rejected |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
