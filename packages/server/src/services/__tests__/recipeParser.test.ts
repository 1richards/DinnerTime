import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock fn is available before vi.mock hoisting
const { mockCreate, mockFetch } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

// Mock global fetch for URL fetching
vi.stubGlobal('fetch', mockFetch);

// Must import after mock setup
import {
  parseDuration,
  extractRecipeJsonLd,
  mapJsonLdToRecipe,
  parseRecipeFromUrl,
  parseRecipeFromPhoto,
  parseRecipeFromText,
} from '../recipeParser.js';

describe('parseDuration', () => {
  it('parses PT30M to 30', () => {
    expect(parseDuration('PT30M')).toBe(30);
  });

  it('parses PT1H30M to 90', () => {
    expect(parseDuration('PT1H30M')).toBe(90);
  });

  it('parses PT2H to 120', () => {
    expect(parseDuration('PT2H')).toBe(120);
  });

  it('returns null for null/undefined input', () => {
    expect(parseDuration(null as unknown as string)).toBeNull();
    expect(parseDuration(undefined as unknown as string)).toBeNull();
  });

  it('returns null for invalid string', () => {
    expect(parseDuration('invalid')).toBeNull();
  });
});

describe('extractRecipeJsonLd', () => {
  it('extracts Recipe from a JSON-LD script tag', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type": "Recipe", "name": "Pasta Carbonara", "recipeIngredient": ["1 lb spaghetti"]}
        </script>
      </head><body></body></html>
    `;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Pasta Carbonara');
  });

  it('returns null when no JSON-LD found', () => {
    const html = '<html><head></head><body><p>Just text</p></body></html>';
    expect(extractRecipeJsonLd(html)).toBeNull();
  });

  it('finds Recipe within @graph array', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@graph": [
            {"@type": "WebPage", "name": "My Site"},
            {"@type": "Recipe", "name": "Tacos", "recipeIngredient": ["1 lb beef"]}
          ]}
        </script>
      </head><body></body></html>
    `;
    const result = extractRecipeJsonLd(html);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Tacos');
  });
});

describe('mapJsonLdToRecipe', () => {
  it('maps schema.org Recipe to ParsedRecipe with durations', () => {
    const jsonLd = {
      '@type': 'Recipe',
      name: 'Test Recipe',
      description: 'A test',
      recipeIngredient: ['2 cups flour', '1 tsp salt'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Mix flour and salt' },
        { '@type': 'HowToStep', text: 'Bake at 350F' },
      ],
      prepTime: 'PT15M',
      cookTime: 'PT1H',
      totalTime: 'PT1H15M',
      recipeYield: '4 servings',
      image: 'https://example.com/image.jpg',
    };

    const result = mapJsonLdToRecipe(jsonLd, 'https://example.com/recipe');
    expect(result.title).toBe('Test Recipe');
    expect(result.description).toBe('A test');
    expect(result.steps).toEqual(['Mix flour and salt', 'Bake at 350F']);
    expect(result.prep_time_minutes).toBe(15);
    expect(result.cook_time_minutes).toBe(60);
    expect(result.total_time_minutes).toBe(75);
    expect(result.servings).toBe(4);
    expect(result.source_url).toBe('https://example.com/recipe');
    expect(result.source_type).toBe('url');
    expect(result.image_url).toBe('https://example.com/image.jpg');
  });

  it('handles missing optional fields gracefully', () => {
    const jsonLd = {
      '@type': 'Recipe',
      name: 'Simple',
      recipeIngredient: ['salt'],
      recipeInstructions: ['Cook it'],
    };

    const result = mapJsonLdToRecipe(jsonLd, 'https://example.com');
    expect(result.title).toBe('Simple');
    expect(result.description).toBeNull();
    expect(result.prep_time_minutes).toBeNull();
    expect(result.cook_time_minutes).toBeNull();
    expect(result.total_time_minutes).toBeNull();
    expect(result.servings).toBeNull();
    expect(result.image_url).toBeNull();
    expect(result.steps).toEqual(['Cook it']);
  });

  it('handles string-array instructions', () => {
    const jsonLd = {
      '@type': 'Recipe',
      name: 'Quick',
      recipeIngredient: ['butter'],
      recipeInstructions: ['Step 1', 'Step 2'],
    };

    const result = mapJsonLdToRecipe(jsonLd, 'https://example.com');
    expect(result.steps).toEqual(['Step 1', 'Step 2']);
  });

  it('extracts servings number from yield string', () => {
    const jsonLd = {
      '@type': 'Recipe',
      name: 'Batch',
      recipeIngredient: ['flour'],
      recipeInstructions: ['Mix'],
      recipeYield: '12 cookies',
    };

    const result = mapJsonLdToRecipe(jsonLd, 'https://example.com');
    expect(result.servings).toBe(12);
  });
});

describe('parseRecipeFromUrl', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockFetch.mockReset();
  });

  it('returns ParsedRecipe from JSON-LD without calling Claude for ingredient parsing', async () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
          {"@type": "Recipe", "name": "Quick Pasta", "recipeIngredient": ["2 cups pasta", "1 tbsp olive oil"], "recipeInstructions": [{"@type": "HowToStep", "text": "Boil pasta"}, {"@type": "HowToStep", "text": "Add oil"}], "prepTime": "PT5M", "cookTime": "PT10M"}
        </script>
      </head><body></body></html>
    `;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    // Mock Claude for ingredient parsing (JSON-LD ingredients are strings, need structured parsing)
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'parse_recipe',
          input: {
            title: 'Quick Pasta',
            ingredients: [
              { name: 'pasta', quantity: 2, unit: 'cup', notes: null },
              { name: 'olive oil', quantity: 1, unit: 'tbsp', notes: null },
            ],
            steps: ['Boil pasta', 'Add oil'],
          },
        },
      ],
    });

    const result = await parseRecipeFromUrl('https://example.com/pasta');
    expect(result.title).toBe('Quick Pasta');
    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients[0].name).toBe('pasta');
    expect(result.steps).toEqual(['Boil pasta', 'Add oil']);
    expect(result.source_url).toBe('https://example.com/pasta');
    expect(result.source_type).toBe('url');
  });

  it('calls Claude for full extraction when no JSON-LD found', async () => {
    const html = '<html><body><h1>My Recipe</h1><p>Just some text about cooking</p></body></html>';

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    });

    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'parse_recipe',
          input: {
            title: 'My Recipe',
            ingredients: [{ name: 'something', quantity: 1, unit: 'cup', notes: null }],
            steps: ['Cook it'],
          },
        },
      ],
    });

    const result = await parseRecipeFromUrl('https://example.com/recipe');
    expect(result.title).toBe('My Recipe');
    expect(mockCreate).toHaveBeenCalled();
    expect(result.source_type).toBe('url');
  });

  it('returns clear error on fetch failure (403/503)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(parseRecipeFromUrl('https://example.com/blocked')).rejects.toThrow(
      /Failed to fetch/
    );
  });
});

describe('parseRecipeFromPhoto', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('sends base64 image to Claude Vision and returns ParsedRecipe', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'parse_recipe',
          input: {
            title: 'Handwritten Recipe',
            ingredients: [
              { name: 'chicken', quantity: 2, unit: 'lb', notes: 'boneless' },
            ],
            steps: ['Season chicken', 'Grill for 20 minutes'],
          },
        },
      ],
    });

    const result = await parseRecipeFromPhoto('base64imagedata');
    expect(result.title).toBe('Handwritten Recipe');
    expect(result.ingredients).toHaveLength(1);
    expect(result.ingredients[0].name).toBe('chicken');
    expect(result.steps).toHaveLength(2);
    expect(result.source_type).toBe('photo');

    // Verify correct Claude call structure
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content[0]).toMatchObject({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'base64imagedata' },
    });
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'parse_recipe' });
  });
});

describe('parseRecipeFromText', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('sends freeform text to Claude and returns ParsedRecipe', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'parse_recipe',
          input: {
            title: 'Pasta Carbonara',
            ingredients: [
              { name: 'spaghetti', quantity: 1, unit: 'lb', notes: null },
              { name: 'eggs', quantity: 4, unit: null, notes: null },
              { name: 'pecorino', quantity: 1, unit: 'cup', notes: 'grated' },
            ],
            steps: ['Cook pasta', 'Mix eggs and cheese', 'Combine'],
          },
        },
      ],
    });

    const result = await parseRecipeFromText(
      'Pasta carbonara. 1 lb spaghetti, 4 eggs, 1 cup grated pecorino. Cook pasta, mix eggs and cheese, combine.'
    );

    expect(result.title).toBe('Pasta Carbonara');
    expect(result.ingredients).toHaveLength(3);
    expect(result.steps).toHaveLength(3);
    expect(result.source_type).toBe('manual');

    // Verify Claude was called with correct tool
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'parse_recipe' });
  });
});
