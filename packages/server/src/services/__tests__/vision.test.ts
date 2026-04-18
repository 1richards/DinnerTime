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
import { identifyFoodItems, identifyFoodItemsBatch, identifyReceiptItems } from '../vision.js';

describe('identifyFoodItems', () => {
  beforeEach(() => {
    mockAnalyzeImageStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('sends image + prompt with source_location to AIClient.analyzeImageStructured', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyFoodItems('base64data', 'fridge');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockAnalyzeImageStructured).toHaveBeenCalledOnce();

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
    });
    expect(callArgs.user).toContain('fridge');
    expect(callArgs.tool).toMatchObject({ name: 'report_food_items' });
  });

  it('parses structured result into ScanResult array', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        {
          name: 'milk',
          quantity: 1,
          unit: 'gallon',
          confidence: 0.95,
          category: 'dairy',
        },
        {
          name: 'eggs',
          quantity: 12,
          unit: 'piece',
          confidence: 0.9,
          category: 'protein',
        },
      ],
    });

    const result = await identifyFoodItems('base64data', 'fridge');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: 'milk',
      quantity: 1,
      unit: 'gallon',
      confidence: 0.95,
      category: 'dairy',
    });
    expect(result[1]).toEqual({
      name: 'eggs',
      quantity: 12,
      unit: 'piece',
      confidence: 0.9,
      category: 'protein',
    });
  });

  it('returns empty array when items missing from result', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({});

    const result = await identifyFoodItems('base64data', 'fridge');
    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(result).toEqual([]);
  });

  it('routes via vision.pantryScan task slot', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyFoodItems('base64data', 'fridge');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockGetClientFor).toHaveBeenCalledTimes(1);
  });

  it('forwards imageBase64 and mimeType + tool.name to analyzeImageStructured', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyFoodItems('ABC123', 'pantry');

    expect(mockAnalyzeImageStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        imageBase64: 'ABC123',
        mimeType: 'image/jpeg',
        tool: expect.objectContaining({ name: 'report_food_items' }),
      })
    );
  });

  it('works for all three source locations (fridge, pantry, freezer)', async () => {
    const locations = ['fridge', 'pantry', 'freezer'] as const;

    for (const location of locations) {
      mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

      await identifyFoodItems('base64data', location);

      const callArgs =
        mockAnalyzeImageStructured.mock.calls[mockAnalyzeImageStructured.mock.calls.length - 1][0];
      expect(callArgs.user).toContain(location);
      expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    }
  });
});

describe('identifyFoodItemsBatch', () => {
  beforeEach(() => {
    mockAnalyzeImagesStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('validates each image against 5MB limit and throws on oversized', async () => {
    // Create a base64 string that decodes to > 5MB
    const oversized = Buffer.alloc(6 * 1024 * 1024).toString('base64');

    await expect(
      identifyFoodItemsBatch([oversized], 'fridge')
    ).rejects.toThrow(/Image 1.*too large/);
  });

  it('calls analyzeImagesStructured with all images and the filtering prompt', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({ items: [] });

    await identifyFoodItemsBatch(['IMG1', 'IMG2'], 'pantry');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockAnalyzeImagesStructured).toHaveBeenCalledOnce();

    const callArgs = mockAnalyzeImagesStructured.mock.calls[0][0];
    expect(callArgs.images).toEqual([
      { base64: 'IMG1', mimeType: 'image/jpeg' },
      { base64: 'IMG2', mimeType: 'image/jpeg' },
    ]);
    expect(callArgs.user).toContain('2 photos');
    expect(callArgs.user).toContain('pantry');
    expect(callArgs.user).toContain('deduplicate');
    expect(callArgs.user).toContain('DO NOT report');
    expect(callArgs.tool).toMatchObject({ name: 'report_food_items' });
    expect(callArgs.maxTokens).toBe(8192);
  });

  it('coerces categories on returned items', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({
      items: [
        { name: 'chicken', quantity: 1, unit: 'lb', confidence: 0.9, category: 'meat' },
        { name: 'apple', quantity: 3, unit: 'piece', confidence: 0.8, category: 'fruit' },
      ],
    });

    const result = await identifyFoodItemsBatch(['IMG1'], 'fridge');

    expect(result[0].category).toBe('protein');
    expect(result[1].category).toBe('produce');
  });

  it('returns empty array when items missing from result', async () => {
    mockAnalyzeImagesStructured.mockResolvedValue({});

    const result = await identifyFoodItemsBatch(['IMG1'], 'fridge');
    expect(result).toEqual([]);
  });
});

describe('identifyReceiptItems', () => {
  beforeEach(() => {
    mockAnalyzeImageStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('routes via vision.pantryScan and uses receipt preamble by default', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', 'pantry');

    expect(mockGetClientFor).toHaveBeenCalledWith('vision.pantryScan');
    expect(mockAnalyzeImageStructured).toHaveBeenCalledOnce();

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
      maxTokens: 4096,
    });
    expect(callArgs.tool).toMatchObject({ name: 'report_food_items' });
    // Receipt preamble mentions printed grocery store receipt
    expect(callArgs.user.toLowerCase()).toContain('printed grocery store receipt');
  });

  it('uses instacart preamble when variant=instacart_screenshot', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', 'pantry', [], 'instacart_screenshot');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('Instacart order summary');
    // Should not include the receipt preamble
    expect(callArgs.user.toLowerCase()).not.toContain('printed grocery store receipt');
  });

  it('uses receipt preamble when variant explicitly receipt', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', 'pantry', [], 'receipt');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user.toLowerCase()).toContain('printed grocery store receipt');
    expect(callArgs.user).not.toContain('Instacart order summary');
  });

  it('includes ALREADY IN PANTRY block when existingItemNames provided', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', 'pantry', ['milk', 'eggs'], 'receipt');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('ALREADY IN PANTRY');
    expect(callArgs.user).toContain('- milk');
    expect(callArgs.user).toContain('- eggs');
  });

  it('does NOT include ALREADY IN PANTRY block when existingItemNames empty', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', 'pantry', [], 'receipt');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    expect(callArgs.user).not.toContain('ALREADY IN PANTRY');
  });

  it('filters out denylist items (subtotal, total, tax, delivery fee, coupon) case-insensitively', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'subtotal', quantity: 1, unit: 'item', confidence: 1, category: 'other' },
        { name: 'Total', quantity: 1, unit: 'item', confidence: 1, category: 'other' },
        { name: 'TAX', quantity: 1, unit: 'item', confidence: 1, category: 'other' },
        { name: 'Delivery Fee', quantity: 1, unit: 'item', confidence: 1, category: 'other' },
        { name: 'Coupon', quantity: 1, unit: 'item', confidence: 1, category: 'other' },
        { name: ' Tip ', quantity: 1, unit: 'item', confidence: 1, category: 'other' },
        { name: 'chicken breast', quantity: 1, unit: 'lb', confidence: 0.9, category: 'protein' },
      ],
    });

    const result = await identifyReceiptItems('base64data', 'pantry');

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('chicken breast');
  });

  it('coerces returned categories (meat -> protein)', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({
      items: [
        { name: 'chicken', quantity: 1, unit: 'lb', confidence: 0.9, category: 'meat' },
        { name: 'apple', quantity: 3, unit: 'piece', confidence: 0.8, category: 'fruit' },
      ],
    });

    const result = await identifyReceiptItems('base64data', 'pantry');

    expect(result[0].category).toBe('protein');
    expect(result[1].category).toBe('produce');
  });

  it('returns empty array when items missing from result', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({});

    const result = await identifyReceiptItems('base64data', 'pantry');
    expect(result).toEqual([]);
  });

  it('throws when image exceeds 5MB limit', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024).toString('base64');

    await expect(identifyReceiptItems(oversized, 'pantry')).rejects.toThrow(/too large/i);
  });

  it('prompt includes receipt-specific rules (skip totals, expand abbreviations)', async () => {
    mockAnalyzeImageStructured.mockResolvedValue({ items: [] });

    await identifyReceiptItems('base64data', 'pantry');

    const callArgs = mockAnalyzeImageStructured.mock.calls[0][0];
    // Should mention receipt-specific rules per RECEIPT_FILTERING_RULES
    expect(callArgs.user).toMatch(/subtotal|total|tax/i);
    expect(callArgs.user).toMatch(/abbreviation/i);
  });
});
