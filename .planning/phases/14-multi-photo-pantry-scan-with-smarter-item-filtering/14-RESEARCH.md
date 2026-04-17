# Phase 14: Multi-Photo Scan & Smarter Item Filtering - Research

**Researched:** 2026-04-15
**Domain:** Multi-image vision API, React Native camera UX, AI prompt engineering for food filtering
**Confidence:** HIGH

## Summary

This phase extends the existing single-photo pantry scan into a multi-photo batch flow and tightens the AI prompt to eliminate vague/unidentifiable items. The existing architecture is well-suited for this -- the core changes are: (1) a new `AnalyzeImagesStructured` method on the AIClient interface that accepts an array of image base64 strings, (2) a multi-photo capture UI with thumbnail strip on the scan screen, (3) updated vision prompt with explicit exclusion rules, and (4) confidence-based default toggling on the review screen.

The Anthropic Messages API natively supports multiple image blocks in a single user message. Claude Sonnet (used for `vision.pantryScan`) handles up to 20 images per message, well above the 5-photo cap. Each image at quality 0.4 JPEG is roughly 200-400KB, so 5 images stay well under the 100MB total request limit. The main risk is increased latency for multi-image requests (roughly linear with image count), which the loading state must communicate.

**Primary recommendation:** Extend the AIClient interface with an `analyzeImagesStructured` method (plural), update AnthropicAdapter to send multiple image content blocks, create a `POST /pantry/scan-batch` endpoint, and manage multi-photo state locally in the scan screen component before submission.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Thumbnail strip at the bottom of the scan screen showing captured photos
- "+" button to add more photos, "Scan All Photos" button to submit
- Maximum 5 photos per scan session
- Tap a thumbnail to view full-size with a "Remove" button
- One location (Fridge/Pantry/Freezer) applies to all photos in a session -- different locations require separate scan sessions
- Send all photos in a single Claude API call with multiple image blocks
- Claude sees all photos together and deduplicates naturally across them
- Simple spinner loading state: "Analyzing N photos..." with count
- Update the AI vision prompt to only return items it can specifically name as cooking ingredients
- Explicitly instruct Claude NOT to return vague descriptions: "leftover container", "unidentified item", "condiment packet", "sauce packet", "unknown dairy", etc.
- Named condiments (ketchup, soy sauce, olive oil) ARE included
- All beverages included (even non-cooking ones like water, soda)
- No server-side blocklist needed -- prompt-only approach
- One flat merged list sorted by category -- no grouping by photo source
- Item count only in header (not photo count)
- Items above 0.7 confidence default to accepted, below 0.7 default to rejected
- User can still toggle any item's accepted state

### Claude's Discretion
- Whether to create a new `/scan-batch` endpoint or extend the existing `/scan` endpoint
- Loading state animation details
- Exact confidence threshold (0.7 suggested but can adjust based on testing)
- Thumbnail strip component implementation details

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| Pantry UX (post-v1) | Multi-photo capture with batch AI analysis and smarter filtering | AIClient multi-image extension, prompt engineering patterns, confidence-based review defaults |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-image-picker | ~55.x | Photo capture | Already used for single-photo scan; `launchCameraAsync` reused per-photo |
| expo-image | ~2.x | Thumbnail display | Already in project; efficient for rendering 1-5 thumbnail previews |
| @anthropic-ai/sdk | ~0.82 | Claude Vision API | Already used via AnthropicAdapter; supports multiple image blocks natively |
| React Native FlatList | built-in | Thumbnail strip | Horizontal FlatList for scrollable thumbnail row |

### No New Dependencies
This phase requires zero new npm packages. Everything needed is already in the project.

## Architecture Patterns

### Recommended Changes

```
packages/server/src/
  ai/
    types.ts              # Add AnalyzeImagesStructuredInput (plural)
    adapters/
      anthropicAdapter.ts # Add analyzeImagesStructured method
      geminiAdapter.ts    # Add analyzeImagesStructured method (stub/throw)
  services/
    vision.ts             # Add identifyFoodItemsBatch(images[], location)
  routes/
    pantry.ts             # Add POST /scan-batch endpoint

apps/mobile/src/
  app/scan/
    index.tsx             # Multi-photo state, thumbnail strip, batch submit
  stores/
    pantryStore.ts        # Add startBatchScan(images[], location)
```

### Pattern 1: Multi-Image AIClient Extension

**What:** Add a new method to AIClient that accepts an array of images instead of one.

**Why not overload the existing method:** The existing `analyzeImageStructured` is used by recipe photo parsing too. A separate `analyzeImagesStructured` (plural) keeps the interface clean and avoids breaking existing callers.

**Interface change:**
```typescript
// In ai/types.ts
export interface AnalyzeImagesStructuredInput<T> {
  system?: string;
  user: string;
  images: Array<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }>;
  tool: StructuredTool<T>;
  maxTokens?: number;
}

// In AIClient interface
analyzeImagesStructured<T>(input: AnalyzeImagesStructuredInput<T>): Promise<T>;
```

### Pattern 2: Anthropic Multi-Image Content Blocks

**What:** Claude Messages API supports multiple image blocks interleaved in a single user message. Each image is a separate content block.

**Example:**
```typescript
// In AnthropicAdapter.analyzeImagesStructured
messages: [{
  role: 'user',
  content: [
    ...images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mimeType, data: img.base64 }
    })),
    { type: 'text', text: i.user },
  ],
}]
```

This is the standard Anthropic pattern for multi-image analysis. Claude processes all images together and can cross-reference them for deduplication.

### Pattern 3: Local Photo State in Scan Screen

**What:** The scan screen manages an array of captured photos in local component state (not Zustand) until the user taps "Scan All Photos", at which point they are submitted to the store/API.

**Why local state:** Photos are ephemeral pre-submission artifacts. They should not persist across navigations or restarts. The pantryStore only needs to know about photos at submission time.

```typescript
// In scan/index.tsx
const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
// CapturedPhoto = { id: string; base64: string; uri: string }
// uri is for thumbnail display, base64 is for API submission
```

### Pattern 4: Confidence-Based Default Accepted State

**What:** Review screen sets `accepted = confidence >= 0.7` instead of always `true`.

**Where to apply:** In `pantryStore.startBatchScan` when mapping API results to `ReviewItem[]`. The threshold is applied client-side so it's easy to adjust.

### Anti-Patterns to Avoid
- **Sending photos one at a time to separate API calls:** Defeats deduplication. User decision is all-in-one-call.
- **Storing captured photos in Zustand/AsyncStorage:** These are large base64 blobs that would bloat persisted state.
- **Adding a server-side blocklist for vague items:** User explicitly decided prompt-only approach. The AI should never produce these items in the first place.
- **Grouping review items by source photo:** User explicitly wants one flat list sorted by category.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image thumbnail display | Custom Image component | expo-image with uri | Already handles caching, sizing, blurhash |
| Horizontal scroll strip | ScrollView with manual layout | FlatList horizontal={true} | Better perf for list of thumbnails, handles key extraction |
| Photo capture | Custom camera UI | ImagePicker.launchCameraAsync | Existing pattern, handles permissions, returns base64+uri |

## Common Pitfalls

### Pitfall 1: Base64 Payload Size
**What goes wrong:** 5 photos at full resolution could exceed the Anthropic 5MB-per-image limit or cause mobile memory pressure during JSON serialization.
**Why it happens:** Camera returns high-res images; base64 encoding inflates size by ~33%.
**How to avoid:** Keep existing `quality: 0.4` setting. At 0.4 quality JPEG, photos are typically 200-400KB each. 5 photos = ~1-2MB total base64, well within limits. The existing per-image 5MB check in `vision.ts` should be applied per-image in the batch variant too.
**Warning signs:** API returns 413 or mobile app freezes during photo capture.

### Pitfall 2: Review Screen Source Location Hardcoded to 'fridge'
**What goes wrong:** The current `review.tsx` has `const sourceLocation: SourceLocation = 'fridge'` hardcoded (line 73). Multi-photo scan sessions already carry a location from the scan screen, but review never reads it.
**Why it happens:** Original implementation didn't pass route params for location.
**How to avoid:** Pass `sourceLocation` as a route parameter from scan to review, or store it in Zustand alongside scanResults. The scan screen already has `selectedLocation` state.
**Warning signs:** All confirmed items show as "fridge" regardless of user's selection.

### Pitfall 3: Navigation Race After Batch Scan
**What goes wrong:** The current `useEffect` in scan/index.tsx navigates to review when `scanResults.length > 0 && !isScanning`. If the user navigates away and comes back, stale scanResults could trigger unwanted navigation.
**Why it happens:** Zustand persists items but scanResults should be ephemeral.
**How to avoid:** Clear scanResults on scan screen mount, or use a separate navigation trigger flag (like the `autoFetch` pattern from suggestionsStore).
**Warning signs:** Opening scan screen immediately redirects to review.

### Pitfall 4: Gemini Adapter Missing Method
**What goes wrong:** Adding `analyzeImagesStructured` to the AIClient interface requires implementation in both adapters. GeminiAdapter must at least have a stub.
**Why it happens:** TypeScript enforces interface compliance.
**How to avoid:** GeminiAdapter can throw "not implemented" since `vision.pantryScan` routes to Anthropic. But it must compile.
**Warning signs:** TypeScript build failure.

### Pitfall 5: Loading State Duration
**What goes wrong:** Multi-image analysis takes 5-15 seconds (vs 3-8 for single image). Users may think the app froze.
**Why it happens:** Claude processes each image sequentially in the same request.
**How to avoid:** Show photo count in loading text ("Analyzing 4 photos..."), use an animated spinner, and set a reasonable timeout (30s).
**Warning signs:** Users cancelling scans or force-quitting.

### Pitfall 6: Duplicate Items From Overlapping Photos
**What goes wrong:** User photographs the same shelf from two angles; AI returns "milk" twice.
**Why it happens:** Each photo is analyzed in context of the others, but the AI may still list overlapping items.
**How to avoid:** The prompt must explicitly instruct deduplication: "These photos are from the same [location]. Items visible in multiple photos should only be reported once." This is the user's chosen approach (Claude deduplicates naturally).
**Warning signs:** Review screen shows duplicate items.

## Code Examples

### Multi-Image Vision Service
```typescript
// packages/server/src/services/vision.ts
export async function identifyFoodItemsBatch(
  base64Images: string[],
  sourceLocation: 'fridge' | 'pantry' | 'freezer'
): Promise<ScanResult[]> {
  // Validate each image
  for (const img of base64Images) {
    const imageBytes = Buffer.from(img, 'base64').length;
    if (imageBytes > MAX_BASE64_BYTES) {
      throw new Error(`Image too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB).`);
    }
  }
  
  const ai = getClientFor('vision.pantryScan');
  const result = await ai.analyzeImagesStructured<{ items: ScanResult[] }>({
    user: `You are analyzing ${base64Images.length} photos of a ${sourceLocation}. ...`,
    images: base64Images.map(b64 => ({ base64: b64, mimeType: 'image/jpeg' as const })),
    tool: foodItemsTool,
    maxTokens: 4096,
  });
  
  return (result.items ?? []).map(item => ({
    ...item,
    category: coerceCategory(item.category),
  }));
}
```

### Updated Vision Prompt (Filtering)
```typescript
const prompt = `You are analyzing ${count} photos of a ${sourceLocation}. These photos may show overlapping areas -- deduplicate items that appear in multiple photos.

For each item, report ONLY items you can specifically name as a cooking ingredient or food product. Examples of GOOD items: "milk", "cheddar cheese", "sriracha", "ground beef", "sourdough bread", "olive oil".

DO NOT report:
- Vague or unidentifiable items ("leftover container", "unidentified dairy item", "mystery sauce")
- Generic descriptions ("condiment packet", "sauce packet", "plastic container with food")
- Non-food items (cleaning supplies, utensils, containers without identifiable contents)
- Items you cannot specifically name -- if you can't tell what it is, exclude it entirely

Named condiments and sauces ARE included (e.g., ketchup, soy sauce, ranch dressing).
All beverages ARE included (e.g., orange juice, soda, water, beer).

Assign confidence 0.0-1.0 based on how clearly you can identify each item. Only report items with confidence >= 0.5.`;
```

### Thumbnail Strip Component
```typescript
// Horizontal FlatList with photo thumbnails
<FlatList
  horizontal
  data={capturedPhotos}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => (
    <Pressable onPress={() => openPreview(item)}>
      <Image source={{ uri: item.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
      <Pressable onPress={() => removePhoto(item.id)} style={styles.removeButton}>
        <Text>X</Text>
      </Pressable>
    </Pressable>
  )}
  ListFooterComponent={
    capturedPhotos.length < 5 ? (
      <Pressable onPress={handleTakePhoto} style={styles.addButton}>
        <Text>+</Text>
      </Pressable>
    ) : null
  }
/>
```

### Confidence-Based Default Accept
```typescript
// In pantryStore.startBatchScan, when mapping results
const reviewItems: ReviewItem[] = data.data.map((item, index) => ({
  id: `scan-${Date.now()}-${index}`,
  ...item,
  accepted: item.confidence >= 0.7,  // Changed from always true
  userEdited: false,
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single image per scan | Multi-image in one API call | This phase | Anthropic API has always supported this; we just used single-image |
| Accept all scan items by default | Confidence-based default toggle | This phase | Reduces user effort on review screen |
| "Be thorough, include partially visible items" | "Only report specifically identifiable items" | This phase | Eliminates vague placeholders in results |

## Open Questions

1. **New endpoint vs extend existing?**
   - What we know: Current `/scan` takes `{ image: string }`. Batch needs `{ images: string[] }`.
   - Recommendation: Create `POST /scan-batch` with `{ images: string[], source_location: string }`. Keep `/scan` for backward compatibility. The single-photo flow can internally call the batch logic with a 1-element array.

2. **Confidence threshold tuning**
   - What we know: User suggested 0.7. Real-world accuracy depends on photo quality.
   - Recommendation: Start at 0.7, which is the user's suggestion. Adjustable later without code changes if moved to a constant.

3. **maxTokens for multi-image**
   - What we know: Current single-image uses 4096 tokens. More photos = more items = more output tokens.
   - Recommendation: Scale to 8192 for batch requests to accommodate larger item lists from 5 photos.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via project config) |
| Config file | packages/server/vitest.config.ts, apps/mobile/vitest.config.ts |
| Quick run command | `cd packages/server && npx vitest run src/services/__tests__/vision.test.ts` |
| Full suite command | `cd packages/server && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P14-01 | Multi-image batch scan service | unit | `npx vitest run src/services/__tests__/vision.test.ts` | Exists (extend) |
| P14-02 | Batch scan route accepts images array | unit | `npx vitest run src/routes/__tests__/pantry.test.ts` | Likely exists (extend) |
| P14-03 | Prompt excludes vague items | unit | `npx vitest run src/services/__tests__/vision.test.ts` | Exists (extend) |
| P14-04 | Confidence-based default accept | unit | `npx vitest run apps/mobile (pantryStore test)` | May need new |
| P14-05 | AnthropicAdapter multi-image | unit | `npx vitest run src/ai/__tests__/anthropicAdapter.test.ts` | Exists (extend) |

### Sampling Rate
- **Per task commit:** `cd packages/server && npx vitest run --reporter=verbose`
- **Per wave merge:** Full suite across server + mobile
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `identifyFoodItemsBatch` test cases in vision.test.ts
- [ ] Route test for POST /scan-batch
- [ ] AnthropicAdapter.analyzeImagesStructured test

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `packages/server/src/services/vision.ts` -- current single-image implementation
- Codebase inspection: `packages/server/src/ai/types.ts` -- AIClient interface definition
- Codebase inspection: `packages/server/src/ai/adapters/anthropicAdapter.ts` -- current image handling
- Codebase inspection: `apps/mobile/src/app/scan/index.tsx` -- current scan UI flow
- Codebase inspection: `apps/mobile/src/app/scan/review.tsx` -- current review flow (hardcoded fridge location bug found)
- Codebase inspection: `packages/server/src/routes/pantry.ts` -- current scan endpoint

### Secondary (MEDIUM confidence)
- Anthropic API documentation -- multi-image support in Messages API (known from SDK usage patterns in adapter)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, extending existing patterns
- Architecture: HIGH - well-understood extension of existing AIClient pattern
- Pitfalls: HIGH - identified from direct codebase inspection (hardcoded fridge, navigation race, payload size)

**Research date:** 2026-04-15
**Valid until:** 2026-05-15 (stable domain, no external dependency churn)
