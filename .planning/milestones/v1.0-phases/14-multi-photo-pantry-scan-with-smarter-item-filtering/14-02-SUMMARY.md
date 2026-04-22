---
phase: 14-multi-photo-pantry-scan-with-smarter-item-filtering
plan: 02
subsystem: ui
tags: [react-native, expo, multi-photo, pantry-scan, zustand, image-picker, thumbnail-strip]

requires:
  - phase: 14-multi-photo-pantry-scan-with-smarter-item-filtering
    provides: POST /scan-batch endpoint, identifyFoodItemsBatch service, filtering prompt
  - phase: 03-pantry-scanning
    provides: pantryStore, scan flow, review screen, SourceLocation types
provides:
  - Multi-photo capture UI (1-5 photos per scan session) with thumbnail strip
  - startBatchScan Zustand action wiring mobile to POST /scan-batch
  - Confidence-based accept/reject defaults in review screen (>=0.7 accepted)
  - Pantry-aware AI dedup (existing items excluded from new scan results)
  - Location pass-through from scan to review via route params (fixes hardcoded 'fridge')
affects: [15-ui-polish, any future scan UX work]

tech-stack:
  added: []
  patterns:
    - "Ephemeral local state (useState) for pre-submission photo buffer; Zustand only after batch submit (per research Pattern 3)"
    - "Fixed-width thumbnail slot sizing (screen-width / 6) so 5 photos + add button fit one row without horizontal scroll"
    - "Route params as scan->review context transfer (sourceLocation) instead of Zustand global state"
    - "Pantry-aware dedup: backend reads current pantry at scan location and passes existing item names to AI to exclude them"

key-files:
  created: []
  modified:
    - apps/mobile/src/stores/pantryStore.ts
    - apps/mobile/src/app/scan/index.tsx
    - apps/mobile/src/app/scan/review.tsx
    - apps/mobile/src/app/(tabs)/pantry.tsx
    - packages/server/src/routes/pantry.ts
    - packages/server/src/services/vision.ts
    - packages/server/src/routes/__tests__/pantry.test.ts

key-decisions:
  - "CapturedPhoto buffer lives in useState (not Zustand) — photos only touch global state via startBatchScan at submit time"
  - "Location locks after first photo (one location per session) with visible note to user"
  - "'Submit' label on batch button (replaced verbose 'Scan All Photos' after checkpoint feedback)"
  - "Thumbnail row sizes slots by screen width so 5 photos + add button fit one row without horizontal scroll"
  - "Pantry-aware dedup: /scan-batch fetches existing pantry items at the target location and passes them to identifyFoodItemsBatch as existingItemNames so shelf-stable items (oils, condiments) don't clutter repeat scans"
  - "Confidence-based accept/reject mapping happens in startBatchScan (store layer), not review screen — review screen stays a dumb renderer"

patterns-established:
  - "Pre-submission buffer in component state, submit folds into Zustand — pattern for any batch-style capture flow"
  - "Screen-width-derived flex sizing for fixed-slot UI rows that must fit N items without scroll"
  - "Backend reads existing domain state and passes it to AI to exclude already-known items (generalizable beyond pantry)"

requirements-completed: ["Pantry UX improvement (post-v1)"]

duration: 22h
completed: 2026-04-17
---

# Phase 14 Plan 02: Mobile Multi-Photo Scan + Review Fixes Summary

**Multi-photo pantry capture (1-5 photos per session) with thumbnail strip, batch submit wired to /scan-batch, confidence-based review defaults, and pantry-aware AI dedup so shelf-stable items stop re-cluttering every scan**

## Performance

- **Duration:** ~22h wall-clock (spans checkpoint human-verify cycle on physical iPhone)
- **Started:** 2026-04-17T05:28:00Z
- **Completed:** 2026-04-18T03:36:52Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 7 (3 new + 4 during checkpoint fixes)

## Accomplishments
- Users can capture up to 5 photos of different shelves/angles before submitting a single batch scan
- Thumbnail strip fits 5 photos + add button on one row (no horizontal scroll) with tap-to-preview and remove-on-preview
- Location picker locks after first photo so one scan session = one location
- Loading state shows photo count ("Analyzing 3 photos…")
- Review screen now reads sourceLocation from route params (Pitfall 2 fixed — hardcoded 'fridge' bug eliminated)
- Items below 0.7 confidence default to unchecked; above threshold default to accepted
- Pantry-aware dedup: AI receives list of existing pantry items at scan location and excludes them, so repeat scans only surface NEW items

## Task Commits

Each task was committed atomically:

1. **Task 1: Add startBatchScan to pantryStore and rebuild scan screen with multi-photo capture** - `e8c94a8` (feat)
2. **Task 2: Fix review screen location bug and confidence-based defaults** - `cbb32cb` (fix)
3. **Task 3: Verify multi-photo scan flow end-to-end** - approved by human-verify on physical iPhone

**Checkpoint fixes (post-verification, rolled into plan scope):** `f6e063d` (fix)

## Files Created/Modified
- `apps/mobile/src/stores/pantryStore.ts` — Added startBatchScan action calling POST /scan-batch with confidence-based accepted mapping
- `apps/mobile/src/app/scan/index.tsx` — Full rewrite: CapturedPhoto local state, horizontal thumbnail strip, preview modal, location lock, "Submit" button, loading count
- `apps/mobile/src/app/scan/review.tsx` — Replaced hardcoded sourceLocation with useLocalSearchParams + allowlist validation
- `apps/mobile/src/app/(tabs)/pantry.tsx` — Minor adjustments during checkpoint pass (header/scan-FAB alignment)
- `packages/server/src/routes/pantry.ts` — /scan-batch now fetches current pantry items at scan location and passes existingItemNames to identifyFoodItemsBatch
- `packages/server/src/services/vision.ts` — identifyFoodItemsBatch accepts optional existingItemNames parameter, injected into filtering prompt
- `packages/server/src/routes/__tests__/pantry.test.ts` — Updated expectation to match new 3-arg call signature

## Decisions Made
- **CapturedPhoto buffer in useState, not Zustand** — Pre-submission photos are ephemeral; global state only enters the picture after startBatchScan succeeds (research Pattern 3).
- **One location per scan session** — LocationPicker disables after first photo; visible "applies to all photos in this session" note.
- **"Submit" over "Scan All Photos"** — Shorter label, fits thumbnail strip layout, less verbose (checkpoint feedback).
- **Screen-width-based thumbnail sizing** — Replaced FlatList horizontal scroll with fixed-width slots (screenWidth/6) so 5 photos + "+" button always fit one row on any iPhone width.
- **Pantry-aware dedup over client-side filter** — Backend route fetches current pantry items at scan location and tells the AI to exclude them, so shelf-stable items (olive oil, soy sauce, hot sauce) don't clutter review after every scan. This moves dedup logic closer to the AI prompt where it has full context.
- **Confidence threshold in startBatchScan, not review screen** — Review stays a dumb renderer reading item.accepted; threshold of 0.7 applied once at store layer during mapping.

## Deviations from Plan

### Auto-fixed Issues (during checkpoint human-verify cycle)

**1. [Rule 1 - UX Bug] Thumbnail strip required horizontal scroll on iPhone widths**
- **Found during:** Task 3 (human-verify on physical iPhone)
- **Issue:** FlatList-based thumbnail strip overflowed screen width with 5 photos + add button, forcing horizontal scroll that felt clunky.
- **Fix:** Replaced FlatList with fixed-slot row sized by screen width / 6 so all 6 slots (5 photo max + add) fit without scrolling regardless of device width.
- **Files modified:** `apps/mobile/src/app/scan/index.tsx`
- **Verification:** Visually verified on physical iPhone — 5 photos + "+" fit one row, no scroll.
- **Committed in:** `f6e063d`

**2. [Rule 2 - Missing Critical] Shelf-stable items re-cluttered every scan**
- **Found during:** Task 3 (human-verify on physical iPhone)
- **Issue:** AI had no knowledge of current pantry, so items like olive oil, hot sauce, soy sauce (already in pantry, obviously still there, not worth re-reviewing) came back in every scan result, burying genuinely new items.
- **Fix:** Added optional `existingItemNames` parameter to `identifyFoodItemsBatch`. The `/scan-batch` route now fetches current pantry items at the target `source_location` from Supabase and passes them to the service, which injects them into the filtering prompt as "exclude these items — they're already tracked". AI now only surfaces NEW items per scan.
- **Files modified:** `packages/server/src/routes/pantry.ts`, `packages/server/src/services/vision.ts`, `packages/server/src/routes/__tests__/pantry.test.ts`
- **Verification:** Test updated for new 3-arg signature; human verified on physical iPhone that repeat scans no longer re-surface shelf-stable items.
- **Committed in:** `f6e063d`

**3. [Rule 1 - UX Label] "Scan All Photos" was too verbose for the button layout**
- **Found during:** Task 3 (human-verify on physical iPhone)
- **Issue:** Verbose label didn't fit the intended visual balance with thumbnail strip above it.
- **Fix:** Renamed to "Submit".
- **Files modified:** `apps/mobile/src/app/scan/index.tsx`
- **Verification:** Visually verified on device.
- **Committed in:** `f6e063d`

---

**Total deviations:** 3 auto-fixed (2 UX bugs, 1 missing-critical dedup feature)
**Impact on plan:** All deviations surfaced during the human-verify checkpoint and were auto-addressed before approval. The pantry-aware dedup is arguably the highest-value change in the plan — without it, the multi-photo flow would have worsened the "noisy review" problem by showing the same shelf-stable items N times.

## Issues Encountered
None beyond the deviations above. Server tests pass, TypeScript compiles, human verification approved.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 complete (both plans shipped).
- Multi-photo pantry scan flow is production-ready on iOS dev client.
- Phase 15 (UI Polish & Navigation Consistency) can now begin — no open blockers from 14.

---
*Phase: 14-multi-photo-pantry-scan-with-smarter-item-filtering*
*Completed: 2026-04-17*

## Self-Check: PASSED

- FOUND commit: `e8c94a8` (Task 1)
- FOUND commit: `cbb32cb` (Task 2)
- FOUND commit: `f6e063d` (checkpoint fixes)
- FOUND file: `apps/mobile/src/stores/pantryStore.ts`
- FOUND file: `apps/mobile/src/app/scan/index.tsx`
- FOUND file: `apps/mobile/src/app/scan/review.tsx`
- FOUND file: `packages/server/src/routes/pantry.ts`
- FOUND file: `packages/server/src/services/vision.ts`
- FOUND file: `packages/server/src/routes/__tests__/pantry.test.ts`
