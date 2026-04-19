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

  it('parses structured result into ScanResult array with source_location', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'milk',
          quantity: 1,
          unit: 'gallon',
          confidence: 0.95,
          category: 'dairy',
          source_location: 'fridge',
        },
        {
          name: 'eggs',
          quantity: 12,
          unit: 'piece',
          confidence: 0.9,
          category: 'protein',
          source_location: 'fridge',
        },
      ],
    });

    const result = await identifyFoodItems('base64data');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'milk',
      quantity: 1,
      unit: 'gallon',
      confidence: 0.95,
      category: 'dairy',
      source_location: 'fridge',
    });
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
          quantity: 1,
          unit: 'bottle',
          confidence: 0.95,
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
          quantity: 1,
          unit: 'piece',
          confidence: 0.5,
          category: 'other',
          source_location: 'counter', // invalid enum
        },
      ],
    });

    const result = await identifyFoodItems('base64data');
    expect(result[0].source_location).toBe('pantry');
  });

  it('mixed single-photo fixture fans out across all 3 locations', async () => {
    // milk -> fridge (static), rice -> pantry (static), 'ice cream' -> freezer (static).
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'milk', quantity: 1, unit: 'gallon', confidence: 0.95, category: 'dairy', source_location: 'fridge' },
        { name: 'rice', quantity: 1, unit: 'bag', confidence: 0.9, category: 'grain', source_location: 'pantry' },
        { name: 'ice cream', quantity: 1, unit: 'pint', confidence: 0.9, category: 'frozen', source_location: 'freezer' },
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
    expect(callArgs.user).toContain('2 photos');
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
        { name: 'chicken', quantity: 1, unit: 'lb', confidence: 0.9, category: 'meat', source_location: 'fridge' },
        { name: 'apple', quantity: 3, unit: 'piece', confidence: 0.8, category: 'fruit', source_location: 'fridge' },
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
        { name: 'eggs', quantity: 12, unit: 'piece', confidence: 0.9, category: 'protein', source_location: 'pantry' },
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
        { name: 'subtotal', quantity: 1, unit: 'item', confidence: 1, category: 'other', source_location: 'pantry' },
        { name: 'Total', quantity: 1, unit: 'item', confidence: 1, category: 'other', source_location: 'pantry' },
        { name: 'TAX', quantity: 1, unit: 'item', confidence: 1, category: 'other', source_location: 'pantry' },
        { name: 'Delivery Fee', quantity: 1, unit: 'item', confidence: 1, category: 'other', source_location: 'pantry' },
        { name: 'Coupon', quantity: 1, unit: 'item', confidence: 1, category: 'other', source_location: 'pantry' },
        { name: ' Tip ', quantity: 1, unit: 'item', confidence: 1, category: 'other', source_location: 'pantry' },
        { name: 'chicken breast', quantity: 1, unit: 'lb', confidence: 0.9, category: 'protein', source_location: 'fridge' },
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
        { name: 'chicken', quantity: 1, unit: 'lb', confidence: 0.9, category: 'meat', source_location: 'fridge' },
        { name: 'apple', quantity: 3, unit: 'piece', confidence: 0.8, category: 'fruit', source_location: 'fridge' },
      ],
    });

    const result = await identifyReceiptItems('base64data');

    expect(result[0].category).toBe('protein');
    expect(result[0].source_location).toBe('fridge');
    expect(result[1].category).toBe('produce');
  });

  it('mixed-locations receipt fixture fans out across all 3 locations', async () => {
    // milk (fridge static), rice (pantry static), 'ice cream' (freezer static)
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'milk', quantity: 1, unit: 'gallon', confidence: 0.9, category: 'dairy', source_location: 'fridge' },
        { name: 'rice', quantity: 1, unit: 'bag', confidence: 0.9, category: 'grain', source_location: 'pantry' },
        { name: 'ice cream', quantity: 1, unit: 'pint', confidence: 0.9, category: 'frozen', source_location: 'freezer' },
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
});

describe('SOURCE_LOCATIONS export', () => {
  it('exports the canonical three-element tuple', () => {
    expect(SOURCE_LOCATIONS).toEqual(['fridge', 'pantry', 'freezer']);
  });
});
