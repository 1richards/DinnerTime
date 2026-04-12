import { describe, it, expect, vi } from 'vitest';

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
import { buildMealPlanPrompt } from '../mealPlanner.js';
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
