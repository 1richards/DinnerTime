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
import { identifyFoodItems, identifyFoodItemsBatch } from '../vision.js';

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
