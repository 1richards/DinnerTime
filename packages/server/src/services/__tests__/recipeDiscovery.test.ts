import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock fn is available before vi.mock hoisting
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor() {}
    },
  };
});

// Must import after mock setup
import {
  buildDiscoveryPrompt,
  discoverRecipes,
  type DiscoveryPreferences,
} from '../recipeDiscovery.js';

const basePrefs: DiscoveryPreferences = {
  allergies: ['Peanut'],
  dietary_restrictions: ['Vegetarian'],
  disliked_ingredients: ['mushrooms', 'olives'],
  cuisine_preferences: ['Italian', 'Thai'],
};

// ---------- buildDiscoveryPrompt ----------

describe('buildDiscoveryPrompt', () => {
  it('separates HARD CONSTRAINTS and SOFT PREFERENCES', () => {
    const prompt = buildDiscoveryPrompt(basePrefs);
    expect(prompt).toContain('HARD CONSTRAINTS');
    expect(prompt).toContain('SOFT PREFERENCES');
    // HARD must come before SOFT
    expect(prompt.indexOf('HARD CONSTRAINTS')).toBeLessThan(
      prompt.indexOf('SOFT PREFERENCES')
    );
  });

  it('places allergies under HARD CONSTRAINTS', () => {
    const prompt = buildDiscoveryPrompt(basePrefs);
    const hardStart = prompt.indexOf('HARD CONSTRAINTS');
    const softStart = prompt.indexOf('SOFT PREFERENCES');
    const hardBlock = prompt.slice(hardStart, softStart);
    expect(hardBlock).toContain('Peanut');
  });

  it('places dietary_restrictions under SOFT PREFERENCES', () => {
    const prompt = buildDiscoveryPrompt(basePrefs);
    const softBlock = prompt.slice(prompt.indexOf('SOFT PREFERENCES'));
    expect(softBlock).toContain('Vegetarian');
  });

  it('includes disliked ingredients and cuisine preferences under SOFT', () => {
    const prompt = buildDiscoveryPrompt(basePrefs);
    const softBlock = prompt.slice(prompt.indexOf('SOFT PREFERENCES'));
    expect(softBlock).toContain('mushrooms');
    expect(softBlock).toContain('olives');
    expect(softBlock).toContain('Italian');
    expect(softBlock).toContain('Thai');
  });

  it('includes AVOID block with existing titles when provided', () => {
    const prompt = buildDiscoveryPrompt(basePrefs, [
      'Spaghetti Carbonara',
      'Chicken Tikka Masala',
    ]);
    expect(prompt).toContain('AVOID');
    expect(prompt).toContain('Spaghetti Carbonara');
    expect(prompt).toContain('Chicken Tikka Masala');
  });

  it('omits AVOID block when existingTitles empty or undefined', () => {
    const prompt = buildDiscoveryPrompt(basePrefs, []);
    expect(prompt).not.toContain('AVOID');
  });
});

// ---------- discoverRecipes ----------

describe('discoverRecipes', () => {
  const mockRecipes = [
    {
      title: 'Tomato Basil Pasta',
      description: 'Simple Italian pasta.',
      ingredients: [
        { name: 'pasta', quantity: 8, unit: 'oz', notes: null },
        { name: 'tomato', quantity: 4, unit: null, notes: 'diced' },
      ],
      steps: ['Boil pasta.', 'Add sauce.'],
      prep_time_minutes: 10,
      cook_time_minutes: 15,
      total_time_minutes: 25,
      servings: 4,
    },
  ];

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('calls Claude with claude-sonnet-4 model and tool_choice forcing suggest_recipes', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'suggest_recipes',
          input: { recipes: mockRecipes },
        },
      ],
    });

    await discoverRecipes({ preferences: basePrefs });

    expect(mockCreate).toHaveBeenCalledOnce();
    const args = mockCreate.mock.calls[0][0];
    expect(args.model).toMatch(/claude-sonnet-4/);
    expect(args.tool_choice).toEqual({ type: 'tool', name: 'suggest_recipes' });
    expect(Array.isArray(args.tools)).toBe(true);
    expect(args.tools[0].name).toBe('suggest_recipes');
  });

  it('returns ParsedRecipe[] with source_type "ai" set on each recipe', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'suggest_recipes',
          input: { recipes: mockRecipes },
        },
      ],
    });

    const result = await discoverRecipes({ preferences: basePrefs });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Tomato Basil Pasta');
    expect(result[0].source_type).toBe('ai');
    expect(result[0].source_url).toBeNull();
    expect(result[0].image_url).toBeNull();
  });

  it('defaults nullable fields to null when missing', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'suggest_recipes',
          input: {
            recipes: [
              {
                title: 'Minimal Recipe',
                ingredients: [{ name: 'salt', quantity: null, unit: null, notes: null }],
                steps: ['Season.'],
              },
            ],
          },
        },
      ],
    });

    const result = await discoverRecipes({ preferences: basePrefs });

    expect(result[0].description).toBeNull();
    expect(result[0].prep_time_minutes).toBeNull();
    expect(result[0].cook_time_minutes).toBeNull();
    expect(result[0].total_time_minutes).toBeNull();
    expect(result[0].servings).toBeNull();
    expect(result[0].source_type).toBe('ai');
  });

  it('throws when response has no tool_use block', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'no tool use here' }],
    });

    await expect(discoverRecipes({ preferences: basePrefs })).rejects.toThrow(
      /tool_use/
    );
  });

  it('passes existingTitles into the system prompt as AVOID list', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'suggest_recipes',
          input: { recipes: mockRecipes },
        },
      ],
    });

    await discoverRecipes({
      preferences: basePrefs,
      existingTitles: ['Grandma Ragu'],
    });

    const args = mockCreate.mock.calls[0][0];
    const system: string = args.system;
    expect(system).toContain('AVOID');
    expect(system).toContain('Grandma Ragu');
  });

  it('uses provided prompt string as the user message', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'suggest_recipes',
          input: { recipes: mockRecipes },
        },
      ],
    });

    await discoverRecipes({ preferences: basePrefs, prompt: 'Give me 3 cozy soups' });

    const args = mockCreate.mock.calls[0][0];
    expect(args.messages[0].content).toBe('Give me 3 cozy soups');
  });
});
