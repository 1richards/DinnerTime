---
phase: 17
slug: something-new-ai-powered-recipe-exploration-with-search-and-remix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full detail in `17-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (mobile + server workspaces; Node env) |
| **Mobile config** | `apps/mobile/vitest.config.ts` (env=node, `vitest.setup.ts` mocks) |
| **Server config** | `packages/server/vitest.config.ts` |
| **Quick run (mobile)** | `cd apps/mobile && pnpm test -- --run src/stores/__tests__/suggestionsStore.test.ts` |
| **Quick run (server)** | `cd packages/server && pnpm test -- --run src/routes/__tests__/recipes.search.test.ts` |
| **Full suite (mobile)** | `cd apps/mobile && pnpm test` |
| **Full suite (server)** | `cd packages/server && pnpm test` |
| **UAT runner** | Maestro 2.4.0 (`apps/mobile/.maestro/scripts/uat.sh all` for full suite; `maestro test .maestro/<flow>.yaml` for a single flow — `uat.sh` has no `flow` subcommand) |
| **Estimated runtime** | ~45s mobile unit, ~15s server unit, ~12m Maestro full suite |

**Gotcha:** `.native.test.*` suffix excluded under node env — use plain `.test.ts` for pure helpers, reserve `.native.test.*` for RN-renderer-coupled tests.

---

## Sampling Rate

- **After every task commit:** Run relevant quick command (store test or route test)
- **After every plan wave:** Run full suite for the workspace touched
- **Before `/gsd:verify-work`:** Full mobile + server suite green + Maestro `27-something-new-search.yaml` green
- **Max feedback latency:** 45 seconds for unit; ~1 min for a single Maestro flow

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-00-01 | 00 | 0 | P17-ALL | stub | `pnpm test -- --run` (both workspaces; expect red) | ❌ W0 | ⬜ pending |
| 17-01-01 | 01 | 1 | P17-04 | integration | `cd packages/server && pnpm test -- --run src/routes/__tests__/recipes.search.test.ts` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | P17-04 | unit (pure) | `cd packages/server && pnpm test -- --run src/services/__tests__/recipeDiscovery.test.ts` | Partially | ⬜ pending |
| 17-02-01 | 02 | 2 | P17-02 | unit | `cd apps/mobile && pnpm test -- --run src/stores/__tests__/suggestionsStore.persist.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 2 | P17-03 | unit | `cd apps/mobile && pnpm test -- --run src/stores/__tests__/suggestionsStore.test.ts` | Partially | ⬜ pending |
| 17-02-03 | 02 | 2 | P17-03 | unit (pure) | `cd apps/mobile && pnpm test -- --run src/stores/__tests__/dedupPrepend.test.ts` | ❌ W0 | ⬜ pending |
| 17-02-04 | 02 | 2 | P17-06 | unit | `cd apps/mobile && pnpm test -- --run src/stores/__tests__/suggestionsStore.test.ts::clearHistory` | ❌ W0 | ⬜ pending |
| 17-03-01 | 03 | 3 | P17-01 | source-contract | `cd apps/mobile && pnpm test -- --run src/app/\(tabs\)/__tests__/kitchen.test.ts` | ❌ W0 | ⬜ pending |
| 17-03-02 | 03 | 3 | P17-03 | source-contract | `cd apps/mobile && pnpm test -- --run src/app/__tests__/search.test.ts` | ❌ W0 | ⬜ pending |
| 17-03-03 | 03 | 3 | P17-05 | source-contract | `cd apps/mobile && pnpm test -- --run src/app/recipes/__tests__/discover.test.ts` | Partially | ⬜ pending |
| 17-03-04 | 03 | 3 | P17-06 | source-contract | Same as 17-03-01 (RegenerateFab removal + HeaderEllipsis actions assertions) | ❌ W0 | ⬜ pending |
| 17-04-01 | 04 | 4 | P17-05 | e2e | `cd apps/mobile && maestro test .maestro/27-something-new-search.yaml` | ❌ W0 | ⬜ pending |
| 17-04-02 | 04 | 4 | P17-01 | e2e | `cd apps/mobile && maestro test .maestro/20-kitchen-segment-toggle.yaml` (after rebasing line ~77 Suggestions → Something New) | Partially | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Note on Maestro invocation:** `apps/mobile/.maestro/scripts/uat.sh` supports only `boot|open|shot|log|reset|smoke|all|help`. There is NO `flow` subcommand — `uat.sh flow <name>` silently falls through to help and exits 0, which would let a verification gate pass without ever running the flow. For single-flow runs, always use `maestro test .maestro/<flow>.yaml` directly. `uat.sh all` is fine for full-suite runs.

---

## Wave 0 Requirements

Tests stubbed red before production code — Nyquist compliance.

- [ ] `apps/mobile/src/stores/__tests__/suggestionsStore.persist.test.ts` — persists searchResults, recentQueries, lastQuery, pantryOnly; excludes autoFetch (Pitfall 1)
- [ ] `apps/mobile/src/stores/__tests__/dedupPrepend.test.ts` — pure helper: dedupes, caps at 5, most-recent first
- [ ] `apps/mobile/src/app/(tabs)/__tests__/kitchen.test.ts` — segment label "Something New", accessibilityLabel, RegenerateFab absence, HeaderEllipsis actions array
- [ ] `apps/mobile/src/app/__tests__/search.test.ts` — context=something-new branch renders search input + pantry toggle
- [ ] `packages/server/src/routes/__tests__/recipes.search.test.ts` — POST /recipes/search happy path + pantryOnly:true manifest wiring + 50-item cap
- [ ] `packages/server/src/services/__tests__/recipeDiscovery.test.ts` — extend with `buildDiscoveryPrompt(pantryManifest)` PANTRY CONSTRAINT assertion
- [ ] `apps/mobile/.maestro/27-something-new-search.yaml` — full happy-path UAT flow (search → results → preview → Remix → save)
- [ ] Rebase `apps/mobile/.maestro/20-kitchen-segment-toggle.yaml:77` — selector swap Suggestions → Something New

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pantry manifest prompt quality | P17-04 | AI output correctness is subjective | UAT: real pantry, search "quick weeknight", verify returned recipes are actually feasible with items on hand |
| Search feel at 3G latency | P17-03 | Throttle-dependent; skeleton vs. spinner is taste | UAT: Network Link Conditioner "3G" profile, run search flow, confirm loading state doesn't feel stuck |
| Recent-query chip horizontal scroll on small devices | P17-02 | iOS-only gesture feel | Physical iPhone UAT — swipe chips sideways; verify no vertical scroll interference |
| Sparkles FAB disposition looks natural (not just absent) | P17-06 | Subjective empty-space aesthetic | Screenshot before/after comparison against design reference |

---

## Known Flakes / Exclusions

- Maestro flow 22 (dirty-form-guard) — iOS Alert interaction is inherently flaky; not a Phase 17 gate
- Flows 20, 24 occasional dev-client early death — rerun flow if under 15s

---

## Dimension 8 Checklist (Nyquist)

- [ ] Every functional requirement maps to ≥1 automated test command
- [ ] Every `must_have` in PLAN files traces back to a test in the map above
- [ ] Wave 0 tests are stubbed before production code is written
- [ ] Full suite latency ≤ 15 minutes end-to-end
- [ ] Manual-only verifications are explicitly marked, not hidden

---

*Validation strategy derived from 17-RESEARCH.md § Validation Architecture*
