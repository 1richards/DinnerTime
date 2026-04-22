# Phase 13: Receipt Scan & Instacart Import - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning (autonomous mode — decisions inferred from user intent + established patterns)

<domain>
## Phase Boundary

Bulk-load pantry items from grocery receipts and Instacart purchases. The goal is to eliminate per-item photo scanning for people who shop once a week and want to dump their whole haul into the pantry at once. Two distinct entry points:
1. **Receipt scan** — User photographs a grocery receipt, AI extracts line items, user reviews, confirms → pantry
2. **Instacart import** — User imports items from their recent Instacart order(s) → pantry

Both feed the same review screen (reuse from Phase 3/14). Both land in the same pantry via existing `reconcileItems`.

</domain>

<decisions>
## Implementation Decisions

### Entry points on the Pantry tab
- Pantry FAB stays as camera scan (current behavior, Phase 14)
- Add a secondary action to access receipt scan and Instacart import — probably a bottom sheet or action menu triggered from a different button
- Location of the entry point: Claude's discretion — consider an overflow menu on the Pantry header, or a "How would you like to add items?" bottom sheet from the FAB with three options (Camera, Receipt, Instacart)

### Receipt scan flow
- Reuse `ImagePicker.launchCameraAsync` with `quality: 0.4, base64: true` (same settings as photo scan — keeps under Anthropic's 5MB limit)
- Single photo per receipt submission (receipts are naturally one image; no multi-photo need)
- Server endpoint: `POST /api/v1/pantry/scan-receipt`
- AI service: new `identifyReceiptItems(base64Image, sourceLocation)` in `vision.ts` — uses Claude vision via `getClientFor('vision.pantryScan')` or a new task route if the prompt differs significantly
- AI prompt must understand: receipts are line items with quantities/units/prices; extract food items only, skip tax/subtotal/discounts
- Results flow into the existing review screen (`scan/review.tsx`) — same `ReviewItem` shape, same accept/reject/edit
- Confidence threshold defaults (≥0.7 accepted) carry from Phase 14

### Instacart import flow — needs research decision
- The current Instacart integration is "link-based": we POST recipes/ingredient lists and get hosted URLs back for ordering
- It is UNCLEAR whether the Developer Platform API exposes purchase history
- **Researcher must determine** viable approaches, ranked:
  1. Official API endpoint for order history (if available)
  2. OAuth + scraping workflow (if permissible)
  3. User forwards order confirmation email → backend parses email HTML
  4. User uploads order screenshot → vision AI extracts items (same as receipt scan but different prompt)
  5. Manual order ID entry + lookup (if supported)
- Planner locks the approach based on research findings
- If NO viable approach exists, the Instacart sub-feature is descoped and replaced with a clearer path (e.g., "paste your order email")

### Review flow reuse
- Both receipt-extracted and Instacart-imported items land on `scan/review.tsx`
- No photo grouping, no source indicator — flat list by category (same as Phase 14)
- Source location is passed via route params (`sourceLocation: 'pantry'` default since receipts/groceries typically go to pantry + fridge mixed; user can edit per item in review)
- `reconcileItems` handles dedup against existing pantry (already updates `last_seen_at` on match)

### Confidence & filtering
- Reuse Phase 14's FILTERING_RULES — no vague items, only specifically named foods
- Receipts have structured text so confidence should be higher on average than photo scans
- Existing-pantry dedup (from Phase 14 checkpoint) applies: don't re-report items already tracked

### Claude's Discretion
- UI for the secondary entry point (bottom sheet vs. menu vs. separate screen button)
- Whether receipt scan uses the same `vision.pantryScan` task route or a new `vision.receiptScan` route in task routing
- Exact Instacart approach (researcher/planner choose based on API constraints)
- Error messaging for unparseable receipts

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scan/review.tsx`: Review screen with accept/reject/edit — reuse unchanged for both receipt and Instacart flows
- `pantryStore.ts`: `startBatchScan` pattern — adapt for `startReceiptScan` and `startInstacartImport`
- `vision.ts`: Established `analyzeImageStructured` + tool_use pattern for Claude Vision — extend with `identifyReceiptItems`
- `routes/pantry.ts`: Existing `/scan` and `/scan-batch` endpoints — add `/scan-receipt` and `/instacart-import` (name TBD)
- `reconcileItems` in `services/pantry.ts`: Unchanged — handles dedup and upsert by normalized_name + source_location
- `FILTERING_RULES` constant in vision.ts: Reuse; maybe extend with receipt-specific guidance ("ignore tax, subtotal, discount lines")
- `coerceCategory` helper: Reuse for category normalization

### Established Patterns
- AIClient interface with `getClientFor(task)` — add new task type if receipt parsing warrants its own model/prompt
- Confidence-based accept defaults (≥0.7) — apply to receipt results
- Existing-pantry dedup via `existingItemNames` passed to the AI — apply to receipt and Instacart flows
- Hono route pattern with authMiddleware + supabase/user from context
- Mobile camera: `ImagePicker.launchCameraAsync({ base64: true, quality: 0.4, mediaTypes: ['images'] })`
- Size validation: 5MB per image limit enforced in vision service

### Integration Points
- Pantry tab FAB currently routes to `/scan` (photo scan only) — needs an additional entry point or sheet
- Review screen accepts items via route params; new flows populate `scanResults` in pantryStore and route to `/scan/review`
- Supabase `pantry_items` table unchanged — reuse existing schema

</code_context>

<specifics>
## Specific Ideas

- User's frustration: "photographing every single item individually doesn't scale"
- The thesis: once-a-week shoppers want to dump their whole haul at once
- Receipts contain structured line items — should parse cleanly with Claude Vision
- Instacart exposes order history to users in their web/mobile UI; the question is whether the Developer Platform API surfaces it to third parties

</specifics>

<deferred>
## Deferred Ideas

- Amazon Fresh / Whole Foods / Walmart Grocery imports — future phase if Instacart pattern works well
- Barcode scanning for individual items — separate phase if needed
- Offline receipt scan (capture now, process later) — not required for v1 of this phase

</deferred>

---

*Phase: 13-receipt-scan-and-instacart-import-for-bulk-pantry-loading*
*Context gathered: 2026-04-17 (autonomous mode)*
