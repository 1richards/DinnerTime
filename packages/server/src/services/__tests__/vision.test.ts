import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAnalyzeImageStructured, mockGenerateStructured, mockGenerateText, mockGetClientFor } =
  vi.hoisted(() => {
    const mockAnalyzeImageStructured = vi.fn();
    const mockGenerateStructured = vi.fn();
    const mockGenerateText = vi.fn();
    const mockGetClientFor = vi.fn(() => ({
      generateText: mockGenerateText,
      generateStructured: mockGenerateStructured,
      analyzeImageStructured: mockAnalyzeImageStructured,
    }));
    return {
      mockAnalyzeImageStructured,
      mockGenerateStructured,
      mockGenerateText,
      mockGetClientFor,
    };
  });

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

// Must import after mock setup
import { identifyFoodItems } from '../vision.js';

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
