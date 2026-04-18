---
phase: 19
slug: design-professionalization-icons-buttons-navigation-search-bars-inspired-by-spotify-strava-doordash
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full design rationale + test matrix lives in `19-RESEARCH.md` `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ~4.1.4 (mobile) + vitest (server, untouched) |
| **Config file** | `apps/mobile/vitest.config.ts` — node env, excludes `src/components/**` (see Wave 0 note below) |
| **Quick run command** | `cd apps/mobile && pnpm test src/design/` |
| **Full suite command** | `cd apps/mobile && pnpm test` + `cd packages/server && pnpm test` |
| **UAT command** | `cd apps/mobile && apps/mobile/.maestro/scripts/uat.sh all` |
| **Estimated runtime** | design unit tests < 2s; full mobile vitest < 10s; Maestro suite ~15 min |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/mobile && pnpm test src/design/tokens.test.ts src/design/tokens-purity.test.ts` — guards the two highest-drift invariants (token parity, no raw orange in `src/**`).
- **After every plan wave:** Run `cd apps/mobile && pnpm test` (full mobile vitest).
- **Before `/gsd:verify-work`:** Full vitest green + Maestro suite green on iOS Simulator with updated screenshots approved.
- **Max feedback latency:** < 2 seconds per task, < 10 seconds per wave.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-* | 01 (tokens) | 1 | Palette + typography | unit | `pnpm test src/design/tokens.test.ts` | ❌ W0 | ⬜ pending |
| 19-01-* | 01 (tokens) | 1 | No raw orange in `src/**` | unit | `pnpm test src/design/tokens-purity.test.ts` | ❌ W0 | ⬜ pending |
| 19-01-* | 01 (icons) | 1 | SF Symbol size helper | unit | `pnpm test src/design/icons.test.ts` | ❌ W0 | ⬜ pending |
| 19-02-* | 02 (Button) | 2 | 5 variants + 44pt height + loading states | unit | `pnpm test src/components/ui/Button.test.ts` | ❌ W0 | ⬜ pending |
| 19-02-* | 02 (Chip) | 2 | filter + display kinds × tone matrix | unit | `pnpm test src/components/ui/Chip.test.ts` | ❌ W0 | ⬜ pending |
| 19-02-* | 02 (SearchBar) | 2 | router.push + shadowOpacity interp | unit | `pnpm test src/components/ui/SearchBar.test.ts` | ❌ W0 | ⬜ pending |
| 19-03-* | 03 (cards) | 2–3 | Mode-aware RecipeCard classNames | unit | `pnpm test src/components/recipes/RecipeCard.test.ts` | ❌ W0 | ⬜ pending |
| 19-04-* | 04 (sweep) | 3 | Sticky pill on Kitchen/Library + expand-to-modal | Maestro | update `.maestro/20-kitchen-segment-toggle.yaml` | ✅ (update) | ⬜ pending |
| 19-04-* | 04 (sweep) | 3 | Tab bar tint = terracotta across all tabs | Maestro | screenshot assertion in `20-kitchen-segment-toggle.yaml` | ✅ (update) | ⬜ pending |
| 19-04-* | 04 (sweep) | 3 | FAB retreatment on Kitchen/Pantry | Maestro | update `08-home-suggestions.yaml` + pantry flow | ✅ (update) | ⬜ pending |
| 19-04-* | 04 (sweep) | 3 | Button variants visible + tappable | Maestro | new `.maestro/21-design-buttons-visual.yaml` | ❌ W3 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/mobile/src/design/tokens.ts` — typed token export (~40 LOC; mirrors `global.css` CSS variables)
- [ ] `apps/mobile/src/design/icons.ts` — SF Symbol size helper `iconPropsForText(scale)`
- [ ] `apps/mobile/src/design/tokens.test.ts` — **token parity test** (every `--color-*` in `global.css` matches `tokens.ts`; guards Pitfall 3)
- [ ] `apps/mobile/src/design/tokens-purity.test.ts` — grep test asserting no `#F97316` / `orange-(50–700)` in `src/**/*.{ts,tsx}` after sweep
- [ ] `apps/mobile/src/design/icons.test.ts` — unit test for `iconPropsForText`
- [ ] `apps/mobile/src/components/ui/Button.test.ts` — pure className assertion (no RNTL renderer)
- [ ] `apps/mobile/src/components/ui/Chip.test.ts` — kind × tone matrix
- [ ] `apps/mobile/src/components/ui/SearchBar.test.ts` — router.push dispatch + interp
- [ ] **`vitest.config.ts` exclusion narrowed** — current `src/components/**` exclusion is too broad; narrow to `src/components/**/*.native.test.*` OR keep the new tests as pure-className `*.test.ts` (no `.tsx`, no RNTL).
- [ ] **Maestro flow updates identified** — list: `20-kitchen-segment-toggle.yaml`, `18-recipe-search-favorite.yaml`, `08-home-suggestions.yaml`, plus new `21-design-buttons-visual.yaml`. Take fresh baseline screenshots after merge.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Terracotta palette subjectively reads as "premium" and "appetizing" | Aesthetic direction (CONTEXT) | Subjective visual judgment | Human UAT Gate A — side-by-side with pre-migration screenshots on iPhone |
| Typography hierarchy reads "Spotify-like premium" across Kitchen/Plan/Pantry | CONTEXT typography decisions | Subjective visual judgment | Human UAT Gate A — review all 5 tabs + scan/cook flows |
| Sticky pill search feels "DoorDash-like" (prominence, tap-target, expand motion) | CONTEXT search decision | Subjective visual judgment + interaction feel | Human UAT Gate A — on-device tap-through |
| `expo-glass-effect` opportunistic usage (if Claude proposes) feels premium, not gimmicky | Claude's Discretion (CONTEXT) | Subjective | Human UAT Gate A |
| Chip density on Plan day card feels "Strava-level" without being cluttered | CONTEXT density decision | Subjective | Human UAT Gate A — Plan tab review |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (design files + test files + vitest.config exclusion adjustment)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 2s per commit, < 10s per wave
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending
