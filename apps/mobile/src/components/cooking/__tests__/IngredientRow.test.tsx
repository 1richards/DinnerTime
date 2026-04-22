/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../IngredientRow` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-04 (checkable ingredient row — success tint on check).
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

  it('fires onToggle(id) on press', () => {
    const onToggle = vi.fn();
    const tree = IngredientRow({
      ...base,
      checked: false,
      onToggle,
    });
    const pressable = flatten(tree).find(
      (el) => el.props.accessibilityRole === 'checkbox'
    );
    expect(pressable).toBeDefined();
    pressable!.props.onPress();
    expect(onToggle).toHaveBeenCalledWith('rice-0');
  });

  it('applies strike-through class when checked', () => {
    const checkedTree = IngredientRow({
      ...base,
      checked: true,
      onToggle: vi.fn(),
    });
    const classes = collectClassNames(checkedTree);
    expect(classes).toMatch(/line-through/);
  });

  it('uses success tone on the check icon and Phase 19 tokens only', () => {
    const checkedTree = IngredientRow({
      ...base,
      checked: true,
      onToggle: vi.fn(),
    });
    const classes = collectClassNames(checkedTree);
    expect(classes).toMatch(/\btext-success\b/);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
