/**
 * Phase 01-01 — ScaledIngredientList missing-ingredient indicator tests.
 *
 * Static-tree-walk pattern (matches StepNavButtons.test.tsx and the
 * cooking IngredientRow.test.tsx that landed today).
 *
 * Coverage matrix (5 cases — one per behavior bullet in 01-PLAN.md Task 2):
 *   1. empty pantry + non-staple ingredients → every row exposes a
 *      trailing Pressable matched by accessibilityLabel /Add .* to shopping list/
 *   2. pantry containing 'chicken' suppresses the indicator on a
 *      'chicken breast' row (bidirectional match working)
 *   3. a 'salt' ingredient row never exposes the trailing Pressable
 *      (PANTRY_STAPLES skip)
 *   4. tapping the trailing Pressable invokes onAddIngredient with
 *      { name, quantity, unit } from the ingredient
 *   5. when an ingredient is in addedNames, its trailing element flips
 *      to a non-pressable cart.fill (success tone) — accessibilityLabel
 *      becomes /Added .* to shopping list/
 *
 * Plus a back-compat guard: omitting the new props renders zero
 * trailing Pressables (today's call sites that don't opt in keep
 * working).
 */

import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

import { ScaledIngredientList } from '../ScaledIngredientList';
import type { ParsedIngredient } from '../../../types/recipe';

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

function findAllByLabelRegex(tree: AnyEl, re: RegExp): AnyEl[] {
  return flatten(tree).filter(
    (el) =>
      typeof el.props?.accessibilityLabel === 'string' &&
      re.test(el.props.accessibilityLabel),
  );
}

const ing = (overrides: Partial<ParsedIngredient> = {}): ParsedIngredient => ({
  name: 'chicken breast',
  quantity: 1,
  unit: 'lb',
  notes: null,
  ...overrides,
});

describe('ScaledIngredientList — missing-ingredient indicator', () => {
  it('back-compat: omitting pantryNames renders zero trailing Pressables', () => {
    const tree = ScaledIngredientList({
      ingredients: [ing({ name: 'chicken breast' }), ing({ name: 'salmon' })],
      multiplier: 1,
    }) as AnyEl;
    const addBtns = findAllByLabelRegex(tree, /Add .* to shopping list/);
    expect(addBtns).toHaveLength(0);
  });

  it('renders a trailing Pressable on every non-staple row when pantry is empty', () => {
    const tree = ScaledIngredientList({
      ingredients: [
        ing({ name: 'chicken breast' }),
        ing({ name: 'broccoli' }),
      ],
      multiplier: 1,
      pantryNames: [],
      addedNames: new Set(),
      onAddIngredient: vi.fn(),
    }) as AnyEl;
    const addBtns = findAllByLabelRegex(tree, /Add .* to shopping list/);
    expect(addBtns).toHaveLength(2);
    expect(addBtns[0].props.accessibilityLabel).toBe(
      'Add chicken breast to shopping list',
    );
  });

  it('suppresses the indicator when the pantry covers an ingredient (bidirectional match)', () => {
    const tree = ScaledIngredientList({
      ingredients: [ing({ name: 'chicken breast' })],
      multiplier: 1,
      pantryNames: ['chicken'],
      addedNames: new Set(),
      onAddIngredient: vi.fn(),
    }) as AnyEl;
    const addBtns = findAllByLabelRegex(tree, /Add .* to shopping list/);
    expect(addBtns).toHaveLength(0);
  });

  it('never renders the indicator on a PANTRY_STAPLES ingredient (salt) — even with empty pantry', () => {
    const tree = ScaledIngredientList({
      ingredients: [ing({ name: 'salt', quantity: 1, unit: 'tsp' })],
      multiplier: 1,
      pantryNames: [],
      addedNames: new Set(),
      onAddIngredient: vi.fn(),
    }) as AnyEl;
    const addBtns = findAllByLabelRegex(tree, /Add .* to shopping list/);
    expect(addBtns).toHaveLength(0);
  });

  it('tapping the trailing Pressable invokes onAddIngredient with the original ingredient', () => {
    const onAddIngredient = vi.fn();
    const tree = ScaledIngredientList({
      ingredients: [ing({ name: 'salmon fillet', quantity: 2, unit: 'lb' })],
      multiplier: 1,
      pantryNames: [],
      addedNames: new Set(),
      onAddIngredient,
    }) as AnyEl;
    const addBtns = findAllByLabelRegex(tree, /Add .* to shopping list/);
    expect(addBtns).toHaveLength(1);
    addBtns[0].props.onPress();
    expect(onAddIngredient).toHaveBeenCalledTimes(1);
    expect(onAddIngredient).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'salmon fillet',
        quantity: 2,
        unit: 'lb',
      }),
    );
  });

  it('renders a non-pressable Added marker when the ingredient name is in addedNames', () => {
    const tree = ScaledIngredientList({
      ingredients: [ing({ name: 'salmon fillet' })],
      multiplier: 1,
      pantryNames: [],
      // Component normalizes via trim+lowercase before looking up
      addedNames: new Set(['salmon fillet']),
      onAddIngredient: vi.fn(),
    }) as AnyEl;
    // No "Add ..." Pressable should remain
    const addBtns = findAllByLabelRegex(tree, /^Add .* to shopping list$/);
    expect(addBtns).toHaveLength(0);
    // But an "Added ..." marker should appear (View, not Pressable; no onPress)
    const addedMarkers = findAllByLabelRegex(tree, /^Added .* to shopping list$/);
    expect(addedMarkers).toHaveLength(1);
    expect(addedMarkers[0].props.onPress).toBeUndefined();
  });
});
