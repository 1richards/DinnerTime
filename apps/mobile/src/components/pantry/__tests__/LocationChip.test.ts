import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// Mock expo-symbols + expo-image to keep SymbolView as an identifiable stub.
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));

import { LocationChip } from '../LocationChip';
import { Chip } from '../../ui/Chip';

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

describe('LocationChip', () => {
  it('renders fridge with label "Fridge" and leadingIcon "snowflake"', () => {
    const tree = LocationChip({ value: 'fridge', onPress: () => {} });
    const chip = flatten(tree).find((el) => el.type === Chip);
    expect(chip).toBeDefined();
    expect(chip!.props.label).toBe('Fridge');
    expect(chip!.props.leadingIcon).toBe('snowflake');
    expect(chip!.props.kind).toBe('display');
    expect(chip!.props.tone).toBe('default');
  });

  it('renders pantry with label "Pantry" and leadingIcon "archivebox"', () => {
    const tree = LocationChip({ value: 'pantry', onPress: () => {} });
    const chip = flatten(tree).find((el) => el.type === Chip);
    expect(chip).toBeDefined();
    expect(chip!.props.label).toBe('Pantry');
    expect(chip!.props.leadingIcon).toBe('archivebox');
  });

  it('renders freezer with label "Freezer" and leadingIcon "snowflake"', () => {
    const tree = LocationChip({ value: 'freezer', onPress: () => {} });
    const chip = flatten(tree).find((el) => el.type === Chip);
    expect(chip).toBeDefined();
    expect(chip!.props.label).toBe('Freezer');
    expect(chip!.props.leadingIcon).toBe('snowflake');
  });

  it('fires onPress when the outer Pressable is tapped', () => {
    const onPress = vi.fn();
    const tree = LocationChip({ value: 'fridge', onPress });
    // The root element returned IS the Pressable (no wrapping fragment).
    expect(typeof tree.props.onPress).toBe('function');
    tree.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('sets an accessibilityLabel of "Location: <label> — tap to change"', () => {
    const fridge = LocationChip({ value: 'fridge', onPress: () => {} });
    expect(fridge.props.accessibilityLabel).toBe(
      'Location: Fridge — tap to change',
    );
    const pantry = LocationChip({ value: 'pantry', onPress: () => {} });
    expect(pantry.props.accessibilityLabel).toBe(
      'Location: Pantry — tap to change',
    );
    const freezer = LocationChip({ value: 'freezer', onPress: () => {} });
    expect(freezer.props.accessibilityLabel).toBe(
      'Location: Freezer — tap to change',
    );
  });

  it('uses the shared LOCATION_SYMBOLS map (no forked duplicate)', async () => {
    const { LOCATION_SYMBOLS } = await import('../locationSymbols');
    const fridge = LocationChip({ value: 'fridge', onPress: () => {} });
    const chip = flatten(fridge).find((el) => el.type === Chip);
    expect(chip!.props.leadingIcon).toBe(LOCATION_SYMBOLS.fridge);
  });
});
