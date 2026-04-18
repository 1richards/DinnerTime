import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));
const { MockSymbolView } = mocks;
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));

import { ErrorState } from '../ErrorState';
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

describe('ErrorState', () => {
  it("renders the title in both 'full' and 'banner' variants", () => {
    const full = ErrorState({ title: 'Something went wrong' });
    expect(findByText(full, 'Something went wrong')).toBeDefined();

    const banner = ErrorState({ title: 'Oh no', variant: 'banner' });
    expect(findByText(banner, 'Oh no')).toBeDefined();
  });

  it('does not render a retry button when retry prop is omitted', () => {
    const tree = ErrorState({ title: 'Err' });
    const buttons = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button',
    );
    expect(buttons.length).toBe(0);
  });

  it('renders a retry button and fires onPress when retry prop is provided', () => {
    const onPress = vi.fn();
    const tree = ErrorState({
      title: 'Err',
      retry: { label: 'Try again', onPress },
    });
    const buttons = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button',
    );
    expect(buttons.length).toBe(1);
    expect(findByText(tree, 'Try again')).toBeDefined();

    buttons[0].props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("variant='banner' caps height at 80 (compact layout)", () => {
    const tree = ErrorState({ title: 'Err', variant: 'banner' });
    // Root carries inline style with maxHeight <= 80
    const style = tree.props.style as { maxHeight?: number } | undefined;
    expect(style?.maxHeight).toBeLessThanOrEqual(80);
  });

  it("variant='full' (default) renders flex-1 centered layout", () => {
    const tree = ErrorState({ title: 'Err' });
    expect(tree.props.className).toMatch(/flex-1/);
    expect(tree.props.className).toMatch(/items-center/);
    expect(tree.props.className).toMatch(/justify-center/);
  });

  it("renders an SF Symbol (SymbolView) in 'full' variant", () => {
    const tree = ErrorState({ title: 'Err' });
    const symbols = flatten(tree).filter((el) => el.type === SymbolIcon);
    expect(symbols.length).toBe(1);
    expect(symbols[0].props.name).toBe('exclamationmark.triangle');
  });
});
