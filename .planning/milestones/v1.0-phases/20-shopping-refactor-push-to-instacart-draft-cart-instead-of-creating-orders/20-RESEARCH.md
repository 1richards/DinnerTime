# Phase 20: Shopping Refactor — Push to Draft Cart — Research

**Researched:** 2026-04-20
**Domain:** Instacart handoff UX + "draft cart" semantics
**Confidence:** HIGH on API ground truth, MEDIUM on UX treatment specifics

## Summary

The critical unknown is definitively resolved: **Instacart Developer Platform does NOT expose a direct "push to user cart" API.** As of 2026, the only partner mechanism is the `/idp/v1/products/products_link` endpoint (the same one Phase 8 already uses). There is no OAuth flow, no per-user cart endpoint, and Instacart FAQ explicitly states "directing users to a specific merchant is not supported." The `products_link_url` response IS the "cart handoff" — it deep-links into the Instacart app (or web when not installed), and when the user is logged in, landing on that page behaves as a pre-populated cart against their preferred retailer.

**This means Phase 20 is a UX refactor, not an API refactor.** The ROADMAP language "push to Instacart draft cart" describes the *user's perception* (DinnerTime hands them a ready-to-checkout cart, they finish inside Instacart) — which is exactly what the existing `products_link` already delivers. Phase 8's implementation is technically correct; it was framed and presented as "create an order" which muddies responsibility (DinnerTime looks like the merchant). Phase 20 should: (1) reframe copy and loading/success states as a handoff, (2) leverage Instacart's deep-linking so users land in the native app when possible, (3) stop storing "orders" as a DinnerTime-owned concept, (4) add shopping telemetry cloned from Phase 16's cooking pipeline, (5) gate the new flow behind a Zustand feature flag for rollback.

**Primary recommendation:** Keep the server-side `createShoppingListPage()` call unchanged. Replace `shopping_orders` semantics with `shopping_handoffs` (or keep the table + rename UX). Build a new `HandoffSheet` component (spinner → success check → "Open in Instacart" CTA with deep-link-first behavior via `Linking.canOpenURL` → `WebBrowser.openBrowserAsync` fallback). Add `shopping_events` telemetry by replicating `packages/server/src/routes/telemetry.ts` + `cooking_events` migration pattern verbatim. Wire a feature flag `shopping.use_draft_cart_handoff` (default true) in settings for rollback.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Instacart owns checkout.** No payment UI, no delivery-window picker, no substitution rules in DinnerTime. Ever.
- **Phase 8 shopping-list primitives preserved:** auto-generation from meal plan, consolidation, pantry subtraction, manual edits all UNTOUCHED. Only the terminal "Order" button changes.
- **Research-first on API:** Verify current endpoints before locking implementation (DONE below — no true draft-cart endpoint exists).
- **Reuse Phase 16 telemetry infrastructure:** `cooking_events` pattern → `shopping_events` table.
- **Reuse Phase 19 design tokens** for all new UI.
- **Feature-flag gated rollback** to Phase 8 behavior via hidden Settings toggle.
- **One batch per handoff** (entire shopping list, no partial pushes).
- **Instacart-only** (multi-retailer deferred).
- **All Instacart traffic through Hono backend** (no API key in mobile).

### Claude's Discretion
- Spinner/loading visual treatment (UI-SPEC decides final pixel layout).
- Error copy wording.
- Exact feature-flag key name and Settings placement.
- Whether to write new `shopping_events` table or fold into existing telemetry pipeline (decided below: new table).
- Deep-link-first vs WebBrowser-first preference (decided below: try deep link, fall back to in-app browser).
- Whether to keep `shopping_orders` table under a new name or migrate (decided below: KEEP table, rename in UI only — avoids destructive migration; rename `orders.tsx` → `handoffs.tsx` in mobile).

### Deferred Ideas (OUT OF SCOPE)
- Webhook / order-status integration (auto-mark pantry items "arrived").
- Multi-retailer (Amazon Fresh, Walmart).
- In-app pre-push cart editor (shopping list IS the editor).
- UPC auto-lookup via Claude vision (use Instacart's matching).
- Offline draft-cart queueing.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SHOP-DC-01 | "Order on Instacart" button reframed as draft-cart handoff (no DinnerTime checkout UI) | Button copy change + `HandoffSheet` replaces current `ActivityIndicator` + `WebBrowser.openBrowserAsync` inline flow. Server call unchanged. |
| SHOP-DC-02 | Apple-Pay-style handoff sheet (sending → success → "Open Instacart") | New `HandoffSheet.tsx` component. Three states: `sending` / `success` / `error`. Deep-link-first CTA. |
| SHOP-DC-03 | Deep-link into Instacart iOS app when installed, web fallback otherwise | `Linking.canOpenURL('instacart://')` gate → `Linking.openURL(products_link_url)` (Instacart advertises universal-link support on the returned HTTPS URL; iOS Universal Links handle app-vs-web routing automatically) → `WebBrowser.openBrowserAsync(products_link_url)` fallback for iOS where universal link isn't installed. |
| SHOP-DC-04 | Shopping telemetry (`shopping.draft_cart_started/succeeded/failed`) | New `apps/mobile/src/shopping/telemetry.ts` + `packages/server/src/routes/shopping-telemetry.ts` (or fold into telemetry.ts) + `shopping_events` migration — clones Phase 16's `cooking_events` schema 1:1. |
| SHOP-DC-05 | Feature flag gates new flow; Settings toggle reverts to Phase 8 inline behavior | Zustand `settingsStore.shoppingHandoffMode: 'draft_cart' \| 'legacy'` + hidden Settings row. Default `'draft_cart'`. |
| SHOP-DC-06 | Error states have specific retry affordances (network / API / auth) | `HandoffSheet` error variant reads from `shoppingStore.handoffError` (new discriminated-union: `network` / `instacart_api` / `auth`), maps each to copy + retry CTA. |

## Standard Stack

### Core (already in project — reuse)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | ~4.x | `/shopping` routes (unchanged) + new `/telemetry/shopping` route | Project standard |
| @supabase/supabase-js | ~2.101 | New `shopping_events` table + RLS | Project standard |
| Zustand | ~5.0 | `shoppingStore` (extend) + `settingsStore` feature flag | Project standard |
| expo-router | bundled | New `/shopping/handoffs` route replacing `/shopping/orders` (or alongside) | Project standard |
| NativeWind | ~4.x + Phase 19 tokens | HandoffSheet styling via `bg-brand` / `text-primary` semantic tokens | Phase 19 locked |
| `expo-symbols` via `SymbolIcon` | bundled | `checkmark.circle.fill` (success), `cart.badge.plus` (sending), `exclamationmark.triangle` (error) | Project standard |
| `expo-web-browser` | bundled | Fallback for web-only devices | Already used in Phase 8 shopping.tsx:90 |
| `react-native` `Linking` | built-in | Deep-link + `canOpenURL` check | Built-in; no install |
| `@anthropic-ai/sdk` | ~0.82 | N/A — no new AI calls | — |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | (server dep) | Schema-validate `/telemetry/shopping` POST body | Clone Phase 16 pattern exactly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate `shopping_events` table | Reuse `cooking_events` with event_type prefix | Table separation keeps query surfaces clean; migration is one file. Chose: new table, same schema. |
| Full-screen modal | Bottom-sheet handoff | Bottom-sheet matches Apple Pay metaphor mentioned in CONTEXT; full-screen is heavier. Chose: sheet. |
| `Linking.openURL(products_link_url)` only | `canOpenURL` probe then `openURL` | Instacart docs confirm universal-link support on the HTTPS URL — iOS routes to app if installed. `openURL` alone is sufficient for iOS; `canOpenURL('instacart://')` is belt-and-suspenders for showing a differentiated CTA label ("Open in Instacart app" vs "Open Instacart.com"). Chose: probe for CTA label only, actual open uses `openURL(products_link_url)`. |

**Installation:** No new packages required.

## Architecture Patterns

### Recommended File Layout (new + renamed files only)
```
apps/mobile/src/
├── components/shopping/
│   └── HandoffSheet.tsx            # NEW — Apple-Pay-style sheet
├── shopping/
│   └── telemetry.ts                # NEW — clone of cooking/telemetry.ts
├── stores/
│   ├── shoppingStore.ts            # EXTEND — handoffState, handoffError, feature-flag-aware createOrder
│   └── settingsStore.ts            # EXTEND (or CREATE) — shoppingHandoffMode flag
├── app/
│   ├── (tabs)/shopping.tsx         # MODIFY — replace inline await WebBrowser with HandoffSheet
│   └── shopping/
│       ├── handoffs.tsx            # RENAME orders.tsx → handoffs.tsx (UI copy only)
│       └── handoff/[id].tsx        # RENAME order/[id].tsx

packages/server/src/
├── routes/
│   └── telemetry.ts                # EXTEND — accept `name: 'shopping.*'` events (schema-light)
└── services/instacart.ts            # UNCHANGED — existing products_link call is correct

supabase/migrations/
└── 00024_shopping_events.sql       # NEW — clones 00020_cooking_events.sql schema
```

**Deliberate non-change:** `packages/server/src/services/instacart.ts`, `shopping_orders` DB table, `POST /api/v1/shopping/:id/order` server route all stay untouched. The refactor is mobile-side UX + new telemetry.

### Pattern 1: HandoffSheet (three-state discriminated union)

```typescript
// apps/mobile/src/components/shopping/HandoffSheet.tsx
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { logShoppingEvent } from '../../shopping/telemetry';

type HandoffState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success'; url: string; itemCount: number; appInstalled: boolean }
  | { kind: 'error'; variant: 'network' | 'instacart_api' | 'auth'; url?: string };

export function HandoffSheet({ state, onOpenCart, onRetry, onDismiss }) {
  // sending: spinner + "Sending to Instacart cart…"
  // success: SymbolIcon "checkmark.circle.fill" (size 56, tint brand)
  //          + "{itemCount} items ready" + primary CTA "Open in Instacart"
  //          + secondary "View shopping list"
  // error: SymbolIcon "exclamationmark.triangle" + variant-specific copy + retry CTA
}

// Open helper — deep link first, web fallback
export async function openInstacartCart(url: string) {
  // 1) Try native open; iOS universal links auto-route to app if installed
  const opened = await Linking.openURL(url).then(() => true).catch(() => false);
  if (opened) return;
  // 2) In-app browser fallback (Safari View Controller on iOS)
  await WebBrowser.openBrowserAsync(url);
}
```
**Source:** `Linking` behavior verified against RN 0.83 docs; Instacart docs confirm universal-link support on `products_link_url`.

### Pattern 2: Shopping Telemetry (clone of Phase 16)

```typescript
// apps/mobile/src/shopping/telemetry.ts — abridged
// COPY apps/mobile/src/cooking/telemetry.ts verbatim, then:
//   - rename CookingEventName → ShoppingEventName
//   - change event names to: 'shopping.draft_cart_started' |
//       'shopping.draft_cart_succeeded' | 'shopping.draft_cart_failed' |
//       'shopping.handoff_opened_app' | 'shopping.handoff_opened_web'
//   - POST to /api/v1/telemetry/shopping (NOT /cooking)
//   - sanitizePayload whitelist: ['item_count', 'list_id', 'order_id',
//       'error_code', 'ms', 'app_installed', 'variant']

// Server side: extend routes/telemetry.ts to add a second router mount
// or a single /telemetry/:channel route accepting ['cooking'|'shopping'].
// RESEARCH recommends: duplicate the router (routes/shopping-telemetry.ts)
// with its own zod schema + insert target table — mirrors project pattern
// of one-route-per-channel (see cooking.ts vs pantry.ts vs shopping.ts).
```

### Pattern 3: Feature Flag with Legacy Fallback

```typescript
// apps/mobile/src/stores/settingsStore.ts (extend or create)
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      shoppingHandoffMode: 'draft_cart' as 'draft_cart' | 'legacy',
      setShoppingHandoffMode: (mode) => set({ shoppingHandoffMode: mode }),
    }),
    { name: 'dinnertime-settings', storage: createJSONStorage(() => AsyncStorage) }
  )
);

// Consumer: apps/mobile/src/app/(tabs)/shopping.tsx handleOrder()
const mode = useSettingsStore((s) => s.shoppingHandoffMode);
if (mode === 'legacy') {
  const { url } = await createOrder();
  await WebBrowser.openBrowserAsync(url); // Phase 8 behavior
  return;
}
// else: open HandoffSheet in 'sending', await createOrder(), then show success
```

### Anti-Patterns to Avoid
- **Calling Instacart twice** — one handoff = one `createShoppingListPage` call. Don't re-post on CTA tap.
- **Storing `products_link_url` as durable state** — URLs have `expires_in` (max 365d, default 30d per Phase 8 code). HandoffSheet URL is ephemeral per-session.
- **Showing "Your order was placed!"** — it wasn't. DinnerTime handed off a cart. Copy must say "Sent to Instacart" or "Cart ready in Instacart."
- **Re-implementing cart UI if deep link fails** — just open the HTTPS URL in WebBrowser. Never try to mirror Instacart's cart in DinnerTime.
- **Skipping telemetry on the legacy path** — feature-flag rollback still needs `shopping.*` events to compare conversion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pushing items to a logged-in user's Instacart cart | OAuth dance, user-bound cart API | `products_link` endpoint (existing) | **No such API exists.** Instacart's public platform is link-based only. Verified 2026-04-20. |
| Deep-link detection | Custom URL scheme handlers | `Linking.openURL(https_url)` + universal links | iOS universal links auto-route the HTTPS URL to the app if installed — no custom scheme needed. |
| Telemetry pipeline | New batching / retry logic | Clone `apps/mobile/src/cooking/telemetry.ts` | Phase 16 already solved queue cap, splice-after-await, wireSupabaseAuth seam, 5xx retry. Copy-paste + rename. |
| Bottom-sheet primitive | Custom animated sheet | Existing `AddItemSheet.tsx` pattern (Phase 8) + Phase 19 tokens | AddItemSheet shows the Zustand-driven modal-from-below pattern; HandoffSheet mirrors structure. |
| Feature flag framework | LaunchDarkly / Unleash | Zustand `settingsStore` persisted to AsyncStorage | Single-user flag; no remote config needed for Phase 20. Ship static default-true, flip via Settings. |
| Order history re-modeling | New `shopping_handoffs` table + migration | Keep `shopping_orders` table, rename UI only | Migration churn with zero runtime benefit. "Order" is fine in DB; UI surfaces "handoff" / "cart". |

**Key insight:** The Instacart API constraints COMPLETELY bound this phase to a UX refactor. All the expensive-looking work (deep-cart integration, OAuth, realtime order sync) is explicitly unavailable — so don't explore it. The value is in (a) reframing the user mental model via sheet + copy, (b) instrumenting the handoff so we can measure abandonment, (c) keeping a safe rollback path.

## Common Pitfalls

### Pitfall 1: Assuming a hidden "cart API" exists because product says "draft cart"
**What goes wrong:** Engineer hunts for a non-existent endpoint, stalls the phase.
**Why:** Product language and API reality diverge — the ROADMAP copy "push to draft cart" is describing UX outcome, not API call shape.
**Avoid:** This research confirms the API surface. Implementation MUST use `createShoppingListPage` (existing). Any deviation requires a new Open Question.
**Warning sign:** A plan mentioning "OAuth to Instacart" or "cart tokens" — that's hallucinated.

### Pitfall 2: iOS Universal Link misconfiguration makes app-install detection unreliable
**What goes wrong:** `Linking.canOpenURL('instacart://')` returns false on iOS even when app is installed, because iOS requires `LSApplicationQueriesSchemes` in Info.plist to probe other apps.
**Avoid:** Don't rely on `canOpenURL` for CTA label accuracy in v1. Label both app-installed and web cases as "Open in Instacart" — let iOS route the HTTPS URL. If we want differentiated labels later, add `instacart` to `LSApplicationQueriesSchemes` in `app.json` ios.infoPlist. For Phase 20: skip the probe, use `Linking.openURL(https_url)` unconditionally, fall back to `WebBrowser` on rejection.
**Warning sign:** Tests mocking `Linking.canOpenURL` returning false in CI but true on device.

### Pitfall 3: Telemetry success event fires before user actually opens the cart
**What goes wrong:** `draft_cart_succeeded` logs when Instacart API returns 200, but user might dismiss the HandoffSheet without tapping "Open Instacart" — inflated success metrics.
**Avoid:** Split events: `draft_cart_succeeded` = server returned URL; `handoff_opened_{app|web}` = user tapped the CTA; `handoff_dismissed` = user closed sheet without tapping. Compare conversion ratio offline.
**Warning sign:** "Success rate 100%, usage 0%."

### Pitfall 4: Feature flag flip doesn't clear stale state
**What goes wrong:** User flips to legacy mode mid-session; HandoffSheet already mounted, shows draft_cart copy.
**Avoid:** Read flag at the moment `handleOrder()` is invoked, not at module import. Tie sheet visibility to a boolean `isHandoffSheetVisible` separate from the Zustand flag.
**Warning sign:** UI shows Apple-Pay sheet even after toggling legacy in Settings.

### Pitfall 5: Expiring products_link silently breaks the "Open" CTA on stale sheets
**What goes wrong:** User receives handoff URL, puts phone down for 31+ days, taps "Open" — Instacart 404.
**Avoid:** HandoffSheet is transactional, not persistent. Dismiss on cold app resume. Orders list page (`handoffs.tsx`) always shows "Create new cart" CTA and disables raw re-open for expired rows (Phase 8 already stores `expires_at`).
**Warning sign:** Users reporting "Instacart showed an empty page."

### Pitfall 6: PII whitelist for shopping telemetry misses `list_id` / `order_id`
**What goes wrong:** Sanitize drops the only joinable keys for offline analysis.
**Avoid:** Replicate Phase 16's 9-key whitelist + add `item_count`, `list_id`, `order_id`, `app_installed`, `variant` (error variant). Raw item names NEVER in payload — only counts.
**Warning sign:** SQL queries on `shopping_events.payload` can't link back to `shopping_lists` rows.

## Code Examples

### Instacart request shape (unchanged from Phase 8 — verified 2026-04-20)
```typescript
// POST https://connect.instacart.com/idp/v1/products/products_link
// Authorization: Bearer <INSTACART_API_KEY>
{
  "title": "DinnerTime — week of Apr 13",
  "link_type": "shopping_list",
  "expires_in": 30,  // days; no default for shopping_list, max 365
  "image_url": null, // optional, 500x500 if provided — not required for shopping_list
  "line_items": [{
    "name": "chicken thighs",
    "line_item_measurements": [{ "quantity": 2, "unit": "pound" }],
    "upcs": [],           // optional — Phase 8 doesn't send
    "display_text": null, // optional override of name on the Instacart page
    "filters": null       // optional brand/organic filters
  }],
  "landing_page_configuration": {
    "partner_linkback_url": "dinnertime://shopping/done"
    // enable_pantry_items is RECIPE-only; MUST NOT send for shopping_list
  }
}
// Response: { "products_link_url": "https://www.instacart.com/store/recipes/..." }
```
Source: https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/

### HandoffSheet invocation from shopping.tsx
```typescript
// apps/mobile/src/app/(tabs)/shopping.tsx
const [handoffState, setHandoffState] = useState<HandoffState>({ kind: 'idle' });

const handleOrder = useCallback(async () => {
  const mode = useSettingsStore.getState().shoppingHandoffMode;
  if (mode === 'legacy') {
    // Phase 8 inline flow — unchanged
    const { url } = await createOrder();
    await WebBrowser.openBrowserAsync(url);
    await fetchOrders();
    return;
  }
  // Draft-cart flow
  setHandoffState({ kind: 'sending' });
  logShoppingEvent({ name: 'shopping.draft_cart_started', payload: sanitizePayload({ list_id: currentList.id, item_count: items.filter(i => !i.checked).length }) });
  try {
    const { url, order_id } = await createOrder();
    setHandoffState({ kind: 'success', url, itemCount: items.filter(i => !i.checked).length, appInstalled: await Linking.canOpenURL('instacart://').catch(() => false) });
    logShoppingEvent({ name: 'shopping.draft_cart_succeeded', payload: sanitizePayload({ list_id: currentList.id, order_id, item_count: /* ... */ }) });
  } catch (err) {
    const variant = classifyHandoffError(err);
    setHandoffState({ kind: 'error', variant });
    logShoppingEvent({ name: 'shopping.draft_cart_failed', payload: sanitizePayload({ error_code: variant }) });
  }
}, [createOrder, currentList, items]);
```

## Data Model (new — shopping_events)

```sql
-- supabase/migrations/00024_shopping_events.sql
-- Mirrors 00020_cooking_events.sql exactly (Phase 16 pattern).
CREATE TABLE shopping_events (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  event_type TEXT NOT NULL,          -- 'shopping.draft_cart_started' etc.
  shopping_list_id UUID REFERENCES shopping_lists(id) ON DELETE SET NULL,
  shopping_order_id UUID REFERENCES shopping_orders(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  client_ts TIMESTAMPTZ,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shopping_events_profile ON shopping_events(profile_id, server_ts DESC);
CREATE INDEX idx_shopping_events_session ON shopping_events(session_id);

ALTER TABLE shopping_events ENABLE ROW LEVEL SECURITY;
-- RLS: SELECT + INSERT only where auth.uid() = profile_id; no UPDATE/DELETE.
```

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `shopping_orders` rows keep "Order" semantic — KEEP. No user-visible DB-name leak (API never returns the column "orders"). | None — UI-layer rename only. |
| Live service config | None — Instacart API key unchanged; endpoint unchanged. | None. |
| OS-registered state | `app.json` ios.infoPlist may need `LSApplicationQueriesSchemes: ['instacart']` for `canOpenURL` probe — optional, see Pitfall 2. | Add entry if plan decides to use canOpenURL for CTA label. |
| Secrets/env vars | `INSTACART_API_KEY`, `INSTACART_BASE_URL` — UNCHANGED. | None. |
| Build artifacts | iOS dev-client must be rebuilt IF `LSApplicationQueriesSchemes` added (native config change → EAS build). | Rebuild dev client via EAS if plan opts in. |

**Key insight:** This is a pure-code refactor with optional Info.plist touch. No data migration. No service reconfiguration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Instacart stub client | Dev/CI | ✓ | — | — |
| Instacart real API (`INSTACART_API_KEY`) | Prod handoff | ? (Phase 8 STATE) | — | Stub returns deterministic placeholder URL |
| iOS 15+ simulator | UAT | ✓ | 26.4 runtime | — |
| Maestro 2.4.0 | UAT flows | ✓ | 2.4.0 | — |
| Physical iPhone with Instacart app installed | Deep-link verification | User-provided | — | Skip deep-link assertion in Maestro; verify in manual DEVICE-TEST doc |

**Missing dependencies with no fallback:** None blocking. Real Instacart key is nice-to-have for prod; stub keeps phase complete.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (server + mobile pure) + React Native Testing Library (mobile component) + Maestro (iOS UAT) |
| Config file | `packages/server/vitest.config.ts`, `apps/mobile/vitest.config.ts`, `apps/mobile/.maestro/*.yaml` |
| Quick run command | `pnpm -C apps/mobile test -- --run` |
| Full suite command | `pnpm -w test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHOP-DC-01 | Order button launches HandoffSheet, not inline WebBrowser | RNTL / helper | `pnpm -C apps/mobile test HandoffSheet.test.tsx -- --run` | ❌ Wave 0 |
| SHOP-DC-02 | HandoffSheet renders sending/success/error states from discriminated union | pure unit | `pnpm -C apps/mobile test HandoffSheet.test.tsx -- --run` | ❌ Wave 0 |
| SHOP-DC-03 | `openInstacartCart(url)` tries Linking.openURL first, falls back to WebBrowser on throw | unit (mocks) | `pnpm -C apps/mobile test openInstacartCart.test.ts -- --run` | ❌ Wave 0 |
| SHOP-DC-04 | `logShoppingEvent` posts to /telemetry/shopping with sanitized payload | unit | `pnpm -C apps/mobile test shopping/telemetry.test.ts -- --run` | ❌ Wave 0 |
| SHOP-DC-04 (server) | `/telemetry/shopping` accepts valid batch, returns 204 empty / 200 ok / 400 schema / 401 auth | unit | `pnpm -C packages/server test telemetry.test.ts -- --run` | ⚠️ extend existing |
| SHOP-DC-04 (DB) | `shopping_events` migration present + RLS policies present | unit (SQL regex) | `pnpm -C packages/server test migrations.test.ts -- --run` | ⚠️ extend existing |
| SHOP-DC-05 | Legacy mode toggle bypasses HandoffSheet, runs Phase 8 inline flow | unit | `pnpm -C apps/mobile test shoppingStore.test.ts -- --run` | ⚠️ extend existing |
| SHOP-DC-06 | Error classification maps network / 502 / 401 to correct variant | unit | `pnpm -C apps/mobile test classifyHandoffError.test.ts -- --run` | ❌ Wave 0 |
| SHOP-DC-01..06 (UAT) | Happy-path sheet → success → open Instacart (web fallback on sim) | Maestro | `maestro test apps/mobile/.maestro/24-shopping-draft-cart.yaml` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm -C apps/mobile test -- --run` + `pnpm -C packages/server test -- --run` (affected files)
- **Per wave merge:** `pnpm -w test`
- **Phase gate:** `pnpm -w test` green + Maestro flow 24 green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/mobile/src/components/shopping/__tests__/HandoffSheet.test.tsx` — SHOP-DC-01, -02
- [ ] `apps/mobile/src/shopping/__tests__/openInstacartCart.test.ts` — SHOP-DC-03
- [ ] `apps/mobile/src/shopping/__tests__/telemetry.test.ts` — SHOP-DC-04 (clone of cooking/telemetry.test.ts)
- [ ] `apps/mobile/src/shopping/__tests__/classifyHandoffError.test.ts` — SHOP-DC-06
- [ ] `apps/mobile/src/stores/__tests__/settingsStore.test.ts` — SHOP-DC-05 flag persistence
- [ ] `packages/server/src/routes/__tests__/telemetry.test.ts` — extend with shopping channel cases (SHOP-DC-04 server)
- [ ] `packages/server/src/__tests__/migrations.test.ts` — extend with 00024_shopping_events assertions
- [ ] `supabase/migrations/00024_shopping_events.sql` — new migration
- [ ] `apps/mobile/.maestro/24-shopping-draft-cart.yaml` — happy-path UAT flow
- [ ] Framework install: none — vitest + RNTL + Maestro already present

## Sources

### Primary (HIGH confidence)
- [Instacart Create Shopping List Page](https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/) — endpoint schema, line_item fields, landing_page_configuration, expires_in semantics
- [Instacart Developer Platform FAQ](https://docs.instacart.com/developer_platform_api/faq/) — "directing users to a specific merchant is not supported"; deep-link support confirmation
- [Instacart Shopping List Concept](https://docs.instacart.com/developer_platform_api/guide/concepts/shopping_list/) — user flow on link open (select store → add to cart → checkout or login)
- [Instacart Deep Linking Docs](https://docs.instacart.com/storefront/learn_about_your_storefront/merchandising_opportunities/deep_linking/) — storefront deep-linking reference
- Existing code: `packages/server/src/services/instacart.ts` — current implementation verified correct for 2026 API
- Existing code: `apps/mobile/src/cooking/telemetry.ts` + `packages/server/src/routes/telemetry.ts` + `supabase/migrations/00020_cooking_events.sql` — Phase 16 pattern to clone
- `CLAUDE.md` — Expo SDK 55, NativeWind, Zustand, expo-web-browser, Phase 19 tokens locked

### Secondary (MEDIUM confidence)
- [API Tracker Instacart summary](https://apitracker.io/a/instacart) — third-party endpoint list, corroborates official docs
- WebSearch 2026-04-20 "Instacart products_link behavior" — cross-verified that products_link IS the cart surface (no separate cart API)

### Tertiary (LOW confidence)
- None — all negative claims ("no OAuth cart-push API") verified against official FAQ + API reference.

## Open Questions

1. **Should legacy fallback be user-visible or hidden Settings-only?**
   - What we know: CONTEXT says hidden menu for admin rollback.
   - What's unclear: Whether UAT needs a visible toggle to test both paths.
   - Recommendation: Hidden Settings row exposed via 5-tap gesture on Settings header (common iOS easter-egg). Maestro flow 24 tests draft_cart default; plan adds secondary flow 25 that programmatically flips the Zustand flag and tests legacy.

2. **Universal Link vs `LSApplicationQueriesSchemes` probe for CTA differentiation.**
   - What we know: `Linking.openURL(https_url)` works without Info.plist changes; iOS routes to app via universal link automatically.
   - What's unclear: Whether we want the CTA to say "Open in Instacart app" vs "Open Instacart.com" based on install status.
   - Recommendation: Skip the probe in v1 (avoid EAS rebuild). CTA reads "Open in Instacart" unconditionally. Add install-aware copy in a follow-up phase if telemetry shows high web-fallback rate.

3. **One `/telemetry/:channel` route or two routers?**
   - What we know: Phase 16 mounts `/api/v1/telemetry/cooking` as a dedicated router.
   - What's unclear: Project preference for one-route-per-channel vs parametric.
   - Recommendation: Duplicate the router (`shopping-telemetry.ts`) for symmetry with `cooking.ts`/`pantry.ts`/`shopping.ts` pattern. Planner can revisit if it adds a third channel and consolidation pressure emerges.

## Project Constraints (from CLAUDE.md)

- **iOS-first** via Expo SDK 55 / RN 0.83 — HandoffSheet must work on iOS simulator and physical device.
- **All Instacart calls through Hono backend** — mobile never holds `INSTACART_API_KEY`. ✓ existing architecture preserved.
- **Dev environment startup** requires server + Metro + (physical iPhone) Cloudflare tunnel. Shopping-telemetry POSTs go through same tunnel.
- **Physical iPhone testing** per project memory — Maestro flow validates sim; real deep-link verification requires physical device DEVICE-TEST doc.
- **NativeWind + Phase 19 tokens only** — no raw hex colors. HandoffSheet uses `bg-brand`, `text-primary`, etc.
- **Biome lint** passes before merge.
- **SF Symbols via SymbolIcon** — `checkmark.circle.fill`, `cart.badge.plus`, `exclamationmark.triangle` verified present in expo-symbols.
- **GSD workflow** enforcement — no direct edits outside `/gsd:execute-phase`.

## Metadata

**Confidence breakdown:**
- API ground truth: HIGH — negative claim "no direct cart API" verified in Instacart FAQ + cross-checked against official endpoint reference + API tracker.
- Architecture: HIGH — mirrors Phase 16 (telemetry) and Phase 8 (sheet + Zustand) patterns exactly.
- Deep-link behavior: MEDIUM — Instacart advertises universal-link routing but docs don't pin exact iOS behavior; Pitfall 2 documents the risk and a safe default.
- Telemetry schema: HIGH — 1:1 clone of `cooking_events`.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (Instacart API is stable; re-verify only if 30+ days pass or Instacart publishes a changelog entry about "cart" endpoints)
