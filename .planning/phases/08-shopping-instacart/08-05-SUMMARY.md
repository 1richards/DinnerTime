---
phase: 08-shopping-instacart
plan: 05
subsystem: server/routes
tags: [shopping, instacart, hono, api, routes]
requires:
  - 08-01 (schema: shopping_lists, shopping_list_items, shopping_orders)
  - 08-02 (consolidateIngredients, subtractPantry, suggestVariations)
  - 08-03 (classifyItems)
  - 08-04 (getInstacartClient)
provides:
  - POST /api/v1/shopping/generate
  - GET  /api/v1/shopping/current
  - GET  /api/v1/shopping/:id
  - POST /api/v1/shopping/items
  - PATCH /api/v1/shopping/items/:id
  - DELETE /api/v1/shopping/items/:id
  - POST /api/v1/shopping/:id/order
  - GET  /api/v1/shopping/orders
  - POST /api/v1/shopping/orders/:id/reorder
  - POST /api/v1/shopping/orders/:id/variations
affects:
  - packages/server/src/routes/shopping.ts
tech-stack:
  added: []
  patterns:
    - "Hono route composition (mirrors meal-plans.ts)"
    - "4-field PATCH whitelist (checked/quantity/name/unit)"
    - "Graceful degrade on classify failure (default 'other')"
    - "Service error.code → HTTP status mapping"
key-files:
  created:
    - packages/server/src/routes/__tests__/shopping.test.ts
  modified:
    - packages/server/src/routes/shopping.ts
decisions:
  - "Reorder snapshot items default category='other' (fast path, no re-classify)"
  - "Instacart call wrapped in try/catch → 502 INSTACART_ERROR (502 not 500 per research Pitfall 4)"
  - "expires_at computed server-side as now + 30 days, mirrors expires_in passed to Instacart"
  - "Fluent supabase mock uses thenable builder so same mock services select/insert/update/delete"
metrics:
  duration: "~6min"
  tasks: 2
  files_changed: 2
  completed: "2026-04-10"
requirements_completed: [SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, SHOP-06, SHOP-07]
---

# Phase 8 Plan 5: Shopping Routes (Hono API Layer) Summary

Wires Plans 02/03/04 into ten Hono routes at `/api/v1/shopping`, exposing SHOP-01 through SHOP-07 as the backend for the mobile shopping feature; the reorder path intentionally rebuilds a fresh list from the order snapshot instead of replaying the old Instacart URL.

## Scope

Replace the stub `shopping.ts` (two 501 routes) with the full orchestration layer:
- `/generate` composes `consolidateIngredients → subtractPantry → classifyItems`, persists `shopping_lists` + `shopping_list_items`.
- CRUD endpoints for items (add user-added, PATCH toggle/edit with whitelist, DELETE).
- `/:id/order` filters checked items, calls `getInstacartClient()` at request time, persists `shopping_orders` with `expires_at = now + 30d`.
- `/orders/:id/reorder` builds a NEW `shopping_lists` row seeded from `items_snapshot` (research Pitfall 4 mitigation — never replays old URL).
- `/orders/:id/variations` routes the snapshot through `suggestVariations` (Haiku).

## Implementation Notes

**classifyItems graceful degrade** — wrapped in try/catch inside `/generate`. On failure the list still persists with every item defaulted to `'other'`; a console warning is logged. This keeps shopping list creation resilient to Claude API flaps.

**PATCH whitelist** — `pickPatchFields` accepts only `checked/quantity/name/unit`. Unknown keys (including `profile_id`) are silently dropped at the route boundary before hitting supabase.update, matching the Phase 6-02 convention.

**Reorder category defaulting** — `items_snapshot` (InstacartLineItem[]) does not carry grocery category. Rather than re-classifying (costly, slow), new items are inserted with `category='other'`. User can re-categorize via `/variations` or manual edit. Decision documented in plan.

**Instacart error mapping** — client throw produces `{ code: 'INSTACART_ERROR', error: <message> }` with HTTP 502 (bad upstream), not 500. Upstream plans log both status + body in the error message (Phase 8-04 convention).

**profile_id scoping** — every fetch `.eq('profile_id', user.id)` in addition to RLS. RLS is treated as a safety net, not the primary scope (defensive defense-in-depth).

**Pre-existing TypeScript warnings** — shopping.ts inherits the project-wide `c.get('supabase') is unknown` warnings seen in `meal-plans.ts`, `pantry.ts`, `recipes.ts`. No shared `Variables` type is defined in the project yet. Shopping.ts matches that convention verbatim; fixing this is a cross-cutting cleanup outside this plan's scope.

## Test Coverage

`packages/server/src/routes/__tests__/shopping.test.ts` — 13 tests covering:

1. 401 without auth
2. `/generate` happy path (201, list + items, classifyItems called)
3. `/generate` 404 when meal_plan not owned by user
4. `/generate` 400 EMPTY_PLAN on zero entries
5. `/current` 200 null when no lists exist
6. `/current` returns most recent list with items
7. `POST /items` 201 creates user_added=true item
8. `PATCH /items/:id` toggles checked, drops unknown keys
9. `DELETE /items/:id` 204
10. `POST /:id/order` only passes unchecked items to Instacart, asserts `expires_at` ≈ 30 days, persists order
11. `POST /orders/:id/reorder` creates NEW list, asserts old URL never appears in response, Instacart NOT called
12. `POST /orders/:id/variations` returns mocked swap suggestions
13. `POST /:id/order` 502 INSTACART_ERROR when client throws

Mocking approach: fluent supabase builder with per-table response bags (select/insert/update/delete all route through the same `then` shim). Mocks `getInstacartClient` to return a stub that records `createShoppingListPage` calls.

## Verification

- `pnpm -C packages/server test -- --run` → **18 files / 172 tests passed** (13 new shopping tests included, zero regressions)
- `pnpm -C packages/server exec tsc --noEmit` → shopping.ts errors limited to pre-existing `c.get<unknown>` pattern shared with meal-plans/pantry/recipes (out of scope)
- Stub Instacart URL (`https://example.com/stub-instacart/abc`) confirmed in `/order` test body

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes or architectural deviations. No authentication gates encountered.

## Requirements Closed

SHOP-01 through SHOP-07 fully wired. Mobile store can now call these endpoints via `authedFetch`.

## Self-Check: PASSED

- `packages/server/src/routes/shopping.ts` — FOUND (517 lines)
- `packages/server/src/routes/__tests__/shopping.test.ts` — FOUND (472 lines)
- Commit `6cae422` (feat) — FOUND
- Commit `81071b0` (test) — FOUND
- All 172 server tests pass
