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
  buildSuggestRecipesSchema,
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
    // servings is normalized to MIN_SERVINGS (4) when missing — DinnerTime
    // is built for households, never single-portion recipes.
    expect(result[0].servings).toBe(4);
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
// Phase 29 (plan 29-01) — LIGHTWEIGHT discovery (D1).
//
// Light mode is OPT-IN. When discoverRecipes is called with `light: true`,
// the generation schema drops the heavy `ingredients[]` + `steps[]` from the
// REQUIRED set (the ~29s cost driver), keeps a cheap `ingredient_names`
// string list for the pantry-match badge, and the prompt omits the
// "Return full recipes with structured ingredients" instruction.
//
// CRITICAL: the default (no light flag) path must stay BYTE-IDENTICAL to
// today so the currently-shipped app is unaffected. The regression guards
// below assert the full required schema + full-detail instruction survive.
// ---------------------------------------------------------------------------
describe('Phase 29: lightweight discovery (D1)', () => {
  describe('buildSuggestRecipesSchema', () => {
    function itemsOf(schema: ReturnType<typeof buildSuggestRecipesSchema>) {
      // schema.properties.recipes.items
      const recipesProp = (schema.properties as Record<string, any>).recipes;
      return recipesProp.items as {
        properties: Record<string, unknown>;
        required: string[];
      };
    }

    it('FULL (light=false): required includes ingredients+steps (regression guard)', () => {
      const items = itemsOf(buildSuggestRecipesSchema(false));
      expect(items.required).toEqual([
        'title',
        'ingredients',
        'steps',
        'difficulty',
        'practiced_skills',
      ]);
      expect(items.properties).toHaveProperty('ingredients');
      expect(items.properties).toHaveProperty('steps');
    });

    it('LIGHT (light=true): required drops ingredients+steps, keeps title/difficulty/practiced_skills', () => {
      const items = itemsOf(buildSuggestRecipesSchema(true));
      expect(items.required).not.toContain('ingredients');
      expect(items.required).not.toContain('steps');
      expect(items.required).toContain('title');
      expect(items.required).toContain('difficulty');
      expect(items.required).toContain('practiced_skills');
    });

    it('LIGHT keeps a cheap ingredient_names string array and drops heavy ingredients/steps properties', () => {
      const items = itemsOf(buildSuggestRecipesSchema(true));
      expect(items.properties).toHaveProperty('ingredient_names');
      const ingredientNames = items.properties.ingredient_names as {
        type: string;
        items: { type: string };
      };
      expect(ingredientNames.type).toBe('array');
      expect(ingredientNames.items.type).toBe('string');
      // Heavy properties are removed from the light schema.
      expect(items.properties).not.toHaveProperty('ingredients');
      expect(items.properties).not.toHaveProperty('steps');
      // Cheap scalar fields survive.
      expect(items.properties).toHaveProperty('description');
      expect(items.properties).toHaveProperty('total_time_minutes');
      expect(items.properties).toHaveProperty('servings');
      expect(items.properties).toHaveProperty('calories_per_serving');
      expect(items.properties).toHaveProperty('protein_grams_per_serving');
    });
  });

  describe('buildDiscoveryPrompt light flag', () => {
    it('LIGHT omits the "Return full recipes with structured ingredients" instruction', () => {
      const prompt = buildDiscoveryPrompt(
        basePrefs,
        undefined,
        undefined,
        undefined,
        true,
      );
      expect(prompt).not.toContain('Return full recipes with structured ingredients');
      // Still wants the cheap fields.
      expect(prompt).toContain('ingredient_names');
      expect(prompt).toContain('SKILL TAGGING');
      expect(prompt).toContain('NUTRITION');
    });

    it('FULL (default) still includes the full-detail instruction (regression guard)', () => {
      const prompt = buildDiscoveryPrompt(basePrefs);
      expect(prompt).toContain('Return full recipes with structured ingredients');
    });
  });

  describe('discoverRecipes light mapping', () => {
    beforeEach(() => {
      mockGenerateStructured.mockReset();
      mockGetClientFor.mockClear();
    });

    it('LIGHT maps ingredient_names into ingredients objects and leaves steps empty', async () => {
      mockGenerateStructured.mockResolvedValue({
        recipes: [
          {
            title: 'X',
            ingredient_names: ['eggs', 'flour'],
            difficulty: 'easy',
            practiced_skills: ['knife skills'],
          },
        ],
      });

      const result = await discoverRecipes({ preferences: basePrefs, light: true });

      expect(result).toHaveLength(1);
      expect(result[0].ingredients).toHaveLength(2);
      expect(result[0].ingredients[0].name).toBe('eggs');
      expect(result[0].ingredients[0].quantity).toBeNull();
      expect(result[0].ingredients[0].unit).toBeNull();
      expect(result[0].ingredients[1].name).toBe('flour');
      expect(result[0].steps).toHaveLength(0);
      expect(result[0].source_type).toBe('ai');
    });

    it('LIGHT selects the light tool schema (required excludes ingredients/steps)', async () => {
      mockGenerateStructured.mockResolvedValue({ recipes: [] });

      await discoverRecipes({ preferences: basePrefs, light: true });

      const args = mockGenerateStructured.mock.calls[0][0];
      const items = (args.tool.schema.properties.recipes.items) as {
        required: string[];
        properties: Record<string, unknown>;
      };
      expect(items.required).not.toContain('ingredients');
      expect(items.required).not.toContain('steps');
      expect(items.properties).toHaveProperty('ingredient_names');
    });

    it('DEFAULT (no light) still uses the full schema with ingredients+steps required (regression guard)', async () => {
      mockGenerateStructured.mockResolvedValue({
        recipes: [
          {
            title: 'Full Recipe',
            ingredients: [{ name: 'salt', quantity: 1, unit: 'tsp', notes: null }],
            steps: ['Season.'],
          },
        ],
      });

      await discoverRecipes({ preferences: basePrefs });

      const args = mockGenerateStructured.mock.calls[0][0];
      const items = (args.tool.schema.properties.recipes.items) as {
        required: string[];
      };
      expect(items.required).toEqual([
        'title',
        'ingredients',
        'steps',
        'difficulty',
        'practiced_skills',
      ]);
      expect(args.system).toContain('Return full recipes with structured ingredients');
    });
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
