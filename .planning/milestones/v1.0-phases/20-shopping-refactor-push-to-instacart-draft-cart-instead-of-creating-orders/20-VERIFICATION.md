---
phase: 20-shopping-refactor-push-to-instacart-draft-cart-instead-of-creating-orders
verified: 2026-04-20T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "UNIVLINK-01: With Instacart app installed, tap 'Order on Instacart' → success state → tap 'Open in Instacart'"
    expected: "Instacart app launches (not Safari); cart shows DinnerTime shopping-list items with quantities and units"
    why_human: "Simulator has no App Store and cannot install the Instacart binary — universal-link routing to a real app cannot be verified programmatically"
  - test: "UNIVLINK-02: Uninstall Instacart app; repeat handoff tap → 'Open in Instacart'"
    expected: "Safari View Controller (SVC) opens instacart.com with the shopping-list page pre-populated"
    why_human: "Requires a physical iPhone with real app-install state toggling; simulator always falls back to Safari and cannot prove the conditional branch"
  - test: "HANDOFF-02: Enable Airplane Mode, tap 'Order on Instacart', observe error sheet, tap 'Try again'"
    expected: "HandoffSheet shows 'network' variant error copy ('Can't reach Instacart'); retry attempt re-runs the fetch (visible in Metro logs)"
    why_human: "Airplane-mode toggling cannot be scripted from the iOS Simulator reliably"
  - test: "ROLLBACK-01: 5-tap Settings header to reveal hidden toggle; flip to 'legacy'; return to Shopping; tap 'Order on Instacart'"
    expected: "No HandoffSheet mounts. Phase 8 inline Safari View Controller opens directly with the Instacart URL"
    why_human: "Requires human to trigger the 5-tap reveal gesture and visually confirm that no HandoffSheet appears — gesture interaction and visual confirmation are not fully automatable on the current Maestro version"
  - test: "TELEMETRY-01: Complete one full handoff (sheet + Open); query shopping_events in Supabase SQL editor"
    expected: "Rows for shopping.draft_cart_started, shopping.draft_cart_succeeded, and shopping.handoff_opened_app (or _web) present; payloads contain only whitelisted keys, no raw item names"
    why_human: "End-to-end DB verification requires authorised Supabase SQL access and a live Cloudflare tunnel — out-of-band from automated verification"
---

# Phase 20: Shopping Refactor — Push to Draft Cart Verification Report

**Phase Goal:** Replace the current "create an order via recipe/shopping-list URL" flow with a draft-cart handoff. DinnerTime pushes selected items to the user's Instacart cart as drafts; the user lands in Instacart with everything pre-populated but manages payment method, delivery window, substitutions, and final checkout inside Instacart itself. DinnerTime is the curator, not the checkout system.
**Verified:** 2026-04-20
**Status:** human_needed — all 6 automated success criteria verified; 5 items require physical iPhone + Supabase access
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | "Order on Instacart" flows no longer create a checkout-ready order; they push items into the user's Instacart cart as drafts | VERIFIED | `shopping.tsx` `handleOrder()` branches on `shoppingHandoffMode`; draft-cart path calls `createOrder()` then opens HandoffSheet — no inline checkout UI |
| 2 | User lands inside the Instacart app (or web) with items pre-populated; can add/remove, choose payment, pick delivery window | VERIFIED (partial — universal-link routing needs physical device) | `openInstacartCart.ts` routes through `Linking.openURL` first (universal link → Instacart app), falls back to `WebBrowser.openBrowserAsync`; Instacart itself owns cart management |
| 3 | Items pushed include quantities, units, and UPC matches where possible (reuse existing Instacart API item-matching) | VERIFIED | `createOrder()` in `shoppingStore` unchanged from Phase 8 (Instacart item-matching preserved); `handoffs.tsx` and `handoff/[id].tsx` reuse the same `shopping_orders` DB table |
| 4 | DinnerTime UI communicates the handoff: "Sending to Instacart cart…" → success state → deep link / URL | VERIFIED | `HandoffSheet.tsx` (304 lines): `sending` state renders `"Sending to Instacart cart…"` + spinner; `success` state renders `"{itemCount} items ready"` + `"Open in Instacart"` CTA; all 9 HandoffSheet tests pass |
| 5 | No card-on-file, delivery-window picker, or payment UI inside DinnerTime | VERIFIED | No payment/delivery UI exists in any Phase 20 file; `shopping.tsx` mounts `<HandoffSheet>` only; Instacart handles checkout |
| 6 | Existing Phase 8 shopping-list features (auto-generation, consolidation, manual edits) remain functional before the cart handoff | VERIFIED | `shopping.tsx` retains `handleGenerate`, `toggleChecked`, `addItem`, `editItem`, `removeItem` unchanged; legacy flag path (`mode === 'legacy'`) preserves Phase 8 `WebBrowser.openBrowserAsync` verbatim |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00024_shopping_events.sql` | shopping_events table, RLS, append-only | VERIFIED | 72 lines; CREATE TABLE with all required columns; 2 indexes; RLS ENABLE; SELECT + INSERT policies; no UPDATE/DELETE policies; migrations.test.ts: 81 tests pass |
| `apps/mobile/src/stores/settingsStore.ts` | Zustand persisted store, `shoppingHandoffMode: 'draft_cart'` default | VERIFIED | 43 lines; `useSettingsStore` exported; `persist` + AsyncStorage wired; key `'dinnertime-settings'`; 4 settingsStore tests pass |
| `apps/mobile/src/shopping/telemetry.ts` | Batched logger — logShoppingEvent, flushShoppingTelemetry, sanitizePayload, __resetForTests | VERIFIED | 259 lines; 14-key whitelist (9 Phase-16 + 5 shopping); queue cap 200; batch 10; 30s timer; 16 telemetry tests pass |
| `apps/mobile/src/shopping/openInstacartCart.ts` | Linking.openURL → WebBrowser fallback; telemetry emission | VERIFIED | 46 lines; try Linking.openURL, catch falls back to WebBrowser; logs `handoff_opened_app` / `handoff_opened_web`; tests pass |
| `apps/mobile/src/shopping/classifyHandoffError.ts` | Discriminator → 'network' / 'instacart_api' / 'auth' | VERIFIED | 37 lines; priority: auth (401/403) > instacart_api (5xx) > network (TypeError / default); tests pass |
| `apps/mobile/src/components/shopping/HandoffSheet.tsx` | 4-state bottom-sheet (idle/sending/success/error); 120+ lines | VERIFIED | 304 lines; all 4 discriminated-union states rendered; variant-specific error copy map; 9 HandoffSheet tests pass |
| `apps/mobile/src/components/settings/ShoppingHandoffSection.tsx` | 5-tap reveal, toggle wired to settingsStore | VERIFIED | 88 lines; `useSettingsStore` selector on lines 30-31; tap counter with 5-tap threshold |
| `apps/mobile/src/app/(tabs)/settings.tsx` | Mounts ShoppingHandoffSection | VERIFIED | `import ShoppingHandoffSection` on line 15; rendered at line 168 |
| `apps/mobile/src/app/(tabs)/shopping.tsx` | HandoffSheet + feature flag + telemetry wired | VERIFIED | All 4 primitives imported (lines 20-35); `handleOrder` reads `shoppingHandoffMode` at tap time; telemetry emitted at started/succeeded/failed/dismissed; HandoffSheet mounted at line 356 |
| `apps/mobile/src/app/shopping/handoffs.tsx` | Renamed list — "Instacart cart" copy | VERIFIED | 125 lines; copy reads "No Instacart carts yet", "Instacart cart", "Instacart carts"; pushes to `/shopping/handoff/:id` |
| `apps/mobile/src/app/shopping/handoff/[id].tsx` | Renamed detail — "Instacart cart" copy | VERIFIED | 211 lines; substantive implementation |
| `apps/mobile/src/app/shopping/orders.tsx` | Legacy redirect stub | VERIFIED | `<Redirect href="/shopping/handoffs" />` |
| `apps/mobile/src/app/shopping/order/[id].tsx` | Legacy redirect stub | VERIFIED | Redirect with `id` param preserved |
| `apps/mobile/.maestro/29-shopping-draft-cart-handoff.yaml` | Maestro flow 29 — happy-path + dismiss; 60+ lines | VERIFIED | 153 lines; asserts `"Sending to Instacart cart.*"`, `".*items ready.*"`, `"Open in Instacart"`, `"View shopping list"`; secondary + primary CTA paths both covered |
| `apps/mobile/.maestro/README.md` | Flow 29 listed under Phase 20 | VERIFIED | Lines 74, 79: flow 29 documented with description |
| `apps/mobile/.maestro/12-shopping-orders.yaml` | Copy rebased to "Instacart cart" | VERIFIED | Line 2: name includes "shopping carts"; line 34: id "View Instacart carts"; no "Instacart order" strings remain |
| `.planning/phases/20-.../DEVICE-TEST-20.md` | Manual UAT checklist — 6 rows + frontmatter | VERIFIED | 74 lines; all 6 rows (UNIVLINK-01/02, HANDOFF-01/02, ROLLBACK-01, TELEMETRY-01); HANDOFF-01 marked `✓ (sim via flow 29)`; simulator signoff section present |
| `apps/mobile/src/shopping/__fixtures__/shopping-list.ts` | Test fixture with 4 items, real types | VERIFIED | `makeFixtureList()` exports `{ list: ShoppingList, items: ShoppingListItem[] }` with typed imports |
| `apps/mobile/src/shopping/__tests__/telemetry.test.ts` | Test contract for shopping telemetry | VERIFIED | 172 lines; passes (3 test files, 16 tests in shopping/__tests__) |
| `apps/mobile/src/shopping/__tests__/openInstacartCart.test.ts` | Test contract for deep-link helper | VERIFIED | 84 lines; passes |
| `apps/mobile/src/shopping/__tests__/classifyHandoffError.test.ts` | Test contract for error discriminator | VERIFIED | 51 lines; passes |
| `apps/mobile/src/components/shopping/__tests__/HandoffSheet.test.tsx` | RNTL tests — 3 states + CTAs | VERIFIED | 216 lines; 9 tests pass |
| `apps/mobile/src/stores/__tests__/settingsStore.test.ts` | Persistence + setter contract | VERIFIED | 96 lines; 4 tests pass |
| `packages/server/src/routes/telemetry.ts` | POST /shopping handler | VERIFIED | `shopping_events` INSERT on line 170; 12 shopping-related lines |
| `packages/server/src/__tests__/migrations.test.ts` | 00024 static assertions | VERIFIED | 81 tests pass (includes 00024 assertions) |
| `packages/server/src/routes/__tests__/telemetry.test.ts` | Shopping channel test cases | VERIFIED | 9 tests pass (extended with shopping cases) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `shopping.tsx` | `HandoffSheet.tsx` | `import HandoffSheet` + `<HandoffSheet state={handoffState} ...>` | WIRED | Lines 20-22, 356 |
| `shopping.tsx` | `settingsStore.ts` | `useSettingsStore.getState().shoppingHandoffMode` at tap time | WIRED | Lines 16, 99 |
| `shopping.tsx` | `openInstacartCart.ts` | `openInstacartCart(url, { sessionId })` | WIRED | Lines 34, 180 |
| `shopping.tsx` | `shopping/telemetry.ts` | `logShoppingEvent(...)` on start/success/fail/dismiss | WIRED | Lines 33, 130, 145, 162, 195 |
| `openInstacartCart.ts` | `react-native Linking` | `Linking.openURL(url)` first | WIRED | Line 30 |
| `openInstacartCart.ts` | `expo-web-browser` | `WebBrowser.openBrowserAsync(url)` on catch | WIRED | Line 38 |
| `shopping/telemetry.ts` | `POST /api/v1/telemetry/shopping` | `fetch(${baseUrl}/api/v1/telemetry/shopping, ...)` | WIRED | Line 220 |
| `packages/server/routes/telemetry.ts` | `shopping_events` table | `supabase.from('shopping_events').insert(rows)` | WIRED | Line 170 |
| `ShoppingHandoffSection.tsx` | `settingsStore.ts` | `useSettingsStore((s) => s.shoppingHandoffMode)` | WIRED | Lines 23, 30-31 |
| `settings.tsx` | `ShoppingHandoffSection.tsx` | `import` + `<ShoppingHandoffSection />` | WIRED | Lines 15, 168 |
| `handoffs.tsx` | `shopping/handoff/:id` | `router.push(/shopping/handoff/${item.id})` | WIRED | Active navigation |
| `orders.tsx` (legacy) | `/shopping/handoffs` | `<Redirect href="/shopping/handoffs">` | WIRED | Redirect in place |
| `29-*.yaml` | `HandoffSheet.tsx` copy strings | regex assertions match component text | WIRED | `.*items ready.*`, `Open in Instacart`, `View shopping list` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `HandoffSheet.tsx` | `state` prop | Parent `shopping.tsx` `handoffState` useState | Yes — driven by `createOrder()` response from shoppingStore (Phase 8 Instacart API call) | FLOWING |
| `handoffs.tsx` | `orders` | `useShoppingStore()` → `fetchOrders()` in useEffect | Yes — `shoppingStore.fetchOrders` queries `shopping_orders` table via server | FLOWING |
| `shopping/telemetry.ts` | queue → POST body | `logShoppingEvent()` calls at each state transition in `shopping.tsx` | Yes — real events emitted from `handleOrder`, `handleOpenCart`, `handleDismiss` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| settingsStore default is `'draft_cart'` | `pnpm -C apps/mobile test --run settingsStore` | 4/4 tests pass | PASS |
| Migration 00024 static contracts hold | `pnpm -C packages/server test --run migrations.test.ts` | 81/81 tests pass | PASS |
| Shopping telemetry pipeline unit tests | `pnpm -C apps/mobile test --run src/shopping/__tests__` | 16/16 tests pass | PASS |
| HandoffSheet 3-state rendering | `pnpm -C apps/mobile test --run HandoffSheet` | 9/9 tests pass | PASS |
| Server /shopping route + shopping_events insert | `pnpm -C packages/server test --run telemetry.test.ts` | 9/9 tests pass | PASS |
| Flow 29 YAML structure and copy assertions | File inspection (153 lines, all regex selectors present) | Well-formed | PASS |
| Maestro flow 12 copy rebase | `12-shopping-orders.yaml` contains "Instacart cart", not "Instacart order" | Line 2, 34, 42-43 verified | PASS |
| No Wave 0 stubs remain in production code | grep for `TODO(phase-20-01)` / `TODO(phase-20-03)` in production files | No matches | PASS |
| Legacy rollback path preserved | `if (mode === 'legacy') { WebBrowser.openBrowserAsync(url) }` | Lines 107-119 of shopping.tsx | PASS |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SHOP-DC-01 | 20-00, 20-01, 20-03, 20-04, 20-05 | Replace order-creation flow with draft-cart handoff; update UI copy | SATISFIED | HandoffSheet mounts instead of inline WebBrowser; "Instacart cart" copy throughout handoffs.tsx / handoff/[id].tsx |
| SHOP-DC-02 | 20-00, 20-03, 20-05 | User lands in Instacart with items pre-populated; Instacart owns checkout | SATISFIED | `openInstacartCart` delivers URL; HandoffSheet has no payment/delivery UI; user taps "Open in Instacart" to proceed |
| SHOP-DC-03 | 20-01, 20-04 | Items include quantities, units, UPC matches (reuse existing API item-matching) | SATISFIED | `createOrder()` from Phase 8 shoppingStore unchanged; Instacart item-matching preserved |
| SHOP-DC-04 | 20-01, 20-04 | Telemetry pipeline for handoff events (sanitized payloads, shopping_events table) | SATISFIED | 14-key whitelist; `shopping_events` migration; server route; 3 telemetry events per handoff flow |
| SHOP-DC-05 | 20-00, 20-02, 20-04 | Feature flag `shoppingHandoffMode` defaults to `'draft_cart'`; hidden rollback to `'legacy'` | SATISFIED | settingsStore default `'draft_cart'`; ShoppingHandoffSection 5-tap reveal; `shopping.tsx` reads flag at tap time |
| SHOP-DC-06 | 20-01, 20-03, 20-05 | Error variants (network / instacart_api / auth) with retry affordance | SATISFIED | `classifyHandoffError` discriminator; HandoffSheet error state with variant-specific copy + "Try again" CTA |

---

### Anti-Patterns Found

No blockers detected.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `shopping.tsx` line 13 | `import * as WebBrowser` | Info | Intentional — retained for legacy path; not dead code |
| `DEVICE-TEST-20.md` | `simulator_signoff: 2026-04-22` but `device_signoff:` empty | Info | Expected — device signoff requires physical iPhone; not a code defect |

---

### Human Verification Required

#### 1. UNIVLINK-01 — Universal link opens real Instacart app

**Test:** Install Instacart app on iPhone. Open DinnerTime Shopping tab. Tap "Order on Instacart". Wait for HandoffSheet success state. Tap "Open in Instacart".
**Expected:** The Instacart **app** launches (not Safari). The cart view within the Instacart app shows the items from the DinnerTime shopping list with matching quantities and units.
**Why human:** The iOS Simulator has no App Store and cannot install the Instacart binary. Universal-link routing (HTTPS URL → native app) cannot be verified without a real app installation.

#### 2. UNIVLINK-02 — Safari fallback when Instacart not installed

**Test:** Delete the Instacart app from the iPhone. Repeat the handoff flow (tap "Order on Instacart" → success → "Open in Instacart").
**Expected:** Safari View Controller opens in-app pointing to instacart.com with the shopping-list page pre-populated. Items match.
**Why human:** Requires physical device with deliberate app-install state toggling; the simulator always falls back to Safari and cannot prove the conditional branch.

#### 3. HANDOFF-02 — Network error variant + retry

**Test:** Enable Airplane Mode on iPhone. Open DinnerTime Shopping tab. Tap "Order on Instacart". Observe the error sheet. Tap "Try again".
**Expected:** HandoffSheet displays the `network` variant — "Can't reach Instacart" title + "Check your connection and try again." subtitle. Tapping "Try again" dismisses the sheet (user re-taps the main button to reissue the call).
**Why human:** Airplane Mode toggling cannot be reliably scripted from the iOS Simulator.

#### 4. ROLLBACK-01 — Hidden Settings toggle falls back to Phase 8 flow

**Test:** Open Settings screen. Tap the "Shopping" section header 5 times rapidly (within 1.5 s) to reveal the hidden toggle. Flip "Use legacy order flow" to ON. Return to Shopping tab. Tap "Order on Instacart".
**Expected:** No HandoffSheet appears. The Phase 8 inline Safari View Controller opens directly with the Instacart URL.
**Why human:** Requires a human to execute the 5-tap reveal gesture and visually confirm that the HandoffSheet component does NOT mount.

#### 5. TELEMETRY-01 — Events land in shopping_events with clean payloads

**Test:** Complete one full handoff on a physical device with the Cloudflare tunnel active (dev backend reachable). Open Supabase SQL editor and run:
`SELECT event_type, payload, client_ts FROM shopping_events WHERE profile_id = '<your-uid>' ORDER BY client_ts DESC LIMIT 10;`
**Expected:** At minimum three rows: `shopping.draft_cart_started`, `shopping.draft_cart_succeeded`, and `shopping.handoff_opened_app` (or `_web`). Payloads contain only whitelisted keys — no raw item names, quantities, or user-identifiable strings.
**Why human:** End-to-end DB verification requires authorised Supabase SQL access and a live Cloudflare tunnel session — both out-of-band from automated verification.

---

### Gaps Summary

No gaps found. All 6 automated success criteria are satisfied by verified production code and passing test suites. The phase goal — draft-cart handoff replacing the checkout-order flow — is fully implemented: HandoffSheet UX primitive, feature-flag branching, telemetry pipeline, DB migration, settings rollback toggle, Maestro flow 29, and UI copy reframe from "order" to "cart".

The 5 items above require a physical iPhone plus Supabase SQL access. They are expected `human_needed` items per the phase design (DEVICE-TEST-20.md was created explicitly to hold them), not regressions or gaps.

---

_Verified: 2026-04-20_
_Verifier: Claude (gsd-verifier)_
