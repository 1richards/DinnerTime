import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// Mock SymbolView so we can match SymbolIcon wrappers by reference.
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));

import { LocationChoiceSheet } from '../LocationChoiceSheet';
import type { SourceLocation } from '../../../types/pantry';

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

function findByText(tree: AnyEl, text: string): AnyEl | undefined {
  return flatten(tree).find((el) => el.props.children === text);
}

// Find the Pressable option rows — those with onPress set AND a className
// containing 'rounded-2xl' (from the OPTIONS map).
function findOptionRows(tree: AnyEl): AnyEl[] {
  return flatten(tree).filter(
    (el) =>
      typeof el.props.className === 'string' &&
      el.props.className.includes('rounded-2xl') &&
      typeof el.props.onPress === 'function',
  );
}

describe('LocationChoiceSheet', () => {
  const noop = () => {};

  it('renders three option rows (Fridge / Pantry / Freezer) when visible=true', () => {
    const tree = LocationChoiceSheet({
      visible: true,
      currentValue: 'pantry',
      onSelect: noop,
      onClose: noop,
    });
    expect(findByText(tree, 'Fridge')).toBeDefined();
    expect(findByText(tree, 'Pantry')).toBeDefined();
    expect(findByText(tree, 'Freezer')).toBeDefined();
    const rows = findOptionRows(tree);
    expect(rows).toHaveLength(3);
  });

  it('includes per-option subtitles for context', () => {
    const tree = LocationChoiceSheet({
      visible: true,
      currentValue: 'pantry',
      onSelect: noop,
      onClose: noop,
    });
    expect(findByText(tree, 'Dairy, fresh meat, produce')).toBeDefined();
    expect(findByText(tree, 'Shelf-stable, canned, dried')).toBeDefined();
    expect(findByText(tree, 'Frozen items, ice cream')).toBeDefined();
  });

  it('highlights the current-value row with a border-brand ring', () => {
    const cases: Array<SourceLocation> = ['fridge', 'pantry', 'freezer'];
    for (const current of cases) {
      const tree = LocationChoiceSheet({
        visible: true,
        currentValue: current,
        onSelect: noop,
        onClose: noop,
      });
      const rows = findOptionRows(tree);
      // Exactly one row carries the border-2 border-brand treatment.
      const highlighted = rows.filter((row) =>
        String(row.props.className).includes('border-2') &&
        String(row.props.className).includes('border-brand'),
      );
      expect(
        highlighted,
        `currentValue=${current} should highlight exactly one row`,
      ).toHaveLength(1);
    }
  });

  it('onSelect fires with the tapped value and onClose fires after selection', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const tree = LocationChoiceSheet({
      visible: true,
      currentValue: 'pantry',
      onSelect,
      onClose,
    });
    const rows = findOptionRows(tree);
    // Tap freezer (third option).
    rows[2].props.onPress();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('freezer');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop Pressable onPress calls onClose', () => {
    const onClose = vi.fn();
    const tree = LocationChoiceSheet({
      visible: true,
      currentValue: 'pantry',
      onSelect: noop,
      onClose,
    });
    // The outermost child of the Modal is the dim-backdrop Pressable.
    // tree is the Modal; its children[0] is the backdrop.
    const children = Array.isArray(tree.props.children)
      ? tree.props.children
      : [tree.props.children];
    const backdrop = children.find(
      (c: unknown) =>
        typeof c === 'object' &&
        c !== null &&
        'props' in (c as AnyEl) &&
        typeof (c as AnyEl).props.onPress === 'function' &&
        typeof (c as AnyEl).props.className === 'string' &&
        (c as AnyEl).props.className.includes('bg-black/40'),
    ) as AnyEl | undefined;
    expect(backdrop).toBeDefined();
    backdrop!.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Modal receives the visible prop from props', () => {
    const visibleTrue = LocationChoiceSheet({
      visible: true,
      currentValue: 'pantry',
      onSelect: noop,
      onClose: noop,
    });
    const visibleFalse = LocationChoiceSheet({
      visible: false,
      currentValue: 'pantry',
      onSelect: noop,
      onClose: noop,
    });
    expect(visibleTrue.props.visible).toBe(true);
    expect(visibleFalse.props.visible).toBe(false);
  });
});
