---
phase: 20
slug: shopping-refactor-push-to-instacart-draft-cart
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 20 — Validation Strategy

> Per-phase validation contract. Authoritative test-to-requirement mapping is in `20-RESEARCH.md` §Validation Architecture.
> This is a UX refactor (no API/service change); validation is lighter than Phase 16.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | vitest (mobile unit), jest (server unit — inherited), maestro (iOS UAT) |
| **Quick run command** | `cd apps/mobile && pnpm test --run src/shopping src/app/\\(tabs\\)/shopping src/stores` |
| **Full suite command** | `pnpm -r test --run && cd apps/mobile && bash .maestro/scripts/uat.sh smoke` |
| **Estimated runtime** | ~15s unit · ~45s Maestro smoke |

---

## Sampling Rate

- **After every task commit:** Run unit tests scoped to shopping.
- **After every plan wave:** Full suite.
- **Before `/gsd:verify-work`:** Full suite + Maestro flow 29 (shopping-draft-cart-handoff) green.
- **Max feedback latency:** 30s unit; 60s Maestro.

---

## Per-Task Verification Map

| Requirement | Test Type | Command / File | Wave | Dependency |
|-------------|-----------|----------------|------|-----------|
| SHOP-DC-01 (legacy order→draft-cart flow replaced) | unit | `pnpm test --run src/app/shopping/__tests__/handoffs.test.tsx` | W2 | W0 |
| SHOP-DC-02 (user lands in Instacart with pre-pop cart) | integration | `pnpm test --run src/app/shopping/__tests__/HandoffSheet.test.tsx` (mocks Linking.openURL) | W2 | W0 |
| SHOP-DC-03 (items include qty/unit/UPC when known) | unit — item payload | `pnpm test --run src/app/shopping/__tests__/itemPayload.test.ts` | W1 | W0 |
| SHOP-DC-04 (handoff UI communicates states) | unit — 3 states | `pnpm test --run src/components/shopping/__tests__/HandoffSheet.test.tsx` | W2 | W0 |
| SHOP-DC-05 (no checkout UI in DinnerTime) | lint — grep ban | `scripts/check-no-checkout-ui.sh` (greps for "card", "delivery window", "payment" in new code) | W3 | — |
| SHOP-DC-06 (Phase 8 features preserved) | regression | `pnpm test --run src/app/shopping src/stores src/shopping` (existing tests must stay green) | W1 | — |
| SHOP-DC-01..06 (UAT) | Maestro | `.maestro/29-shopping-draft-cart.yaml` | W3 | W2 |

---

## Wave 0 Requirements

- [ ] `apps/mobile/src/shopping/__fixtures__/shopping-list.ts` — test shopping-list fixture
- [ ] `apps/mobile/src/shopping/__tests__/telemetry.test.ts` — red stub
- [ ] `apps/mobile/src/components/shopping/__tests__/HandoffSheet.test.tsx` — red stub
- [ ] `apps/mobile/src/app/\\(tabs\\)/shopping/__tests__/handoffs.test.tsx` — red stub
- [ ] `packages/server/src/routes/__tests__/shopping-telemetry.test.ts` — red stub (or extend existing telemetry.test.ts)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Universal link opens Instacart app on physical iPhone (falls back to Safari if app uninstalled) | SHOP-DC-02 | Simulator can't install the real Instacart app | Physical iPhone: tap "Open Instacart" in success state; verify app launches with cart pre-populated |
| Items actually appear in Instacart cart as drafts (not orders) | SHOP-DC-01 | Requires Instacart API round-trip to a real user cart | Physical iPhone: complete handoff, verify items visible in Instacart app cart, confirm no payment/checkout fired |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Wave 0 red stubs turn green in Waves 1–3
- [ ] Maestro 29 passes on simulator
- [ ] Manual verifications complete on physical iPhone (user action)
- [ ] `nyquist_compliant: true` set after Wave 0 green

**Approval:** pending
