/**
 * Phase 22-04 — IngredientChecklist tests.
 *
 * Pattern: mirrors `dayRowHelpers.test.ts` — exercise the PURE HELPERS
 * (buildRows, formatIngredientSubtitle, toggleIndex) rather than mounting
 * a hook-bearing component under vitest-node. The React component
 * (`IngredientChecklist`) is a thin `useState` wrapper around
 * `buildRows`; its non-empty rendering path can only execute inside a
 * real renderer, and interactive coverage lives in Maestro flow 34.
 *
 * The component's EMPTY-STATE path is stateless (no useState runs when
 * ingredients.length === 0), so that branch IS asserted via a direct
 * functional call to the component.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

import {
  IngredientChecklist,
  buildRows,
  formatIngredientSubtitle,
  toggleIndex,
} from './IngredientChecklist';
import type { MealPlanIngredient } from '../../types/mealPlan';

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

describe('formatIngredientSubtitle', () => {
  it('both quantity + unit → "2 cup"', () => {
    expect(formatIngredientSubtitle({ name: 'flour', quantity: 2, unit: 'cup' })).toBe(
      '2 cup',
    );
  });

  it('neither → undefined', () => {
    expect(formatIngredientSubtitle({ name: 'salt' })).toBeUndefined();
  });

  it('quantity only → "4"', () => {
    expect(formatIngredientSubtitle({ name: 'butter', quantity: 4 })).toBe('4');
  });

  it('unit only → "ml"', () => {
    expect(formatIngredientSubtitle({ name: 'water', unit: 'ml' })).toBe('ml');
  });

  it('empty-string unit counts as missing → undefined/quantity fallback', () => {
    expect(formatIngredientSubtitle({ name: 'salt', unit: '' })).toBeUndefined();
    expect(formatIngredientSubtitle({ name: 'eggs', quantity: 2, unit: '' })).toBe('2');
  });

  it('zero quantity is still "0" (not falsy-suppressed)', () => {
    expect(formatIngredientSubtitle({ name: 'sugar', quantity: 0, unit: 'g' })).toBe(
      '0 g',
    );
    expect(formatIngredientSubtitle({ name: 'sugar', quantity: 0 })).toBe('0');
  });
});

describe('toggleIndex', () => {
  it('adds index when absent', () => {
    const r = toggleIndex(new Set<number>(), 2);
    expect([...r]).toEqual([2]);
  });

  it('removes index when present', () => {
    const r = toggleIndex(new Set([1, 2, 3]), 2);
    expect([...r].sort()).toEqual([1, 3]);
  });

  it('does not mutate input', () => {
    const src = new Set([1]);
    toggleIndex(src, 1);
    expect([...src]).toEqual([1]);
  });

  it('returns a fresh Set (referential inequality)', () => {
    const src = new Set([1]);
    const r = toggleIndex(src, 2);
    expect(r).not.toBe(src);
  });
});

describe('buildRows', () => {
  const makeNoopToggle = () => () => {};

  it('returns one RowSpec per ingredient (2 for 2)', () => {
    const ings: MealPlanIngredient[] = [
      { name: 'flour', quantity: 2, unit: 'cup' },
      { name: 'salt' },
    ];
    const rows = buildRows(ings, new Set(), makeNoopToggle);
    expect(rows).toHaveLength(2);
  });

  it('row title mirrors ingredient.name', () => {
    const ings: MealPlanIngredient[] = [
      { name: 'flour' },
      { name: 'salt' },
      { name: 'butter' },
    ];
    const rows = buildRows(ings, new Set(), makeNoopToggle);
    expect(rows.map((r) => r.title)).toEqual(['flour', 'salt', 'butter']);
  });

  it('row subtitle carries quantity + unit when present, omitted when absent', () => {
    const ings: MealPlanIngredient[] = [
      { name: 'flour', quantity: 2, unit: 'cup' },
      { name: 'salt' },
      { name: 'butter', quantity: 4 },
      { name: 'water', unit: 'ml' },
    ];
    const rows = buildRows(ings, new Set(), makeNoopToggle);
    expect(rows[0]?.subtitle).toBe('2 cup');
    expect(rows[1]?.subtitle).toBeUndefined();
    expect(rows[2]?.subtitle).toBe('4');
    expect(rows[3]?.subtitle).toBe('ml');
  });

  it('each row has leading.kind === "checkbox" + onToggle fn + checked=false initially', () => {
    const ings: MealPlanIngredient[] = [{ name: 'flour' }, { name: 'salt' }];
    const rows = buildRows(ings, new Set(), makeNoopToggle);
    for (const r of rows) {
      expect(r.leading.kind).toBe('checkbox');
      expect(r.leading.checked).toBe(false);
      expect(typeof r.leading.onToggle).toBe('function');
    }
  });

  it('checked indices surface through leading.checked + struck', () => {
    const ings: MealPlanIngredient[] = [
      { name: 'flour' },
      { name: 'salt' },
      { name: 'butter' },
    ];
    const rows = buildRows(ings, new Set([0, 2]), makeNoopToggle);
    expect(rows[0]?.leading.checked).toBe(true);
    expect(rows[1]?.leading.checked).toBe(false);
    expect(rows[2]?.leading.checked).toBe(true);
    // struck mirrors checked
    expect(rows[0]?.struck).toBe(true);
    expect(rows[1]?.struck).toBe(false);
    expect(rows[2]?.struck).toBe(true);
  });

  it('onToggle factory is called per row with the row index', () => {
    const ings: MealPlanIngredient[] = [{ name: 'flour' }, { name: 'salt' }];
    const factory = vi.fn(() => () => {});
    buildRows(ings, new Set(), factory);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenNthCalledWith(1, 0);
    expect(factory).toHaveBeenNthCalledWith(2, 1);
  });

  it('row keys are unique — safe against duplicate ingredient names', () => {
    const ings: MealPlanIngredient[] = [
      { name: 'salt' },
      { name: 'salt' }, // same name, different row
    ];
    const rows = buildRows(ings, new Set(), makeNoopToggle);
    expect(rows[0]?.key).not.toBe(rows[1]?.key);
  });

  it('simulating an onToggle call via toggleIndex flips the observable checked state', () => {
    // Regression guard: the wiring between makeToggle and checked state
    // produces a fresh Set on toggle. Simulate the (makeToggle → setter)
    // round-trip manually.
    let checked = new Set<number>();
    const makeToggle = (i: number) => () => {
      checked = toggleIndex(checked, i);
    };
    const ings: MealPlanIngredient[] = [{ name: 'flour' }, { name: 'salt' }];
    const rows = buildRows(ings, checked, makeToggle);
    expect(rows[0]?.leading.checked).toBe(false);
    // Invoke the toggle callback on row 0:
    rows[0]?.leading.onToggle();
    // Rebuild rows with the updated set — mirrors what React would do.
    const rows2 = buildRows(ings, checked, makeToggle);
    expect(rows2[0]?.leading.checked).toBe(true);
    expect(rows2[1]?.leading.checked).toBe(false);
  });
});

describe('IngredientChecklist (empty state — stateless branch)', () => {
  it('empty list renders "No ingredients listed" — this branch does not invoke useState', () => {
    const tree = IngredientChecklist({ ingredients: [] }) as AnyEl;
    const all = flatten(tree);
    const texts: string[] = [];
    for (const el of all) {
      const ch = el.props?.children;
      if (typeof ch === 'string') texts.push(ch);
      if (Array.isArray(ch)) {
        for (const c of ch) if (typeof c === 'string') texts.push(c);
      }
    }
    expect(texts.some((t) => /No ingredients listed/i.test(t))).toBe(true);
  });
});
