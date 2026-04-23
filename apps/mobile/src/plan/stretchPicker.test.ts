import { describe, it, expect } from 'vitest';

import { estimateComplexity, pickStretchDay } from './stretchPicker';
import type { MealPlanEntry } from '../types/mealPlan';

function mkEntry(partial: Partial<MealPlanEntry>): MealPlanEntry {
  return {
    id: partial.id ?? 'e-x',
    meal_plan_id: 'plan-x',
    day_of_week: partial.day_of_week ?? 0,
    recipe_id: null,
    title: partial.title ?? 'Test',
    description: null,
    ingredients: [],
    ingredients_needed: [],
    estimated_time_minutes: partial.estimated_time_minutes ?? 30,
    difficulty: partial.difficulty ?? null,
    kid_friendly: false,
    why_suggested: null,
    status: partial.status ?? 'planned',
    cooked_at: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('estimateComplexity', () => {
  it('easy + 20min → 1 + 2.0 = 3', () => {
    expect(estimateComplexity({ difficulty: 'easy', estimated_time_minutes: 20 })).toBeCloseTo(3);
  });

  it('medium + 30min → 6 + 3.0 = 9', () => {
    expect(estimateComplexity({ difficulty: 'medium', estimated_time_minutes: 30 })).toBeCloseTo(9);
  });

  it('hard + 60min → 12 + 6.0 = 18', () => {
    expect(estimateComplexity({ difficulty: 'hard', estimated_time_minutes: 60 })).toBeCloseTo(18);
  });

  it('null difficulty falls back to 3 (default)', () => {
    expect(estimateComplexity({ difficulty: null, estimated_time_minutes: 30 })).toBeCloseTo(6);
  });

  it('null time falls back to 30min (default)', () => {
    expect(estimateComplexity({ difficulty: 'easy', estimated_time_minutes: null })).toBeCloseTo(4);
  });
});

describe('pickStretchDay', () => {
  it('picks the day of the single highest-complexity entry above median+2', () => {
    const entries = [
      mkEntry({ day_of_week: 0, difficulty: 'easy', estimated_time_minutes: 20 }), // c=3
      mkEntry({ day_of_week: 2, difficulty: 'hard', estimated_time_minutes: 60 }), // c=18
      mkEntry({ day_of_week: 5, difficulty: 'medium', estimated_time_minutes: 30 }), // c=9
    ];
    const median = 5; // floor = 7; 18 and 9 both qualify
    expect(pickStretchDay(entries, median)).toBe(2); // highest complexity wins
  });

  it('returns null when no entry exceeds median+2', () => {
    const entries = [
      mkEntry({ day_of_week: 0, difficulty: 'easy', estimated_time_minutes: 20 }), // c=3
      mkEntry({ day_of_week: 3, difficulty: 'easy', estimated_time_minutes: 15 }), // c=2.5
    ];
    const median = 5; // floor = 7; none qualify
    expect(pickStretchDay(entries, median)).toBeNull();
  });

  it('ties broken by lowest day_of_week (Monday first)', () => {
    const entries = [
      mkEntry({ day_of_week: 5, difficulty: 'hard', estimated_time_minutes: 60 }), // c=18
      mkEntry({ day_of_week: 1, difficulty: 'hard', estimated_time_minutes: 60 }), // c=18
      mkEntry({ day_of_week: 3, difficulty: 'hard', estimated_time_minutes: 60 }), // c=18
    ];
    const median = 5; // floor = 7; all three qualify, tied on complexity
    expect(pickStretchDay(entries, median)).toBe(1); // Monday=0 not present; Tuesday=1 wins
  });

  it('excludes already-cooked entries', () => {
    const entries = [
      mkEntry({
        day_of_week: 2,
        difficulty: 'hard',
        estimated_time_minutes: 60,
        status: 'cooked',
      }), // c=18 but COOKED → excluded
      mkEntry({ day_of_week: 5, difficulty: 'medium', estimated_time_minutes: 30 }), // c=9
    ];
    const median = 5; // floor = 7; only the medium qualifies
    expect(pickStretchDay(entries, median)).toBe(5);
  });

  it('empty entries → null', () => {
    expect(pickStretchDay([], 5)).toBeNull();
  });
});
