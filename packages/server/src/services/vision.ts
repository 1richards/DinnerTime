import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import { classifyLocationStatic } from './itemLocation.js';
import { SOURCE_LOCATIONS, type SourceLocation } from './sourceLocation.js';
import { type Quantity, sanitize as sanitizeQuantity } from './units.js';

/**
 * Phase 18: where an item lives in the kitchen. Canonical enum lives in
 * sourceLocation.ts (leaf module) to avoid a circular import with
 * itemLocation.ts. Re-exported here so existing consumers keep working.
 */
export { SOURCE_LOCATIONS };
export type { SourceLocation };

export const VALID_CATEGORIES = [
  'produce',
  'dairy',
  'protein',
  'grain',
  'condiment',
  'beverage',
  'frozen',
  'snack',
  'other',
] as const;
export type PantryCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Phase 24-04: per-field confidence exposed by the AI vision tool.
 *
 * Each score is in [0, 1] and describes how sure the model is about that
 * single field on a scanned item. Consumers use these for inline UI hints
 * (< 0.7 → dashed underline / caution) and scan_events.field_confidence
 * JSONB persistence (24-05). The overall legacy `ScanResult.confidence`
 * number remains for the Phase 14 0.7 threshold gate and is derived as
 * the minimum of the four field scores so the worst-case surfaces.
 */
export interface FieldConfidence {
  name: number;
  quantity: number;
  /**
   * Kept for forward-compat even though unit is now nested inside
   * `quantity` — the AI still scores its confidence in the unit token
   * independently of the numeric value.
   */
  unit: number;
  category: number;
}

export interface ScanResult {
  name: string;
  /**
   * Phase 24-04: quantity as `{ value, unit, system }` (see units.ts).
   * Was a flat number + sibling unit string pre-24a. normalizeScanItems
   * accepts both shapes (backward-compat) and always sanitizes via
   * units.sanitize so downstream consumers never see NaN/Infinity.
   */
  quantity: Quantity;
  /**
   * Overall/legacy confidence — computed as min(fieldConfidence.*) so the
   * Phase 14 0.7 threshold gate continues to work. Prefer reading
   * `fieldConfidence` when showing per-field UI hints.
   */
  confidence: number;
  /**
   * Phase 24-04: per-field confidence breakdown (name, quantity, unit,
   * category). Consumed by the review screen for inline low-confidence
   * hints and persisted to scan_events.field_confidence (24-05).
   */
  fieldConfidence: FieldConfidence;
  category: PantryCategory;
  /**
   * Phase 18: AI-inferred kitchen location for this item (post-corrected by
   * LOCATION_STATIC_MAP when a known name is present). Every scan return path
   * carries this field — consumers (reconcileItems, review screen) depend on it.
   */
  source_location: SourceLocation;
}

const QUANTITY_SYSTEMS = [
  'count',
  'imperial-weight',
  'imperial-volume',
  'metric-weight',
  'metric-volume',
  'custom',
] as const;

const foodItemsSchema: JsonSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Common name of the food item (lowercase, singular)' },
          quantity: {
            type: 'object',
            description:
              'Estimated quantity as { value, unit, system }. system picks the dimension: count (pieces), imperial-weight (oz/lb), imperial-volume (tsp/tbsp/cup), metric-weight (g/kg), metric-volume (ml/l), or custom for unknown units.',
            properties: {
              value: { type: 'number', description: 'Numeric amount, default 1' },
              unit: {
                type: 'string',
                description: 'Unit token (e.g. "piece", "lb", "oz", "cup", "tbsp", "g", "kg", "ml", "l", "bottle", "bag", "bunch")',
              },
              system: {
                type: 'string',
                enum: [...QUANTITY_SYSTEMS],
                description:
                  'Dimension: count (pieces), imperial-weight (oz/lb), imperial-volume (tsp/tbsp/cup), metric-weight (g/kg), metric-volume (ml/l), or custom (unknown/non-convertible units like bottle, bag, bunch).',
              },
            },
            required: ['value', 'unit', 'system'],
          },
          confidence: {
            type: 'object',
            description:
              'Per-field confidence scores 0.0-1.0 reflecting how sure you are about each attribute independently.',
            properties: {
              name: { type: 'number', description: 'Confidence in the identified item name' },
              quantity: { type: 'number', description: 'Confidence in the numeric quantity value' },
              unit: { type: 'number', description: 'Confidence in the unit token' },
              category: { type: 'number', description: 'Confidence in the chosen category' },
            },
            required: ['name', 'quantity', 'unit', 'category'],
          },
          category: {
            type: 'string',
            enum: [...VALID_CATEGORIES],
            description:
              'MUST be exactly one of: produce, dairy, protein, grain, condiment, beverage, frozen, snack, other. Meat/fish goes under "protein". Vegetables/fruit go under "produce". Anything unclear goes under "other".',
          },
          source_location: {
            type: 'string',
            enum: [...SOURCE_LOCATIONS],
            description:
              'Where a typical US household stores this item. fridge = dairy, fresh meat/produce, opened condiments. freezer = frozen foods, ice cream. pantry = shelf-stable, canned, dried, spices, oils, baked goods.',
          },
        },
        required: ['name', 'quantity', 'confidence', 'category', 'source_location'],
      },
    },
  },
  required: ['items'],
};

/**
 * Normalize a category string — if the AI returned something outside the
 * allowed set, coerce it to 'other' rather than failing the DB insert.
 */
export function coerceCategory(raw: unknown): PantryCategory {
  if (typeof raw !== 'string') return 'other';
  const lower = raw.trim().toLowerCase();
  if ((VALID_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as PantryCategory;
  }
  // Common fallbacks the AI might emit despite the enum.
  if (lower === 'meat' || lower === 'fish' || lower === 'poultry' || lower === 'seafood') return 'protein';
  if (lower === 'vegetable' || lower === 'vegetables' || lower === 'fruit' || lower === 'fruits' || lower === 'veggies') return 'produce';
  if (lower === 'bread' || lower === 'pasta' || lower === 'cereal' || lower === 'rice') return 'grain';
  if (lower === 'sauce' || lower === 'spice' || lower === 'oil' || lower === 'vinegar') return 'condiment';
  if (lower === 'drink' || lower === 'juice') return 'beverage';
  return 'other';
}

/**
 * Normalize + classify post-AI. STATIC_MAP wins over the AI response (Pitfall 1,
 * RESEARCH Q4 Option C). Invalid enums fall back to STATIC_MAP hit or 'pantry'
 * default (shelf-stable bias, matching Wave 1 classifyItems behavior).
 */
function correctLocation(rawName: unknown, rawLoc: unknown): SourceLocation {
  const name = typeof rawName === 'string' ? rawName.trim().toLowerCase() : '';
  const staticHit = name ? classifyLocationStatic(name) : null;
  if (staticHit) return staticHit;
  if (typeof rawLoc === 'string' && (SOURCE_LOCATIONS as readonly string[]).includes(rawLoc)) {
    return rawLoc as SourceLocation;
  }
  return 'pantry';
}

/**
 * Phase 24-04: clamp an untrusted confidence number into [0, 1]. Non-finite
 * inputs (NaN, ±Infinity, non-number) default to 0.5 so the review screen
 * surfaces uncertainty instead of hiding it with a confident-looking 1.0.
 */
function clamp01(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0.5;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Phase 24-04: normalize a raw confidence payload to FieldConfidence.
 *
 * Accepts:
 *   - Nested object { name, quantity, unit, category } (new 24a shape)
 *   - Flat number (legacy shape — splits to all four fields)
 *   - Missing fields (default to 0.5)
 *   - Non-finite values (default to 0.5)
 *   - Out-of-range values (clamp to [0, 1])
 */
function normalizeFieldConfidence(raw: unknown): FieldConfidence {
  // Legacy flat shape: a bare number applies uniformly.
  if (typeof raw === 'number') {
    const c = clamp01(raw);
    return { name: c, quantity: c, unit: c, category: c };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Partial<Record<keyof FieldConfidence, unknown>>;
    return {
      name: clamp01(r.name),
      quantity: clamp01(r.quantity),
      unit: clamp01(r.unit),
      category: clamp01(r.category),
    };
  }
  // Missing entirely — uniform uncertainty default.
  return { name: 0.5, quantity: 0.5, unit: 0.5, category: 0.5 };
}

/**
 * Phase 24-04: normalize a raw quantity payload to a sanitized Quantity.
 *
 * Accepts:
 *   - Nested { value, unit, system } (new 24a shape) → sanitize pass-through
 *   - Legacy flat number + sibling unit → wrap with system='count' default
 *     (legacy data was always piece-style counts)
 *   - Missing / malformed → sanitize's default {value:1, unit:'piece', system:'count'}
 *
 * units.sanitize clamps NaN/Infinity/negative values and coerces unknown
 * system strings to 'custom' so the reconcileItems multi-row fallback fires
 * instead of silently aggregating incompatible units (24-05).
 */
function normalizeQuantity(raw: unknown, flatUnit?: unknown): Quantity {
  // New nested shape — delegate entirely to sanitize (handles partial objects).
  if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
    return sanitizeQuantity(raw);
  }
  // Legacy flat: quantity was a plain number, unit lived as a sibling string.
  if (typeof raw === 'number') {
    const unit = typeof flatUnit === 'string' && flatUnit.length > 0 ? flatUnit : 'piece';
    return sanitizeQuantity({ value: raw, unit, system: 'count' });
  }
  return sanitizeQuantity(null);
}

const foodItemsTool: StructuredTool<{ items: RawScanItem[] }> = {
  name: 'report_food_items',
  description: 'Report all food items visible in the image with confidence scores',
  schema: foodItemsSchema,
};

const MAX_BASE64_BYTES = 5 * 1024 * 1024; // Anthropic's 5 MB limit

/**
 * Receipt/Instacart extraction: names the AI might emit for ledger lines
 * (subtotal, taxes, fees, discounts, credits). These are filtered out server-side
 * after the AI call — prompt instructions alone are not reliable enough to trust.
 * All entries are lowercase; matching trims + lowercases the returned name.
 */
export const RECEIPT_NAME_DENYLIST: ReadonlySet<string> = new Set([
  'subtotal',
  'total',
  'tax',
  'tip',
  'fee',
  'delivery fee',
  'service fee',
  'bag fee',
  'deposit',
  'discount',
  'coupon',
  'credit',
  'change',
]);

/**
 * Phase 18: location-agnostic per-item classification directive folded into the
 * existing filter/identification rules. The AI picks a location per item;
 * STATIC_MAP corrects known entries post-call.
 */
const LOCATION_CLASSIFICATION_RULES = `For each item, infer where a typical US household stores it — fridge (dairy, fresh meat/produce, opened condiments), freezer (frozen foods, ice cream, frozen vegetables), or pantry (shelf-stable, canned, dried, spices, oils, baked goods). Set source_location accordingly.`;

/**
 * Phase 24-04: per-item quantity + per-field confidence directive. Appended to
 * every vision prompt so Claude knows to emit the nested shapes declared by
 * foodItemsSchema (not just rely on tool-schema enforcement).
 *
 * Prompt stays as an in-file string for 24a; versioned .md prompt files are
 * 24b scope.
 */
const QUANTITY_AND_CONFIDENCE_RULES = `For each item, provide a quantity object with value, unit, and system (count for pieces; imperial-weight for oz/lb; imperial-volume for tsp/tbsp/cup; metric-weight for g/kg; metric-volume for ml/l; custom for any other unit like bottle/bag/bunch). Also provide per-field confidence for name, quantity, unit, and category from 0 to 1, reflecting how sure you are about each attribute independently.`;

const FILTERING_RULES = `For each item, report ONLY items you can specifically name as a cooking ingredient or food product. Examples of GOOD items: "milk", "cheddar cheese", "sriracha", "ground beef", "sourdough bread", "olive oil".

DO NOT report:
- Vague or unidentifiable items ("leftover container", "unidentified dairy item", "mystery sauce")
- Generic descriptions ("condiment packet", "sauce packet", "plastic container with food")
- Non-food items (cleaning supplies, utensils, containers without identifiable contents)
- Items you cannot specifically name -- if you can't tell what it is, exclude it entirely

Named condiments and sauces ARE included (e.g., ketchup, soy sauce, ranch dressing).
All beverages ARE included (e.g., orange juice, soda, water, beer).

Only report items with overall confidence >= 0.5 (use the name field's confidence as the primary gate).
The category field MUST be exactly one of the nine values in the schema.

${LOCATION_CLASSIFICATION_RULES}

${QUANTITY_AND_CONFIDENCE_RULES}`;

/**
 * Receipt / Instacart-screenshot-specific extraction rules.
 * Extends FILTERING_RULES with line-item parsing, abbreviation expansion, and
 * explicit denylist guidance. Pairs with server-side RECEIPT_NAME_DENYLIST
 * filtering (prompt alone is not sufficient — belt-and-suspenders).
 *
 * Source: 13-RESEARCH.md "Pattern 1". Pitfall 2 mitigation appended:
 * empty items array when image is too faded/blurry to read reliably.
 *
 * Phase 24-04: receipts often show weight (lb/oz) — the quantity.system enum
 * below lets Claude emit imperial-weight for those line items.
 */
export const RECEIPT_FILTERING_RULES = `${FILTERING_RULES}

This image is a GROCERY RECEIPT (or a screenshot of an Instacart order summary).
- Each line typically shows: item name, quantity, unit or weight, price.
- Extract ONLY purchased food/grocery items.
- DO NOT report: subtotal, total, tax, tip, fees, discounts, coupons, store loyalty
  credits, deposits, bag fees, delivery fees, service fees, or store name.
- DO NOT report non-food items (cleaning supplies, paper goods, beauty products,
  medicine) even if they appear on the receipt.
- Expand common receipt abbreviations (e.g., "CHKN BRST" -> "chicken breast",
  "ORG BANANA" -> "organic bananas", "GV WHL MLK" -> "whole milk").
- Receipts often show weights in lb or oz — use imperial-weight system and the
  exact unit token from the line when present. If only a price is present,
  default quantity to { value: 1, unit: "piece", system: "count" }.
- If an item appears multiple times on separate lines, report it once with the
  summed quantity.
- If the receipt is too faded or blurry to read reliably, return an empty items array.
Dairy/fresh meat/produce → fridge. Frozen items → freezer. Shelf-stable → pantry.`;

/**
 * Shape returned by the AI tool before normalization. Fields are all
 * optional because malformed / partial responses must flow through
 * normalizeScanItems → sanitize rather than crashing the scan.
 */
interface RawScanItem {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown; // legacy flat shape
  confidence?: unknown;
  category?: unknown;
  source_location?: unknown;
}

/**
 * Map raw AI items to ScanResult[], coercing category and correcting
 * source_location via STATIC_MAP-wins. Shared by all three vision entrypoints
 * so the invariant is enforced in exactly one place.
 *
 * Phase 24-04: also sanitizes the new nested `quantity` and `confidence`
 * shapes while tolerating legacy flat payloads (backward-compat path).
 */
function normalizeScanItems(raw: Array<RawScanItem> | undefined): ScanResult[] {
  return (raw ?? []).map((item) => {
    const quantity = normalizeQuantity(item.quantity, item.unit);
    const fieldConfidence = normalizeFieldConfidence(item.confidence);
    // Overall legacy confidence = min of per-field scores so the existing
    // 0.7 threshold gate (Phase 14) reflects the worst-case attribute.
    const confidence = Math.min(
      fieldConfidence.name,
      fieldConfidence.quantity,
      fieldConfidence.unit,
      fieldConfidence.category,
    );
    return {
      name: String(item.name ?? ''),
      quantity,
      confidence,
      fieldConfidence,
      category: coerceCategory(item.category),
      source_location: correctLocation(item.name, item.source_location),
    };
  });
}

export async function identifyFoodItems(base64Image: string): Promise<ScanResult[]> {
  const imageBytes = Buffer.from(base64Image, 'base64').length;
  if (imageBytes > MAX_BASE64_BYTES) {
    throw new Error(
      `Image too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please retake at lower resolution.`
    );
  }
  const ai = getClientFor('vision.pantryScan');
  const result = await ai.analyzeImageStructured<{ items: RawScanItem[] }>({
    user: `You are analyzing a kitchen photo. Identify each visible food item and infer where a typical US household stores it (fridge/pantry/freezer).\n\n${FILTERING_RULES}`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: foodItemsTool,
    maxTokens: 4096,
  });
  return normalizeScanItems(result.items);
}

export async function identifyFoodItemsBatch(
  base64Images: string[],
  existingItemNames: string[] = []
): Promise<ScanResult[]> {
  // Validate each image against the 5MB limit.
  for (let i = 0; i < base64Images.length; i++) {
    const imageBytes = Buffer.from(base64Images[i], 'base64').length;
    if (imageBytes > MAX_BASE64_BYTES) {
      throw new Error(
        `Image ${i + 1} too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please retake at lower resolution.`
      );
    }
  }

  const count = base64Images.length;
  const ai = getClientFor('vision.pantryScan');

  // Build the "already in pantry" directive when items exist. This prevents
  // shelf-stable items (condiments, oils, etc.) from cluttering review results
  // on every scan. The reconciler still updates last_seen_at for matched items
  // via a separate code path, so skipping them here is purely a UX filter.
  const existingBlock = existingItemNames.length > 0
    ? `\n\nALREADY IN PANTRY (do NOT report these — they are already tracked):\n${existingItemNames.map((n) => `- ${n}`).join('\n')}\n\nIf you see any of the above items in the photos, exclude them from your response. Only report NEW items not already in this list.`
    : '';

  const result = await ai.analyzeImagesStructured<{ items: RawScanItem[] }>({
    user: `You are analyzing ${count} kitchen photos. These photos may show overlapping areas -- deduplicate items that appear in multiple photos. For each item, infer where a typical US household stores it (fridge/pantry/freezer).\n\n${FILTERING_RULES}${existingBlock}`,
    images: base64Images.map((b64) => ({ base64: b64, mimeType: 'image/jpeg' as const })),
    tool: foodItemsTool,
    maxTokens: 8192,
  });
  return normalizeScanItems(result.items);
}

/**
 * Extract pantry items from a single receipt photo or Instacart order
 * screenshot. Single function with a `variant` param (receipt vs instacart
 * screenshot) because both are single-image structured-OCR tasks with the
 * same ScanResult[] output shape.
 *
 * Pantry-aware dedup (`existingItemNames`) mirrors identifyFoodItemsBatch so
 * shelf-stable items (oils, condiments) don't clutter repeat imports.
 *
 * Server-side denylist (RECEIPT_NAME_DENYLIST) catches ledger lines the AI
 * may emit despite prompt instructions (research Pitfall 4).
 *
 * Phase 18: no longer takes a source_location parameter. AI classifies per item;
 * STATIC_MAP corrects known names post-call.
 *
 * Phase 24-04: shares foodItemsSchema + normalizeScanItems with the pantry-scan
 * flows — single source of truth for the nested quantity + confidence shape.
 */
export async function identifyReceiptItems(
  base64Image: string,
  existingItemNames: string[] = [],
  variant: 'receipt' | 'instacart_screenshot' = 'receipt'
): Promise<ScanResult[]> {
  const imageBytes = Buffer.from(base64Image, 'base64').length;
  if (imageBytes > MAX_BASE64_BYTES) {
    throw new Error(
      `Image too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please retake at lower resolution.`
    );
  }

  const ai = getClientFor('vision.pantryScan');

  const existingBlock = existingItemNames.length > 0
    ? `\n\nALREADY IN PANTRY (do NOT report these — they are already tracked):\n${existingItemNames.map((n) => `- ${n}`).join('\n')}\n\nIf you see any of the above items on the receipt, exclude them from your response. Only report NEW items not already in this list.`
    : '';

  const variantPreamble = variant === 'instacart_screenshot'
    ? 'You are analyzing a screenshot of an Instacart order summary or order confirmation. For each line, extract the product from the label (size on package) as quantity.{value, unit, system}.'
    : 'You are analyzing a photograph of a printed grocery store receipt.';

  const result = await ai.analyzeImageStructured<{ items: RawScanItem[] }>({
    user: `${variantPreamble}\n\n${RECEIPT_FILTERING_RULES}${existingBlock}`,
    imageBase64: base64Image,
    mimeType: 'image/jpeg',
    tool: foodItemsTool,
    maxTokens: 4096,
  });

  // Coerce category + correct location via STATIC_MAP, then filter denylisted
  // ledger lines. The denylist is a safety net — the prompt already instructs
  // Claude not to emit these, but we can't rely on prompt adherence alone for
  // financial-looking lines.
  return normalizeScanItems(result.items).filter((item) => {
    const normalized = item.name.trim().toLowerCase();
    return !RECEIPT_NAME_DENYLIST.has(normalized);
  });
}
