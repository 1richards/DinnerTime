---
phase: 15
slug: ui-polish-and-navigation-consistency-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full design + test matrix lives in `15-RESEARCH.md` `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 (mobile unit) + Maestro 2.4.0 (iOS Simulator UAT) |
| **Config file** | `apps/mobile/vitest.config.ts` (existing) |
| **Quick run command** | `cd apps/mobile && pnpm test --run` |
| **Full suite command** | `cd apps/mobile && pnpm test --run && maestro test .maestro/` |
| **UAT command** | `apps/mobile/.maestro/scripts/uat.sh all` |
| **Estimated runtime** | Vitest < 30s; Maestro full suite ~15 min |

---

## Sampling Rate

- **After every task commit:** `cd apps/mobile && pnpm test --run src/components/ui src/design`
- **After every plan wave:** full `pnpm test` + Maestro flows affected by the wave
- **Before `/gsd:verify-work`:** full Vitest green + full Maestro suite green + `/gsd:ui-review 15` zero BLOCK findings
- **Max feedback latency:** < 30s per commit

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-* | 01 (primitives) | 1 | EmptyState/LoadingState/ErrorState render correctly | unit | `pnpm test --run src/components/ui/__tests__/{Empty,Loading,Error}State.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-* | 01 (SymbolIcon) | 1 | SymbolIcon size→px mapping + tintColor passthrough | unit | `pnpm test --run src/components/ui/__tests__/SymbolIcon.test.tsx` | ❌ W0 | ⬜ pending |
| 15-01-* | 01 (dirty-form) | 1 | `useDirtyFormGuard` blocks back when dirty | unit | `pnpm test --run src/components/ui/__tests__/useDirtyFormGuard.test.tsx` | ❌ W0 | ⬜ pending |
| 15-02-* | 02 (nav migration) | 2 | Modal presentation on scan + recipe import layouts | Maestro | `maestro test .maestro/03-import-url.yaml .maestro/scan-*.yaml` | ✅ (exists; rebase) | ⬜ pending |
| 15-02-* | 02 (nav migration) | 2 | Every pushed screen has chevron-only back button | grep | `apps/mobile/scripts/verify-headers.sh` (Wave 0 adds) | ❌ W0 | ⬜ pending |
| 15-03-* | 03 (icon sweep) | 2 | No Ionicons imports remain in src/ | grep | `! grep -rn "from '@expo/vector-icons'" apps/mobile/src` | ✅ (inline) | ⬜ pending |
| 15-03-* | 03 (icon sweep) | 2 | No decorative-emoji unicode in src/app empty states | grep | `! grep -rnP "[\\x{1F300}-\\x{1F9FF}]" apps/mobile/src/app` | ✅ (inline) | ⬜ pending |
| 15-04-* | 04 (finalize) | 3 | Modal drag-down + dirty-form guard Maestro flows | Maestro | `maestro test .maestro/21-modal-dismiss.yaml .maestro/22-dirty-form-guard.yaml` | ❌ W3 | ⬜ pending |
| 15-04-* | 04 (finalize) | 3 | All existing Maestro flows green after nav+icon migration | Maestro | `apps/mobile/.maestro/scripts/uat.sh all` | ✅ (rebase) | ⬜ pending |
| 15-04-* | 04 (audit) | 3 | `/gsd:ui-review 15` zero BLOCK findings | audit | `/gsd:ui-review 15` | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/mobile/src/components/ui/EmptyState.tsx` (new component)
- [ ] `apps/mobile/src/components/ui/LoadingState.tsx` (new component)
- [ ] `apps/mobile/src/components/ui/ErrorState.tsx` (new component)
- [ ] `apps/mobile/src/components/ui/SymbolIcon.tsx` (thin SymbolView wrapper — size-to-px mapping, tintColor passthrough)
- [ ] `apps/mobile/src/components/ui/useDirtyFormGuard.ts` (hook wrapping React Navigation 7 `usePreventRemove`)
- [ ] `apps/mobile/src/components/ui/__tests__/EmptyState.test.tsx`
- [ ] `apps/mobile/src/components/ui/__tests__/LoadingState.test.tsx`
- [ ] `apps/mobile/src/components/ui/__tests__/ErrorState.test.tsx`
- [ ] `apps/mobile/src/components/ui/__tests__/SymbolIcon.test.tsx`
- [ ] `apps/mobile/src/components/ui/__tests__/useDirtyFormGuard.test.tsx`
- [ ] `apps/mobile/scripts/verify-headers.sh` — greps for chevron-only header pattern compliance
- [ ] `apps/mobile/scripts/verify-no-ionicons.sh` — greps for Ionicons imports (fail if any)
- [ ] `apps/mobile/scripts/verify-no-decorative-emoji.sh` — greps for decorative emoji unicode in `src/app/` empty states
- [ ] `apps/mobile/.maestro/21-modal-dismiss.yaml` — new flow for scan-modal swipe-down dismiss
- [ ] `apps/mobile/.maestro/22-dirty-form-guard.yaml` — new flow (may need manual-only note if Alert interaction is flaky)
- [ ] Re-baseline screenshots for existing Maestro flows whose text selectors depended on "Back" label (removed when chevron-only lands)
- [ ] **`vitest.config.ts` exclusion review** — `src/components/**` currently excluded from mobile vitest; new tests must either live outside that path OR the exclusion must be narrowed. Prefer pure-className/props tests in `src/components/ui/__tests__/` that stay node-pure (no RNTL renderer).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual polish feels "iOS-native Apple HIG" across every screen | UI quality (post-v1) | Subjective visual judgment | Human UAT — walk every tab + scan + recipe flow on iPhone 17 Pro sim |
| Modal drag-down dismiss feels natural on scan/review flow | CONTEXT modal decision | Gesture feel | Human UAT — drag modal down on scan flow, confirm dismissal |
| Swipe-back gesture feels correct on every pushed screen | CONTEXT swipe-back decision | Gesture feel | Human UAT — swipe from left edge on recipe detail, settings sub-screens |
| Dirty-form confirmation dialog appears and reads correctly | CONTEXT dirty-form guard | Alert content + UX | Human UAT — edit recipe, swipe back, confirm dialog |
| SF Symbol names render correctly (no ? boxes or missing icons) across iOS 15/16/17/26 | CONTEXT icon decision | iOS version availability varies | Human UAT on at least iPhone 17 Pro sim (iOS 26.4 runtime) |
| Empty-state food imagery reads as appetizing (not dated) | CONTEXT FOOD_IMAGES decision | Subjective | Human UAT — view every empty state post-migration |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive implementation tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 primitives + 5 tests + 3 grep scripts + 2 Maestro flows + screenshot rebase list)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 30s per commit
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending
