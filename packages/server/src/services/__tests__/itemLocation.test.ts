import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase 18-01: itemLocation routes via the AIClient factory (Gemini flash-lite
// for ingredient.categorize). Mirrors the Phase 11-04 canonical test pattern:
// vi.hoisted + vi.mock('../../ai/clientFactory.js').
const { mockGenerateStructured, mockGetClientFor } = vi.hoisted(() => ({
  mockGenerateStructured: vi.fn(),
  mockGetClientFor: vi.fn(),
}));

vi.mock('../../ai/clientFactory.js', () => ({
  getClientFor: mockGetClientFor,
}));

import {
  LOCATION_STATIC_MAP,
  classifyLocationStatic,
  classifyBatchWithAI,
  classifyItems,
  classifyLocationsTool,
} from '../itemLocation.js';
import type { SourceLocation } from '../vision.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetClientFor.mockReturnValue({
    generateText: vi.fn(),
    generateStructured: mockGenerateStructured,
    analyzeImageStructured: vi.fn(),
    analyzeImagesStructured: vi.fn(),
  });
  // Silence expected warn() during fallback tests.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// -----------------------------------------------------------------------------
// LOCATION_STATIC_MAP — coverage invariants
// -----------------------------------------------------------------------------

describe('LOCATION_STATIC_MAP', () => {
  it('has at least 120 entries across all three locations', () => {
    expect(Object.keys(LOCATION_STATIC_MAP).length).toBeGreaterThanOrEqual(120);
  });

  it('covers each of fridge/pantry/freezer with required minimums', () => {
    const counts: Record<SourceLocation, number> = { fridge: 0, pantry: 0, freezer: 0 };
    for (const loc of Object.values(LOCATION_STATIC_MAP)) {
      counts[loc]++;
    }
    expect(counts.fridge).toBeGreaterThanOrEqual(40);
    expect(counts.pantry).toBeGreaterThanOrEqual(50);
    expect(counts.freezer).toBeGreaterThanOrEqual(15);
  });

  it('documented edge cases resolve to researched defaults', () => {
    // RESEARCH Q1 edge-case table — these are intentional US-household defaults.
    expect(LOCATION_STATIC_MAP.egg).toBe('fridge');
    expect(LOCATION_STATIC_MAP.eggs).toBe('fridge');
    expect(LOCATION_STATIC_MAP['olive oil']).toBe('pantry');
    expect(LOCATION_STATIC_MAP.butter).toBe('fridge');
    expect(LOCATION_STATIC_MAP.tomato).toBe('pantry');
    expect(LOCATION_STATIC_MAP['hot sauce']).toBe('fridge');
    expect(LOCATION_STATIC_MAP.bread).toBe('pantry');
    expect(LOCATION_STATIC_MAP.wine).toBe('pantry');
  });
});

// -----------------------------------------------------------------------------
// classifyLocationsTool — schema shape
// -----------------------------------------------------------------------------

describe('classifyLocationsTool schema', () => {
  it('constrains source_location to the 3-value enum (Pitfall 5 mitigation)', () => {
    const enumVals = (
      classifyLocationsTool.schema.properties?.classifications.items
        ?.properties?.source_location as { enum?: string[] }
    ).enum;
    expect(enumVals).toEqual(['fridge', 'pantry', 'freezer']);
  });
});

// -----------------------------------------------------------------------------
// classifyLocationStatic — direct lookup + token fallback
// -----------------------------------------------------------------------------

describe('classifyLocationStatic', () => {
  it('returns fridge for milk (direct hit)', () => {
    expect(classifyLocationStatic('milk')).toBe('fridge');
  });

  it('returns pantry for organic bananas via token fallback (banana/bananas token)', () => {
    // "organic bananas" → tokens [organic, bananas] → bananas hit in map
    expect(classifyLocationStatic('organic bananas')).toBe('pantry');
  });

  it('returns null for unknown single-token items', () => {
    expect(classifyLocationStatic('zorblax')).toBeNull();
  });

  it('returns null for unknown multi-token items with no matching token', () => {
    expect(classifyLocationStatic('zorblax quux')).toBeNull();
  });

  it('classifier consumes pre-normalized input (lowercase); uppercase returns null to document contract', () => {
    // The classifier is explicitly documented to receive already-normalized names.
    // Callers normalize upstream; uppercase input is a programmer error.
    expect(classifyLocationStatic('MILK')).toBeNull();
    // After normalization:
    expect(classifyLocationStatic('MILK'.toLowerCase())).toBe('fridge');
  });

  it('resolves frozen prefixed items via direct hit on the compound key', () => {
    expect(classifyLocationStatic('frozen peas')).toBe('freezer');
    expect(classifyLocationStatic('ice cream')).toBe('freezer');
  });
});

// -----------------------------------------------------------------------------
// classifyBatchWithAI — structured tool call
// -----------------------------------------------------------------------------

describe('classifyBatchWithAI', () => {
  it('short-circuits to {} for empty input without invoking AI', async () => {
    const result = await classifyBatchWithAI([]);
    expect(result).toEqual({});
    expect(mockGetClientFor).not.toHaveBeenCalled();
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it('maps structured output to a name→location record and routes via ingredient.categorize', async () => {
    mockGenerateStructured.mockResolvedValue({
      classifications: [
        { name: 'dragon fruit', source_location: 'fridge' },
        { name: 'kimchi', source_location: 'fridge' },
      ],
    });

    const result = await classifyBatchWithAI(['dragon fruit', 'kimchi']);
    expect(result).toEqual({
      'dragon fruit': 'fridge',
      kimchi: 'fridge',
    });
    expect(mockGetClientFor).toHaveBeenCalledWith('ingredient.categorize');

    const callArgs = mockGenerateStructured.mock.calls[0][0];
    expect(callArgs.tool.name).toBe('classify_item_locations');
    expect(callArgs.maxTokens).toBe(1024);
    expect(callArgs.user).toContain('dragon fruit');
    expect(callArgs.user).toContain('kimchi');
    expect(callArgs.user).toMatch(/US household/i);
  });
});

// -----------------------------------------------------------------------------
// classifyItems — static-first hybrid
// -----------------------------------------------------------------------------

describe('classifyItems', () => {
  it('hits STATIC_MAP for knowns and batches unknowns to AI', async () => {
    mockGenerateStructured.mockResolvedValue({
      classifications: [{ name: 'dragon fruit', source_location: 'fridge' }],
    });

    const result = await classifyItems([
      { normalizedName: 'milk' },
      { normalizedName: 'olive oil' },
      { normalizedName: 'dragon fruit' },
    ]);

    expect(result).toEqual({
      milk: 'fridge',
      'olive oil': 'pantry',
      'dragon fruit': 'fridge',
    });

    // AI was called exactly once, and only for the unknown.
    expect(mockGenerateStructured).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateStructured.mock.calls[0][0];
    expect(callArgs.user).toContain('dragon fruit');
    expect(callArgs.user).not.toContain('milk');
    expect(callArgs.user).not.toContain('olive oil');
  });

  it('does NOT invoke the AI when every item is statically known (zero-unknown fast path)', async () => {
    const result = await classifyItems([
      { normalizedName: 'milk' },
      { normalizedName: 'chicken' },
      { normalizedName: 'rice' },
    ]);
    expect(result).toEqual({
      milk: 'fridge',
      chicken: 'fridge',
      rice: 'pantry',
    });
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it('STATIC_MAP always wins: AI drift on "olive oil" → still pantry (Pitfall 1)', async () => {
    // AI mock emits an incorrect answer; the static map must override.
    mockGenerateStructured.mockResolvedValue({
      classifications: [{ name: 'olive oil', source_location: 'fridge' }],
    });

    const result = await classifyItems([{ normalizedName: 'olive oil' }]);
    expect(result).toEqual({ 'olive oil': 'pantry' });
    // AI was not even called — static hit short-circuits.
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });

  it('defaults AI-omitted unknowns to pantry (shelf-stable bias)', async () => {
    mockGenerateStructured.mockResolvedValue({
      classifications: [{ name: 'kimchi', source_location: 'fridge' }],
    });

    const result = await classifyItems([
      { normalizedName: 'kimchi' },
      { normalizedName: 'gloopworts' },
    ]);
    expect(result).toEqual({
      kimchi: 'fridge',
      gloopworts: 'pantry',
    });
  });

  it('gracefully degrades when Gemini throws MALFORMED_FUNCTION_CALL (Pitfall 5)', async () => {
    mockGenerateStructured.mockRejectedValue(new Error('MALFORMED_FUNCTION_CALL'));

    const result = await classifyItems([
      { normalizedName: 'milk' }, // static hit — unaffected
      { normalizedName: 'gloopworts' }, // unknown — must default to pantry
      { normalizedName: 'flibber' }, // unknown — must default to pantry
    ]);

    expect(result).toEqual({
      milk: 'fridge',
      gloopworts: 'pantry',
      flibber: 'pantry',
    });
    expect(console.warn).toHaveBeenCalled();
  });

  it('deduplicates repeated normalizedName inputs', async () => {
    const result = await classifyItems([
      { normalizedName: 'milk' },
      { normalizedName: 'milk' },
      { normalizedName: 'milk' },
    ]);
    expect(result).toEqual({ milk: 'fridge' });
    expect(mockGenerateStructured).not.toHaveBeenCalled();
  });
});
