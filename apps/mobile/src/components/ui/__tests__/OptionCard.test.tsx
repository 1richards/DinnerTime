import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { Pressable } from 'react-native';

const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));

import { OptionCard } from '../OptionCard';
import { SymbolIcon } from '../SymbolIcon';

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

/** Flatten an arbitrary StyleProp<ViewStyle> to a single object so callers
 *  can read fields like borderStyle/opacity even when caller passed a
 *  function (Pressable's style accepts ({pressed}) => StyleProp). */
function resolvePressableStyle(p: AnyEl): Record<string, unknown> {
  const raw = p.props.style;
  const arr = typeof raw === 'function' ? raw({ pressed: false }) : raw;
  const flat = Array.isArray(arr) ? arr : [arr];
  return Object.assign({}, ...flat.filter(Boolean));
}

describe('OptionCard — default variant rendering', () => {
  it('renders the label text', () => {
    const tree = OptionCard({
      label: 'Knife skills',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    expect(findByText(tree, 'Knife skills')).toBeDefined();
  });

  it('renders an icon chip with backgroundColor derived from tint (tint+1A alpha)', () => {
    const tree = OptionCard({
      label: 'Knife skills',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    // Find the SymbolIcon and confirm its tintColor is the supplied tint.
    const symbol = flatten(tree).find((el) => el.type === SymbolIcon);
    expect(symbol).toBeDefined();
    expect(symbol!.props.tintColor).toBe('#C65D3A');

    // The chip wrapper uses backgroundColor `${tint}1A`. Walk the tree for
    // any element whose style includes that.
    const hasChipBg = flatten(tree).some((el) => {
      const s = el.props?.style;
      const arr = Array.isArray(s) ? s : [s];
      return arr.some((x: unknown) => {
        if (!x || typeof x !== 'object') return false;
        const bg = (x as Record<string, unknown>).backgroundColor;
        return typeof bg === 'string' && bg.toLowerCase() === '#c65d3a1a';
      });
    });
    expect(hasChipBg).toBe(true);
  });

  it('omits the sub line when sub prop is undefined', () => {
    const tree = OptionCard({
      label: 'Knife skills',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    expect(
      flatten(tree).find((el) => el.props.children === 'Speed up prep'),
    ).toBeUndefined();
  });

  it('renders the sub line when sub prop is provided', () => {
    const tree = OptionCard({
      label: 'Knife skills',
      sub: 'Speed up prep',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    expect(findByText(tree, 'Speed up prep')).toBeDefined();
  });
});

describe('OptionCard — selected state', () => {
  it('renders a checkmark.circle.fill SymbolIcon overlay when selected=true', () => {
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      selected: true,
      onPress: () => {},
    });
    const symbols = flatten(tree).filter((el) => el.type === SymbolIcon);
    const check = symbols.find((s) => s.props.name === 'checkmark.circle.fill');
    expect(check).toBeDefined();
    // Tinted with success token (#16A34A — see design/tokens.ts)
    expect(check!.props.tintColor).toBe('#16A34A');
  });

  it('does NOT render the checkmark overlay when selected is false/undefined', () => {
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    const symbols = flatten(tree).filter((el) => el.type === SymbolIcon);
    const check = symbols.find((s) => s.props.name === 'checkmark.circle.fill');
    expect(check).toBeUndefined();
  });
});

describe('OptionCard — disabled state', () => {
  it('sets the Pressable disabled prop when disabled=true', () => {
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      disabled: true,
      onPress: () => {},
    });
    const pressable = flatten(tree).find((el) => el.type === Pressable);
    expect(pressable).toBeDefined();
    expect(pressable!.props.disabled).toBe(true);
    const style = resolvePressableStyle(pressable!);
    expect(style.opacity).toBe(0.45);
  });

  it('does not set disabled when disabled is omitted', () => {
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    const pressable = flatten(tree).find((el) => el.type === Pressable);
    expect(pressable!.props.disabled).toBeFalsy();
  });
});

describe('OptionCard — variant=custom', () => {
  it('uses dashed borderStyle for variant="custom"', () => {
    const tree = OptionCard({
      label: 'Custom',
      symbol: 'pencil' as never,
      tint: '#1C1917',
      variant: 'custom',
      onPress: () => {},
    });
    const pressable = flatten(tree).find((el) => el.type === Pressable);
    const style = resolvePressableStyle(pressable!);
    expect(style.borderStyle).toBe('dashed');
  });

  it('uses solid (default) borderStyle for variant="default"', () => {
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress: () => {},
    });
    const pressable = flatten(tree).find((el) => el.type === Pressable);
    const style = resolvePressableStyle(pressable!);
    // Default borderStyle is undefined OR 'solid' — assert it's not 'dashed'.
    expect(style.borderStyle).not.toBe('dashed');
  });
});

describe('OptionCard — onPress wiring', () => {
  it('fires onPress when the Pressable onPress is invoked', () => {
    const onPress = vi.fn();
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      onPress,
    });
    const pressable = flatten(tree).find((el) => el.type === Pressable);
    pressable!.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards an explicit accessibilityLabel through to the Pressable', () => {
    const tree = OptionCard({
      label: 'X',
      symbol: 'scissors' as never,
      tint: '#C65D3A',
      accessibilityLabel: 'Focus on Knife skills',
      onPress: () => {},
    });
    const pressable = flatten(tree).find((el) => el.type === Pressable);
    expect(pressable!.props.accessibilityLabel).toBe('Focus on Knife skills');
  });
});
