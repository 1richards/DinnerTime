# Post-v1 Execution Plan

**Created:** 2026-04-18
**Scope:** Phases 15-25 (11 phases remaining)
**Optimization goal:** Maximize autonomous execution time; concentrate user feedback into upfront sessions and UAT gates.

---

## Sequencing Logic

### Dependency graph (simplified)

```
15 ──→ 19 ──→ 23 ──→ 25
 └─→ 16
18 ──→ 24 ──→ 21 (reordered: 24 before 21 — identity dedup replaces fuzzy)
17 + 20 ──→ 22
16 independent
```

### Where user feedback has the highest leverage

| Leverage | Phases | Nature |
|----------|--------|--------|
| HIGH (shape the feel) | 15, 16, 17, 19, 20, 22, 25 | Opinionated UX decisions |
| LOW (mostly engineering) | 18, 21, 23 (minus UI), 24 | Performance/reliability |

**Strategy:** front-load all opinion-shaping input in concentrated discussion sessions, then run wide autonomous stretches.

---

## Upfront Discussion Sessions (~2 hours total)

| # | Session | Phases | Est. user time | Output |
|---|---------|--------|----------------|--------|
| 1 | Design direction | 15, 19 | 30 min | CONTEXT.md × 2 |
| 2 | Feature flows | 16, 17, 20, 22 | 60 min | CONTEXT.md × 4 |
| 3 | Platform & launch | 23, 25 | 30 min | CONTEXT.md × 2 |

Phases without a session (18, 21, 24) have clear enough scope from the ROADMAP phase description to skip to planning.

### Session 1 — Design direction

Topics:
- Reference apps (Spotify, Strava, DoorDash) — which aesthetic dimensions to borrow?
- Color palette, typography, spacing, iconography direction
- Empty/loading/error state philosophy
- Navigation consistency conventions (headers, back buttons, tab conventions)

### Session 2 — Feature flows

Topics:
- Something New (17): keyword search UX, result persistence model, remix-save flow
- Shopping Refactor (20): what "send to Instacart cart" looks like UX-side
- Plan Experience (22): week vs month view, day drill-down, skill-focus concept
- Cooking Mode (16): voice activation model, info layout, hands-free commands

### Session 3 — Platform & launch

Topics:
- Settings (23): which account-management features must ship in v1.1? Face ID opt-in flow. Error UX patterns.
- Launch (25): TestFlight vs unlisted vs public. App Store listing draft. Invite list.

---

## Autonomous Execution Blocks

### Block A — Design Foundation

| Phase | Title |
|-------|-------|
| 15 | UI Polish & Nav Consistency |
| 19 | Design Professionalization |

**Why these together:** 19 builds directly on 15's baseline. Together they establish the design system every subsequent phase inherits.

**Scope:** ~6 plans, ~25 atomic commits
**UAT Gate A:** Inspect the new design system rendered across every existing screen. Biggest risk: if this gate surfaces major design misses, it ripples into every subsequent block.

### Block B — Pantry/Vision Intelligence

| Phase | Title | Notes |
|-------|-------|-------|
| 18 | AI Auto-Location | Simpler, tighter scope — runs first |
| 24 | AI Vision & Data-Model Refactor | Deep infra; reordered BEFORE 21 |
| 21 | Pantry Intelligence | Scope refined: rules/staples/presentation only (fuzzy dedup dropped — replaced by 24's identity dedup) |

**Why 24 before 21:** Phase 24's canonical-ingredient identity dedup replaces Phase 21's planned fuzzy-string dedup. Running 24 first lets 21 focus on genuinely new work (rules, staples, presentation) instead of building throwaway fuzzy logic.

**Scope:** ~9 plans, ~40 atomic commits. Longest autonomous stretch — could run a full day.
**UAT Gate B:** Dogfood on real kitchen. Scan fridge + pantry + freezer. Import a receipt. Verify dedup, categorization, auto-location on live data.

### Block C — Feature Refactors

| Phase | Title |
|-------|-------|
| 17 | Something New (AI recipe exploration) |
| 20 | Shopping Refactor (push-to-cart) |
| 16 | Cooking Mode UX |
| 22 | Plan Experience Refactor (integrates 17 + 20) |

**Ordering within block:** 17 and 20 first (independent), then 16 (independent of above, grouped for coherence), then 22 (depends on 17 + 20).

**Scope:** ~12 plans, ~50 atomic commits
**UAT Gate C:** End-to-end flows. Browse recipes, generate plan, shop list, push to Instacart, cook with voice.

### Block D — Platform Readiness

| Phase | Title |
|-------|-------|
| 23 | Settings, Auth & Non-Functional Requirements |

**Scope:** ~4 plans, ~15 atomic commits
**UAT Gate D:** Settings screens (password/email/export/delete), auth lifecycle (Face ID, session refresh, forgot password), error handling, performance budgets.

### Block E — Launch

| Phase | Title |
|-------|-------|
| 25 | Private Beta Launch |

**Collaborative by nature — not a single autonomous stretch.**

Gates:
- Backend deployment (Fly.io/Railway) — autonomous setup, user approves
- TestFlight upload — autonomous
- App Store listing draft — user reviews
- Invite list confirmation — user decides
- First beta feedback round — user collects

**Scope:** ~3 plans, ~12 atomic commits + ongoing feedback loops

---

## Estimated Totals

| Block | Phases | Plans | Commits | User UAT time |
|-------|--------|-------|---------|--------------|
| A | 2 | ~6 | ~25 | 30 min |
| B | 3 | ~9 | ~40 | 60 min (real-data dogfooding) |
| C | 4 | ~12 | ~50 | 60 min (flow walkthroughs) |
| D | 1 | ~4 | ~15 | 30 min |
| E | 1 | ~3 | ~12 | 45 min (iterative launch prep) |
| **Total** | **11** | **~34** | **~142** | **~3.75 hours UAT + 2 hours upfront = ~6 hours total** |

**Autonomous execution estimate:** 30-40 hours. Ratio: ~1:6 user-to-autonomous.

---

## Risks

1. **Phase 24 before 21** — reorders numeric sequence. If user prefers original order, split 21's fuzzy dedup into a technical-debt note for 24.
2. **Block B breadth** — touches vision prompts, data model migration, canonical ingredient seeding. If Wave 0 surfaces unexpected issues, block stalls. Mitigation: add an early dogfood checkpoint mid-block if it runs long.
3. **Block C parallelization opportunity** — 16 is independent of 17/20/22 code-wise. Could shave time via multi-workspace parallel execution if user wants that complexity.
4. **Design system churn** — UAT Gate A is the highest-leverage gate. Major misses here cause rework in every subsequent block. Recommendation: invest extra time in Session 1.

---

## How we use this document

- **Before starting each block:** check here for sequencing rationale and scope
- **After each UAT gate:** update this doc with what was approved and what surfaced new work
- **When new phases emerge mid-execution:** add them to the relevant block or note as "post-execution plan" for a future refresh
- **Across sessions:** this doc persists so any Claude session can resume from here

---

*Review and update this plan whenever scope shifts materially.*
