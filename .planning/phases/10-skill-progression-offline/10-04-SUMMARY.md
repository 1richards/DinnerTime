---
phase: 10-skill-progression-offline
plan: 04
subsystem: mobile-offline
tags: [offline, persistence, zustand, asyncstorage, netinfo, foundation]
requires:
  - 10-01
provides:
  - persistent-stores
  - network-store
  - offline-queue
  - foun-07-mobile
affects:
  - apps/mobile/src/stores/recipeStore.ts
  - apps/mobile/src/stores/pantryStore.ts
  - apps/mobile/src/stores/mealPlanStore.ts
  - apps/mobile/src/stores/preferencesStore.ts
  - apps/mobile/src/stores/shoppingStore.ts
tech-stack:
  added:
    - zustand/middleware (persist, createJSONStorage)
  patterns:
    - Zustand persist middleware with partialize + version
    - Module-side-effect NetInfo listener wiring
    - Executor-registry offline write queue with FIFO replay
key-files:
  created:
    - apps/mobile/src/stores/networkStore.ts
    - apps/mobile/src/lib/offlineQueue.ts
    - apps/mobile/src/stores/__tests__/networkStore.test.ts
    - apps/mobile/src/lib/__tests__/offlineQueue.test.ts
    - apps/mobile/src/stores/__tests__/recipeStore.persist.test.ts
  modified:
    - apps/mobile/src/stores/recipeStore.ts
    - apps/mobile/src/stores/pantryStore.ts
    - apps/mobile/src/stores/mealPlanStore.ts
    - apps/mobile/src/stores/preferencesStore.ts
    - apps/mobile/src/stores/shoppingStore.ts
    - apps/mobile/vitest.setup.ts
key-decisions:
  - "isInternetReachable=null treated as online (unknown != offline) to avoid false-offline flicker on cold launch"
  - "Offline queue executor registry decouples queue lib from store imports; stores register their own replay handlers at module init"
  - "Persist partialize strips loading/error/transient fields per store so rehydration never restores stale UI state"
  - "Global AsyncStorage mock in vitest.setup.ts so persist middleware loads cleanly across all existing store tests with zero per-file changes"
  - "markCooked offline path enqueues by day-of-week (entryId=String(day)) since mealPlanStore.markCooked signature is day-keyed"
metrics:
  duration: "4 min"
  tasks_completed: 2
  files_changed: 11
  completed_date: 2026-04-10
---

# Phase 10 Plan 04: Mobile Offline Foundation Summary

Persisted all five Zustand stores to AsyncStorage, added a NetInfo-driven networkStore, and a FIFO offline write queue that auto-replays on reconnect — the entire FOUN-07 mobile foundation (UI surfacing deferred to 10-05).

## What Was Built

**networkStore** (`apps/mobile/src/stores/networkStore.ts`)
- Initial `isOnline=true`, single NetInfo listener wired as module side-effect
- `isOnline = isConnected && isInternetReachable !== false` so `null` (unknown reachability) is treated as online

**offlineQueue** (`apps/mobile/src/lib/offlineQueue.ts`)
- `enqueue / getPending / flush` API, persists under `dinnertime-offline-queue`
- Internal `Map<type, Executor>` registry with `registerExecutor(type, fn)`
- FIFO flush: successful ops are removed, failed ops kept in place
- Subscribes to networkStore on module load — auto-flushes on false→true edge

**Persist middleware on 5 stores**
- `recipeStore` → `dinnertime-recipes` (recipes only)
- `pantryStore` → `dinnertime-pantry` (items only)
- `mealPlanStore` → `dinnertime-meal-plan` (currentPlan only)
- `preferencesStore` → `dinnertime-preferences` (members + cuisinePreferences + skillLevel)
- `shoppingStore` → `dinnertime-shopping` (currentList + items + orders)
- All use `createJSONStorage(() => AsyncStorage)`, `partialize` strips loading/error/transient flags, `version: 1`

**Offline write paths**
- `mealPlanStore.markCooked` → if offline, optimistic + enqueue `{type:'markCooked', entryId, recipeId}`; registers executor that calls `markCooked(Number(entryId))` on replay
- `pantryStore.markItemUsed/markItemDepleted` → if offline, optimistic + enqueue `{type:'pantryEdit', itemId, patch:{status}}`; registers executor that re-routes through the appropriate store action

**Test infrastructure**
- Added global AsyncStorage mock to `vitest.setup.ts` so persist middleware loads cleanly in every existing store test with zero per-file changes
- 13 new tests added across networkStore (5), offlineQueue (5), and recipeStore.persist (3)

## Verification

- `pnpm --filter mobile test` → **183/183 passing** (was 170 before this plan; 13 new tests, zero regressions)
- `pnpm --filter mobile exec tsc --noEmit` → clean
- All FOUN-07 must-have truths observable in code

## Tasks Executed

| # | Task | Commits |
|---|------|---------|
| 1 | networkStore + offlineQueue (RED → GREEN) | `1d9ba50`, `5698709` |
| 2 | Persist 5 stores + offline write hooks (RED → GREEN) | `2bf3b24`, `5af063f` |

## Deviations from Plan

None — plan executed as written. Two minor notes:

1. **MealPlanEntry has no entryId field**, so `markCooked` enqueues `entryId: String(day)` (day-of-week is the natural key for that store). The replay executor parses it back via `Number(op.entryId)`.
2. **pantryStore exposes `markItemUsed/markItemDepleted` instead of a generic `updateItem`**, so the offline path was added to both action wrappers and the pantryEdit executor branches on `patch.status` to dispatch back through the right action.

Both notes match the existing 10-01 / phase-08 store conventions and required no architectural changes.

## Self-Check: PASSED

Verified files exist:
- FOUND: apps/mobile/src/stores/networkStore.ts
- FOUND: apps/mobile/src/lib/offlineQueue.ts
- FOUND: apps/mobile/src/stores/__tests__/networkStore.test.ts
- FOUND: apps/mobile/src/lib/__tests__/offlineQueue.test.ts
- FOUND: apps/mobile/src/stores/__tests__/recipeStore.persist.test.ts

Verified commits exist:
- FOUND: 1d9ba50 test(10-04): add failing tests for networkStore and offlineQueue
- FOUND: 5698709 feat(10-04): add networkStore and offlineQueue
- FOUND: 2bf3b24 test(10-04): add failing rehydration test for recipeStore
- FOUND: 5af063f feat(10-04): persist stores and wire offline queue hooks
