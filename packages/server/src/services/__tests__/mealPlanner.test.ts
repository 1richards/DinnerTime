import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mock for Anthropic SDK (needed because mealPlanner imports anthropic config)
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
  buildMealPlanPrompt,
  generateMealPlan,
  generateMealPlanTool,
} from '../mealPlanner.js';
import type { MealPlanContext } from '../mealPlanner.js';

// ---------- Test Data ----------

const baseContext: MealPlanContext = {
  pantryItems: [
    { name: 'Chicken Breast', quantity: 2, unit: 'lb', category: 'protein' },
    { name: 'Rice', quantity: 3, unit: 'cup', category: 'grain' },
    { name: 'Broccoli', quantity: 1, unit: 'head', category: 'produce' },
    { name: 'Garlic', quantity: 4, unit: 'clove', category: 'produce' },
  ],
  preferences: {
    allergies: [],
    restrictions: [],
    cuisines: ['Italian'],
    dislikes: [],
    kidFriendlyNeeded: false,
    householdSize: 2,
  },
  recipeLibrary: [
    { id: 'recipe-a', title: 'Lemon Chicken Piccata' },
    { id: 'recipe-b', title: 'Garlic Butter Shrimp' },
  ],
  recentMealTitles: ['Spaghetti Bolognese', 'Chicken Tikka Masala'],
  weekStart: '2026-04-13',
};

// ---------- buildMealPlanPrompt Tests ----------

describe('buildMealPlanPrompt', () => {
  it('Test 1: contains every pantry item name', () => {
    const prompt = buildMealPlanPrompt(baseContext);
    for (const item of baseContext.pantryItems) {
      expect(prompt).toContain(item.name);
    }
  });

  it('Test 2: allergies appear under HARD CONSTRAINTS block (not mixed with SOFT PREFERENCES)', () => {
    const ctx: MealPlanContext = {
      ...baseContext,
      preferences: {
        ...baseContext.preferences,
        allergies: ['Peanut', 'Shellfish'],
        restrictions: ['Vegetarian'],
      },
    };
    const prompt = buildMealPlanPrompt(ctx);
    const hardIdx = prompt.indexOf('HARD CONSTRAINTS');
    const softIdx = prompt.indexOf('SOFT PREFERENCES');
    const peanutIdx = prompt.indexOf('Peanut');
    expect(hardIdx).toBeGreaterThanOrEqual(0);
    expect(softIdx).toBeGreaterThan(hardIdx);
    expect(peanutIdx).toBeGreaterThan(hardIdx);
    expect(peanutIdx).toBeLessThan(softIdx);
    expect(prompt).toContain('Shellfish');
  });

  it('Test 3: soft dietary restrictions appear under SOFT PREFERENCES block', () => {
    const ctx: MealPlanContext = {
      ...baseContext,
      preferences: {
        ...baseContext.preferences,
        restrictions: ['Gluten-Free', 'Low-Sodium'],
      },
    };
    const prompt = buildMealPlanPrompt(ctx);
    const softIdx = prompt.indexOf('SOFT PREFERENCES');
    const gfIdx = prompt.indexOf('Gluten-Free');
    expect(softIdx).toBeGreaterThanOrEqual(0);
    expect(gfIdx).toBeGreaterThan(softIdx);
    expect(prompt).toContain('Low-Sodium');
  });

  it('Test 4: recipe library titles appear with their IDs in RECIPE LIBRARY block', () => {
    const prompt = buildMealPlanPrompt(baseContext);
    expect(prompt).toContain('RECIPE LIBRARY');
    expect(prompt).toContain('Lemon Chicken Piccata');
    expect(prompt).toContain('recipe-a');
    expect(prompt).toContain('Garlic Butter Shrimp');
    expect(prompt).toContain('recipe-b');
  });

  it('Test 5: recent cooked titles appear under AVOID REPEATING block', () => {
    const prompt = buildMealPlanPrompt(baseContext);
    const avoidIdx = prompt.indexOf('AVOID REPEATING');
    expect(avoidIdx).toBeGreaterThanOrEqual(0);
    expect(prompt.indexOf('Spaghetti Bolognese')).toBeGreaterThan(avoidIdx);
    expect(prompt).toContain('Chicken Tikka Masala');
  });

  it('Test 6: prompt contains weeknight (Mon-Thu) vs weekend (Fri-Sun) complexity guidance', () => {
    const prompt = buildMealPlanPrompt(baseContext);
    expect(prompt).toMatch(/Mon-Thu/);
    expect(prompt).toMatch(/weeknight/i);
    expect(prompt).toMatch(/15-30 min/);
    expect(prompt).toMatch(/Fri-Sun/);
    expect(prompt).toMatch(/weekend/i);
    expect(prompt).toMatch(/ambitious/i);
  });

  it('Test 7: when kidFriendlyNeeded=true, demands at least 3 of 7 kid_friendly nights', () => {
    const ctx: MealPlanContext = {
      ...baseContext,
      preferences: { ...baseContext.preferences, kidFriendlyNeeded: true },
    };
    const prompt = buildMealPlanPrompt(ctx);
    expect(prompt).toMatch(/at least 3 of 7/i);
    expect(prompt).toMatch(/kid_friendly/);
  });

  it('Test 8: demands EXACTLY 7 days with day_of_week 0..6 / 0=Monday', () => {
    const prompt = buildMealPlanPrompt(baseContext);
    expect(prompt).toMatch(/EXACTLY 7 days/);
    expect(prompt).toMatch(/0\.\.6/);
    expect(prompt).toMatch(/0=Monday/);
  });

  it('Test 9: empty recipe library and empty recent meals still contain section headers with (none) placeholder', () => {
    const ctx: MealPlanContext = {
      ...baseContext,
      recipeLibrary: [],
      recentMealTitles: [],
    };
    const prompt = buildMealPlanPrompt(ctx);
    expect(prompt).toContain('RECIPE LIBRARY');
    expect(prompt).toContain('AVOID REPEATING');
    const recipeBlock = prompt.slice(
      prompt.indexOf('RECIPE LIBRARY'),
      prompt.indexOf('AVOID REPEATING'),
    );
    expect(recipeBlock).toContain('(none)');
    const avoidBlock = prompt.slice(prompt.indexOf('AVOID REPEATING'));
    expect(avoidBlock).toContain('(none)');
  });
});

// ---------- generateMealPlanTool Tests ----------

describe('generateMealPlanTool', () => {
  it('Test 1: days array has minItems:7 and maxItems:7', () => {
    const daysSchema = (generateMealPlanTool.input_schema.properties as Record<string, unknown>)
      .days as { minItems: number; maxItems: number };
    expect(daysSchema.minItems).toBe(7);
    expect(daysSchema.maxItems).toBe(7);
  });

  it('Test 2: per-day required list includes complexity_target and kid_friendly', () => {
    const daysSchema = (generateMealPlanTool.input_schema.properties as Record<string, unknown>)
      .days as { items: { required: string[] } };
    expect(daysSchema.items.required).toContain('complexity_target');
    expect(daysSchema.items.required).toContain('kid_friendly');
    expect(daysSchema.items.required).toContain('day_of_week');
  });
});

// ---------- generateMealPlan Tests ----------

describe('generateMealPlan', () => {
  const mockDays = [
    {
      day_of_week: 'mon',
      title: 'Lemon Chicken',
      description: 'Weeknight chicken dinner',
      recipe_id: 'recipe-a',
      ingredients_used: ['Chicken Breast', 'Garlic'],
      ingredients_needed: ['Lemon'],
      estimated_time_minutes: 25,
      difficulty: 'easy',
      complexity_target: 'weeknight',
      kid_friendly: true,
      why_suggested: 'Quick and uses pantry chicken',
    },
    {
      day_of_week: 'tue',
      title: 'Rice Bowl',
      description: 'Simple rice bowl',
      recipe_id: null,
      ingredients_used: ['Rice', 'Broccoli'],
      ingredients_needed: [],
      estimated_time_minutes: 20,
      difficulty: 'easy',
      complexity_target: 'weeknight',
      kid_friendly: true,
      why_suggested: 'Fast weeknight',
    },
    {
      day_of_week: 'wed',
      title: 'Stir Fry',
      description: 'Chicken broccoli stir fry',
      recipe_id: null,
      ingredients_used: ['Chicken Breast', 'Broccoli'],
      ingredients_needed: ['Soy sauce'],
      estimated_time_minutes: 25,
      difficulty: 'easy',
      complexity_target: 'weeknight',
      kid_friendly: true,
      why_suggested: 'Uses pantry items',
    },
    {
      day_of_week: 'thu',
      title: 'Garlic Pasta',
      description: 'Simple pasta',
      recipe_id: null,
      ingredients_used: ['Garlic'],
      ingredients_needed: ['Pasta'],
      estimated_time_minutes: 20,
      difficulty: 'easy',
      complexity_target: 'weeknight',
      kid_friendly: true,
      why_suggested: 'Easy weeknight',
    },
    {
      day_of_week: 'fri',
      title: 'Roast Chicken',
      description: 'Weekend roast',
      recipe_id: null,
      ingredients_used: ['Chicken Breast'],
      ingredients_needed: ['Herbs'],
      estimated_time_minutes: 75,
      difficulty: 'medium',
      complexity_target: 'weekend',
      kid_friendly: false,
      why_suggested: 'Weekend project',
    },
    {
      day_of_week: 'sat',
      title: 'Risotto',
      description: 'Weekend risotto',
      recipe_id: null,
      ingredients_used: ['Rice', 'Garlic'],
      ingredients_needed: ['Parmesan'],
      estimated_time_minutes: 45,
      difficulty: 'medium',
      complexity_target: 'weekend',
      kid_friendly: false,
      why_suggested: 'Weekend cooking',
    },
    {
      day_of_week: 'sun',
      title: 'Sunday Stew',
      description: 'Slow-cooked stew',
      recipe_id: null,
      ingredients_used: ['Chicken Breast', 'Broccoli'],
      ingredients_needed: ['Stock'],
      estimated_time_minutes: 90,
      difficulty: 'medium',
      complexity_target: 'weekend',
      kid_friendly: false,
      why_suggested: 'Sunday comfort',
    },
  ];

  const basePantryItems = [
    {
      id: 'p1',
      profile_id: 'profile-1',
      name: 'Chicken Breast',
      normalized_name: 'chicken breast',
      quantity: 2,
      unit: 'lb',
      category: 'protein',
      source_location: 'fridge',
      confidence: 0.9,
      status: 'available',
      last_seen_at: new Date().toISOString(),
    },
    {
      id: 'p2',
      profile_id: 'profile-1',
      name: 'Rice',
      normalized_name: 'rice',
      quantity: 3,
      unit: 'cup',
      category: 'grain',
      source_location: 'pantry',
      confidence: 0.9,
      status: 'available',
      last_seen_at: new Date().toISOString(),
    },
    {
      id: 'p3',
      profile_id: 'profile-1',
      name: 'Broccoli',
      normalized_name: 'broccoli',
      quantity: 1,
      unit: 'head',
      category: 'produce',
      source_location: 'fridge',
      confidence: 0.9,
      status: 'available',
      last_seen_at: new Date().toISOString(),
    },
    {
      id: 'p4',
      profile_id: 'profile-1',
      name: 'Garlic',
      normalized_name: 'garlic',
      quantity: 4,
      unit: 'clove',
      category: 'produce',
      source_location: 'pantry',
      confidence: 0.9,
      status: 'available',
      last_seen_at: new Date().toISOString(),
    },
  ];

  const baseMembers = [
    {
      id: 'm1',
      profile_id: 'profile-1',
      name: 'Alice',
      member_type: 'adult',
      age_range: null,
      dietary_restrictions: [],
      dietary_allergies: [],
      disliked_ingredients: [],
    },
  ];

  const baseProfile = {
    cuisine_preferences: ['Italian'],
    skill_level: 'intermediate',
  };

  type SupabaseMockOptions = {
    pantryItems?: typeof basePantryItems;
    members?: typeof baseMembers;
    profile?: typeof baseProfile;
    recipes?: Array<{ id: string; title: string }>;
    recentMeals?: Array<{ title: string; cooked_at: string }>;
    existingPlan?: { id: string } | null;
  };

  let recentMealsLimitArg = 0;
  let insertedPlan: unknown = null;
  let insertedEntries: unknown[] = [];
  let deletedPlanId: string | null = null;

  const makeMockSupabase = (opts: SupabaseMockOptions = {}) => {
    const pantryItems = opts.pantryItems ?? basePantryItems;
    const members = opts.members ?? baseMembers;
    const profile = opts.profile ?? baseProfile;
    const recipes = opts.recipes ?? [{ id: 'recipe-a', title: 'Lemon Chicken Piccata' }];
    const recentMeals = opts.recentMeals ?? [];
    const existingPlan = opts.existingPlan ?? null;

    recentMealsLimitArg = 0;
    insertedPlan = null;
    insertedEntries = [];
    deletedPlanId = null;

    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'pantry_items') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: pantryItems, error: null }),
              }),
            }),
          };
        }
        if (table === 'household_members') {
          return {
            select: () => ({
              eq: () => ({ data: members, error: null }),
            }),
          };
        }
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: () => ({ data: profile, error: null }),
              }),
            }),
          };
        }
        if (table === 'recipes') {
          return {
            select: () => ({
              eq: () => ({
                limit: () => ({ data: recipes, error: null }),
              }),
            }),
          };
        }
        if (table === 'meal_plan_entries') {
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: (n: number) => {
                    recentMealsLimitArg = n;
                    return { data: recentMeals, error: null };
                  },
                }),
              }),
            }),
            insert: (rows: unknown[]) => {
              insertedEntries = rows;
              return {
                select: () => ({ data: rows, error: null }),
              };
            },
          };
        }
        if (table === 'meal_plans') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => ({ data: existingPlan, error: null }),
                }),
              }),
            }),
            delete: () => ({
              eq: (_col: string, id: string) => {
                deletedPlanId = id;
                return { error: null };
              },
            }),
            insert: (row: unknown) => ({
              select: () => ({
                single: () => {
                  insertedPlan = row;
                  const inserted = Array.isArray(row) ? row[0] : row;
                  return {
                    data: {
                      id: 'plan-new',
                      ...(inserted as Record<string, unknown>),
                      generated_at: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  };
                },
              }),
            }),
          };
        }
        return {};
      }),
    };
  };

  const mockToolUseResponse = (days: unknown[]) => ({
    content: [
      {
        type: 'tool_use',
        id: 'tool_1',
        name: 'generate_meal_plan',
        input: { days },
      },
    ],
  });

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('Test 3: persists meal_plans + 7 meal_plan_entries and returns MealPlan', async () => {
    mockCreate.mockResolvedValue(mockToolUseResponse(mockDays));
    const supabase = makeMockSupabase();
    const result = await generateMealPlan(supabase as never, 'profile-1', '2026-04-13');

    expect(insertedPlan).not.toBeNull();
    expect(insertedEntries).toHaveLength(7);
    expect(result.entries).toHaveLength(7);
    expect(result.week_start).toBe('2026-04-13');
  });

  it('Test 4: throws INVALID_PLAN_LENGTH when Claude returns fewer than 7 days', async () => {
    mockCreate.mockResolvedValue(mockToolUseResponse(mockDays.slice(0, 5)));
    const supabase = makeMockSupabase();
    await expect(
      generateMealPlan(supabase as never, 'profile-1', '2026-04-13'),
    ).rejects.toThrow(/INVALID_PLAN_LENGTH|7 days/);
  });

  it('Test 5: throws when pantry has fewer than 3 items', async () => {
    const supabase = makeMockSupabase({ pantryItems: basePantryItems.slice(0, 2) });
    await expect(
      generateMealPlan(supabase as never, 'profile-1', '2026-04-13'),
    ).rejects.toThrow(/pantry|EMPTY_PANTRY/i);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('Test 6: recent meals query is capped at 21 entries', async () => {
    mockCreate.mockResolvedValue(mockToolUseResponse(mockDays));
    const supabase = makeMockSupabase();
    await generateMealPlan(supabase as never, 'profile-1', '2026-04-13');
    expect(recentMealsLimitArg).toBe(21);
  });

  it('Test 7: regenerate flow deletes existing plan then inserts fresh', async () => {
    mockCreate.mockResolvedValue(mockToolUseResponse(mockDays));
    const supabase = makeMockSupabase({ existingPlan: { id: 'plan-old' } });
    await generateMealPlan(supabase as never, 'profile-1', '2026-04-13');
    expect(deletedPlanId).toBe('plan-old');
    expect(insertedPlan).not.toBeNull();
    expect(insertedEntries).toHaveLength(7);
  });

  it('Test 8: day_of_week strings mon..sun are mapped to SMALLINT 0..6 on persistence', async () => {
    mockCreate.mockResolvedValue(mockToolUseResponse(mockDays));
    const supabase = makeMockSupabase();
    await generateMealPlan(supabase as never, 'profile-1', '2026-04-13');

    const entries = insertedEntries as Array<{ day_of_week: number; title: string }>;
    const byTitle = Object.fromEntries(entries.map((e) => [e.title, e.day_of_week]));
    expect(byTitle['Lemon Chicken']).toBe(0);
    expect(byTitle['Rice Bowl']).toBe(1);
    expect(byTitle['Stir Fry']).toBe(2);
    expect(byTitle['Garlic Pasta']).toBe(3);
    expect(byTitle['Roast Chicken']).toBe(4);
    expect(byTitle['Risotto']).toBe(5);
    expect(byTitle['Sunday Stew']).toBe(6);
  });
});
