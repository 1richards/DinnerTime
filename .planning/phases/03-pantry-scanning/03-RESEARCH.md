# Phase 3: Pantry Scanning - Research

**Researched:** 2026-04-10
**Domain:** AI Vision (food recognition), Image Capture, Persistent Inventory Management
**Confidence:** HIGH

## Summary

Phase 3 is the first AI-powered feature in DinnerTime and forms the core of the app's value proposition. It requires three major technical domains: (1) capturing photos via expo-image-picker on the mobile client, (2) sending images to Claude's Vision API via the Hono backend for food item identification with structured output, and (3) persisting a pantry inventory in Supabase with reconciliation logic across multiple scans and confidence decay over time.

The architecture is straightforward: the mobile app captures a photo, sends the base64 image to the backend, the backend calls Claude Sonnet 4 with vision + tool_use to extract structured food items with confidence scores, returns them to the client for user review/correction, then persists confirmed items to Supabase. The pantry inventory is a persistent table with per-item metadata (last_seen_at, confidence, source location). Reconciliation merges new scan results with existing inventory using item name matching, and a confidence decay system marks items not seen in 7+ days as uncertain.

**Primary recommendation:** Use Claude Vision with tool_use for structured food item extraction, expo-image-picker for photo capture (not expo-camera), Zustand store with optimistic updates for pantry state, and a dedicated Supabase `pantry_items` table with RLS policies following existing project patterns.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PANT-01 | User can take a photo of fridge and AI identifies food items | expo-image-picker for capture, Claude Vision API with tool_use for structured extraction |
| PANT-02 | User can take a photo of pantry shelves and AI identifies items | Same pipeline as PANT-01; source_location field distinguishes fridge/pantry/freezer |
| PANT-03 | User can take a photo of freezer and AI identifies items | Same pipeline as PANT-01; source_location field distinguishes fridge/pantry/freezer |
| PANT-04 | AI shows detected items with confidence scores for user confirmation | Tool schema returns items with name, quantity, unit, confidence; review UI displays these |
| PANT-05 | User can correct, remove, or add items the AI missed | Review screen with editable list before committing to inventory |
| PANT-06 | Pantry inventory persists and updates across multiple scans (reconciliation) | Supabase pantry_items table with upsert logic matching on normalized item name + location |
| PANT-07 | Items get confidence decay -- items not seen in 7+ days marked uncertain | last_seen_at timestamp column; client-side or query-time calculation for staleness |
| PANT-08 | User can manually mark items as used or depleted | Status field on pantry_items with values like 'available', 'used', 'depleted' |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo-image-picker | ~55.x | Photo capture from camera | Already in stack recommendation; simpler than expo-camera for single-photo use case; returns base64 directly |
| @anthropic-ai/sdk | ~0.82 | Claude API client (backend) | Official TypeScript SDK; supports vision with base64 images and tool_use for structured output |
| Claude Sonnet 4 | latest | Food recognition model | Best cost/performance for vision tasks; ~$0.004 per 1MP image input |
| Zustand | ~5.0 | Client pantry state | Already used for authStore and preferencesStore; optimistic update pattern established |
| @supabase/supabase-js | ~2.103 | Database operations | Already in both mobile and server; RLS pattern established |
| Hono | ~4.x | Backend API routes | Pantry route stub already exists at /api/v1/pantry |

### New Dependencies Required
| Library | Version | Purpose | Install Location |
|---------|---------|---------|-----------------|
| @anthropic-ai/sdk | ~0.82 | Claude API calls | packages/server (NOT yet installed) |
| expo-image-picker | ~55.x | Photo capture | apps/mobile (NOT yet installed) |
| zod | ^3.25 | Tool schema validation (already in server deps) | packages/server (already installed) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| expo-image-picker | expo-camera | expo-camera gives viewfinder control but adds complexity; we need a single photo, not live preview |
| Claude tool_use | JSON mode / prompt-only | tool_use guarantees structured output schema; prompt-only risks malformed JSON |
| Supabase direct | React Query + API | Direct Supabase reads via RLS are simpler for inventory queries; writes go through backend for AI processing |

**Installation:**
```bash
# Server - add Anthropic SDK
cd packages/server && pnpm add @anthropic-ai/sdk

# Mobile - add image picker
cd apps/mobile && pnpm add expo-image-picker
```

## Architecture Patterns

### Recommended Project Structure
```
apps/mobile/src/
  app/(tabs)/pantry.tsx           # Main pantry inventory screen
  app/scan/index.tsx              # Camera/scan screen (new route)
  app/scan/review.tsx             # Review AI results screen (new route)
  components/pantry/              # Pantry-specific components
    PantryItemCard.tsx            # Single item display with status
    PantryItemList.tsx            # Scrollable inventory list
    ScanButton.tsx                # Camera trigger FAB
    ReviewItemRow.tsx             # Editable item in review screen
    EmptyPantry.tsx               # Empty state
  stores/pantryStore.ts           # Zustand store for pantry state
  types/pantry.ts                 # TypeScript types for pantry domain
  hooks/usePantryItems.ts         # Data fetching hook

packages/server/src/
  routes/pantry.ts                # Expand existing stub
  services/vision.ts              # Claude Vision integration
  services/pantry.ts              # Inventory reconciliation logic
  config/anthropic.ts             # Anthropic client setup

supabase/migrations/
  00003_pantry_items.sql          # New migration
```

### Pattern 1: Image Capture and Upload Flow
**What:** User takes photo -> base64 encoding -> send to backend -> Claude Vision -> structured response
**When to use:** Every scan operation (PANT-01, PANT-02, PANT-03)
**Example:**
```typescript
// Mobile: Capture image with expo-image-picker
import * as ImagePicker from 'expo-image-picker';

async function capturePhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({
    base64: true,
    quality: 0.8, // Balance quality vs upload size
    mediaTypes: ['images'],
  });

  if (result.canceled || !result.assets[0].base64) return null;
  return result.assets[0].base64;
}
```

### Pattern 2: Claude Vision with Tool Use for Structured Extraction
**What:** Send base64 image to Claude with a tool schema that defines the expected food item structure
**When to use:** Backend processing of every scan image
**Example:**
```typescript
// Server: packages/server/src/services/vision.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic(); // Uses ANTHROPIC_API_KEY env var

const foodItemsTool = {
  name: 'report_food_items',
  description: 'Report all food items visible in the image with confidence scores',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Common name of the food item (lowercase, singular)' },
            quantity: { type: 'number', description: 'Estimated quantity (default 1)' },
            unit: { type: 'string', description: 'Unit of measurement (e.g., "piece", "bag", "bottle", "lb", "bunch")' },
            confidence: { type: 'number', description: 'Confidence score 0.0-1.0 for identification accuracy' },
            category: { type: 'string', description: 'Category: produce, dairy, protein, grain, condiment, beverage, frozen, snack, other' },
          },
          required: ['name', 'quantity', 'unit', 'confidence', 'category'],
        },
      },
    },
    required: ['items'],
  },
};

export async function identifyFoodItems(
  base64Image: string,
  sourceLocation: 'fridge' | 'pantry' | 'freezer'
): Promise<FoodItem[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    tools: [foodItemsTool],
    tool_choice: { type: 'tool', name: 'report_food_items' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
        },
        {
          type: 'text',
          text: `Identify all visible food items in this ${sourceLocation} photo. For each item, estimate quantity and provide a confidence score. Be thorough - include partially visible items with lower confidence.`,
        },
      ],
    }],
  });

  const toolBlock = response.content.find((b) => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') return [];
  return (toolBlock.input as { items: FoodItem[] }).items;
}
```

### Pattern 3: Pantry Inventory Reconciliation
**What:** Merge new scan results with existing inventory, updating last_seen timestamps and handling duplicates
**When to use:** Every time user confirms scan results (PANT-06)
**Example:**
```typescript
// Server: Reconciliation logic
// For each confirmed item from a scan:
// 1. Normalize name (lowercase, trim, singularize)
// 2. Check if item exists in pantry for this user + location
// 3. If exists: update last_seen_at, quantity, confidence
// 4. If new: insert with current timestamp
// 5. Items in inventory NOT in this scan remain unchanged (user might not have scanned everything)

// Key: DO NOT auto-remove items missing from a scan.
// Users scan partial shelves. Only explicit "mark as used" removes items.
```

### Pattern 4: Confidence Decay (PANT-07)
**What:** Items not seen in recent scans gradually lose confidence
**When to use:** Displaying inventory, querying pantry state
**Example:**
```typescript
// Calculate effective confidence at query time (not stored)
function getEffectiveConfidence(item: PantryItem): number {
  const daysSinceLastSeen = Math.floor(
    (Date.now() - new Date(item.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceLastSeen <= 7) return item.confidence;
  // Linear decay after 7 days, floor at 0.1
  const decayFactor = Math.max(0.1, 1 - (daysSinceLastSeen - 7) * 0.05);
  return item.confidence * decayFactor;
}

// Items with effective confidence below threshold get "uncertain" visual treatment
const UNCERTAIN_THRESHOLD = 0.5;
```

### Anti-Patterns to Avoid
- **Auto-removing items missing from scans:** Users scan partial shelves. Never delete items just because they were not in the latest scan. Only explicit user action (PANT-08) removes items.
- **Sending full-resolution photos:** Resize to ~1092x1092 or smaller before sending to Claude. Larger images cost more tokens with no quality benefit.
- **Storing base64 in the database:** Store processed results only. If image storage is needed later, use Supabase Storage with a reference URL.
- **Client-side AI calls:** All Claude API calls must go through the backend. Never expose ANTHROPIC_API_KEY to the mobile app.
- **Exact string matching for reconciliation:** Use normalized names (lowercase, trimmed) to match "Milk" with "milk" and "whole milk" variants.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Food recognition from images | Custom CV model or OCR pipeline | Claude Vision API with tool_use | Claude handles diverse food items, partial visibility, various packaging; custom models need training data |
| Structured AI output | String parsing of Claude text responses | tool_use with forced tool_choice | Guarantees valid JSON structure matching your schema; eliminates parsing errors |
| Image capture + permissions | Custom camera module | expo-image-picker | Handles OS permissions, camera UI, image compression, base64 encoding |
| Optimistic state updates | Custom sync logic | Zustand pattern (already established in preferencesStore) | Project already uses optimistic Zustand updates with Supabase rollback |
| Database migrations | Manual SQL in code | Supabase migrations (00003_pantry_items.sql) | Project convention: numbered SQL migrations in supabase/migrations/ |

**Key insight:** The AI vision capability is entirely Claude's domain -- there is zero value in building custom food recognition. The engineering effort belongs in the UX (review/correction flow) and data model (reconciliation, decay).

## Common Pitfalls

### Pitfall 1: Oversized Image Uploads
**What goes wrong:** Sending 12MP photos (4000x3000) to Claude wastes tokens and adds latency. Base64 encoding a 5MB JPEG yields ~6.7MB of text data.
**Why it happens:** expo-image-picker defaults to quality 1.0 and full resolution.
**How to avoid:** Set `quality: 0.8` and resize images client-side. Target ~1092x1092 px (1.19 MP) which is Claude's optimal size at ~1590 tokens (~$0.005/image).
**Warning signs:** Slow scan responses (>10s), high API costs, request timeouts.

### Pitfall 2: Reconciliation Ambiguity
**What goes wrong:** "Cheddar cheese" from one scan vs "cheese" from another -- are these the same item?
**Why it happens:** Claude may describe the same item differently across scans depending on visibility, angle, and lighting.
**How to avoid:** Normalize item names aggressively (lowercase, trim). Use category as a secondary match key. Prompt Claude to use common/generic names. Accept that some duplicates will exist and let users merge manually.
**Warning signs:** Inventory growing with near-duplicates after each scan.

### Pitfall 3: Assuming Complete Scans
**What goes wrong:** Deleting items not found in a new scan, destroying accurate inventory data.
**Why it happens:** Treating each scan as a complete snapshot rather than a partial observation.
**How to avoid:** Scans are ADDITIVE only. They update last_seen_at for matched items and add new items. They never remove items. Only PANT-08 (manual mark as used) removes items.
**Warning signs:** Users complaining items "disappeared" from their pantry.

### Pitfall 4: Missing ANTHROPIC_API_KEY Configuration
**What goes wrong:** Server crashes or returns 500 on first scan attempt.
**Why it happens:** The env.ts config currently only has Supabase vars. ANTHROPIC_API_KEY needs to be added.
**How to avoid:** Add ANTHROPIC_API_KEY to env.ts requireEnv() calls and to the vitest.config.ts test env. Add to .env.example if one exists.
**Warning signs:** Server startup failures in development.

### Pitfall 5: React Native Base64 Upload Issues
**What goes wrong:** Large base64 strings cause memory pressure or request timeouts on mobile.
**Why it happens:** Base64 inflates data by ~33%. A 2MB image becomes ~2.7MB of text in the request body.
**How to avoid:** Compress images before encoding (quality: 0.8). Consider chunked upload or multipart form data to Supabase Storage, then pass storage URL to backend. For MVP, direct base64 in request body should work for compressed images.
**Warning signs:** App crashes on low-memory devices, network timeouts.

## Code Examples

### Database Schema (Supabase Migration)
```sql
-- supabase/migrations/00003_pantry_items.sql

CREATE TABLE pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL, -- lowercase, trimmed for matching
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'piece',
  category TEXT NOT NULL CHECK (category IN (
    'produce', 'dairy', 'protein', 'grain', 'condiment',
    'beverage', 'frozen', 'snack', 'other'
  )),
  source_location TEXT NOT NULL CHECK (source_location IN ('fridge', 'pantry', 'freezer')),
  confidence NUMERIC DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'depleted')),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pantry_items_profile ON pantry_items(profile_id);
CREATE INDEX idx_pantry_items_lookup ON pantry_items(profile_id, normalized_name, source_location);
CREATE INDEX idx_pantry_items_status ON pantry_items(profile_id, status);

-- RLS
ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pantry items"
  ON pantry_items FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own pantry items"
  ON pantry_items FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own pantry items"
  ON pantry_items FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own pantry items"
  ON pantry_items FOR DELETE
  USING (profile_id = auth.uid());

-- Trigger
CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON pantry_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### TypeScript Types
```typescript
// apps/mobile/src/types/pantry.ts

export interface PantryItem {
  id: string;
  profile_id: string;
  name: string;
  normalized_name: string;
  quantity: number;
  unit: string;
  category: FoodCategory;
  source_location: SourceLocation;
  confidence: number;
  status: PantryItemStatus;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export type FoodCategory =
  | 'produce' | 'dairy' | 'protein' | 'grain'
  | 'condiment' | 'beverage' | 'frozen' | 'snack' | 'other';

export type SourceLocation = 'fridge' | 'pantry' | 'freezer';

export type PantryItemStatus = 'available' | 'used' | 'depleted';

// AI scan result before user confirmation
export interface ScanResult {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
  category: FoodCategory;
}

// Review item (scan result + user edits)
export interface ReviewItem extends ScanResult {
  id: string; // temp client ID
  accepted: boolean;
  userEdited: boolean;
}
```

### Hono Route Pattern (following existing conventions)
```typescript
// packages/server/src/routes/pantry.ts
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { identifyFoodItems } from '../services/vision.js';

const pantry = new Hono();
pantry.use('*', authMiddleware);

// GET /api/v1/pantry - List user's pantry items
pantry.get('/', async (c) => {
  const supabase = c.get('supabase');
  const user = c.get('user');
  const { data, error } = await supabase
    .from('pantry_items')
    .select('*')
    .eq('profile_id', user.id)
    .eq('status', 'available')
    .order('category', { ascending: true });
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ data });
});

// POST /api/v1/pantry/scan - Process a photo scan
pantry.post('/scan', async (c) => {
  const { image, source_location } = await c.req.json();
  const items = await identifyFoodItems(image, source_location);
  return c.json({ data: items });
});

// POST /api/v1/pantry/confirm - Confirm reviewed items into inventory
pantry.post('/confirm', async (c) => {
  // Reconciliation logic: upsert items into pantry_items
  // ...
});

// PATCH /api/v1/pantry/:id - Update item (mark used/depleted, edit)
pantry.patch('/:id', async (c) => {
  // ...
});

export default pantry;
```

### Zustand Store Pattern (following existing conventions)
```typescript
// apps/mobile/src/stores/pantryStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { PantryItem, ReviewItem, SourceLocation } from '../types/pantry';

interface PantryState {
  items: PantryItem[];
  scanResults: ReviewItem[];
  isScanning: boolean;
  isLoading: boolean;

  loadItems: (profileId: string) => Promise<void>;
  startScan: (base64Image: string, location: SourceLocation) => Promise<void>;
  confirmScan: (profileId: string, items: ReviewItem[]) => Promise<void>;
  markItemUsed: (itemId: string) => Promise<void>;
  markItemDepleted: (itemId: string) => Promise<void>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom food recognition models (YOLO, etc.) | LLM Vision APIs (Claude, GPT-4o) | 2024-2025 | No training data needed; handles novel items; structured output via tool_use |
| Camera viewfinder with frame guides | Simple photo picker | Expo SDK 55 | expo-image-picker is simpler, handles permissions; viewfinder UX adds complexity without value for single-photo capture |
| Separate image upload + processing | Base64 inline in API request | Current | For images under ~3MB compressed, inline base64 is simpler than separate upload flows |

**Deprecated/outdated:**
- expo-av: Deprecated in SDK 52+; not relevant for this phase but noted
- Legacy Architecture: Dropped in Expo SDK 55; New Architecture only

## Open Questions

1. **Claude Vision accuracy for real fridge photos**
   - What we know: Claude Vision works well for clear, well-lit images. The STATE.md notes "Claude Vision accuracy for real fridge photos needs empirical validation in Phase 3."
   - What's unclear: Accuracy with cluttered shelves, poor lighting, partially visible items, wrapped/packaged foods where labels are not visible
   - Recommendation: Build the scan flow, test with real photos during development, tune the prompt based on results. The review/correction UI (PANT-05) is the safety net.

2. **Item name normalization strategy**
   - What we know: Simple lowercase + trim will handle basic cases
   - What's unclear: Should we use a food taxonomy/ontology for normalization? "Cheddar" vs "cheese" vs "cheddar cheese block"
   - Recommendation: Start simple (lowercase/trim). Add prompt engineering to ask Claude for standardized names. Defer taxonomy to later if duplicates become a UX problem.

3. **Image size optimization**
   - What we know: Claude works best at ~1092x1092, expo-image-picker supports quality compression
   - What's unclear: Optimal quality setting for food recognition (0.7? 0.8? 0.9?) -- lower quality = smaller upload but potentially worse recognition
   - Recommendation: Start with quality: 0.8, benchmark, adjust if recognition quality suffers.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~4.1.4 |
| Config file (mobile) | apps/mobile/vitest.config.ts |
| Config file (server) | packages/server/vitest.config.ts |
| Quick run command | `pnpm -r test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANT-01 | Claude identifies food items from fridge photo | unit (mock Claude) | `cd packages/server && pnpm vitest run src/services/__tests__/vision.test.ts -x` | No - Wave 0 |
| PANT-02 | Claude identifies items from pantry photo | unit (covered by PANT-01 test with different source_location param) | Same as PANT-01 | No - Wave 0 |
| PANT-03 | Claude identifies items from freezer photo | unit (covered by PANT-01 test) | Same as PANT-01 | No - Wave 0 |
| PANT-04 | Scan returns items with confidence scores | unit | `cd packages/server && pnpm vitest run src/services/__tests__/vision.test.ts -x` | No - Wave 0 |
| PANT-05 | User can edit/remove/add items in review | unit (store) | `cd apps/mobile && pnpm vitest run src/stores/__tests__/pantryStore.test.ts -x` | No - Wave 0 |
| PANT-06 | Inventory reconciliation across scans | unit | `cd packages/server && pnpm vitest run src/services/__tests__/pantry.test.ts -x` | No - Wave 0 |
| PANT-07 | Confidence decay for items not seen in 7+ days | unit | `cd apps/mobile && pnpm vitest run src/hooks/__tests__/usePantryItems.test.ts -x` | No - Wave 0 |
| PANT-08 | User can mark items as used/depleted | unit (store) | `cd apps/mobile && pnpm vitest run src/stores/__tests__/pantryStore.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm -r test`
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/server/src/services/__tests__/vision.test.ts` -- covers PANT-01 through PANT-04 (mock @anthropic-ai/sdk)
- [ ] `packages/server/src/services/__tests__/pantry.test.ts` -- covers PANT-06 reconciliation logic
- [ ] `apps/mobile/src/stores/__tests__/pantryStore.test.ts` -- covers PANT-05, PANT-08
- [ ] `apps/mobile/src/hooks/__tests__/usePantryItems.test.ts` -- covers PANT-07 confidence decay
- [ ] Add `ANTHROPIC_API_KEY: 'test-key'` to packages/server/vitest.config.ts test env

## Sources

### Primary (HIGH confidence)
- [Claude Vision API Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) -- image formats, size limits, best practices, token costs
- [Using Vision with Tools (Claude Cookbook)](https://platform.claude.com/cookbook/tool-use-vision-with-tools) -- complete pattern for structured extraction from images via tool_use
- [Expo ImagePicker Documentation](https://docs.expo.dev/versions/latest/sdk/imagepicker/) -- API reference, options, permission methods, base64 support
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) -- RLS policies for storage buckets

### Secondary (MEDIUM confidence)
- [Supabase React Native File Upload](https://supabase.com/blog/react-native-storage) -- ArrayBuffer upload pattern for React Native (base64 workaround)
- Existing project patterns from Phase 1-2 (preferencesStore.ts, household_preferences migration, Hono route stubs)

### Tertiary (LOW confidence)
- Claude Vision food recognition accuracy for real-world fridge/pantry photos (needs empirical validation -- flagged in STATE.md blockers)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project stack recommendation, APIs well-documented
- Architecture: HIGH -- follows established project patterns (Zustand stores, Hono routes, Supabase migrations with RLS)
- Pitfalls: HIGH -- common issues well-documented in official sources
- AI Vision accuracy: MEDIUM -- Claude Vision is proven but food-in-fridge recognition specifically needs real-world testing

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable stack, no fast-moving dependencies)
