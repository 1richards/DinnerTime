/**
 * IngredientRow tests.
 *
 * Phase 16-05: COOK-UX-04 — checkable ingredient row with success tint
 * on check + Phase 19 token contract.
 *
 * Phase 01-01: missing-ingredient indicator — optional inPantry /
 * wasAdded / onAddToShoppingList props that render a trailing
 * cart.badge.plus Pressable when the ingredient is missing and a
 * non-pressable cart.fill (success tone) marker once added. Static
 * tree-walk pattern matching StepNavButtons.test.tsx.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// Mock expo-symbols + expo-haptics so the IngredientRow import chain doesn't
// pull in expo-modules-core (which references the RN-only `__DEV__` global).
vi.mock('expo-symbols', () => ({
  SymbolView: (_props: unknown) => null,
}));
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

import { IngredientRow } from '../IngredientRow';

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

function collectClassNames(tree: AnyEl): string {
  return flatten(tree)
    .map((el) => (typeof el.props.className === 'string' ? el.props.className : ''))
    .join(' ');
}

describe('IngredientRow', () => {
  const base = {
    id: 'rice-0',
    name: 'jasmine rice',
    quantity: 1.5,
    unit: 'cup',
  };

  // UAT pivot — cooking-mode ingredients are now a non-interactive bullet
  // list (matches the recipe-detail rendering). The checkable prop
  // contract (`checked` + `onToggle`) stays for back-compat with the
  // cookingStore wiring and any external callers, but the row no longer
  // exposes a checkbox accessibilityRole and ignores `checked` visually.

  it('renders as a non-interactive bullet line (no checkbox role)', () => {
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
    });
    const checkbox = flatten(tree).find(
      (el) => el.props.accessibilityRole === 'checkbox'
    );
    expect(checkbox).toBeUndefined();
  });

  it('does NOT apply strike-through when checked (bullet list, no completion state)', () => {
    const checkedTree = IngredientRow({
      ...base,
      checked: true,
      onToggle: vi.fn(),
    });
    const classes = collectClassNames(checkedTree);
    expect(classes).not.toMatch(/line-through/);
  });

  it('uses Phase 19 token classes only (no raw hex)', () => {
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
    });
    const classes = collectClassNames(tree);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('renders a bullet character so the row reads as a list item', () => {
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
    });
    const bulletNode = flatten(tree).find((el) => {
      const c = el.props?.children;
      if (typeof c === 'string') return c === '•';
      if (Array.isArray(c)) return c.some((p) => p === '•');
      return false;
    });
    expect(bulletNode).toBeDefined();
  });
});

describe('IngredientRow — missing-ingredient indicator (Phase 01-01)', () => {
  const base = {
    id: 'salmon-0',
    name: 'salmon fillet',
    quantity: 2,
    unit: 'lb',
  };

  function findByLabelRegex(tree: ReturnType<typeof IngredientRow>, re: RegExp) {
    return flatten(tree as AnyEl).find(
      (el) =>
        typeof el.props?.accessibilityLabel === 'string' &&
        re.test(el.props.accessibilityLabel),
    );
  }

  it('renders a trailing Pressable when inPantry=false and wasAdded=false', () => {
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
      inPantry: false,
      wasAdded: false,
      onAddToShoppingList: vi.fn(),
    });
    const btn = findByLabelRegex(tree, /^Add .* to shopping list$/);
    expect(btn).toBeDefined();
    expect(btn!.props.accessibilityLabel).toBe(
      'Add salmon fillet to shopping list',
    );
    expect(typeof btn!.props.onPress).toBe('function');
  });

  it('does NOT render the trailing Pressable when inPantry=true', () => {
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
      inPantry: true,
      wasAdded: false,
      onAddToShoppingList: vi.fn(),
    });
    const btn = findByLabelRegex(tree, /^Add .* to shopping list$/);
    expect(btn).toBeUndefined();
  });

  it('renders a non-pressable Added marker when wasAdded=true', () => {
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
      inPantry: false,
      wasAdded: true,
      onAddToShoppingList: vi.fn(),
    });
    // No "Add ..." Pressable
    const addBtn = findByLabelRegex(tree, /^Add .* to shopping list$/);
    expect(addBtn).toBeUndefined();
    // But an "Added ..." marker (View, no onPress)
    const addedMarker = findByLabelRegex(tree, /^Added .* to shopping list$/);
    expect(addedMarker).toBeDefined();
    expect(addedMarker!.props.onPress).toBeUndefined();
  });

  it('tapping the trailing Pressable invokes onAddToShoppingList', () => {
    const onAddToShoppingList = vi.fn();
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
      inPantry: false,
      wasAdded: false,
      onAddToShoppingList,
    });
    const btn = findByLabelRegex(tree, /^Add .* to shopping list$/);
    expect(btn).toBeDefined();
    btn!.props.onPress();
    expect(onAddToShoppingList).toHaveBeenCalledTimes(1);
  });

  it('regression guard: bullet rendering coexists with the cart-add Pressable when new props are passed', () => {
    const onAddToShoppingList = vi.fn();
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle: vi.fn(),
      inPantry: false,
      wasAdded: false,
      onAddToShoppingList,
    });
    const all = flatten(tree as AnyEl);
    // No checkbox role anywhere — bullet list is non-interactive.
    expect(
      all.find((el) => el.props?.accessibilityRole === 'checkbox'),
    ).toBeUndefined();
    // Cart-add Pressable still wired.
    const addBtn = all.find(
      (el) =>
        el.props?.accessibilityRole === 'button' &&
        typeof el.props?.accessibilityLabel === 'string' &&
        el.props.accessibilityLabel.includes('Add'),
    );
    expect(addBtn).toBeDefined();
    addBtn!.props.onPress();
    expect(onAddToShoppingList).toHaveBeenCalledTimes(1);
  });
});
