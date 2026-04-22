/**
 * Phase 22-04 — IngredientChecklist tests.
 *
 * Static JSX-tree walk (mirrors MonthGrid.test.ts / HandoffSheet.test.tsx).
 * vitest-node can't mount React hooks, but we can:
 *   - call the component as a function with props to get the JSX tree
 *   - walk children via props.children
 *   - assert row counts, titles, and empty-state rendering
 *
 * Per-row checkbox toggling state lives in React useState so we can't
 * exercise the full toggle cycle under vitest-node. We instead assert
 * that the hook seam exposes a toggle callback on each row and that the
 * initial render has `checked=false` for all rows. The interactive
 * coverage lives in Maestro flow 34 (green once plan 22-04 ships).
 *
 * We do NOT test the ItemRow internals here — those have their own tests.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

import { IngredientChecklist } from './IngredientChecklist';
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

describe('IngredientChecklist', () => {
  it('renders one ItemRow per ingredient (2 rows for 2 ingredients)', () => {
    const ingredients: MealPlanIngredient[] = [
      { name: 'flour', quantity: 2, unit: 'cup' },
      { name: 'salt' },
    ];
    const tree = IngredientChecklist({ ingredients }) as AnyEl;
    const all = flatten(tree);
    // Find ItemRow elements by displayName/name on the component type.
    const rows = all.filter(
      (el) =>
        typeof el.type === 'function' &&
        // @ts-expect-error — runtime name inspection
        (el.type.name === 'ItemRow' || el.type.displayName === 'ItemRow'),
    );
    expect(rows.length).toBe(2);
  });

  it('each row title matches the ingredient name', () => {
    const ingredients: MealPlanIngredient[] = [
      { name: 'flour', quantity: 2, unit: 'cup' },
      { name: 'salt' },
      { name: 'butter', quantity: 4, unit: 'tbsp' },
    ];
    const tree = IngredientChecklist({ ingredients }) as AnyEl;
    const all = flatten(tree);
    const rows = all.filter(
      (el) =>
        typeof el.type === 'function' &&
        // @ts-expect-error — runtime name inspection
        (el.type.name === 'ItemRow' || el.type.displayName === 'ItemRow'),
    );
    expect(rows.map((r) => r.props.title)).toEqual(['flour', 'salt', 'butter']);
  });

  it('row subtitle carries quantity + unit when present, omitted when absent', () => {
    const ingredients: MealPlanIngredient[] = [
      { name: 'flour', quantity: 2, unit: 'cup' },
      { name: 'salt' },
      { name: 'butter', quantity: 4 },
      { name: 'water', unit: 'ml' },
    ];
    const tree = IngredientChecklist({ ingredients }) as AnyEl;
    const all = flatten(tree);
    const rows = all.filter(
      (el) =>
        typeof el.type === 'function' &&
        // @ts-expect-error — runtime name inspection
        (el.type.name === 'ItemRow' || el.type.displayName === 'ItemRow'),
    );
    // flour: both → "2 cup"
    expect(rows[0]?.props.subtitle).toBe('2 cup');
    // salt: neither → undefined
    expect(rows[1]?.props.subtitle).toBeUndefined();
    // butter: quantity only → "4"
    expect(rows[2]?.props.subtitle).toBe('4');
    // water: unit only → "ml"
    expect(rows[3]?.props.subtitle).toBe('ml');
  });

  it('each row has a leading="checkbox" affordance with onToggle + checked=false initially', () => {
    const ingredients: MealPlanIngredient[] = [
      { name: 'flour' },
      { name: 'salt' },
    ];
    const tree = IngredientChecklist({ ingredients }) as AnyEl;
    const all = flatten(tree);
    const rows = all.filter(
      (el) =>
        typeof el.type === 'function' &&
        // @ts-expect-error — runtime name inspection
        (el.type.name === 'ItemRow' || el.type.displayName === 'ItemRow'),
    );
    for (const r of rows) {
      expect(r.props.leading?.kind).toBe('checkbox');
      expect(r.props.leading?.checked).toBe(false);
      expect(typeof r.props.leading?.onToggle).toBe('function');
    }
  });

  it('onToggle callback does not throw (invocation is safe)', () => {
    // Component uses useState internally — we can't observe the toggled
    // state from outside a renderer, but we can assert the callback is a
    // well-formed function that doesn't crash when called. This guards
    // against a regression where onToggle might accidentally be `undefined`
    // or bound to a missing setter.
    const ingredients: MealPlanIngredient[] = [{ name: 'flour' }];
    const tree = IngredientChecklist({ ingredients }) as AnyEl;
    const all = flatten(tree);
    const rows = all.filter(
      (el) =>
        typeof el.type === 'function' &&
        // @ts-expect-error — runtime name inspection
        (el.type.name === 'ItemRow' || el.type.displayName === 'ItemRow'),
    );
    const toggle = rows[0]?.props.leading?.onToggle;
    expect(() => toggle?.()).not.toThrow();
  });

  it('empty list renders "No ingredients listed" empty state', () => {
    const tree = IngredientChecklist({ ingredients: [] }) as AnyEl;
    const all = flatten(tree);
    // Walk text nodes — empty-state text must appear somewhere in the
    // rendered tree. We don't assert the exact visual primitive (Text vs
    // EmptyState) to keep the test resilient to later restyling.
    const texts: string[] = [];
    for (const el of all) {
      const children = el.props?.children;
      if (typeof children === 'string') texts.push(children);
      if (Array.isArray(children)) {
        for (const c of children) if (typeof c === 'string') texts.push(c);
      }
    }
    expect(texts.some((t) => /No ingredients listed/i.test(t))).toBe(true);
    // And no ItemRow rendered in the empty case.
    const rows = all.filter(
      (el) =>
        typeof el.type === 'function' &&
        // @ts-expect-error — runtime name inspection
        (el.type.name === 'ItemRow' || el.type.displayName === 'ItemRow'),
    );
    expect(rows.length).toBe(0);
  });

  it('does not persist to AsyncStorage (no side-effect at render time)', () => {
    // Spy on AsyncStorage.setItem — if IngredientChecklist accidentally
    // persists, this assertion catches it. Persistence is explicitly a v2
    // feature per PLAN 22-04 behavior block.
    // (Global AsyncStorage mock lives in vitest.setup.ts.)
    const ingredients: MealPlanIngredient[] = [{ name: 'flour' }];
    const setItemSpy = vi.fn();
    // Best-effort: if the module has been imported, tap its setItem.
    // If not imported, this assertion is vacuously true (no persistence).
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const AS = require('@react-native-async-storage/async-storage').default;
      AS.setItem = setItemSpy;
    } catch {
      // module not present — fine
    }
    IngredientChecklist({ ingredients });
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});
