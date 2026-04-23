---
phase: 24
slug: ai-vision-and-pantry-data-model-deep-refactor-scan-quality-item-creation-categorization-deduplication-quantity-extraction-canonical-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
scope_note: This VALIDATION covers Phase 24a (data-model + dedup, criteria 6-23). Phase 24b (vision quality, criteria 1-2, 4-5, 24-26) will get its own VALIDATION.md in a follow-up plan-phase invocation. Criterion #3 (multi-pass) is DESCOPED.
---

# Phase 24 — Validation Strategy

> Per-phase validation contract. This doc covers **24a only** (data-model + dedup). 24b (vision quality) is deferred to a separate plan-phase invocation.
> Full test matrix lives in `24a-RESEARCH.md § 14. Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.4 (server + mobile) |
| **Config file** | Vitest defaults; tests in `__tests__/` next to code |
| **Quick run command** | `pnpm --filter @dinnertime/server test -- --run` |
| **Full suite command** | `pnpm test` + `npx tsc --noEmit -p packages/server` + `npx tsc --noEmit -p apps/mobile` |
| **UAT command** | `apps/mobile/.maestro/scripts/uat.sh smoke` |
| **Estimated runtime** | Server < 20s; mobile < 15s; Maestro smoke ~5 min |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @dinnertime/server test -- --run` + `npx tsc --noEmit -p packages/server`
- **After every plan wave:** full server vitest + both tsc + mobile vitest + Maestro smoke when mobile touched
- **Before `/gsd:verify-work`:** full suite green + Maestro smoke green
- **Max feedback latency:** < 30s per commit

---

## Per-Task Verification Map (24a only)

| Req | Behavior | Test Type | Automated Command | Wave |
|-----|----------|-----------|-------------------|------|
| REQ-06 | canonical_ingredients table + unique canonical_name | migration | `pnpm --filter @dinnertime/server test -- --run tests/migrations.test.ts` | 1 |
| REQ-07 | canonicalResolver exact → alias → fuzzy → candidate | unit | `pnpm test --run src/services/__tests__/canonicalResolver.test.ts` | 1 |
| REQ-08 | Seed loads ~300 canonical rows on migration | integration | same migrations.test.ts — SELECT COUNT(*) assertion | 1 |
| REQ-09 | Unknown name creates candidate row | unit | canonicalResolver.test — `matchType === 'candidate_created'` | 1 |
| REQ-10 | canonical.category used (not item.category) | unit | pantry.test — reconcile reads canonical.category | 2 |
| REQ-11 | Per-user canonical_category_override | integration | pantry.test — insert override, verify merged read | 2 |
| REQ-12 | ~2000-3000 aliases loaded | integration | migrations.test.ts — COUNT assertion | 1 |
| REQ-13 | Dedup on (canonical_id, source_location) | unit | pantry.test — rescan same canonical+location merges | 2 |
| REQ-14 | Fuzzy fallback ONLY when exact miss | unit | canonicalResolver.test — ordering assertion | 1 |
| REQ-15 | All 4 scan flows converge at reconcileItems | integration | routes/__tests__/pantry.test.ts — spy at /confirm | 2 |
| REQ-16 | quantity JSONB `{value,unit,system}` on insert | unit | pantry.test — shape assertion | 2 |
| REQ-17 | units.ts conversions (tbsp↔tsp, oz↔lb, pieces) | unit | `pnpm test --run src/services/__tests__/units.test.ts` | 1 |
| REQ-18 | Quantity aggregation on compatible-unit re-scan | unit | pantry.test — sums value on rescan | 2 |
| REQ-19 | field_confidence propagates to scan_events | integration | routes test — POST /scan writes scan_events row | 2 |
| REQ-20 | pantry_items.canonical_ingredient_id nullable FK | migration | migrations.test.ts — schema assertion | 1 |
| REQ-21 | scan_events append-only + RLS | integration | migrations.test.ts — UPDATE/DELETE fail; SELECT filtered | 1 |
| REQ-22 | RLS on canonical_category_override + scan_events | integration | migrations.test.ts per-table | 1 |
| REQ-23 | Forward-only — legacy NULL canonical rows still work | integration | routes test — GET /pantry returns old + new rows | 2 |
| UI § 12 | Inline low-confidence treatment on ReviewItemRow | snapshot + visual | `pnpm test --run apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx` + Maestro smoke | 3 |

---

## Wave 0 Requirements

- [ ] `packages/server/src/services/__tests__/canonicalResolver.test.ts` (new)
- [ ] `packages/server/src/services/__tests__/units.test.ts` (new)
- [ ] `packages/server/tests/migrations.test.ts` (extend — REQ-06/08/12/20/21/22)
- [ ] `packages/server/src/services/__tests__/pantry.test.ts` (REWRITE dedup tests for REQ-13; extend REQ-10/11/16/18)
- [ ] `packages/server/src/routes/__tests__/pantry.test.ts` (extend — REQ-15/19/23)
- [ ] `apps/mobile/src/components/pantry/__tests__/ReviewItemRow.test.tsx` (extend — inline confidence snapshot)
- [ ] Maestro smoke re-run after mobile changes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Canonical resolution feels "right" on real kitchen scan | REQ-06/07/09 | Subjective + needs real iPhone photos | Human UAT — scan fridge, verify items land on canonicals not unknown_* |
| Dedup merges "chkn brst" + "chicken breast" + "organic chicken breast" | REQ-13 | Requires varied real scan inputs | Human UAT — scan same shelf from 3 angles with different labels visible |
| Quantity aggregation on re-scan feels natural | REQ-18 | Subjective gradient (when to merge vs flag incompatible) | Human UAT — scan same item twice with different units |
| Inline confidence dashed underline reads "uncertain, check me" not "broken" | UI § 12 | Subjective visual language | Human UAT — force-low-confidence scan, confirm affordance registers |

---

## Validation Sign-Off (24a)

- [ ] All 24a tasks have `<automated>` verify commands or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 new/extended test files + Maestro smoke)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per commit
- [ ] `nyquist_compliant: true` set after Wave 0 lands
- [ ] **24b VALIDATION.md** created in a follow-up plan-phase invocation (prompt files, eval harness, accuracy metric)

**Approval:** pending
