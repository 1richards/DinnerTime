---
phase: 18
slug: ai-auto-location-for-pantry-imports-remove-forced-fridge-pantry-freezer-choice
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 18 — Validation Strategy

> Per-phase validation contract. Full test matrix lives in `18-RESEARCH.md` `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.4 (mobile + server), Maestro 2.4.0 (iOS Simulator UAT) |
| **Config file** | `apps/mobile/vitest.config.ts`, `packages/server/vitest.config.ts` |
| **Quick run command** | `cd packages/server && pnpm test --run` + `cd apps/mobile && pnpm test --run` |
| **Full suite command** | same as quick — neither suite is long |
| **UAT command** | `apps/mobile/.maestro/scripts/uat.sh all` |
| **Estimated runtime** | Vitest < 15s total; Maestro ~15 min |

---

## Sampling Rate

- **After every task commit:** `pnpm test --run` scoped to the files touched (e.g., `pnpm test --run src/services/itemLocation.test.ts`)
- **After every wave merge:** full `pnpm test --run` in both `packages/server/` and `apps/mobile/`
- **Before `/gsd:verify-work`:** full Vitest green + Maestro smoke flows green on iOS Simulator
- **Max feedback latency:** < 30s per commit

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-* | 01 (migrations) | 1 | `item_attributes` JSONB column + `item_override_events` table exist w/ RLS | integration | `pnpm test --run src/db/migrations.test.ts` | ❌ W0 | ⬜ pending |
| 18-01-* | 01 (classifier) | 1 | Hybrid STATIC_MAP + Haiku fallback returns valid location for known/unknown items | unit | `pnpm test --run src/services/itemLocation.test.ts` | ❌ W0 | ⬜ pending |
| 18-02-* | 02 (vision tool schema) | 2 | `vision.ts` tool schema includes `source_location`; Claude response shapes per-item location | unit + integration | `pnpm test --run src/services/vision.test.ts` | ✅ (extend) | ⬜ pending |
| 18-02-* | 02 (receipt/Instacart) | 2 | `identifyReceiptItems.ts` adds per-item location; Instacart hardcode removed | unit + integration | `pnpm test --run src/services/identifyReceiptItems.test.ts` | ✅ (extend) | ⬜ pending |
| 18-02-* | 02 (dual-write) | 2 | `reconcileItems` writes both `source_location` column AND `item_attributes.source_location` | unit | `pnpm test --run src/services/pantry.test.ts` | ✅ (extend) | ⬜ pending |
| 18-02-* | 02 (override-events) | 2 | `POST /api/v1/pantry/override-events` validates, writes to table, RLS-gated | integration | `pnpm test --run src/routes/pantry.test.ts` | ✅ (extend) | ⬜ pending |
| 18-03-* | 03 (LocationChip) | 3 | LocationChip renders correct SF Symbol + label per value; tap opens sheet | unit | `pnpm test --run src/components/ui/LocationChip.test.tsx` | ❌ W0 | ⬜ pending |
| 18-03-* | 03 (ChoiceSheet) | 3 | LocationChoiceSheet renders 3 options, calls onChange on selection | unit | `pnpm test --run src/components/ui/LocationChoiceSheet.test.tsx` | ❌ W0 | ⬜ pending |
| 18-03-* | 03 (review integration) | 3 | ReviewItemRow shows LocationChip; override fires logOverrideEvent | unit | `pnpm test --run src/components/pantry/ReviewItemRow.test.tsx` | ❌ W0 | ⬜ pending |
| 18-03-* | 03 (LocationPicker removal) | 3 | LocationPicker not rendered on any scan entry (camera/batch/receipt/Instacart) | grep | `! grep -rn "LocationPicker" apps/mobile/src/app/scan/ apps/mobile/src/app/\(tabs\)` | ✅ (inline) | ⬜ pending |
| 18-03-* | 03 (pantryStore signature) | 3 | `startScan`/`startBatchScan`/`startScanReceipt`/`startScanInstacart` no longer require `location` param | typecheck | `cd apps/mobile && npx tsc --noEmit -p .` | — | ⬜ pending |
| 18-03-* | 03 (Maestro) | 3 | Flows 07, 16, 19 pass on iOS Simulator after LocationPicker removal | Maestro | `apps/mobile/.maestro/scripts/uat.sh smoke` | ✅ (comment updates) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/server/src/db/migrations/00009_item_attributes.sql` (new)
- [ ] `packages/server/src/db/migrations/00010_item_override_events.sql` (new)
- [ ] `packages/server/src/services/itemLocation.ts` (new — hybrid STATIC_MAP + Haiku fallback)
- [ ] `packages/server/src/services/itemLocation.test.ts` (new)
- [ ] `packages/server/src/db/migrations.test.ts` (new — asserts columns, RLS policies, CHECK constraints exist)
- [ ] `apps/mobile/src/components/ui/LocationChip.tsx` (new)
- [ ] `apps/mobile/src/components/ui/LocationChip.test.tsx` (new — pure prop-to-className test, no RNTL)
- [ ] `apps/mobile/src/components/ui/LocationChoiceSheet.tsx` (new)
- [ ] `apps/mobile/src/components/ui/LocationChoiceSheet.test.tsx` (new)
- [ ] `apps/mobile/src/lib/logOverrideEvent.ts` (new — thin authed fetch helper)
- [ ] Wave 0 test infra: ensure `packages/server/src/db/migrations.test.ts` can query a fresh Supabase schema (pattern already exists from prior phase migration tests)
- [ ] `apps/mobile/scripts/verify-no-location-picker-scan.sh` (optional — codifies the grep check above)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI classifications feel "right" on real kitchen scan | ROADMAP #1, #4 | Subjective + requires real iPhone photos | Human UAT on physical iPhone — scan fridge, pantry, freezer; verify > 90% of items land in correct location without override |
| Review chip bottom-sheet feels natural (not intrusive) | Phase 18 UX decisions | Gesture/interaction feel | Human UAT — tap chip, confirm sheet height + dismissal gesture |
| Camera flow without LocationPicker feels faster | ROADMAP #3 | Subjective | Human UAT — tap camera FAB, confirm zero extra taps before photo |
| Instacart import fan-out visible on review screen | ROADMAP #5 | Human eyeballs the distribution | Human UAT — import a diverse Instacart order, confirm items land in 2+ locations |
| Receipt fan-out for mixed grocery run | ROADMAP #5 | Subjective | Human UAT — scan a real receipt with dairy, frozen, shelf-stable items; confirm auto-distribution |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands or Wave 0 dependencies declared
- [ ] Sampling continuity: no 3 consecutive implementation tasks without automated verify
- [ ] Wave 0 covers all MISSING references (2 migrations + hybrid classifier + 2 mobile primitives + logOverrideEvent helper + 3 test files)
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 30s per commit
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending
