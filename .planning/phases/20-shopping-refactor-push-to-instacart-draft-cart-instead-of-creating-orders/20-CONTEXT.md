# Phase 20: Shopping Refactor — Push to Draft Cart - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode, Claude-selected defaults across all grey areas)

<domain>
## Phase Boundary

Replace the Phase 8 "create an order via recipe/shopping-list URL" flow (which hands back a hosted Instacart page URL) with a "push to Instacart draft cart" model. DinnerTime is the curator — it chooses items, quantities, and UPC matches. Instacart is the checkout system — user manages payment method, delivery window, substitutions, and final checkout **inside Instacart**.

Phase 8's shopping-list primitives (auto-generation from meal plan, consolidation, manual edits) stay intact. Only the "Order on Instacart" button's destination changes.

**Out of scope:**
- Instacart payment/checkout UI in DinnerTime (explicitly forbidden).
- Webhook integration for "order placed" notifications — deferred; the handoff is fire-and-forget.
- UPC database curation — reuse existing Instacart item-matching, don't build our own.
- Offline draft-cart queueing — online-only handoff.

</domain>

<decisions>
## Implementation Decisions

### Draft-Cart API Strategy

- **Instacart API research first:** Phase 20 research must verify which Instacart Developer Platform endpoint supports "push to draft cart." If the public docs only expose the Recipe/Shopping-List-to-URL model (what Phase 8 uses today), confirm whether a draft-cart endpoint exists. If not, pivot to the closest equivalent and document the deviation.
- **Fallback if no draft-cart endpoint:** If Instacart has no true draft-cart API, the "push" semantics are emulated by creating a shopping-list page URL and redirecting the user — essentially Phase 8's current behavior with UX rewording. Document this clearly in research; do not ship misleading UI copy.
- **Claude's Discretion:** The exact endpoint, request shape, and auth pattern are determined by the Instacart API research — not locked here.

### Handoff UX Flow

- **Trigger:** Existing "Order on Instacart" buttons (shopping list + recipe detail). No new entry points.
- **Loading state:** Full-screen (or sheet) loading with brand-token spinner + copy "Sending to Instacart cart…". UI-SPEC will finalize exact layout.
- **Success state:** Check-mark affirmation + CTA "Open Instacart" (deep link preferred; web URL fallback).
- **Error states:** Network failure, Instacart API error, auth failure — each with specific retry affordance.
- **No in-app checkout:** Card-on-file, delivery window, substitutions are Instacart's responsibility. DinnerTime UI must never show these.

### Data Sent to Instacart

- **Per item:** name, quantity, unit, UPC (when known from Instacart item-matching cache).
- **Batch semantics:** One batch per handoff (entire shopping list or entire recipe in one push). No partial pushes.
- **Authentication:** User is authenticated to Instacart via OAuth or shared session — defer specifics to research.

### Existing Phase 8 Preservation

- **Shopping-list auto-generation from meal plan:** UNTOUCHED.
- **Consolidation (combine duplicate ingredients):** UNTOUCHED.
- **Manual edits (add/remove items, change quantities):** UNTOUCHED.
- **Only the terminal "Order" button's destination and UX change.**

### Telemetry & Rollback

- **Feature flag:** Gate the new draft-cart flow behind a Zustand-stored feature flag default-on; admins can flip to Phase 8 fallback via Settings (hidden menu) if Instacart API issues emerge in beta.
- **Telemetry events:** `shopping.draft_cart_started`, `.draft_cart_succeeded`, `.draft_cart_failed` — reuse Phase 16 telemetry infrastructure (`cooking_events` pattern replicated as `shopping_events`).

### Claude's Discretion (explicitly flagged)

- Spinner/loading visual treatment (UI-SPEC decides)
- Error copy wording (copywriting work in UI-SPEC)
- Exact feature-flag key name and Settings placement (plan decides)
- Whether to write a new shopping_events table or reuse telemetry pipeline (research decides based on volume)
- Instacart API auth pattern (research decides)

</decisions>

<code_context>
## Existing Code Insights

### Phase 8 Infrastructure (to preserve)
- `apps/mobile/src/app/(tabs)/shopping/*` — shopping-list UI, consolidation, manual edits
- `apps/mobile/src/app/recipes/[id]/*` — recipe detail with "Order on Instacart" button
- Server routes for Instacart integration (research to locate exactly — likely `packages/server/src/routes/instacart.ts` or similar)
- Instacart API client module on mobile or server

### Phase 16 Assets Reusable
- Telemetry pipeline: `apps/mobile/src/cooking/telemetry.ts` pattern + `packages/server/src/routes/telemetry.ts` pattern + `cooking_events` Supabase table pattern → replicate for `shopping_events`.
- Phase 19 design tokens for all new UI.
- SF Symbols via `SymbolIcon` (loading, success, error states).
- Toast primitive from Phase 16 (`CommandToast`) may be reusable or a shopping-specific variant needed.

### Integration Points
- Settings screen — new "Shopping" section for feature-flag toggle (hidden/admin path).
- Deep-linking setup — iOS URL schemes (`instacart://`) with web fallback.
- Existing auth pattern (bearer to backend, which proxies to Instacart).

</code_context>

<specifics>
## Specific Ideas

- UI treatment should feel like Apple Pay's hand-off: "We're sending it to Instacart — you'll take it from there."
- Consider a success "receipt card" that shows (a) item count, (b) an estimated total if Instacart API returns it, (c) an "Open Instacart" primary CTA, (d) a muted "View shopping list in DinnerTime" secondary.
- Handle the "user doesn't have Instacart installed" case — fallback to web URL opens Safari automatically via universal link.

</specifics>

<deferred>
## Deferred Ideas

- **Webhook/order-status integration** — DinnerTime listens for "Instacart order delivered" to auto-mark pantry items as "arrived." Defer to a later phase.
- **Multi-retailer support** — this phase is Instacart-only per project constraints.
- **DinnerTime-internal cart editing before push** — users already edit the shopping list in DinnerTime before the handoff; no separate "pre-push cart editor" needed.
- **UPC auto-lookup via Claude vision** — out of scope; use Instacart's existing item-matching.

</deferred>
