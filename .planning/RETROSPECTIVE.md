# DinnerTime — Project Retrospectives

## Milestone: v1.0 — Private Beta Launch Ready

**Shipped:** 2026-04-22
**Scope:** 25 phases, 122 plans, 269 tasks

### What Was Built

Full-stack iOS meal planning app: Expo SDK 55 mobile app + Hono/Node.js backend + Supabase.
Core loop: snap pantry photos → AI identifies ingredients → dinner suggestions → weekly plan → shopping list → Instacart handoff → voice cooking mode. Supporting layers: canonical ingredient data model (366 seeds + 1587 aliases), hybrid Anthropic/Gemini AI client, design system (terracotta/cream tokens, SF Symbols, 5-variant Button), Maestro UAT suite (38 flows), Sentry observability, biometric auth, in-app feedback pipeline, and TestFlight/Fly.io launch infrastructure.

### What Worked

**Multi-phase autonomous execution.** Long chains of dependent phases executed without human checkpoints between plans. TDD-first (Wave 0 red stubs before production code) consistently caught integration regressions before they compounded.

**Nyquist Wave 0 pattern.** Shipping red test stubs in plan -00 before any Wave 1 production code meant every subsequent plan had a concrete pass/fail signal. Phases 16, 17, 20, 22, 23 all benefited — no "did we build the right thing?" drift.

**Stub-first external integrations.** Instacart and Maestro flows used env-gated stubs that let server and mobile work proceed in parallel before API approval or simulator setup was confirmed.

### What Was Inefficient

**iPhone dev-client rebuild forgotten in Phase 23.** Native modules (expo-local-authentication) required a full EAS dev-client rebuild, but the plan assumed the existing build would suffice. Caused a loop when the biometric bridge wasn't available on the already-installed app. Lesson: any phase installing a new native module should include "trigger EAS dev-client build" as an explicit Wave 0 task.

**Audit item noise in MILESTONES.md.** The CLI's accomplishment list included raw plan-internal fragments ("RED:", "One-liner:", "Server (2 files):") that leaked from plan summaries. Future milestone archives should strip or clean these before commit.

### Patterns Worth Keeping

- **Lazy-load native modules** — wrap in try/catch with graceful degrade; keeps server-rendered tests fast and simulator flows safe.
- **Wave-0 scaffolding before any feature code** — the Nyquist pattern pays off every time; skip it and the phase invariably ships with ambiguous coverage.
- **Pure-function helpers before integration** — units.ts, canonicalResolver, ruleEvaluator, monthHelpers all proved out independently before being wired into routes or stores.

### Lessons

1. Test native bridges at install time, not at integration time. Add `EAS_DEV_CLIENT_REBUILD_REQUIRED: true` to any plan that adds a native config plugin.
2. Keep plan accomplishment strings to one sentence; multi-sentence plans produce noisy archive artifacts.
3. Physical iPhone testing (Cloudflare tunnel) diverges from simulator behavior on SecureStore and camera quality — budget explicit DEVICE-TEST plans when these surfaces are touched.

### Cost

Approximately 30 executor agent spawns across 25 phases. Majority were Claude Opus for architecture decisions (Phases 1-11) and Sonnet for execution (Phases 12-25). Token spend was front-loaded in the data-model phases (24) and design-system phases (19).
