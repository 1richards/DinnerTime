# Phase 13: Receipt Scan & Instacart Import - Research

**Researched:** 2026-04-15
**Domain:** Document vision (grocery receipts) + Instacart Developer Platform API constraints
**Confidence:** HIGH (receipt scan path), HIGH (Instacart decision — API does not expose order history)

## Summary

The receipt-scan half of this phase is a low-risk extension of the existing Phase 14 multi-photo pantry scan pattern. The same Claude Vision + structured tool-use pipeline handles grocery receipts cleanly — the only deltas are a receipt-specific prompt (strip tax/subtotal/totals, expand receipt abbreviations), a new `vision.receiptScan` task route, and a new `POST /pantry/scan-receipt` endpoint. The existing `reconcileItems`, review screen, and confidence threshold infrastructure is reusable with zero changes.

The Instacart half is where the plan pivots. **The Instacart Developer Platform API (the API we integrated in Phase 8) does not expose user purchase history, order history, or any read-side user data.** It is a partner-key, write-only, link-based API: we POST recipes/shopping lists and receive hosted Instacart URLs. There is no OAuth, no user-scoped auth, and no `/orders` or `/receipts` endpoint. A deprecated `GET /v2/fulfillment/users/{user_id}/orders` exists on the separate *Instacart Connect* API, but Connect is for retailer integrations (not third-party apps like ours) and the endpoint is deprecated even there.

**Primary recommendation:** Descope "Instacart API order history" to **approach #4 from CONTEXT.md — user uploads an Instacart order screenshot or order confirmation email screenshot, and Claude Vision extracts items using the same pipeline as the receipt scan.** This parallels the receipt flow almost 1:1 (one image → structured items → review → reconcile). Build a single unified "bulk import" service under the hood with two entry-point prompts (one for printed receipts, one for Instacart screenshots) that both call `identifyReceiptItems(base64, variant)`. This collapses the two flows in the backend while preserving the two-entry-point UX described in CONTEXT.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Two entry points on Pantry tab:** Pantry FAB stays as camera scan (Phase 14 unchanged). Add a secondary action for receipt scan and Instacart import — probably a bottom sheet or action menu from a separate button.
- **Receipt scan uses `ImagePicker.launchCameraAsync({ quality: 0.4, base64: true })`** — same settings as photo scan, keeps under Anthropic's 5 MB limit.
- **Single photo per receipt** — receipts are naturally one image; no multi-photo need.
- **Server endpoint: `POST /api/v1/pantry/scan-receipt`**
- **New AI service function:** `identifyReceiptItems(base64Image, sourceLocation)` in `vision.ts` — uses Claude vision via `getClientFor('vision.pantryScan')` OR a new task route if the prompt differs significantly.
- **AI prompt must:** understand receipts are line items with quantities/units/prices; extract food items only; skip tax/subtotal/discounts.
- **Review flow reuses** the existing `scan/review.tsx` — same `ReviewItem` shape, same accept/reject/edit.
- **Confidence threshold defaults (≥0.7 auto-accepted)** carry from Phase 14.
- **`reconcileItems` handles dedup** against existing pantry — no schema change, no new reconcile logic.
- **No photo grouping, no source indicator** on the review screen — flat list by category (same as Phase 14).
- **Source location** passed via route params. Default `sourceLocation: 'pantry'` because receipts/groceries typically span pantry + fridge mixed; user can edit per-item in review.
- **Reuse Phase 14's FILTERING_RULES** — no vague items, only specifically-named foods. Extend with receipt-specific guidance.
- **Existing-pantry dedup** (the Phase 14 pantry-aware dedup — `existingItemNames` passed to AI) applies to receipt and Instacart flows too.
- **If NO viable Instacart API approach exists**, Instacart sub-feature is descoped and replaced with a clearer path (e.g., paste/upload order email or screenshot).

### Claude's Discretion

- UI for the secondary entry point (bottom sheet vs. menu vs. separate screen button).
- Whether receipt scan uses the same `vision.pantryScan` task route or a new `vision.receiptScan` route in task routing.
- **Exact Instacart approach** (researcher/planner choose based on API constraints). **→ Research conclusion below: descope to screenshot import (approach #4).**
- Error messaging for unparseable receipts.

### Deferred Ideas (OUT OF SCOPE)

- Amazon Fresh / Whole Foods / Walmart Grocery imports — future phase if Instacart pattern works well.
- Barcode scanning for individual items — separate phase if needed.
- Offline receipt scan (capture now, process later) — not required for v1 of this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase requirement ID supplied: **"Pantry scalability (post-v1)"** — not a formal REQUIREMENTS.md ID. This is a post-v1 polish phase addressing user friction: *"photographing every single item individually doesn't scale"* for once-a-week shoppers who want to dump their whole haul at once.

| ID | Description | Research Support |
|----|-------------|------------------|
| Pantry scalability (post-v1) — Receipt scan | User photographs a grocery receipt → items extracted → pantry | Claude Vision handles printed receipt OCR well; existing batch-scan pipeline extends cleanly (new endpoint + new prompt only). Thermal-print fade is the only serious accuracy risk (documented in Pitfall 2). |
| Pantry scalability (post-v1) — Instacart import | User imports items from Instacart order history → pantry | **API-based import NOT VIABLE** (Instacart Developer Platform does not expose order history). Descope to screenshot-based import using the same vision pipeline as receipt scan. |
| Dedup with existing inventory | Imported items reconcile against existing pantry (no duplicates) | `reconcileItems` in `services/pantry.ts` already handles this via `normalized_name` + `source_location` upsert. Zero change required. |
| Pantry tab entry points | Both flows accessible from Pantry tab alongside camera scan | Current FAB routes to `/scan`. Add a bottom sheet or secondary action surfacing Camera / Receipt / Instacart as three choices. |

Phase success criteria from the orchestrator prompt:
1. User can photograph a grocery store receipt and get items extracted and added to pantry. ✓ (feasible — same pipeline as Phase 14 with receipt prompt)
2. User can import items from their Instacart order history into the pantry. → **Reframed as "User can upload an Instacart order screenshot and get items extracted"** because the Developer Platform API does not expose history.
3. Imported items are reconciled with existing pantry inventory (no duplicates). ✓ (zero change — existing `reconcileItems`)
4. Both flows are accessible from the Pantry tab alongside the existing camera scan. ✓ (UI choice — bottom sheet recommended; see Architecture Patterns)
</phase_requirements>

## Standard Stack

### Core (already in use — no new runtime dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | ^0.88.0 | Claude Vision for receipt + screenshot OCR | Already routed through `AIClient` abstraction. Claude Sonnet 4 handles receipt line-item extraction well with structured tool-use (no template-tuning needed). |
| expo-image-picker | ^55.0.18 | Single-photo capture (receipts) + single-image library pick (Instacart screenshots) | Already used in `scan/index.tsx`. Supports both camera capture (`launchCameraAsync`) and library picking (`launchImageLibraryAsync`) — both accept `{ base64: true, quality: 0.4 }`. |
| Hono | ^4.7.10 | Backend routes | Already hosts `/pantry/scan` and `/pantry/scan-batch`. Add `/pantry/scan-receipt` and `/pantry/import-instacart` (or a unified `/pantry/scan-document`). |
| Zustand | ^5.0 (via `pantryStore.ts`) | Client state for scan results | Extend existing store with `startReceiptScan` and `startInstacartImport` actions that populate `scanResults` and hand off to `/scan/review`. |

### Supporting (already in use)

| Library | Purpose |
|---------|---------|
| `@supabase/supabase-js` ^2.103.0 | `reconcileItems` runs via Supabase client from route context (unchanged). |
| `react-native-safe-area-context` | Screen chrome for any new screens (unchanged pattern). |
| `expo-router` | File-based routing for any new screen(s) (unchanged pattern). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Claude Vision | Taggun / Veryfi / Google Document AI | Taggun/Veryfi have retailer taxonomies that expand "CHKN BRST" → "Chicken Breast" out of the box, higher line-item accuracy on hard receipts. **Why not:** adds a second AI vendor, second API key, second billing surface, second error mode. Claude handles receipts well enough and the user already corrects items in review. Keep the stack single-provider. |
| expo-image-picker | react-native-document-scanner-plugin | Document scanner adds edge detection + perspective correction, which would improve receipt quality. **Why not:** native module (requires dev-client rebuild, which is fine — we already have one), but adds a dependency for a marginal win. The user-correctable review screen absorbs OCR errors. Revisit only if accuracy is unacceptable after Wave 1 shakedown. |
| expo-image-picker camera | expo-camera with custom overlay | Custom overlay could show a rectangular frame ("fit receipt inside this box") that helps users frame long receipts. **Why not:** Phase 14 already picked `expo-image-picker` for simplicity, receipts in review can be re-taken. Defer unless Wave 1 UAT surfaces framing complaints. |

**No new dependencies are required for this phase.** The work is pure backend + mobile wiring using libraries already installed.

**Version verification:** All versions listed are the same ones already pinned in `apps/mobile/package.json` and `packages/server/package.json` as of 2026-04-15 (confirmed via file read during research). No `npm view` upgrade needed.

## Architecture Patterns

### Recommended Project Structure (additions only)

```
packages/server/src/
├── services/
│   └── vision.ts                     # ADD: identifyReceiptItems(base64, variant, existingItemNames)
│                                     # variant: 'receipt' | 'instacart_screenshot'
└── routes/
    └── pantry.ts                     # ADD: POST /scan-receipt, POST /import-instacart
                                      #      (or unified POST /scan-document with { variant })

apps/mobile/src/
├── app/
│   ├── (tabs)/
│   │   └── pantry.tsx                # EDIT: replace single FAB with bottom-sheet launcher (or add secondary action)
│   └── scan/
│       ├── receipt.tsx               # ADD: single-photo capture screen (receipts)
│       └── instacart.tsx             # ADD: library-pick screen (Instacart screenshots)
├── components/pantry/
│   └── BulkImportSheet.tsx           # ADD: bottom sheet with three options (Camera / Receipt / Instacart)
└── stores/
    └── pantryStore.ts                # ADD: startReceiptScan(base64, sourceLocation)
                                      #      startInstacartImport(base64)
```

### Pattern 1: Vision pipeline extension — copy `identifyFoodItemsBatch`, swap prompt

**What:** Keep the tool-use schema (`report_food_items`) and the `FILTERING_RULES` constant. Introduce a new prompt variant that tells Claude the image is a receipt (or Instacart screenshot) and to extract line items, skip totals, expand abbreviations.

**When to use:** For both `scan-receipt` and `import-instacart` — both are single-image structured-OCR tasks with the same output shape as photo scans (`ScanResult[]`).

**Example (sketch — reuses the existing schema):**

```typescript
// Source: packages/server/src/services/vision.ts (existing pattern at identifyFoodItemsBatch)

const RECEIPT_FILTERING_RULES = `${FILTERING_RULES}

This image is a GROCERY RECEIPT (or a screenshot of an Instacart order summary).
- Each line typically shows: item name, quantity, unit or weight, price.
- Extract ONLY purchased food/grocery items.
- DO NOT report: subtotal, total, tax, tip, fees, discounts, coupons, store loyalty
  credits, deposits, bag fees, delivery fees, service fees, or store name.
- DO NOT report non-food items (cleaning supplies, paper goods, beauty products,
  medicine) even if they appear on the receipt.
- Expand common receipt abbreviations (e.g., "CHKN BRST" → "chicken breast",
  "ORG BANANA" → "organic bananas", "GV WHL MLK" → "whole milk").
- If a quantity column is present, use it. If only a price is present, default
  quantity to 1 and unit to "piece".
- If an item appears multiple times on separate lines, report it once with the
  summed quantity.`;

export async function identifyReceiptItems(
  base64Image: string,
  sourceLocation: 'fridge' | 'pantry' | 'freezer',
  existingItemNames: string[] = [],
  variant: 'receipt' | 'instacart_screenshot' = 'receipt',
): Promise<ScanResult[]> {
  // 5 MB validation (same as identifyFoodItems)
  const imageBytes = Buffer.from(base64Image, 'base64').length;
  if (imageBytes > MAX_BASE64_BYTES) throw new Error(/*...*/);

  const ai = getClientFor('vision.pantryScan'); // OR a new 'vision.receiptScan' route

  const existingBlock = existingItemNames.length > 0
    ? `\n\nALREADY IN PANTRY:\n${existingItemNames.map((n) => `- ${n}`).join('\n')}`
    : '';

  const variantPreamble = variant === 'instacart_screenshot'
    ? 'You are analyzing a screenshot of an Instacart order summary or order confirmation.'
    : 'You are analyzing a photograph of a printed grocery store receipt.';

  const result = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
    user: `${variantPreamble}\n\n${RECEIPT_FILTERING_RULES}${existingBlock}`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: foodItemsTool,           // reuse unchanged
    maxTokens: 4096,
  });

  return (result.items ?? []).map((item) => ({ ...item, category: coerceCategory(item.category) }));
}
```

### Pattern 2: Reuse `scanResults` + `scan/review.tsx` verbatim

**What:** After the receipt or Instacart endpoint returns, populate `pantryStore.scanResults` with `ReviewItem[]` using the same `scan-${Date.now()}-${index}` ID convention as `startBatchScan`. Navigate to `/scan/review?sourceLocation=pantry` (default for bulk imports per CONTEXT).

**Why:** The review screen is a dumb renderer. It doesn't care whether items came from a fridge photo, a pantry photo, a receipt, or an Instacart screenshot — it reads `scanResults` and submits via `confirmScan` → `reconcileItems`.

**Per-item source location editing:** The review screen already lets users edit category per item. For v1 of this phase, all imported items inherit the passed `sourceLocation` (`'pantry'` default). If users want to split (e.g., produce → fridge, rice → pantry), they can re-scan individual items with the existing Phase 14 flow. **Do not add per-item location editing in this phase** — it's scope creep and CONTEXT defers it.

### Pattern 3: Bottom sheet entry point on Pantry tab

**What:** Keep the existing camera FAB on `/scan`. Add a second FAB or overflow-menu item ("Add items from…") that opens a bottom sheet with three cards: Camera (→ `/scan`), Receipt (→ `/scan/receipt`), Instacart (→ `/scan/instacart`).

**Why:** Preserves the one-tap camera-scan path (Phase 14 is the fastest and most-used). Adds discoverability for receipt/Instacart without cluttering the Pantry header. Bottom sheets on native modals are already used in meal planning (SwapSheet/CookConfirm).

**Alternative considered:** Inline buttons in the `EmptyPantry` component. Rejected — users with non-empty pantries still need access.

### Anti-Patterns to Avoid

- **Do NOT build a new review screen.** The existing `scan/review.tsx` is the canonical review surface. Three review screens with slightly different shapes = maintenance nightmare.
- **Do NOT create a parallel reconcile function.** `reconcileItems` is battle-tested and covers dedup, upsert, and `last_seen_at` updates. Feed it the same `ConfirmedItem[]` shape from all three flows.
- **Do NOT split receipt and Instacart into completely separate backend services.** Both are single-image vision extractions with the same output shape. One service function with a `variant` param, two thin route handlers.
- **Do NOT try to OAuth into Instacart.** The Developer Platform API does not support user-scoped auth. Scraping a user's Instacart account on their behalf is a Terms of Service hazard (see Pitfall 1).
- **Do NOT write a new AI schema.** `foodItemsTool` + `report_food_items` is the canonical structured output for pantry items. Reuse it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Receipt text extraction | Custom OCR, text parsing, regex for receipt line formats | Claude Vision with structured tool-use | Receipts have zero standardization across retailers — column order varies, abbreviations vary, thermal fade varies. Claude's vision reasoning handles this. A regex solution would eat months of edge-case work for parity. |
| Retailer abbreviation expansion | Hand-curated `CHKN → chicken` mapping table | Claude Vision with prompt instruction to expand abbreviations | Taggun and similar vendors maintain proprietary retailer taxonomies with millions of SKU records. Claude gets most common cases right from general training. User corrects the tail in review. |
| Instacart scraping / OAuth harvester | Headless browser automation, cookie jar, 2FA handling | Screenshot-based import via Claude Vision | Instacart Developer Platform does not support user-scoped auth; any alternative would violate ToS, break on UI changes, handle MFA, and expose credentials. Descope to the user pasting a screenshot. |
| Receipt image preprocessing | Threshold/contrast/deskew pipeline, perspective correction | Rely on Claude Vision's robustness to imperfect images + user's second-take affordance | We already have a retake button. Claude handles moderate angle, blur, and fade. A preprocessing pipeline would add 50+ KB of image-op code for a marginal win. |
| Line item dedup across multiple receipts | Custom "same purchase already imported" detection | `reconcileItems` normalized_name upsert + `last_seen_at` semantics | This is a solved problem for Phase 3. A receipt dropped twice will update `last_seen_at` and bump quantity, same as scanning the fridge twice. |

**Key insight:** Everything hard about this phase is solved by leaning harder on Claude Vision and the existing pantry reconciliation pipeline. The temptation will be to "do it properly" with a real OCR library or a real retailer taxonomy. Resist.

## Runtime State Inventory

Not applicable — this is a greenfield feature addition (new service function, new endpoint, new screen, new store action). No renames, no migrations, no existing data to transform.

- **Stored data:** None affected. New items land in the existing `pantry_items` table via the existing `reconcileItems` path.
- **Live service config:** None affected.
- **OS-registered state:** None.
- **Secrets/env vars:** None added. `INSTACART_API_KEY` is NOT needed for screenshot-based import (the whole point of the descope).
- **Build artifacts:** None affected. No native module additions → no dev-client rebuild required.

## Common Pitfalls

### Pitfall 1: Scraping Instacart on the user's behalf is a ToS trap

**What goes wrong:** Team considers approach #2 (OAuth + scraping) from CONTEXT, writes a headless browser that logs into `instacart.com` with user creds and pulls `/orders`.

**Why it happens:** It's the "obvious" way to get the data when the API doesn't expose it.

**How to avoid:** Do not do it. Instacart's developer terms restrict third-party access to user accounts. Even if a path works today, it will break on UI changes, require 2FA handling, and expose us to account-locks. **Locked decision from research: descope to approach #4 (screenshot upload).**

**Warning signs:** Any task referencing "Puppeteer", "Playwright", "user credentials", "session cookies", "login flow". Reject on sight.

### Pitfall 2: Thermal receipt fade destroys OCR accuracy

**What goes wrong:** User scans a receipt that's been in their bag for two weeks. Thermal ink has faded, Claude Vision returns empty or garbled items, user rage-quits.

**Why it happens:** Thermal paper fades in days to weeks under heat, light, or humidity. Default image settings wash out faded text further.

**How to avoid:**
- Add a user-facing note on the receipt capture screen: *"Best results with fresh, flat receipts. Faded receipts may miss items."*
- Prompt Claude to explicitly report low confidence when text is unreadable: `If the receipt is too faded or blurry to read reliably, return an empty items array.`
- At the store layer, if `scanResults.length === 0` AND backend returned success, show a "Couldn't read this receipt — try again with better lighting" message, not a blank review screen.

**Warning signs:** Review screen shows 0 items after a successful API response. Handle explicitly.

### Pitfall 3: Non-food receipt lines get imported as food

**What goes wrong:** Receipt includes paper towels, dish soap, deli bags — Claude sees "DAWN" or "PAPER TOWEL" and emits it as a pantry item (category: `other`).

**Why it happens:** Model tries to be helpful and extract every line. Generic "other" category catches non-food items.

**How to avoid:** The `RECEIPT_FILTERING_RULES` block above explicitly instructs Claude to exclude cleaning supplies, paper goods, beauty, medicine. Reinforce with a test: feed a fixture receipt containing `PAPER TOWEL`, `DISH SOAP`, `ADVIL` — assert none appear in output.

**Warning signs:** Review screen contains `paper towel` or `dish soap` with category `other`. Tighten prompt.

### Pitfall 4: Subtotal/tax lines emitted as items

**What goes wrong:** Claude emits `subtotal` or `tax` as a line item with quantity 1.

**Why it happens:** Tool-use schema requires `name`, `quantity`, `unit`, `confidence`, `category`. Without explicit exclusion rules, totals look like line items.

**How to avoid:** Explicit negative list in prompt (done in `RECEIPT_FILTERING_RULES` above). Add a server-side name denylist as belt-and-suspenders:

```typescript
const RECEIPT_NAME_DENYLIST = new Set([
  'subtotal', 'total', 'tax', 'tip', 'fee', 'delivery fee', 'service fee',
  'bag fee', 'deposit', 'discount', 'coupon', 'credit', 'change',
]);
// Applied in identifyReceiptItems before return:
return items.filter((item) => !RECEIPT_NAME_DENYLIST.has(normalizeName(item.name)));
```

**Warning signs:** Any item named `subtotal`, `tax`, `total`, `fee` in output. Filter server-side.

### Pitfall 5: Instacart screenshot ≠ Instacart receipt

**What goes wrong:** User screenshots the Instacart *order confirmation* email (has items with product photos + names). Claude handles it fine. Different user screenshots the in-app *order tracking* page (shows "delivery scheduled" with almost no item data). Claude returns 2 items instead of 30.

**Why it happens:** Instacart surfaces order data on ~4 different screens with different levels of detail.

**How to avoid:** On the Instacart import screen, show a small help card with three example screenshots labeled "works best": (1) the confirmation email, (2) the "Your Order" page with items expanded, (3) the final receipt page. If user uploads an ambiguous image, Claude's low-confidence filtering handles it at the review layer.

**Warning signs:** Low item count on Instacart imports during UAT. Revisit the help card.

### Pitfall 6: Per-item category assignment drifts when bulk-importing

**What goes wrong:** Receipt has 20 items. Claude assigns `other` to 8 of them because it doesn't know the category from the abbreviation alone. User has to re-categorize 8 items in review.

**Why it happens:** Abbreviations obscure category (`"GV WHL MLK"` — is that milk or a mixer?). Claude plays it safe with `other`.

**How to avoid:** Existing `coerceCategory` helper already handles `meat/fish/poultry → protein` and similar common drift. Consider extending prompt with: `After expanding abbreviations, assign the category of the expanded name (e.g., "WHL MLK" → "whole milk" → "dairy"). If unsure, prefer "other".` This nudges Claude toward concrete categories. Don't overtune — review flow corrects the rest.

**Warning signs:** > 30% of receipt items land in `other`. Retune prompt.

### Pitfall 7: Ambiguous source_location on bulk imports

**What goes wrong:** Receipt import lands all 20 items at `source_location: 'pantry'`. User's rice, oil, and pasta are correct. Their milk, eggs, and chicken are wrong (should be fridge). User has to edit.

**Why it happens:** Receipts don't indicate where items go. CONTEXT decided `pantry` is the default.

**How to avoid:** Accept the tradeoff. CONTEXT explicitly defers per-item location routing. The user-level fix is: after import, bulk-select items in review and re-assign. **Do not try to AI-infer storage location in this phase** — it's latent scope creep, and wrong guesses would be worse than a blanket default.

**Warning signs:** UAT feedback requesting "automatic fridge detection". Defer to a future phase.

## Code Examples

Verified patterns from the existing codebase (all sourced from `packages/server/src/services/vision.ts` + `packages/server/src/routes/pantry.ts`):

### Receipt scan route (sketch)

```typescript
// Source pattern: packages/server/src/routes/pantry.ts (copy /scan-batch, swap service call)

/**
 * POST /scan-receipt - Extract items from a grocery receipt photo.
 * Body: { image: string (base64), source_location?: 'fridge' | 'pantry' | 'freezer' }
 */
pantry.post('/scan-receipt', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const body = await c.req.json<{
    image: string;
    source_location?: 'fridge' | 'pantry' | 'freezer';
  }>();

  if (!body.image) {
    return c.json({ error: 'Missing required field: image' }, 400);
  }

  const sourceLocation = body.source_location ?? 'pantry';
  const validLocations = ['fridge', 'pantry', 'freezer'];
  if (!validLocations.includes(sourceLocation)) {
    return c.json({ error: 'Invalid source_location' }, 400);
  }

  try {
    // Pantry-aware dedup — same pattern as /scan-batch
    const { data: existingItems } = await supabase
      .from('pantry_items')
      .select('name')
      .eq('profile_id', user.id)
      .eq('source_location', sourceLocation)
      .eq('status', 'available');
    const existingNames = (existingItems ?? []).map((r: { name: string }) => r.name);

    const items = await identifyReceiptItems(body.image, sourceLocation, existingNames, 'receipt');
    return c.json({ data: items });
  } catch (error) {
    console.error('[pantry/scan-receipt] Vision error:', error);
    const message = error instanceof Error ? error.message : 'Vision processing failed';
    return c.json({ error: message }, 500);
  }
});
```

### Mobile store action (sketch)

```typescript
// Source pattern: apps/mobile/src/stores/pantryStore.ts (copy startBatchScan, swap endpoint)

startReceiptScan: async (base64Image: string, sourceLocation: SourceLocation) => {
  set({ isScanning: true });
  try {
    const token = await getAuthToken();
    const response = await fetch(`${getApiBaseUrl()}/api/v1/pantry/scan-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ image: base64Image, source_location: sourceLocation }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error ?? 'Receipt scan failed');
    }

    const data = await response.json();
    const reviewItems: ReviewItem[] = (data.data ?? []).map(
      (item: any, index: number) => ({
        id: `scan-${Date.now()}-${index}`,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        confidence: item.confidence,
        category: item.category,
        accepted: item.confidence >= 0.7,  // Same threshold as Phase 14
        userEdited: false,
      })
    );

    set({ scanResults: reviewItems, isScanning: false });
  } catch (err) {
    set({ isScanning: false });
    throw err;
  }
},
```

### Receipt capture screen (single-photo variant — simplified from `scan/index.tsx`)

```typescript
// Source pattern: apps/mobile/src/app/scan/index.tsx (simplify for single-photo flow)

const result = await ImagePicker.launchCameraAsync({
  base64: true,
  quality: 0.4,
  mediaTypes: ['images'],
  // Receipts are tall — allowing user to edit/crop improves framing
  allowsEditing: true,  // iOS + Android
});

if (result.canceled || !result.assets?.[0]?.base64) return;

await startReceiptScan(result.assets[0].base64, 'pantry');
// useEffect on scanResults navigates to /scan/review (same pattern as Phase 14)
```

### Instacart screenshot import (library pick, not camera)

```typescript
// Source pattern: expo-image-picker library-pick API

const result = await ImagePicker.launchImageLibraryAsync({
  base64: true,
  quality: 0.4,
  mediaTypes: ['images'],
  allowsEditing: false,  // screenshots are already cropped
});

if (result.canceled || !result.assets?.[0]?.base64) return;

await startInstacartImport(result.assets[0].base64);
// Endpoint: POST /pantry/scan-receipt with variant='instacart_screenshot'
// (or a dedicated /pantry/import-instacart route that calls the same service)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Retailer-specific receipt OCR (Taggun, Veryfi) | General-purpose vision LLMs (Claude, GPT-4o, Gemini) with tool-use schemas | 2024-2025 | VLLMs now match or beat specialized OCR for everyday receipts without per-retailer tuning. Specialized vendors still win on fringe cases (damaged receipts, international retailers, high-volume expense reporting). For a consumer app: VLLM is fine. |
| Instacart Connect API with `/fulfillment/users/{id}/orders` | Link-based Developer Platform API (write-only, no history) | ~2022-2023 | Instacart consolidated around a link-first "recipe/shopping list page" model. No third-party app can currently read user history via official APIs. |
| Hand-tuned image preprocessing (threshold, deskew, contrast) | Raw image direct to VLLM | ~2023-2024 | VLLMs handle moderate noise and angle robustly. Preprocessing is now mostly unnecessary for OCR-quality work. |

**Deprecated/outdated:**
- `GET /v2/fulfillment/users/{user_id}/orders` on Instacart Connect — deprecated, and Connect is not the API tier we have access to anyway.
- Template-based receipt parsing libraries (e.g., parser-per-retailer) — superseded by VLLMs.

## Open Questions

1. **Should receipt scan use a new `vision.receiptScan` task route?**
   - What we know: The existing `vision.pantryScan` routes to Anthropic Sonnet. Receipt OCR is a similar workload.
   - What's unclear: Whether routing receipts to Haiku (or Gemini Flash) would meaningfully cut cost with acceptable accuracy.
   - Recommendation: **Start on `vision.pantryScan` (Sonnet) for Wave 1.** After UAT confirms accuracy, add a dedicated `vision.receiptScan` route in a polish pass and A/B test Haiku. Don't optimize prematurely.

2. **Unified endpoint vs. two endpoints (`/scan-receipt` + `/import-instacart`)?**
   - What we know: Backend logic is 95% shared (one service function with a variant). Two routes keep URLs expressive.
   - What's unclear: Whether the mobile store prefers one action with a variant or two distinct actions.
   - Recommendation: **Two routes (`/scan-receipt` and `/import-instacart`), one service function** (`identifyReceiptItems(base64, sourceLocation, existing, variant)`). Keeps route URLs self-describing, keeps service logic DRY.

3. **Does Claude reliably expand abbreviations across regional chains (Kroger, Publix, H-E-B, Trader Joe's)?**
   - What we know: General-purpose pattern works for common abbreviations (CHKN, ORG, WHL).
   - What's unclear: Regional store-specific codes (e.g., Trader Joe's uses short product names that don't abbreviate standard food words).
   - Recommendation: Capture 3-5 real receipts from different chains during Wave 1 UAT as fixtures. If accuracy < 80% on a chain, add chain-specific guidance to the prompt or accept that the user corrects in review.

4. **What's the failure UX if Claude returns 0 items?**
   - What we know: Current batch-scan path doesn't handle this explicitly — the review screen just shows empty.
   - What's unclear: Whether to show a specific error ("Couldn't read that receipt — try again with better lighting") or route to an empty review screen with a manual-add affordance.
   - Recommendation: **Show a dedicated error state before navigating to review.** Return user to the capture screen with a retry button. Phase 14 doesn't do this but it wasn't a pain point because multi-photo scans rarely return 0. Receipts more often will.

## Environment Availability

Not applicable — this phase is a pure code/config change. No new external tools, no new services, no new runtimes.

All dependencies already provisioned in Phase 3 (Claude Vision) and Phase 14 (batch-scan pipeline):

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Anthropic Claude API (Sonnet 4) | Receipt + Instacart vision | ✓ | Via `AIClient` routing | — (required) |
| `expo-image-picker` | Mobile capture / library pick | ✓ | ^55.0.18 | — (already installed) |
| `@supabase/supabase-js` | pantry_items reconcile | ✓ | ^2.103.0 | — (already installed) |
| `ANTHROPIC_API_KEY` | Backend | Assumed present (prod uses real key) | — | Stub adapters for test (existing pattern) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.4 (backend), Vitest (mobile, via vitest.setup.ts) |
| Config file | `packages/server/vitest.config.ts`, `apps/mobile/vitest.config.ts` |
| Quick run command | `pnpm -w -F @dinnertime/server test -- --run path/to/test` |
| Full suite command | `pnpm -w test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| Receipt scan (happy path) | `identifyReceiptItems` extracts items from a synthetic receipt image | unit | `pnpm -w -F @dinnertime/server test -- vision.test.ts` | ⚠️ Wave 0 — extend existing `vision.test.ts` |
| Receipt scan (denylist) | `subtotal`, `tax`, `total`, `fee` filtered from output | unit | same as above | ⚠️ Wave 0 |
| Receipt scan (non-food) | `paper towel`, `dish soap` excluded by prompt (fixture test) | unit | same as above | ⚠️ Wave 0 |
| Route `/scan-receipt` (auth + shape) | POST returns items with correct shape; 400 on missing image | integration | `pnpm -w -F @dinnertime/server test -- pantry.test.ts` OR new `pantry.scan-receipt.test.ts` | ⚠️ Wave 0 — extend existing `pantry.test.ts` |
| Route `/scan-receipt` (pantry dedup) | `existingItemNames` passed to vision service | integration | same as above | ⚠️ Wave 0 |
| Instacart import (variant flag) | `variant: 'instacart_screenshot'` swaps prompt preamble | unit | `pnpm -w -F @dinnertime/server test -- vision.test.ts` | ⚠️ Wave 0 |
| Reconcile (no regression) | Existing `reconcileItems` tests still pass with receipt-shaped items | integration | `pnpm -w -F @dinnertime/server test -- pantry.test.ts` | ✅ (already covers the shape) |
| Mobile store `startReceiptScan` | Populates `scanResults` with correct IDs and threshold | unit | mobile vitest config | ⚠️ Wave 0 — new `pantryStore.receiptScan.test.ts` |
| Mobile capture flow (manual) | User can take a photo, see review, confirm — Maestro smoke | e2e / manual | `.maestro/receipt-scan.yaml` | ⚠️ Wave 0 — new Maestro flow |

### Sampling Rate

- **Per task commit:** Run the relevant service / route / store test file — `pnpm -w -F @dinnertime/server test -- <file>` or `pnpm -F @dinnertime/mobile test -- <file>`.
- **Per wave merge:** Full backend suite + full mobile suite.
- **Phase gate:** Full suite green + at least one real-device Maestro smoke test of the receipt flow before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `packages/server/src/services/__tests__/vision.test.ts` — add `identifyReceiptItems` unit tests (happy path, denylist filter, non-food filter, variant switching). Use `vi.mock('../../ai/clientFactory.js')` following the canonical AIClient test mock pattern established in Phase 11.
- [ ] `packages/server/src/routes/__tests__/pantry.test.ts` (or new file) — add `/scan-receipt` route tests: 200 shape, 400 missing image, 400 invalid source_location, existing-items passthrough.
- [ ] `apps/mobile/src/stores/__tests__/pantryStore.test.ts` (or new file) — add `startReceiptScan` and `startInstacartImport` action tests (fetch mock, scanResults population, confidence threshold).
- [ ] `apps/mobile/.maestro/receipt-scan.yaml` — new Maestro smoke flow: open Pantry → bulk-import sheet → (mock image) → review → confirm → back on pantry with items visible. Consider stubbing the backend or recording a fixture response.
- [ ] 3-5 real grocery receipt fixture images in a test fixtures directory (if the team wants integration-style "real AI call" sanity tests — optional).

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives are load-bearing for this phase and the planner must honor them:

- **iOS-first (Expo/React Native)** — no Android or web work in this phase.
- **All AI calls through backend** — mobile MUST NOT hold Anthropic or Instacart API keys. Receipt/screenshot images go backend-ward via the new `/scan-receipt` endpoint, never direct to Claude.
- **Claude API for all AI features** — do not introduce a second vision provider for receipts (e.g., Taggun, Veryfi, Google Document AI) even if accuracy is tempting. Stay on Claude.
- **Hono for backend, Zustand for client state** — new routes live in `packages/server/src/routes/pantry.ts`, new store actions extend `apps/mobile/src/stores/pantryStore.ts`. No new frameworks.
- **NativeWind for styling** — any new screens use NativeWind `className="..."` props, matching Phase 14 patterns.
- **expo-image-picker ^55.0.18** — already installed, use for both camera and library. Do NOT introduce `react-native-document-scanner-plugin` unless Wave 1 UAT proves it necessary (see Alternatives Considered).
- **UAT via Maestro before "complete"** — CLAUDE.md explicitly requires Maestro validation on iOS Simulator before declaring a UI feature done. Plan must include at least one Maestro smoke flow for the receipt path.
- **GSD workflow enforcement** — this phase work is expected to flow through `/gsd:execute-phase`. No direct repo edits outside GSD.
- **expo-av is deprecated** — not relevant to this phase (no audio), but reinforces "don't use deprecated APIs".

## Sources

### Primary (HIGH confidence)

- **CONTEXT.md** (`.planning/phases/13-receipt-scan-and-instacart-import-for-bulk-pantry-loading/13-CONTEXT.md`) — authoritative source for locked decisions.
- **Existing code** — read directly from the working tree:
  - `packages/server/src/services/vision.ts` — canonical pattern for `identifyFoodItems` / `identifyFoodItemsBatch`.
  - `packages/server/src/routes/pantry.ts` — canonical pattern for `/scan` and `/scan-batch` route handlers.
  - `packages/server/src/services/pantry.ts` — `reconcileItems` for dedup/upsert.
  - `packages/server/src/services/instacart.ts` — confirms the current Instacart integration is the link-based `POST /idp/v1/products/products_link` model (no order-history endpoint touched).
  - `apps/mobile/src/stores/pantryStore.ts` — canonical `startScan` / `startBatchScan` store pattern.
  - `apps/mobile/src/app/scan/index.tsx` + `review.tsx` — canonical capture and review screens.
  - `packages/server/src/ai/taskRouting.ts` — task-to-model routing map.
- **[Claude Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision)** — image size limits (8000×8000 px), max 600 images/request, 32 MB request limit. Confirms our 5 MB base64 guard is correct.
- **[Expo ImagePicker Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/)** — `launchCameraAsync` + `launchImageLibraryAsync` options (`base64`, `quality`, `allowsEditing`, `mediaTypes`).
- **[Instacart Developer Platform API overview](https://docs.instacart.com/developer_platform_api/)** — confirms API is partner-key, link-first, with no documented order-history endpoint.
- **[Instacart API reference overview](https://docs.instacart.com/developer_platform_api/api/overview/)** — confirms only API-key (bearer) auth; no OAuth, no user-scoped access.

### Secondary (MEDIUM confidence)

- **[Instacart docs index — Connect vs Developer Platform](https://docs.instacart.com/connect/)** — the deprecated `GET /v2/fulfillment/users/{user_id}/orders` lives here (Connect, not Developer Platform). Corroborates "no order history for third-party apps" conclusion.
- **[Claude Vision for Document Analysis — getstream.io guide](https://getstream.io/blog/anthropic-claude-visual-reasoning/)** — corroborates that Claude Vision handles receipts/invoices without OCR preprocessing.
- **[Claude vs GPT vs Gemini for Invoice Extraction — Koncile](https://www.koncile.ai/en/ressources/claude-gpt-or-gemini-which-is-the-best-llm-for-invoice-extraction)** — general corroboration that current-gen VLLMs match specialized OCR on common cases.

### Tertiary (LOW confidence)

- **[Why Thermal Receipts Fade — Tabscanner](https://tabscanner.com/blog/why-receipts-fade-and-how-to-restore-their-information/)** — background for Pitfall 2 (thermal fade). Vendor-sourced but aligns with general knowledge.
- **[Grocery Receipt Abbreviations — Microblink](https://microblink.com/commerce/receipt-ocr/)** — background for Pitfall 6 (abbreviation drift). Vendor-sourced.

## Metadata

**Confidence breakdown:**

- **Standard Stack:** HIGH — all dependencies verified from the working tree; no new libraries needed.
- **Architecture patterns:** HIGH — direct extension of the Phase 14 pipeline; patterns read from source.
- **Instacart API decision:** HIGH — official Instacart docs confirm no order-history endpoint on the Developer Platform API; corroborated by multiple sources; the deprecated Connect endpoint is not accessible to our API tier.
- **Receipt OCR accuracy:** MEDIUM — Claude Vision handles common cases well per multiple secondary sources, but no empirical testing on real DinnerTime receipt fixtures yet. Plan must include a UAT pass with 3-5 real receipts.
- **Pitfalls:** HIGH on structural pitfalls (denylist, variant drift, category drift), MEDIUM on thermal-fade UX guidance (depends on real-world image quality).

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (30 days). Re-verify Instacart Developer Platform docs if the plan slips more than a month — Instacart ships API changes occasionally, and a new "orders" endpoint would reopen approach #1 from CONTEXT.
