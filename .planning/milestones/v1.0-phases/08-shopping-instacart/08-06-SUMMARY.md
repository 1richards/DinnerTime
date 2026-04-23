---
phase: 08-shopping-instacart
plan: 06
subsystem: mobile-state
tags: [zustand, shopping, optimistic-updates, mobile]
requires:
  - apps/mobile/src/types/shopping.ts
  - apps/mobile/src/stores/mealPlanStore.ts (pattern reference)
  - /api/v1/shopping routes (Phase 08-05)
provides:
  - useShoppingStore hook with CRUD + order actions
  - Optimistic + rollback semantics for all mutations
affects:
  - Phase 08-07 UI will consume this store
tech_stack:
  added: []
  patterns:
    - authedFetch helper centralizes /api/v1 prefix + auth
    - Snapshot-based rollback for optimistic mutations
    - Temp id via crypto.randomUUID() for add-before-server
key_files:
  created:
    - apps/mobile/src/stores/shoppingStore.ts
    - apps/mobile/src/stores/__tests__/shoppingStore.test.ts
  modified: []
key_decisions:
  - Mirror mealPlanStore authedFetch convention verbatim (no shared helper extraction yet)
  - createOrder throws without currentList (UI guard) but also writes error state for consistency
  - fetchVariations returns [] on failure instead of throwing (read-only best-effort)
  - Store returns Instacart URL but never opens it (UI responsibility per plan Avoid note)
metrics:
  duration: 6min
  tasks: 2
  files_created: 2
  files_modified: 0
  completed: 2026-04-10
---

# Phase 08 Plan 06: Mobile Shopping Store Summary

One-liner: Zustand v5 shoppingStore with optimistic CRUD, snapshot rollback, and Instacart order actions, mirroring mealPlanStore.

## What Was Built

A single Zustand store (`useShoppingStore`) exposing the full shopping surface to the UI:

**State shape**
```ts
{ currentList, items, orders, variations, loading, error }
```

**List actions**
- `generateList(mealPlanId)` — POST /shopping/generate, populates list + items
- `fetchCurrent()` — GET /shopping/current, 404 treated as null (no error)

**Item mutations (all optimistic + snapshot rollback)**
- `toggleChecked(id)` — PATCH /shopping/items/:id { checked }
- `addItem({name, quantity, unit})` — temp id via crypto.randomUUID, replaced with server item on success
- `editItem(id, patch)` — PATCH with arbitrary patch, replaced with server item on success
- `removeItem(id)` — filter then DELETE, restores snapshot on failure

**Order actions**
- `createOrder()` — throws without currentList, returns `{url, order_id}`
- `fetchOrders()` — GET /shopping/orders
- `reorder(orderId)` — POST /shopping/orders/:id/reorder, sets returned list as currentList
- `fetchVariations(orderId)` — POST /shopping/orders/:id/variations, stores suggestions, returns []-on-failure

## Files

- `apps/mobile/src/stores/shoppingStore.ts` (415 lines)
- `apps/mobile/src/stores/__tests__/shoppingStore.test.ts` (20 tests, all green)

## Test Coverage

20 tests covering:
- generateList success + server error
- fetchCurrent 404 / 200
- toggleChecked optimistic mid-state, persist, rollback on HTTP error, rollback on network throw
- addItem optimistic append + server replace, rollback
- editItem optimistic patch + server replace, rollback
- removeItem filter + confirm, rollback
- createOrder no-list throw (no network), success payload, error surface via thrown + state
- fetchOrders list fetch
- reorder sets currentList + items
- fetchVariations success storage, failure returns []

Verification: `pnpm -C apps/mobile test shoppingStore.test.ts -- --run` → 20/20 passed.
TypeScript: `tsc --noEmit` clean.

## Deviations from Plan

None — plan executed as written. Task 1 and Task 2 were merged into a single RED/GREEN cycle since they share the same test file and store module; commits still split into `test(08-06)` and `feat(08-06)` per TDD protocol.

## Commits

- `57a75d7` test(08-06): add failing tests for shoppingStore actions
- `e384a72` feat(08-06): implement shoppingStore with optimistic CRUD + orders

## Requirements Addressed

SHOP-01, SHOP-02, SHOP-03, SHOP-04, SHOP-05, SHOP-06, SHOP-07 — all addressable from the UI layer via this store.

## Next

Phase 08-07: Mobile shopping UI consumes this store (list screen, checkbox interactions, Instacart button via WebBrowser.openBrowserAsync, variations sheet).

## Self-Check: PASSED

- FOUND: apps/mobile/src/stores/shoppingStore.ts
- FOUND: apps/mobile/src/stores/__tests__/shoppingStore.test.ts
- FOUND commit: 57a75d7
- FOUND commit: e384a72
- Tests: 20/20 passing
