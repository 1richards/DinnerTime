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
    mockGenerateStructured.mockReset();
    mockGetClientFor.mockClear();
  });

  it('calls AIClient.generateStructured with recipe.discovery task and suggest_recipes tool', async () => {
    mockGenerateStructured.mockResolvedValue({ recipes: mockRecipes });

    await discoverRecipes({ preferences: basePrefs });

    expect(mockGetClientFor).toHaveBeenCalledWith('recipe.discovery');
    expect(mockGenerateStructured).toHaveBeenCalledOnce();
    const args = mockGenerateStructured.mock.calls[0][0];
    expect(args.tool.name).toBe('suggest_recipes');
  });

  it('returns ParsedRecipe[] with source_type "ai" set on each recipe', async () => {
    mockGenerateStructured.mockResolvedValue({ recipes: mockRecipes });

    const result = await discoverRecipes({ preferences: basePrefs });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Tomato Basil Pasta');
    expect(result[0].source_type).toBe('ai');
    expect(result[0].source_url).toBeNull();
    expect(result[0].image_url).toBeNull();
  });

  it('defaults nullable fields to null when missing', async () => {
    mockGenerateStructured.mockResolvedValue({
      recipes: [
        {
          title: 'Minimal Recipe',
          ingredients: [{ name: 'salt' }],
          steps: ['Season.'],
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

  it('returns empty array when response has no recipes', async () => {
    mockGenerateStructured.mockResolvedValue({ recipes: undefined });

    const result = await discoverRecipes({ preferences: basePrefs });
    expect(result).toEqual([]);
  });

  it('passes existingTitles into the system prompt as AVOID list', async () => {
    mockGenerateStructured.mockResolvedValue({ recipes: mockRecipes });

    await discoverRecipes({
      preferences: basePrefs,
      existingTitles: ['Grandma Ragu'],
    });

    const args = mockGenerateStructured.mock.calls[0][0];
    expect(args.system).toContain('AVOID');
    expect(args.system).toContain('Grandma Ragu');
  });

  it('uses provided prompt string as the user message', async () => {
    mockGenerateStructured.mockResolvedValue({ recipes: mockRecipes });

    await discoverRecipes({ preferences: basePrefs, prompt: 'Give me 3 cozy soups' });

    const args = mockGenerateStructured.mock.calls[0][0];
    expect(args.user).toBe('Give me 3 cozy soups');
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Wave 0 (plan 17-00) — red scaffolding for Plan 17-01.
//
// Plan 17-01 extends buildDiscoveryPrompt with a third parameter:
//   buildDiscoveryPrompt(prefs, existingTitles?, pantryManifest?)
//
// When pantryManifest is a non-empty array, the prompt MUST append a
// PANTRY CONSTRAINT section that the AI treats as a hard filter (only
// return recipes 100% feasible from the listed items + common staples).
//
// Today, buildDiscoveryPrompt has a 2-arg signature — passing a third arg
// is a no-op (TypeScript will also complain unless we cast). These cases
// fail at runtime because the string assertion sees no constraint block.
//
// @see .planning/phases/17-.../17-CONTEXT.md D-04
// ---------------------------------------------------------------------------
describe('Phase 17: buildDiscoveryPrompt pantry manifest (P17-04)', () => {
  it('P17-04: embeds a PANTRY CONSTRAINT section when pantryManifest provided', () => {
    const prompt = (
      buildDiscoveryPrompt as (
        prefs: DiscoveryPreferences,
        titles?: string[],
        manifest?: string[],
      ) => string
    )(basePrefs, [], ['eggs', 'spinach']);

    expect(prompt).toContain('PANTRY CONSTRAINT (HARD):');
    expect(prompt).toContain('- eggs');
    expect(prompt).toContain('- spinach');
    // Staples note — common items users don't need listed explicitly.
    expect(prompt).toMatch(/salt.*pepper.*water.*oil/is);
  });

  it('P17-04: omits PANTRY CONSTRAINT section when manifest is undefined', () => {
    const prompt = buildDiscoveryPrompt(basePrefs, []);
    expect(prompt).not.toContain('PANTRY CONSTRAINT');
  });

  it('P17-04: omits PANTRY CONSTRAINT section when manifest is an empty array', () => {
    const prompt = (
      buildDiscoveryPrompt as (
        prefs: DiscoveryPreferences,
        titles?: string[],
        manifest?: string[],
      ) => string
    )(basePrefs, [], []);

    expect(prompt).not.toContain('PANTRY CONSTRAINT');
  });

  it('P17-04: lists each manifest item on its own line with a "- " prefix', () => {
    const prompt = (
      buildDiscoveryPrompt as (
        prefs: DiscoveryPreferences,
        titles?: string[],
        manifest?: string[],
      ) => string
    )(basePrefs, [], ['eggs', 'spinach', 'feta']);

    // Three dash-prefixed lines, each on its own line.
    expect(prompt).toMatch(/- eggs\n/);
    expect(prompt).toMatch(/- spinach\n/);
    // The last item may or may not have a trailing newline depending on
    // whether the constraint block is followed by more content — just
    // assert it's present.
    expect(prompt).toMatch(/- feta/);
  });
});
