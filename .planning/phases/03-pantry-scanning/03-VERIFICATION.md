---
phase: 03-pantry-scanning
verified: 2026-04-10T00:41:30Z
status: gaps_found
score: 9/11 must-haves verified
gaps:
  - truth: "User can tap a scan button, choose fridge/pantry/freezer, take a photo, and see AI-detected items"
    status: failed
    reason: "startScan reads data.items from the API response but the server's POST /scan returns { data: [...] }. The ?? [] fallback silently fires so scanResults is always empty after a real scan. The unit test masks this by mocking the response as { items: [...] } instead of { data: [...] }."
    artifacts:
      - path: "apps/mobile/src/stores/pantryStore.ts"
        issue: "Line 76: (data.items ?? []) should be (data.data ?? []) to match server response shape { data: ScanResult[] }"
    missing:
      - "Fix startScan in pantryStore.ts: change data.items to data.data"
      - "Update pantryStore confirmScan test mock to return { data: [...] } instead of { items: [...] } to match actual server contract"

  - truth: "User can confirm reviewed items and see them appear in their pantry inventory"
    status: failed
    reason: "confirmScan reads data.items from the API response but the server's POST /confirm returns { data: [...] }. confirmedItems is always [] so nothing is ever merged into the pantry after confirmation."
    artifacts:
      - path: "apps/mobile/src/stores/pantryStore.ts"
        issue: "Line 146: (data.items ?? []) should be (data.data ?? []) to match server response shape { data: PantryItem[] }"
    missing:
      - "Fix confirmScan in pantryStore.ts: change data.items to data.data"

human_verification:
  - test: "Full scan-to-inventory flow on device/simulator"
    expected: "After taking a photo, review screen shows detected items; confirming adds them to the pantry tab and they persist across app restarts"
    why_human: "Visual camera flow, navigation transitions, and actual AI response quality cannot be verified programmatically"
  - test: "Uncertainty indicator for stale items"
    expected: "Items not seen in 7+ days display muted opacity, a clock icon, and 'Not seen in X days' text"
    why_human: "Cannot fast-forward real time; verified by unit tests only — visual rendering requires device inspection"
  - test: "Optimistic update rollback under network failure"
    expected: "Marking an item used/depleted while offline reverts the UI change cleanly"
    why_human: "Requires simulated network failure on a running device"
---

# Phase 3: Pantry Scanning Verification Report

**Phase Goal:** Users can photograph their fridge, pantry, and freezer and the app builds an accurate, persistent inventory
**Verified:** 2026-04-10T00:41:30Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | pantry_items table exists with correct schema and RLS policies | VERIFIED | `supabase/migrations/00003_pantry_items.sql` — full schema with 9 columns, 3 indexes, 4 RLS policies, updated_at trigger |
| 2 | TypeScript types for pantry domain exported and usable | VERIFIED | `apps/mobile/src/types/pantry.ts` exports all 6 required types: FoodCategory, SourceLocation, PantryItemStatus, PantryItem, ScanResult, ReviewItem |
| 3 | ANTHROPIC_API_KEY configured in server env and test env | VERIFIED | `packages/server/src/config/env.ts` line 23 has lazy getter; `packages/server/vitest.config.ts` line 14 has test key |
| 4 | Claude Vision API called with base64 image and tool_use schema | VERIFIED | `packages/server/src/services/vision.ts` — identifyFoodItems uses forced tool_choice, correct message structure, model claude-sonnet-4-20250514 |
| 5 | Reconciliation upserts items by normalized_name + source_location, never auto-deletes | VERIFIED | `packages/server/src/services/pantry.ts` — select-then-insert/update pattern; no delete calls issued |
| 6 | Pantry routes handle GET, POST /scan, POST /confirm, PATCH /:id | VERIFIED | `packages/server/src/routes/pantry.ts` — all 4 routes present, wired to vision and reconciliation services |
| 7 | User can tap a scan button, choose location, take photo, and see AI-detected items | FAILED | `startScan` in pantryStore reads `data.items` but server returns `{ data: [...] }` — scan results are always empty |
| 8 | User can confirm reviewed items and see them appear in pantry inventory | FAILED | `confirmScan` reads `data.items` but server returns `{ data: [...] }` — confirmed items are never merged |
| 9 | Pantry store exposes items reactively, supports scan review workflow | VERIFIED | `apps/mobile/src/stores/pantryStore.ts` — Zustand store with full state shape and all 8 actions implemented |
| 10 | Confidence decay calculates effective confidence based on days since last_seen_at | VERIFIED | `apps/mobile/src/hooks/usePantryItems.ts` — getEffectiveConfidence: 7-day grace, 0.05/day linear decay, floor at 0.1; 5 tests pass |
| 11 | Pantry tab shows items grouped by category with scan FAB and location filters | VERIFIED | `apps/mobile/src/app/(tabs)/pantry.tsx` uses usePantryItems, PantryItemList (SectionList), ScanButton, location filter tabs |

**Score:** 9/11 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `supabase/migrations/00003_pantry_items.sql` | VERIFIED | CREATE TABLE, 3 CREATE INDEX, 4 CREATE POLICY, 1 trigger — complete |
| `apps/mobile/src/types/pantry.ts` | VERIFIED | All 6 exports present and structurally correct |
| `packages/server/src/config/anthropic.ts` | VERIFIED | Singleton exported; imports ANTHROPIC_API_KEY from env |
| `packages/server/src/config/env.ts` | VERIFIED | ANTHROPIC_API_KEY getter at line 23 |

### Plan 02 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/server/src/services/vision.ts` | VERIFIED | identifyFoodItems exported; imports anthropic from config; tool_use schema correct |
| `packages/server/src/services/pantry.ts` | VERIFIED | reconcileItems and normalizeName exported; additive-only logic verified |
| `packages/server/src/routes/pantry.ts` | VERIFIED | Default export; all 4 routes; calls identifyFoodItems and reconcileItems |
| `packages/server/src/services/__tests__/vision.test.ts` | VERIFIED | 5 tests all passing |
| `packages/server/src/services/__tests__/pantry.test.ts` | VERIFIED | 4 reconciliation tests + normalizeName tests all passing |

### Plan 03 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/mobile/src/stores/pantryStore.ts` | VERIFIED (with bug) | Exists and structurally complete; but API response key mismatch makes startScan/confirmScan non-functional at runtime |
| `apps/mobile/src/stores/__tests__/pantryStore.test.ts` | VERIFIED | 7 tests passing — but test mock uses wrong response shape { items: [...] } masking the runtime bug |
| `apps/mobile/src/hooks/usePantryItems.ts` | VERIFIED | usePantryItems and getEffectiveConfidence exported; wired to usePantryStore |
| `apps/mobile/src/hooks/__tests__/usePantryItems.test.ts` | VERIFIED | 5 tests all passing |

### Plan 04 Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `apps/mobile/src/app/scan/_layout.tsx` | VERIFIED | Stack layout with index and review screens |
| `apps/mobile/src/app/scan/index.tsx` | VERIFIED | LocationPicker + ImagePicker + startScan wired; loading state renders |
| `apps/mobile/src/app/scan/review.tsx` | VERIFIED | scanResults read; confirmScan called; addReviewItem/removeReviewItem/updateReviewItem all used |
| `apps/mobile/src/app/(tabs)/pantry.tsx` | VERIFIED | usePantryItems called; EmptyPantry, PantryItemList, ScanButton all rendered |
| `apps/mobile/src/components/pantry/PantryItemCard.tsx` | VERIFIED | markItemUsed/markItemDepleted called; isUncertain styling applied; expand-to-act pattern |
| `apps/mobile/src/components/pantry/PantryItemList.tsx` | VERIFIED | SectionList with CATEGORY_ORDER; pull-to-refresh |
| `apps/mobile/src/components/pantry/ScanButton.tsx` | VERIFIED | FAB navigates to /scan |
| `apps/mobile/src/components/pantry/LocationPicker.tsx` | VERIFIED | 3 location cards with selection state |
| `apps/mobile/src/components/pantry/ReviewItemRow.tsx` | VERIFIED | Toggle accepted, inline name edit, confidence badge, remove button |
| `apps/mobile/src/components/pantry/EmptyPantry.tsx` | VERIFIED | Empty state with "Scan Now" navigating to /scan |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/server/src/config/anthropic.ts` | `packages/server/src/config/env.ts` | `env.ANTHROPIC_API_KEY` | WIRED | Line 3: `env.ANTHROPIC_API_KEY` |
| `packages/server/src/routes/pantry.ts` | `packages/server/src/services/vision.ts` | `identifyFoodItems` | WIRED | Line 3 import + line 62 call |
| `packages/server/src/routes/pantry.ts` | `packages/server/src/services/pantry.ts` | `reconcileItems` | WIRED | Line 4 import + line 87 call |
| `packages/server/src/services/vision.ts` | `packages/server/src/config/anthropic.ts` | `import.*anthropic` | WIRED | Line 1 import; used in identifyFoodItems |
| `apps/mobile/src/app/scan/index.tsx` | `apps/mobile/src/stores/pantryStore.ts` | `usePantryStore.*startScan` | WIRED | Line 13 destructure; line 42 call |
| `apps/mobile/src/app/scan/review.tsx` | `apps/mobile/src/stores/pantryStore.ts` | `scanResults`, `confirmScan` | WIRED | Lines 19-24 destructure; lines 73, 90-94 use |
| `apps/mobile/src/app/(tabs)/pantry.tsx` | `apps/mobile/src/hooks/usePantryItems.ts` | `usePantryItems` | WIRED | Line 6 import; line 26 call |
| `apps/mobile/src/components/pantry/PantryItemCard.tsx` | `apps/mobile/src/stores/pantryStore.ts` | `markItemUsed`, `markItemDepleted` | WIRED | Line 5 import; lines 18, 26-38 calls |
| `apps/mobile/src/stores/pantryStore.ts` → `POST /scan` | Server response shape | `data.data` | BROKEN | Store reads `data.items` but server returns `{ data: [...] }` |
| `apps/mobile/src/stores/pantryStore.ts` → `POST /confirm` | Server response shape | `data.data` | BROKEN | Store reads `data.items` but server returns `{ data: [...] }` |
| `apps/mobile/src/hooks/usePantryItems.ts` | `apps/mobile/src/stores/pantryStore.ts` | `usePantryStore` | WIRED | Line 2 import; line 46 call |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PANT-01 | 03-02, 03-04 | User can take a photo of their fridge and AI identifies visible food items | BLOCKED | identifyFoodItems is implemented and tested; but startScan response parsing bug means results never reach the UI |
| PANT-02 | 03-02, 03-04 | User can take a photo of pantry shelves and AI identifies items | BLOCKED | Same startScan bug — source_location='pantry' is supported in backend but broken at store layer |
| PANT-03 | 03-02, 03-04 | User can take a photo of freezer and AI identifies items | BLOCKED | Same startScan bug — all three locations affected |
| PANT-04 | 03-02, 03-04 | AI shows detected items with confidence scores for user confirmation | BLOCKED | ReviewItemRow renders confidence badges correctly; but scan results are empty due to startScan bug |
| PANT-05 | 03-03, 03-04 | User can correct, remove, or add items the AI missed | PARTIAL | updateReviewItem, removeReviewItem, addReviewItem all implemented and tested; blocked in practice by PANT-01 bug |
| PANT-06 | 03-01, 03-02 | Pantry inventory persists across multiple scans (reconciliation) | BLOCKED | reconcileItems is correct and tested; but confirmScan response parsing bug means items never persist |
| PANT-07 | 03-03 | Items not seen in 7+ days marked as uncertain | VERIFIED | getEffectiveConfidence fully tested with 5 passing cases; isUncertain flag wired to UI opacity + clock icon |
| PANT-08 | 03-03, 03-04 | User can manually mark items as used or depleted | VERIFIED | markItemUsed/markItemDepleted with optimistic updates + rollback; PantryItemCard expand-to-act UI wired |

**Coverage summary:** 8/8 requirement IDs claimed across plans are accounted for. All 8 appear in REQUIREMENTS.md mapped to Phase 3. No orphaned requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `apps/mobile/src/stores/pantryStore.ts` line 76 | `data.items ?? []` — wrong response key | BLOCKER | Scan results always empty; PANT-01/02/03/04/05 all broken at runtime |
| `apps/mobile/src/stores/pantryStore.ts` line 146 | `data.items ?? []` — wrong response key | BLOCKER | Confirmed items never merged into pantry; PANT-06 broken at runtime |
| `apps/mobile/src/stores/__tests__/pantryStore.test.ts` line 261 | Mock returns `{ items: [...] }` but real server returns `{ data: [...] }` | WARNING | Test passes while hiding the bug above; gives false confidence |

---

## Test Results

| Suite | Tests | Status |
|-------|-------|--------|
| `packages/server/src/services/__tests__/vision.test.ts` | 5/5 | All passing |
| `packages/server/src/services/__tests__/pantry.test.ts` | 4/4 + 1 normalizeName | All passing |
| `apps/mobile/src/stores/__tests__/pantryStore.test.ts` | 7/7 | All passing (but mock masks API contract bug) |
| `apps/mobile/src/hooks/__tests__/usePantryItems.test.ts` | 5/5 | All passing |

---

## Human Verification Required

### 1. Full Scan-to-Inventory Flow

**Test:** Take a photo of real food items using the scan flow on device/simulator (after fixing the response-key bug)
**Expected:** Review screen shows AI-detected items with confidence badges; confirming navigates to pantry tab showing items grouped by category
**Why human:** Camera permissions, actual photo capture, AI response quality, and navigation transitions cannot be verified programmatically

### 2. Uncertainty Indicator Rendering

**Test:** Manually set a pantry item's `last_seen_at` to 20+ days ago in Supabase, then reload the pantry tab
**Expected:** That item displays with muted opacity (0.6), a clock icon, and "Not seen in X days" text
**Why human:** Cannot fast-forward real time in the running app; rendering correctness requires visual inspection

### 3. Optimistic Rollback Under Network Failure

**Test:** Put device in airplane mode, then tap "Used" or "Gone" on a pantry item
**Expected:** Item optimistically disappears from the list, then reappears after the network request fails
**Why human:** Requires simulated network failure during a live PATCH request

---

## Gaps Summary

Two blocking gaps prevent the core user journey from functioning end-to-end at runtime. Both are the same root cause: the Zustand store reads `data.items` from the scan and confirm API responses, but the Hono backend consistently returns `{ data: [...] }` (not `{ items: [...] }`). The `?? []` fallback silently swallows the mismatch — no error is thrown, scans appear to succeed, but zero items are ever stored.

This means PANT-01, PANT-02, PANT-03, PANT-04, PANT-05 (camera → AI → review flow), and PANT-06 (persistence) are all blocked. The two requirements that do not depend on this flow — PANT-07 (confidence decay) and PANT-08 (mark used/depleted) — are fully verified.

The fix is a two-line change in `pantryStore.ts` (lines 76 and 146: `data.items` → `data.data`), plus updating the corresponding test mock to match the real server contract.

The infrastructure layers — database schema, RLS, Anthropic client, vision service, reconciliation service, all UI components, and all navigation wiring — are correctly implemented and substantive.

---

_Verified: 2026-04-10T00:41:30Z_
_Verifier: Claude (gsd-verifier)_
