# Phase 14: Multi-Photo Scan & Smarter Item Filtering - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the existing pantry scan flow to accept multiple photos before submitting (capturing different angles/shelves), and improve AI item filtering to only return specifically identifiable cooking-relevant items. No vague placeholder items like "leftover container" or "unidentified dairy item".

</domain>

<decisions>
## Implementation Decisions

### Multi-photo capture flow
- Thumbnail strip at the bottom of the scan screen showing captured photos
- "+" button to add more photos, "Scan All Photos" button to submit
- Maximum 5 photos per scan session
- Tap a thumbnail to view full-size with a "Remove" button
- One location (Fridge/Pantry/Freezer) applies to all photos in a session — different locations require separate scan sessions

### Photo-to-API strategy
- Send all photos in a single Claude API call with multiple image blocks
- Claude sees all photos together and deduplicates naturally across them
- Simple spinner loading state: "Analyzing 4 photos..." with count
- API endpoint design (new vs reuse existing): Claude's discretion

### Item filtering rules
- Update the AI vision prompt to only return items it can specifically name as cooking ingredients
- Explicitly instruct Claude NOT to return vague descriptions: "leftover container", "unidentified item", "condiment packet", "sauce packet", "unknown dairy", etc.
- Named condiments (ketchup, soy sauce, olive oil) ARE included — the issue is unidentifiable items, not condiment category
- All beverages included (even non-cooking ones like water, soda) — user can reject on review screen
- No server-side blocklist needed — prompt-only approach

### Review screen
- One flat merged list sorted by category — no grouping by photo source
- Item count only in header (not photo count)
- Items above 0.7 confidence default to accepted, below 0.7 default to rejected
- User can still toggle any item's accepted state

### Claude's Discretion
- Whether to create a new `/scan-batch` endpoint or extend the existing `/scan` endpoint
- Loading state animation details
- Exact confidence threshold (0.7 suggested but can adjust based on testing)
- Thumbnail strip component implementation details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scan/index.tsx`: Current single-photo capture screen — needs multi-photo state management added
- `scan/review.tsx`: Review screen with accept/reject/edit per item — mostly reusable as-is, needs confidence-based default toggling
- `pantryStore.ts`: `startScan()` sends single image to API — needs new method for multi-image batch
- `vision.ts`: `identifyFoodItems()` with Claude tool_use — needs multi-image variant and prompt update
- `LocationPicker` component: Reusable as-is
- `Button`, `Input` components: Reusable

### Established Patterns
- `ImagePicker.launchCameraAsync()` with `quality: 0.4` and `base64: true` — keep this for each photo
- 5MB per-image Anthropic limit enforced server-side in `vision.ts`
- `authedFetch()` pattern in stores for API calls
- `ReviewItem` type with `accepted`, `userEdited`, `confidence` fields

### Integration Points
- `POST /api/v1/pantry/scan` route in `routes/pantry.ts` — extend or create batch variant
- `identifyFoodItems()` in `vision.ts` — needs multi-image support and prompt change
- `AnthropicAdapter.analyzeImageStructured()` — currently takes single `imageBase64`, needs to support array of images
- Pantry FAB button on pantry tab routes to `/scan`

</code_context>

<specifics>
## Specific Ideas

- User described frustration with current single-photo flow: "photographing every single item individually doesn't scale"
- Specific examples of bad AI results to eliminate: "leftover container", "condiment or sauce packet", "unidentified dairy or deli item"
- The filtering should only capture "stuff it can identify" — if the AI can't name it specifically, silently exclude it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-multi-photo-pantry-scan-with-smarter-item-filtering*
*Context gathered: 2026-04-15*
