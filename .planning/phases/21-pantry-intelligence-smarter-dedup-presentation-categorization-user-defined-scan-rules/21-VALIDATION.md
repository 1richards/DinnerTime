---
phase: 21
slug: pantry-intelligence-smarter-dedup-presentation-categorization-user-defined-scan-rules
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 21 — Validation Strategy

> Full test matrix lives in `21-RESEARCH.md § Validation Architecture`. Phase 21 re-scoped post-24a (fuzzy dedup dropped).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (server + mobile) |
| **Config file** | Vitest defaults; tests in `__tests__/` next to code |
| **Quick run command** | `pnpm --filter @dinnertime/server test -- --run` |
| **Full suite command** | `pnpm test` + `npx tsc --noEmit -p packages/server` + `npx tsc --noEmit -p apps/mobile` |
| **UAT command** | `apps/mobile/.maestro/scripts/uat.sh smoke` |
| **Estimated runtime** | Server < 25s; mobile < 20s; Maestro smoke ~5 min |

---

## Sampling Rate

- **After every task commit:** scoped `pnpm test --run <path>` + `npx tsc --noEmit -p packages/server`
- **After every plan wave:** full server + mobile vitest + both tsc + Maestro smoke if mobile touched
- **Before `/gsd:verify-work`:** full suite green + Maestro smoke green
- **Max feedback latency:** < 30s per commit

---

## Per-Task Verification Map

| Behavior | Test Type | Automated Command | Wave |
|----------|-----------|-------------------|------|
| user_staples + user_location_rules + suggested_rules + canonical_scan_counts tables exist w/ RLS | migration | `pnpm test --run tests/migrations.test.ts` | 1 |
| ruleEvaluator applies location-mapping AFTER canonical resolution | unit | `pnpm test --run src/services/__tests__/ruleEvaluator.test.ts` | 1 |
| ruleEvaluator precedence ASC, first-match-wins | unit | same | 1 |
| suggestionAggregator writes rows after N=2 overrides in 30 days | unit | `pnpm test --run src/services/__tests__/suggestionAggregator.test.ts` | 1 |
| canonicalPromoter RPC promotes candidate→active at counter ≥ 5 | integration | `pnpm test --run src/services/__tests__/canonicalPromoter.test.ts` | 1 |
| Name-mapping rule writes to ingredient_aliases source='user_rule' | unit | route test | 2 |
| Location-mapping rule writes to user_location_rules | unit | route test | 2 |
| Staples auto-accept at confidence ≥ 0.3 | unit | `pnpm test --run src/services/__tests__/pantry.test.ts` | 2 |
| /staples CRUD + /rules CRUD + /suggestions GET routes | integration | `pnpm test --run src/routes/__tests__/pantry.test.ts` | 2 |
| 30-day preview queries scan_events with LIMIT | integration | same route test | 2 |
| Aggregator fires on scan-confirm fire-and-forget | integration | route test — void pattern | 2 |
| ItemRow `size="compact"` renders 48pt | snapshot | `pnpm test --run apps/mobile/src/components/ui/__tests__/ItemRow.test.tsx` | 3 |
| PantryItemCard applies dashed-border when confidence < 0.5 | snapshot | `pnpm test --run apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx` | 3 |
| Pantry tab 4-way grouping toggle switches view | snapshot | `pnpm test --run apps/mobile/src/app/(tabs)/__tests__/pantry.test.tsx` | 3 |
| Settings pantry-rules route renders list + add + drag-reorder | smoke | `pnpm test --run apps/mobile/src/app/settings/__tests__/pantry-rules.test.tsx` | 3 |
| Settings staples route renders list + add | smoke | `pnpm test --run apps/mobile/src/app/settings/__tests__/staples.test.tsx` | 3 |
| Maestro smoke after pantry-tab + Settings changes | Maestro | `apps/mobile/.maestro/scripts/uat.sh smoke` | 3 |

---

## Wave 0 Requirements

- [ ] `packages/server/src/services/__tests__/ruleEvaluator.test.ts` (new)
- [ ] `packages/server/src/services/__tests__/suggestionAggregator.test.ts` (new)
- [ ] `packages/server/src/services/__tests__/canonicalPromoter.test.ts` (new)
- [ ] `packages/server/src/__tests__/migrations.test.ts` (extend for 00016-00018 + RPC)
- [ ] `packages/server/src/services/__tests__/pantry.test.ts` (extend — staples auto-accept branch)
- [ ] `packages/server/src/routes/__tests__/pantry.test.ts` (extend — 3 new routes + aggregator-on-confirm + 30-day preview)
- [ ] `apps/mobile/src/components/ui/__tests__/ItemRow.test.tsx` (extend for compact variant)
- [ ] `apps/mobile/src/components/pantry/__tests__/PantryItemCard.test.tsx` (extend for stale dashed-border)
- [ ] `apps/mobile/src/app/(tabs)/__tests__/pantry.test.tsx` (new — grouping toggle + StickySearchPill + filter chips)
- [ ] `apps/mobile/src/app/settings/__tests__/pantry-rules.test.tsx` (new)
- [ ] `apps/mobile/src/app/settings/__tests__/staples.test.tsx` (new)
- [ ] `draggable-flatlist` RN 0.83 New Architecture smoke check (Wave 0 gate per research Open Question 2)
- [ ] Maestro smoke re-run after all mobile changes

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| Drag-to-reorder rule list feels natural on iOS sim | Gesture feel | Human UAT — drag rule, verify order persists |
| 4-way grouping toggle switches feel fast + stable | Subjective | Human UAT — rapid-switch modes, no visual jank |
| Stale dashed-border reads "uncertain" not "broken" | Subjective visual language | Human UAT on physical iPhone with real stale data |
| Staples auto-accept at 0.3 feels natural (not aggressive) | Requires real varied scans | Human UAT — scan known staple at low confidence, verify skip |
| 30-day preview panel loads fast + is tappable | UX feel | Human UAT — create rule, view preview, tap item |
| Suggestions section shows up after 2 repeats | Requires real override activity | Human UAT — do 2 overrides of same canonical, verify suggestion appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify commands or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive implementation tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 new test files + 6 extensions + Maestro smoke)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per commit
- [ ] `nyquist_compliant: true` after Wave 0 lands

**Approval:** pending
