/**
 * Phase 22-03 — MonthPatterns tests.
 *
 * Static JSX-tree walk (vitest-node, no React renderer). Asserts:
 *   - With zero entries, three "No data yet" empty-state messages render.
 *   - With protein-biased entries, the protein bucket keys appear in the tree.
 *   - With cuisine-biased entries, the cuisine bucket keys appear.
 *   - With repeating-title entries, the repeat chip shows "{title} · ×{count}".
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';

import { MonthPatterns } from './MonthPatterns';
import type { MealPlanEntry } from '../../types/mealPlan';

type AnyEl = ReactElement<any>;

function flatten(node: unknown): AnyEl[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'object' && node !== null && 'props' in (node as AnyEl)) {
    const el = node as AnyEl;
    return [el, ...flatten(el.props.children)];
  }
  return [];
}

/** Recursively collect every string/number leaf in the JSX tree. */
function collectLeaves(node: unknown, out: string[]): void {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) collectLeaves(n, out);
    return;
  }
  if (typeof node === 'object' && node !== null && 'props' in (node as AnyEl)) {
    const el = node as AnyEl;
    collectLeaves(el.props.children, out);
  }
}

/** Get the concatenated text content of every Text leaf in the tree. */
function textCorpus(tree: AnyEl): string {
  const parts: string[] = [];
  collectLeaves(tree, parts);
  return parts.join(' ');
}

const makeEntry = (day: number, overrides: Partial<MealPlanEntry> = {}): MealPlanEntry => ({
  id: `e-${day}`,
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

describe('MonthPatterns', () => {
  it('shows 3 empty-state messages when entries is empty', () => {
    const tree = MonthPatterns({ entries: [] }) as AnyEl;
    const corpus = textCorpus(tree);
    // Three separate sections each display the empty-state sentence.
    const matches = corpus.match(/No data yet — cook meals to see your patterns\./g);
    expect(matches?.length).toBe(3);
  });

  it('renders Protein / Cuisine / Repeats section titles', () => {
    const tree = MonthPatterns({ entries: [] }) as AnyEl;
    const corpus = textCorpus(tree);
    expect(corpus).toMatch(/Protein/);
    expect(corpus).toMatch(/Cuisine/);
    expect(corpus).toMatch(/Repeats/);
  });

  it('shows protein bucket keys with counts when entries contain recognizable proteins', () => {
    const entries = [
      makeEntry(0, { title: 'Chicken Tikka' }),
      makeEntry(1, { title: 'Chicken Soup' }),
      makeEntry(2, { title: 'Beef Stew' }),
    ];
    const tree = MonthPatterns({ entries }) as AnyEl;
    const corpus = textCorpus(tree);
    // Bucket labels + counts flow through the bar rows.
    expect(corpus).toMatch(/chicken/);
    expect(corpus).toMatch(/beef/);
  });

  it('shows cuisine chip with keyword + count', () => {
    const entries = [
      makeEntry(0, { title: 'Tacos' }),
      makeEntry(1, { title: 'Pasta' }),
      makeEntry(2, { title: 'Tacos' }),
    ];
    const tree = MonthPatterns({ entries }) as AnyEl;
    const corpus = textCorpus(tree);
    expect(corpus).toMatch(/Mexican/);
    expect(corpus).toMatch(/Italian/);
    // Count appears in chip text "{key} · {count}". Because the JSX
    // flattener inserts spaces between leaves, match with flexible spacing.
    expect(corpus).toMatch(/Mexican\s*·\s*2/);
    expect(corpus).toMatch(/Italian\s*·\s*1/);
  });

  it('shows repeat chip "{title} · ×{count}" when a title appears twice', () => {
    const entries = [
      makeEntry(0, { title: 'Chicken Tacos' }),
      makeEntry(1, { title: 'Chicken Tacos' }),
      makeEntry(2, { title: 'Pasta' }),
    ];
    const tree = MonthPatterns({ entries }) as AnyEl;
    const corpus = textCorpus(tree);
    expect(corpus).toMatch(/Chicken Tacos\s*·\s*×\s*2/);
  });

  it('hides the Repeats empty-state when at least one title repeats', () => {
    const entries = [
      makeEntry(0, { title: 'Chicken Tacos' }),
      makeEntry(1, { title: 'Chicken Tacos' }),
    ];
    const tree = MonthPatterns({ entries }) as AnyEl;
    const corpus = textCorpus(tree);
    // Only Protein + Cuisine show the bucket data, Repeats shows the repeat chip.
    const matches = corpus.match(/No data yet/g);
    // With protein + cuisine + repeats all present, zero empty-state messages.
    expect(matches).toBeNull();
  });
});
