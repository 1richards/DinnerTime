import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAnalyzeImageStructured, mockAnalyzeImagesStructured, mockGenerateStructured, mockGenerateText, mockGetClientFor } =
  vi.hoisted(() => {
    const mockAnalyzeImageStructured = vi.fn();
    const mockAnalyzeImagesStructured = vi.fn();
    const mockGenerateStructured = vi.fn();
    const mockGenerateText = vi.fn();
    const mockGetClientFor = vi.fn(() => ({
      generateText: mockGenerateText,
      generateStructured: mockGenerateStructured,
      analyzeImageStructured: mockAnalyzeImageStructured,
      analyzeImagesStructured: mockAnalyzeImagesStructured,
    }));
    return {
      mockAnalyzeImageStructured,
      mockAnalyzeImagesStructured,
      mockGenerateStructured,
      mockGenerateText,
      mockGetClientFor,
    };
  });

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

// Must import after mock setup
import { identifyFoodItems, identifyFoodItemsBatch, identifyReceiptItems, SOURCE_LOCATIONS } from '../vision.js';

describe('identifyFoodItems', () => {
  beforeEach(() => {
    mockAnalyzeImageStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('sends image + location-agnostic prompt to AIClient.analyzeImageStructured', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyFoodItems('base64data');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockAnalyzeImageStructured).toHaveBeenCalledOnce();

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
    });
    // Prompt should be location-agnostic and instruct per-item inference.
    expect(callArgs.user).toMatch(/fridge/i);
    expect(callArgs.user).toMatch(/pantry/i);
    expect(callArgs.user).toMatch(/freezer/i);
    // Must NOT contain the old per-photo location preamble form.
    expect(callArgs.user).not.toMatch(/You are analyzing a photo of a (fridge|pantry|freezer)\./);
    expect(callArgs.tool).toMatchObject({ name: 'report_food_items' });
  });

  it('24a: prompt instructs quantity.{value,unit,system} + per-field confidence', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });
    await identifyFoodItems('base64data');
    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    // Per-field confidence instruction present.
    expect(callArgs.user).toMatch(/per-field confidence|confidence.*name.*quantity.*unit.*category/i);
    // Quantity object with system explanation.
    expect(callArgs.user).toMatch(/quantity.*value.*unit.*system|imperial-weight|imperial-volume/i);
  });

  it('24a: tool schema declares nested quantity object with value/unit/system', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });
    await identifyFoodItems('base64data');
    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    const schema = callArgs.tool.schema;
    const itemSchema = schema.properties.items.items;
    expect(itemSchema.properties.quantity.type).toBe('object');
    expect(itemSchema.properties.quantity.properties.value.type).toBe('number');
    expect(itemSchema.properties.quantity.properties.unit.type).toBe('string');
    expect(itemSchema.properties.quantity.properties.system.type).toBe('string');
    expect(itemSchema.properties.quantity.properties.system.enum).toEqual([
      'count',
      'imperial-weight',
      'imperial-volume',
      'metric-weight',
      'metric-volume',
      'custom',
    ]);
    expect(itemSchema.properties.quantity.required).toEqual(['value', 'unit', 'system']);
  });

  it('24a: tool schema declares nested confidence object with per-field numbers', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });
    await identifyFoodItems('base64data');
    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    const itemSchema = callArgs.tool.schema.properties.items.items;
    expect(itemSchema.properties.confidence.type).toBe('object');
    expect(itemSchema.properties.confidence.properties.name.type).toBe('number');
    expect(itemSchema.properties.confidence.properties.quantity.type).toBe('number');
    expect(itemSchema.properties.confidence.properties.unit.type).toBe('number');
    expect(itemSchema.properties.confidence.properties.category.type).toBe('number');
    expect(itemSchema.properties.confidence.required).toEqual(['name', 'quantity', 'unit', 'category']);
  });

  it('parses structured result into ScanResult array with nested Quantity + fieldConfidence', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'milk',
          quantity: { value: 1, unit: 'gallon', system: 'custom' },
          confidence: { name: 0.95, quantity: 0.9, unit: 0.85, category: 0.98 },
          category: 'dairy',
          source_location: 'fridge',
        },
        {
          name: 'eggs',
          quantity: { value: 12, unit: 'piece', system: 'count' },
          confidence: { name: 0.9, quantity: 0.95, unit: 0.9, category: 0.95 },
          category: 'protein',
          source_location: 'fridge',
        },
      ],
    });

    const result = await identifyFoodItems('base64data');

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('milk');
    expect(result[0].quantity).toEqual({ value: 1, unit: 'gallon', system: 'custom' });
    expect(result[0].fieldConfidence).toEqual({ name: 0.95, quantity: 0.9, unit: 0.85, category: 0.98 });
    // Overall confidence = min of field confidences (preserves 0.7 gate semantics).
    expect(result[0].confidence).toBe(0.85);
    expect(result[0].category).toBe('dairy');
    expect(result[0].source_location).toBe('fridge');

    expect(result[1].quantity).toEqual({ value: 12, unit: 'piece', system: 'count' });
    expect(result[1].fieldConfidence.name).toBe(0.9);
    expect(result[1].source_location).toBe('fridge');
  });

  it('returns empty array when items missing from result', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({});

    const result = await identifyFoodItems('base64data');
    expect(result).toEqual([]);
  });

  it('routes via vision.pantryScan task slot', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyFoodItems('base64data');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockGetClientFor).toHaveBeenCalledTimes(1);
  });

  it('forwards imageBase64 and mimeType + tool.name to analyzeImageStructured', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyFoodItems('ABC123');

    expect(mockAnalyzeImageStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: 'ABC123',
        mimeType: 'image/jpeg',
        tool: expect.objectContaining({ name: 'report_food_items' }),
      })
    );
  });

  it('STATIC_MAP wins over AI: AI returns fridge for olive oil -> result is pantry', async () => {
    // olive oil is in LOCATION_STATIC_MAP as pantry. If AI says fridge, static wins.
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'olive oil',
          quantity: { value: 1, unit: 'bottle', system: 'custom' },
          confidence: { name: 0.95, quantity: 0.9, unit: 0.9, category: 0.9 },
          category: 'condiment',
          source_location: 'fridge',
        },
      ],
    });

    const result = await identifyFoodItems('base64data');
    expect(result).toHaveLength(1);
    expect(result[0].source_location).toBe('pantry');
  });

  it('falls back to pantry when AI returns an invalid enum for an unknown name', async () => {
    // 'mystery ingredient xyz' is not in STATIC_MAP; AI returns an invalid enum.
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'mystery ingredient xyz',
          quantity: { value: 1, unit: 'piece', system: 'count' },
          confidence: { name: 0.5, quantity: 0.5, unit: 0.5, category: 0.5 },
          category: 'other',
          source_location: 'counter', // invalid enum
        },
      ],
    });

    const result = await identifyFoodItems('base64data');
    expect(result[0].source_location).toBe('pantry');
  });

  it('mixed single-photo fixture fans out across all 3 locations', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'milk', quantity: { value: 1, unit: 'gallon', system: 'custom' }, confidence: { name: 0.95, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'dairy', source_location: 'fridge' },
        { name: 'rice', quantity: { value: 1, unit: 'bag', system: 'custom' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'grain', source_location: 'pantry' },
        { name: 'ice cream', quantity: { value: 1, unit: 'pint', system: 'custom' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'frozen', source_location: 'freezer' },
      ],
    });

    const result = await identifyFoodItems('base64data');
    expect(new Set(result.map((i) => i.source_location)).size).toBe(3);
  });
});

describe('identifyFoodItemsBatch', () => {
  beforeEach(() => {
    mockAnalyzeImagesStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('validates each image against 5MB limit and throws on oversized', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024).toString('base64');

    await expect(
      identifyFoodItemsBatch([oversized])
    ).rejects.toThrow(/Image 1.*too large/);
  });

  it('calls analyzeImagesStructured with all images and the location-agnostic filtering prompt', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({ items: [] });

    await identifyFoodItemsBatch(['IMG1', 'IMG2']);

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockAnalyzeImagesStructured).toHaveBeenCalledOnce();

    const callArgs = mockAnalyzeImagesStructured.mock.calls[0][0];
    expect(callArgs.images).toEqual([
      { base64: 'IMG1', mimeType: 'image/jpeg' },
      { base64: 'IMG2', mimeType: 'image/jpeg' },
    ]);
    expect(callArgs.user).toMatch(/2\s+(kitchen\s+)?photos/);
    // No single-location lock in the prompt.
    expect(callArgs.user).not.toMatch(/You are analyzing \d+ photos of a (fridge|pantry|freezer)/);
    expect(callArgs.user).toContain('deduplicate');
    expect(callArgs.user).toContain('DO NOT report');
    expect(callArgs.user).toMatch(/fridge/i);
    expect(callArgs.user).toMatch(/pantry/i);
    expect(callArgs.user).toMatch(/freezer/i);
    expect(callArgs.tool).toMatchObject({ name: 'report_food_items' });
    expect(callArgs.maxTokens).toBe(8192);
  });

  it('coerces categories on returned items and returns source_location', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({
      items: [
        { name: 'chicken', quantity: { value: 1, unit: 'lb', system: 'imperial-weight' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'meat', source_location: 'fridge' },
        { name: 'apple', quantity: { value: 3, unit: 'piece', system: 'count' }, confidence: { name: 0.8, quantity: 0.8, unit: 0.8, category: 0.8 }, category: 'fruit', source_location: 'fridge' },
      ],
    });

    const result = await identifyFoodItemsBatch(['IMG1']);

    expect(result[0].category).toBe('protein');
    expect(result[0].source_location).toBe('fridge');
    expect(result[1].category).toBe('produce');
  });

  it('STATIC_MAP wins: AI says pantry for eggs, result is fridge', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({
      items: [
        { name: 'eggs', quantity: { value: 12, unit: 'piece', system: 'count' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'protein', source_location: 'pantry' },
      ],
    });

    const result = await identifyFoodItemsBatch(['IMG1']);
    expect(result[0].source_location).toBe('fridge');
  });

  it('returns empty array when items missing from result', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({});

    const result = await identifyFoodItemsBatch(['IMG1']);
    expect(result).toEqual([]);
  });

  it('passes through existing item names in the prompt when provided', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({ items: [] });

    await identifyFoodItemsBatch(['IMG1'], ['milk', 'eggs']);
    const callArgs = mockAnalyzeImagesStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('ALREADY IN PANTRY');
    expect(callArgs.user).toContain('- milk');
  });
});

describe('identifyReceiptItems', () => {
  beforeEach(() => {
    mockAnalyzeImageStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('routes via vision.pantryScan and uses receipt preamble by default', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockAnalyzeImageStructured).toHaveBeenCalledOnce();

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
      maxTokens: 4096,
    });
    expect(callArgs.tool).toMatchObject({ name: 'report_food_items' });
    expect(callArgs.user.toLowerCase()).toContain('printed grocery store receipt');
    // Prompt must instruct per-item location inference.
    expect(callArgs.user).toMatch(/fridge/i);
    expect(callArgs.user).toMatch(/pantry/i);
    expect(callArgs.user).toMatch(/freezer/i);
  });

  it('uses instacart preamble when variant=instacart_screenshot', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', [], 'instacart_screenshot');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('Instacart order summary');
    expect(callArgs.user.toLowerCase()).not.toContain('printed grocery store receipt');
  });

  it('uses receipt preamble when variant explicitly receipt', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', [], 'receipt');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user.toLowerCase()).toContain('printed grocery store receipt');
    expect(callArgs.user).not.toContain('You are analyzing a screenshot of an Instacart order summary');
  });

  it('includes ALREADY IN PANTRY block when existingItemNames provided', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', ['milk', 'eggs'], 'receipt');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('ALREADY IN PANTRY');
    expect(callArgs.user).toContain('- milk');
    expect(callArgs.user).toContain('- eggs');
  });

  it('does NOT include ALREADY IN PANTRY block when existingItemNames empty', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', [], 'receipt');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).not.toContain('ALREADY IN PANTRY');
  });

  it('filters out denylist items (subtotal, total, tax, delivery fee, coupon) case-insensitively', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'subtotal', quantity: { value: 1, unit: 'item', system: 'custom' }, confidence: { name: 1, quantity: 1, unit: 1, category: 1 }, category: 'other', source_location: 'pantry' },
        { name: 'Total', quantity: { value: 1, unit: 'item', system: 'custom' }, confidence: { name: 1, quantity: 1, unit: 1, category: 1 }, category: 'other', source_location: 'pantry' },
        { name: 'TAX', quantity: { value: 1, unit: 'item', system: 'custom' }, confidence: { name: 1, quantity: 1, unit: 1, category: 1 }, category: 'other', source_location: 'pantry' },
        { name: 'Delivery Fee', quantity: { value: 1, unit: 'item', system: 'custom' }, confidence: { name: 1, quantity: 1, unit: 1, category: 1 }, category: 'other', source_location: 'pantry' },
        { name: 'Coupon', quantity: { value: 1, unit: 'item', system: 'custom' }, confidence: { name: 1, quantity: 1, unit: 1, category: 1 }, category: 'other', source_location: 'pantry' },
        { name: ' Tip ', quantity: { value: 1, unit: 'item', system: 'custom' }, confidence: { name: 1, quantity: 1, unit: 1, category: 1 }, category: 'other', source_location: 'pantry' },
        { name: 'chicken breast', quantity: { value: 1, unit: 'lb', system: 'imperial-weight' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'protein', source_location: 'fridge' },
      ],
    });

    const result = await identifyReceiptItems('base64data');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('chicken breast');
    expect(result[0].source_location).toBe('fridge');
  });

  it('coerces returned categories (meat -> protein) and keeps source_location', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'chicken', quantity: { value: 1, unit: 'lb', system: 'imperial-weight' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'meat', source_location: 'fridge' },
        { name: 'apple', quantity: { value: 3, unit: 'piece', system: 'count' }, confidence: { name: 0.8, quantity: 0.8, unit: 0.8, category: 0.8 }, category: 'fruit', source_location: 'fridge' },
      ],
    });

    const result = await identifyReceiptItems('base64data');

    expect(result[0].category).toBe('protein');
    expect(result[0].source_location).toBe('fridge');
    expect(result[1].category).toBe('produce');
  });

  it('mixed-locations receipt fixture fans out across all 3 locations', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'milk', quantity: { value: 1, unit: 'gallon', system: 'custom' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'dairy', source_location: 'fridge' },
        { name: 'rice', quantity: { value: 1, unit: 'bag', system: 'custom' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'grain', source_location: 'pantry' },
        { name: 'ice cream', quantity: { value: 1, unit: 'pint', system: 'custom' }, confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 }, category: 'frozen', source_location: 'freezer' },
      ],
    });

    const result = await identifyReceiptItems('base64data');
    const locations = new Set(result.map((i) => i.source_location));
    expect(locations.size).toBe(3);
    expect(locations.has('fridge')).toBe(true);
    expect(locations.has('pantry')).toBe(true);
    expect(locations.has('freezer')).toBe(true);
  });

  it('returns empty array when items missing from result', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({});

    const result = await identifyReceiptItems('base64data');
    expect(result).toEqual([]);
  });

  it('throws when image exceeds 5MB limit', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024).toString('base64');

    await expect(identifyReceiptItems(oversized)).rejects.toThrow(/too large/i);
  });

  it('prompt includes receipt-specific rules (skip totals, expand abbreviations) + location inference', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).toMatch(/subtotal|total|tax/i);
    expect(callArgs.user).toMatch(/abbreviation/i);
    // Per-item location instruction.
    expect(callArgs.user).toMatch(/(infer|classify).*location|where .* (stores?|lives?)|fridge.*pantry.*freezer/i);
  });

  it('24a: receipt prompt also instructs per-field confidence + quantity.{value,unit,system}', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });
    await identifyReceiptItems('base64data');
    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).toMatch(/per-field confidence|name.*quantity.*unit.*category/i);
    expect(callArgs.user).toMatch(/quantity.*value.*unit.*system|imperial-weight|imperial-volume|lb|oz/i);
  });
});

describe('SOURCE_LOCATIONS export', () => {
  it('exports the canonical three-element tuple', () => {
    expect(SOURCE_LOCATIONS).toEqual(['fridge', 'pantry', 'freezer']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 24a: normalizeScanItems — new Quantity + FieldConfidence shape
// These tests exercise normalization indirectly through the public surface
// (identifyFoodItems) and assert sanitize + default + legacy-flat fallbacks.
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeScanItems — 24a shape', () => {
  beforeEach(() => {
    mockAnalyzeImageStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('produces nested Quantity from new schema', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'chicken breast',
          quantity: { value: 2, unit: 'lb', system: 'imperial-weight' },
          confidence: { name: 0.9, quantity: 0.85, unit: 0.9, category: 0.95 },
          category: 'protein',
          source_location: 'fridge',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.quantity).toEqual({ value: 2, unit: 'lb', system: 'imperial-weight' });
  });

  it('backward-compat: flat quantity number → Quantity with piece/count', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'apple',
          // Legacy flat shape: quantity as a number + sibling unit string.
          quantity: 3,
          unit: 'piece',
          // Legacy flat confidence.
          confidence: 0.92,
          category: 'produce',
          source_location: 'fridge',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.quantity).toEqual({ value: 3, unit: 'piece', system: 'count' });
  });

  it('per-field confidence preserved from AI response', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'banana',
          quantity: { value: 1, unit: 'piece', system: 'count' },
          confidence: { name: 0.92, quantity: 0.55, unit: 0.73, category: 0.88 },
          category: 'produce',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.fieldConfidence).toEqual({ name: 0.92, quantity: 0.55, unit: 0.73, category: 0.88 });
  });

  it('missing confidence fields default to 0.5', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'tomato',
          quantity: { value: 1, unit: 'piece', system: 'count' },
          // confidence with only some fields present
          confidence: { name: 0.9 },
          category: 'produce',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.fieldConfidence.name).toBe(0.9);
    expect(item.fieldConfidence.quantity).toBe(0.5);
    expect(item.fieldConfidence.unit).toBe(0.5);
    expect(item.fieldConfidence.category).toBe(0.5);
  });

  it('NaN confidence → 0.5', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'onion',
          quantity: { value: 1, unit: 'piece', system: 'count' },
          confidence: { name: Number.NaN, quantity: Number.POSITIVE_INFINITY, unit: -0.5, category: 2.5 },
          category: 'produce',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.fieldConfidence.name).toBe(0.5);
    expect(item.fieldConfidence.quantity).toBe(0.5);
    // negative clamps to 0
    expect(item.fieldConfidence.unit).toBe(0);
    // >1 clamps to 1
    expect(item.fieldConfidence.category).toBe(1);
  });

  it('flat confidence number splits to all four fields', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'lettuce',
          quantity: 1,
          unit: 'head',
          // Legacy flat: confidence is a number, not an object.
          confidence: 0.7,
          category: 'produce',
          source_location: 'fridge',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.fieldConfidence).toEqual({ name: 0.7, quantity: 0.7, unit: 0.7, category: 0.7 });
  });

  it('overall confidence = min of field confidences', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'pepper',
          quantity: { value: 2, unit: 'piece', system: 'count' },
          confidence: { name: 0.9, quantity: 0.3, unit: 0.85, category: 0.95 },
          category: 'produce',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    // min(0.9, 0.3, 0.85, 0.95) = 0.3
    expect(item.confidence).toBe(0.3);
  });

  it('malformed quantity sanitized via units.sanitize (NaN value → 0)', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'broken',
          quantity: { value: Number.NaN, unit: 'piece', system: 'count' },
          confidence: { name: 0.5, quantity: 0.5, unit: 0.5, category: 0.5 },
          category: 'other',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.quantity.value).toBe(0);
    expect(item.quantity.unit).toBe('piece');
    expect(item.quantity.system).toBe('count');
  });

  it('missing quantity.system defaults to custom (forces multi-row fallback)', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'weirdunit',
          quantity: { value: 5, unit: 'bunch' },
          confidence: { name: 0.9, quantity: 0.9, unit: 0.9, category: 0.9 },
          category: 'produce',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.quantity).toEqual({ value: 5, unit: 'bunch', system: 'custom' });
  });

  it('completely missing confidence object → all fields default to 0.5', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'mystery',
          quantity: { value: 1, unit: 'piece', system: 'count' },
          // confidence missing entirely
          category: 'other',
          source_location: 'pantry',
        },
      ],
    });
    const [item] = await identifyFoodItems('IMG');
    expect(item.fieldConfidence).toEqual({ name: 0.5, quantity: 0.5, unit: 0.5, category: 0.5 });
    expect(item.confidence).toBe(0.5);
  });
});
