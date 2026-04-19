import { getClientFor } from '../ai/clientFactory.js';
import type { JsonSchema, StructuredTool } from '../ai/types.js';
import { classifyLocationStatic } from './itemLocation.js';
import { SOURCE_LOCATIONS, type SourceLocation } from './sourceLocation.js';

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

export interface ScanResult {
  name: string;
  quantity: number;
  unit: string;
  confidence: number;
  category: PantryCategory;
  /**
   * Phase 18: AI-inferred kitchen location for this item (post-corrected by
   * LOCATION_STATIC_MAP when a known name is present). Every scan return path
   * carries this field — consumers (reconcileItems, review screen) depend on it.
   */
  source_location: SourceLocation;
}

const foodItemsSchema: JsonSchema = {
  type: 'object',
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
        required: ['name', 'quantity', 'unit', 'confidence', 'category', 'source_location'],
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

const foodItemsTool: StructuredTool<{ items: ScanResult[] }> = {
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

const FILTERING_RULES = `For each item, report ONLY items you can specifically name as a cooking ingredient or food product. Examples of GOOD items: "milk", "cheddar cheese", "sriracha", "ground beef", "sourdough bread", "olive oil".

DO NOT report:
- Vague or unidentifiable items ("leftover container", "unidentified dairy item", "mystery sauce")
- Generic descriptions ("condiment packet", "sauce packet", "plastic container with food")
- Non-food items (cleaning supplies, utensils, containers without identifiable contents)
- Items you cannot specifically name -- if you can't tell what it is, exclude it entirely

Named condiments and sauces ARE included (e.g., ketchup, soy sauce, ranch dressing).
All beverages ARE included (e.g., orange juice, soda, water, beer).

Assign confidence 0.0-1.0 based on how clearly you can identify each item. Only report items with confidence >= 0.5.
The category field MUST be exactly one of the nine values in the schema.

${LOCATION_CLASSIFICATION_RULES}`;

/**
 * Receipt / Instacart-screenshot-specific extraction rules.
 * Extends FILTERING_RULES with line-item parsing, abbreviation expansion, and
 * explicit denylist guidance. Pairs with server-side RECEIPT_NAME_DENYLIST
 * filtering (prompt alone is not sufficient — belt-and-suspenders).
 *
 * Source: 13-RESEARCH.md "Pattern 1". Pitfall 2 mitigation appended:
 * empty items array when image is too faded/blurry to read reliably.
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
- If a quantity column is present, use it. If only a price is present, default
  quantity to 1 and unit to "piece".
- If an item appears multiple times on separate lines, report it once with the
  summed quantity.
- If the receipt is too faded or blurry to read reliably, return an empty items array.
Dairy/fresh meat/produce → fridge. Frozen items → freezer. Shelf-stable → pantry.`;

/**
 * Map raw AI items to ScanResult[], coercing category and correcting
 * source_location via STATIC_MAP-wins. Shared by all three vision entrypoints
 * so the invariant is enforced in exactly one place.
 */
function normalizeScanItems(raw: Array<Partial<ScanResult>> | undefined): ScanResult[] {
  return (raw ?? []).map((item) => ({
    name: String(item.name ?? ''),
    quantity: typeof item.quantity === 'number' ? item.quantity : 1,
    unit: typeof item.unit === 'string' ? item.unit : 'piece',
    confidence: typeof item.confidence === 'number' ? item.confidence : 0,
    category: coerceCategory(item.category),
    source_location: correctLocation(item.name, item.source_location),
  }));
}

export async function identifyFoodItems(base64Image: string): Promise<ScanResult[]> {
  const imageBytes = Buffer.from(base64Image, 'base64').length;
  if (imageBytes > MAX_BASE64_BYTES) {
    throw new Error(
      `Image too large (${(imageBytes / 1024 / 1024).toFixed(1)} MB). Please retake at lower resolution.`
    );
  }
  const ai = getClientFor('vision.pantryScan');
  const result = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
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

  const result = await ai.analyzeImagesStructured<{ items: ScanResult[] }>({
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
    ? 'You are analyzing a screenshot of an Instacart order summary or order confirmation.'
    : 'You are analyzing a photograph of a printed grocery store receipt.';

  const result = await ai.analyzeImageStructured<{ items: ScanResult[] }>({
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
