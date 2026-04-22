/**
 * Phase 22-03 — monthHelpers tests.
 *
 * Pure-function coverage for the 4 helpers that drive the Month view:
 *   - buildMonthGrid(fromWeekStart, entriesByIso) — deterministic 35-cell
 *     grid starting on Monday.
 *   - aggregateProtein(entries) — keyword-match protein bucketing with
 *     fall-through to 'veg' → 'other'.
 *   - aggregateCuisine(entries) — keyword-match cuisine bucketing with
 *     fall-through to 'other'.
 *   - findRepeats(entries) — titles appearing ≥2 times with count.
 *
 * These tests run under vitest-node (pure logic, no React / no RN). The
 * helpers are implementation-free until GREEN — this file commits in RED
 * state first (per plan's tdd="true" flag).
 */
import { describe, it, expect } from 'vitest';
import {
  buildMonthGrid,
  aggregateProtein,
  aggregateCuisine,
  findRepeats,
  type MonthCell,
} from './monthHelpers';
import type { MealPlanEntry } from '../../types/mealPlan';

const makeEntry = (
  day: number,
  overrides: Partial<MealPlanEntry> = {}
): MealPlanEntry => ({
  id: `entry-${day}`,
  meal_plan_id: 'plan-1',
  day_of_week: day,
  recipe_id: null,
  title: 'Stub',
  description: null,
  ingredients: [],
  ingredients_needed: [],
  estimated_time_minutes: 30,
  difficulty: 'easy',
  kid_friendly: true,
  why_suggested: null,
  status: 'planned',
  cooked_at: null,
  created_at: '2026-05-11T00:00:00Z',
  ...overrides,
});

describe('buildMonthGrid', () => {
  it('returns exactly 35 cells', () => {
    const cells = buildMonthGrid('2026-05-11', new Map());
    expect(cells).toHaveLength(35);
  });

  it('first cell is the provided Monday, last cell is 34 days later (Sunday)', () => {
    const cells = buildMonthGrid('2026-05-11', new Map());
    expect(cells[0]!.iso).toBe('2026-05-11');
    // 34 days after 2026-05-11 = 2026-06-14 (Sunday)
    expect(cells[34]!.iso).toBe('2026-06-14');
  });

  it('all cells default to status=empty, entry=null when map is empty', () => {
    const cells = buildMonthGrid('2026-05-11', new Map());
    for (const c of cells) {
      expect(c.status).toBe('empty');
      expect(c.entry).toBeNull();
    }
  });

  it('dayOfMonth is populated 1..31 crossing month boundaries', () => {
    const cells = buildMonthGrid('2026-05-11', new Map());
    // 2026-05-11 -> day 11
    expect(cells[0]!.dayOfMonth).toBe(11);
    // 2026-05-31 -> day 31; then 2026-06-01 rolls to 1
    const may31 = cells.find((c) => c.iso === '2026-05-31');
    const jun01 = cells.find((c) => c.iso === '2026-06-01');
    expect(may31?.dayOfMonth).toBe(31);
    expect(jun01?.dayOfMonth).toBe(1);
  });

  it('cells map to the provided entries and inherit status', () => {
    const entry = makeEntry(2, { status: 'cooked', title: 'Tacos' });
    const map = new Map<string, MealPlanEntry>([['2026-05-13', entry]]);
    const cells = buildMonthGrid('2026-05-11', map);
    const found = cells.find((c) => c.iso === '2026-05-13');
    expect(found).toBeDefined();
    expect(found!.status).toBe('cooked');
    expect(found!.entry?.title).toBe('Tacos');
  });

  it('maps planned entries to status=planned', () => {
    const entry = makeEntry(0, { status: 'planned' });
    const cells = buildMonthGrid(
      '2026-05-11',
      new Map([['2026-05-11', entry]])
    );
    expect(cells[0]!.status).toBe('planned');
  });

  it('maps skipped entries to status=skipped', () => {
    const entry = makeEntry(3, { status: 'skipped' });
    const cells = buildMonthGrid(
      '2026-05-11',
      new Map([['2026-05-14', entry]])
    );
    const found = cells.find((c) => c.iso === '2026-05-14');
    expect(found?.status).toBe('skipped');
  });

  it('is deterministic (same input → same output)', () => {
    const a = buildMonthGrid('2026-05-11', new Map());
    const b = buildMonthGrid('2026-05-11', new Map());
    expect(a.map((c) => c.iso)).toEqual(b.map((c) => c.iso));
  });

  it('type-shape: cells expose iso, dayOfMonth, status, entry', () => {
    const cells = buildMonthGrid('2026-05-11', new Map());
    const keys = Object.keys(cells[0]!) as Array<keyof MonthCell>;
    expect(keys).toContain('iso');
    expect(keys).toContain('dayOfMonth');
    expect(keys).toContain('status');
    expect(keys).toContain('entry');
  });
});

describe('aggregateProtein', () => {
  it('returns empty array on no entries', () => {
    expect(aggregateProtein([])).toEqual([]);
  });

  it("bucketizes 'chicken' title into chicken bucket", () => {
    const entries = [makeEntry(0, { title: 'Chicken Tikka Masala' })];
    const out = aggregateProtein(entries);
    const chicken = out.find((b) => b.key === 'chicken');
    expect(chicken?.count).toBe(1);
  });

  it("bucketizes 'salmon' into fish bucket", () => {
    const entries = [makeEntry(0, { title: 'Grilled salmon with lemon' })];
    const out = aggregateProtein(entries);
    expect(out.find((b) => b.key === 'fish')?.count).toBe(1);
  });

  it("bucketizes 'beef' into beef bucket", () => {
    const entries = [makeEntry(0, { title: 'Beef Stew' })];
    const out = aggregateProtein(entries);
    expect(out.find((b) => b.key === 'beef')?.count).toBe(1);
  });

  it("bucketizes 'bacon' and 'pork' into pork bucket", () => {
    const entries = [
      makeEntry(0, { title: 'Bacon carbonara' }),
      makeEntry(1, { title: 'Pork Chops' }),
    ];
    const out = aggregateProtein(entries);
    expect(out.find((b) => b.key === 'pork')?.count).toBe(2);
  });

  it('bucketizes unknown titles into veg (fall-through)', () => {
    const entries = [makeEntry(0, { title: 'Simple Tossed Salad' })];
    const out = aggregateProtein(entries);
    expect(out.find((b) => b.key === 'veg')?.count).toBe(1);
  });

  it("reads ingredient names ('tofu' → veg)", () => {
    const entries = [
      makeEntry(0, {
        title: 'Mystery Dish',
        ingredients: [{ name: 'tofu' }],
      }),
    ];
    const out = aggregateProtein(entries);
    expect(out.find((b) => b.key === 'veg')?.count).toBe(1);
  });

  it('aggregates multiple entries across buckets', () => {
    const entries = [
      makeEntry(0, { title: 'Chicken Pasta' }),
      makeEntry(1, { title: 'Beef Taco' }),
      makeEntry(2, { title: 'Chicken Soup' }),
    ];
    const out = aggregateProtein(entries);
    expect(out.find((b) => b.key === 'chicken')?.count).toBe(2);
    expect(out.find((b) => b.key === 'beef')?.count).toBe(1);
  });
});

describe('aggregateCuisine', () => {
  it('returns empty array on no entries', () => {
    expect(aggregateCuisine([])).toEqual([]);
  });

  it("bucketizes 'Tacos' title into Mexican", () => {
    const entries = [makeEntry(0, { title: 'Tacos al Pastor' })];
    const out = aggregateCuisine(entries);
    expect(out.find((b) => b.key === 'Mexican')?.count).toBe(1);
  });

  it("bucketizes 'Pasta' into Italian", () => {
    const entries = [makeEntry(0, { title: 'Pasta Bolognese' })];
    const out = aggregateCuisine(entries);
    expect(out.find((b) => b.key === 'Italian')?.count).toBe(1);
  });

  it("bucketizes 'Sushi' into Japanese", () => {
    const entries = [makeEntry(0, { title: 'Sushi Night' })];
    const out = aggregateCuisine(entries);
    expect(out.find((b) => b.key === 'Japanese')?.count).toBe(1);
  });

  it('bucketizes unknown into other', () => {
    const entries = [makeEntry(0, { title: 'Zebra Slop' })];
    const out = aggregateCuisine(entries);
    expect(out.find((b) => b.key === 'other')?.count).toBe(1);
  });

  it("reads description when title isn't a hint", () => {
    const entries = [
      makeEntry(0, {
        title: 'Family dinner',
        description: 'A quick thai curry',
      }),
    ];
    const out = aggregateCuisine(entries);
    expect(out.find((b) => b.key === 'Thai')?.count).toBe(1);
  });

  it('aggregates multiple entries across cuisines', () => {
    const entries = [
      makeEntry(0, { title: 'Tacos' }),
      makeEntry(1, { title: 'Pasta' }),
      makeEntry(2, { title: 'Burrito' }),
    ];
    const out = aggregateCuisine(entries);
    expect(out.find((b) => b.key === 'Mexican')?.count).toBe(2);
    expect(out.find((b) => b.key === 'Italian')?.count).toBe(1);
  });
});

describe('findRepeats', () => {
  it('returns empty array on no entries', () => {
    expect(findRepeats([])).toEqual([]);
  });

  it('drops single-occurrence titles', () => {
    const entries = [
      makeEntry(0, { title: 'Tacos' }),
      makeEntry(1, { title: 'Pasta' }),
    ];
    expect(findRepeats(entries)).toEqual([]);
  });

  it('counts titles appearing ≥2 times', () => {
    const entries = [
      makeEntry(0, { title: 'Tacos' }),
      makeEntry(1, { title: 'Pasta' }),
      makeEntry(2, { title: 'Tacos' }),
    ];
    const out = findRepeats(entries);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ title: 'Tacos', count: 2 });
  });

  it('is case-insensitive and trims whitespace', () => {
    const entries = [
      makeEntry(0, { title: 'Chicken Curry' }),
      makeEntry(1, { title: 'chicken curry  ' }),
      makeEntry(2, { title: 'CHICKEN CURRY' }),
    ];
    const out = findRepeats(entries);
    expect(out).toHaveLength(1);
    expect(out[0]!.count).toBe(3);
  });

  it('returns entries sorted by count (descending)', () => {
    const entries = [
      makeEntry(0, { title: 'Tacos' }),
      makeEntry(1, { title: 'Pasta' }),
      makeEntry(2, { title: 'Tacos' }),
      makeEntry(3, { title: 'Pasta' }),
      makeEntry(4, { title: 'Tacos' }),
    ];
    const out = findRepeats(entries);
    expect(out[0]!.title).toBe('Tacos');
    expect(out[0]!.count).toBe(3);
    expect(out[1]!.title).toBe('Pasta');
    expect(out[1]!.count).toBe(2);
  });

  it('ignores empty or whitespace-only titles', () => {
    const entries = [
      makeEntry(0, { title: '' }),
      makeEntry(1, { title: '   ' }),
      makeEntry(2, { title: 'Tacos' }),
      makeEntry(3, { title: 'Tacos' }),
    ];
    const out = findRepeats(entries);
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe('Tacos');
  });
});
