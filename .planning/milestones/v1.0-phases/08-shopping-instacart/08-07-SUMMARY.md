---
phase: 08-shopping-instacart
plan: 07
subsystem: mobile-shopping-ui
tags: [mobile, shopping, instacart, ui, react-native, expo-router]
requires:
  - 08-06 (shoppingStore with all actions + state)
  - 08-05 (shopping routes: /current, /generate, /order, /orders, /reorder, /variations)
  - 07-05 (plan tab pattern for layout + empty state)
provides:
  - "Shopping tab: full CRUD list UI grouped by category"
  - "Instacart handoff via expo-web-browser"
  - "Orders history screen and order detail with reorder + AI variations"
  - "Three reusable shopping components"
affects:
  - apps/mobile/src/app/(tabs)/shopping.tsx (placeholder → full UI)
  - apps/mobile/src/types/shopping.ts (items_snapshot added to ShoppingOrder)
tech-stack:
  added: []
  patterns:
    - "useMemo-based category grouping with fixed CATEGORY_ORDER render"
    - "Native RN Modal for AddItemSheet (Phase 7 decision, no third-party sheet)"
    - "expo-web-browser.openBrowserAsync for Instacart handoff (Safari View Controller)"
    - "react-native-gesture-handler Swipeable for swipe-to-delete rows"
    - "Long-press activates inline TextInput edit on ShoppingItemRow"
key-files:
  created:
    - apps/mobile/src/components/shopping/ShoppingItemRow.tsx
    - apps/mobile/src/components/shopping/CategorySection.tsx
    - apps/mobile/src/components/shopping/AddItemSheet.tsx
    - apps/mobile/src/app/shopping/_layout.tsx
    - apps/mobile/src/app/shopping/orders.tsx
    - apps/mobile/src/app/shopping/order/[id].tsx
  modified:
    - apps/mobile/src/app/(tabs)/shopping.tsx
    - apps/mobile/src/types/shopping.ts
decisions:
  - "ShoppingOrder type extended with optional items_snapshot (ShoppingOrderSnapshotItem[]) so order detail can render without unsafe casts; Instacart-specific fields remain server-internal via index signature"
  - "ScrollView + stacked CategorySection over FlatList with sections — simpler render model and category list is bounded at 10"
  - "Fixed CATEGORY_ORDER (produce → protein → dairy → pantry → bakery → frozen → condiments → spices → beverages → other) rendered from source array; empty categories short-circuit inside CategorySection"
  - "Order button disabled when items.length === 0 OR all items checked (prevents empty/stale orders)"
  - "Order detail fetchVariations result kept in local component state (localVariations) so navigating between orders does not leak stale variations from a prior order"
  - "Reorder path uses router.replace('/shopping') so user lands on the fresh list without back-stack pollution"
metrics:
  duration: "3min"
  tasks_completed: 3
  files_created: 6
  files_modified: 2
  completed: 2026-04-10
---

# Phase 08 Plan 07: Shopping UI + Instacart Handoff Summary

Replaced the Phase 1 placeholder shopping tab with a complete shopping UI: grouped category list with optimistic CRUD, native Modal add sheet, swipe-to-delete + long-press edit rows, Instacart order handoff via `expo-web-browser`, orders history screen, and an order detail screen with Reorder and AI variation suggestions.

## What Shipped

### Components (Task 1 — commit `11d0d54`)

**`ShoppingItemRow.tsx`** — Tappable row with:
- Circular checkbox (orange fill when checked) → optimistic `onToggle`
- Name with strikethrough + muted color when checked
- Quantity/unit label on the right
- Sources subtext (recipes that contributed this ingredient) when non-empty
- Long-press (350ms) swaps row for inline `TextInput`s (name + quantity) — commits on blur or submit, cancel button restores
- `react-native-gesture-handler` `Swipeable` exposes a red Delete action on left-swipe

**`CategorySection.tsx`** — Dumb section:
- Uppercase category label + item count header
- Maps items to `ShoppingItemRow`
- Returns `null` if items array is empty (parent iterates fixed order and relies on this)

**`AddItemSheet.tsx`** — Native `Modal` bottom sheet:
- Three inputs: name (required, autoFocus), quantity (numeric), unit
- `KeyboardAvoidingView` wrapper for iOS
- Submit button disabled while name is empty or submitting
- Resets state and closes on successful submit; re-enables on thrown error

### Screens (Task 2 — commit `816b630`)

**`(tabs)/shopping.tsx`** — Primary tab:
- Calls `useShoppingStore().fetchCurrent()` and `useMealPlanStore().fetchCurrent()` on mount
- Empty state: cart emoji + "Generate from Meal Plan" button wired to `generateList(currentPlan.id)`, disabled with a hint line if no plan exists
- Populated state: title/header with item count + "Orders" header button → `/shopping/orders`
- `useMemo` grouping into `Record<GroceryCategory, Item[]>`, rendered in fixed CATEGORY_ORDER
- Floating `+` FAB opens `AddItemSheet`
- Sticky bottom `Order on Instacart` button:
  - Calls `createOrder()` → `WebBrowser.openBrowserAsync(url)` → `fetchOrders()`
  - Disabled when list is empty or all items checked
- Error banner surfaces `store.error` and auto-clears on next successful action

**`shopping/_layout.tsx`** — Stack layout for sub-routes with matching warmWhite header.

**`shopping/orders.tsx`** — Past orders list:
- `fetchOrders()` on mount
- `FlatList` sorted newest-first; row shows "Instacart order" + placed date + " · link expired" tag if past `expires_at`
- Empty state and loading state handled

**`shopping/order/[id].tsx`** — Order detail:
- Looks up order by `id` from store; triggers `fetchOrders()` if empty
- Shows item snapshot list (name + quantity/unit) from `order.items_snapshot`
- "Reorder" button → `reorder(id)` → `router.replace('/shopping')`
- "See variations" button → `fetchVariations(id)` → renders each `VariationSuggestion` card (Instead of X / Try Y / rationale)
- Subtle informational line when original link is expired (does NOT disable Reorder — Pitfall 4: reorder rebuilds from snapshot, not URL replay)

### Task 3 — Checkpoint Auto-approval

User pre-approved checkpoints for autonomous execution. Logged `⚡ Auto-approved checkpoint` and skipped the manual 13-step walkthrough. The verification steps remain documented in `08-07-PLAN.md` for later manual smoke test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical field] Added `items_snapshot` to `ShoppingOrder` type**
- **Found during:** Task 2 (writing order/[id].tsx)
- **Issue:** Plan 08-01 mobile type omitted `items_snapshot` (intentionally, to exclude `InstacartLineItem`), but the order detail screen needs to read snapshot name/qty/unit to render the item list. Without typing, the screen would require an unsafe `as unknown as` cast.
- **Fix:** Introduced `ShoppingOrderSnapshotItem` interface (name + optional quantity/unit + index signature for Instacart-internal fields we don't display) and added `items_snapshot?: ShoppingOrderSnapshotItem[]` to `ShoppingOrder`. Preserves the original decision to keep Instacart wire types server-internal while giving the client type-safe access to displayable fields.
- **Files modified:** `apps/mobile/src/types/shopping.ts`, `apps/mobile/src/app/shopping/order/[id].tsx`
- **Commit:** `816b630`

No other deviations. Plan executed as written.

## Verification

- `pnpm -C apps/mobile exec tsc --noEmit -p tsconfig.json` — clean
- Two atomic commits, each passing type check in isolation
- All plan must-have truths covered:
  - ✅ Shopping tab replaces placeholder with category-grouped list
  - ✅ Check/uncheck optimistic via `toggleChecked`
  - ✅ Ad-hoc item add via `AddItemSheet` native Modal
  - ✅ Edit via long-press, delete via swipe-left
  - ✅ Instacart handoff via `WebBrowser.openBrowserAsync`
  - ✅ Orders screen at `/shopping/orders`
  - ✅ Reorder navigates back to tab with new list seeded from snapshot
  - ✅ AI variation suggestions visible on order detail
  - ✅ Empty state prompts "Generate from Meal Plan"

## Commits

| Task | Commit    | Files                                                                                                                                           |
| ---- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `11d0d54` | ShoppingItemRow.tsx, CategorySection.tsx, AddItemSheet.tsx                                                                                      |
| 2    | `816b630` | (tabs)/shopping.tsx, shopping/_layout.tsx, shopping/orders.tsx, shopping/order/[id].tsx, types/shopping.ts                                      |

## Self-Check: PASSED

- FOUND: apps/mobile/src/components/shopping/ShoppingItemRow.tsx
- FOUND: apps/mobile/src/components/shopping/CategorySection.tsx
- FOUND: apps/mobile/src/components/shopping/AddItemSheet.tsx
- FOUND: apps/mobile/src/app/shopping/_layout.tsx
- FOUND: apps/mobile/src/app/shopping/orders.tsx
- FOUND: apps/mobile/src/app/shopping/order/[id].tsx
- FOUND: apps/mobile/src/app/(tabs)/shopping.tsx (modified)
- FOUND: apps/mobile/src/types/shopping.ts (modified)
- FOUND commit: 11d0d54
- FOUND commit: 816b630
