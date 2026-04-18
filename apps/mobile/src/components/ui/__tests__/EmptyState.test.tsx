import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// Mock native surfaces so React.createElement captures identifiable shapes.
// Each mock returns a sentinel function-component reference we can match on.
// Wrap in vi.hoisted so refs are initialized before vi.mock factories run.
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
  MockExpoImage: (_props: unknown) => null,
}));
const { MockSymbolView, MockExpoImage } = mocks;

vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));
vi.mock('expo-image', () => ({ Image: mocks.MockExpoImage }));

import { EmptyState } from '../EmptyState';
import { SymbolIcon } from '../SymbolIcon';

type AnyEl = ReactElement<any>;

/** Recursively flatten a React element tree into a flat array of elements. */
function flatten(node: unknown): AnyEl[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'object' && node !== null && 'props' in (node as AnyEl)) {
    const el = node as AnyEl;
    return [el, ...flatten(el.props.children)];
  }
  return [];
}

/** Find the first element with a children string that matches `text`. */
function findByText(tree: AnyEl, text: string): AnyEl | undefined {
  return flatten(tree).find((el) => el.props.children === text);
}

describe('EmptyState', () => {
  it("renders an expo-image Image when visual.kind === 'image'", () => {
    const tree = EmptyState({
      visual: { kind: 'image', uri: 'https://example.com/pic.jpg' },
      title: 'Empty',
    });
    const images = flatten(tree).filter((el) => el.type === MockExpoImage);
    expect(images.length).toBe(1);
    expect(images[0].props.source).toEqual({
      uri: 'https://example.com/pic.jpg',
    });
    // Must NOT also render a SymbolIcon when image variant is chosen
    const symbols = flatten(tree).filter((el) => el.type === SymbolIcon);
    expect(symbols.length).toBe(0);
  });

  it("renders a SymbolIcon (SymbolView) when visual.kind === 'symbol' with that name", () => {
    const tree = EmptyState({
      visual: { kind: 'symbol', name: 'cart' },
      title: 'Empty',
    });
    const symbols = flatten(tree).filter((el) => el.type === SymbolIcon);
    expect(symbols.length).toBe(1);
    expect(symbols[0].props.name).toBe('cart');
    // Must NOT also render an expo-image Image
    const images = flatten(tree).filter((el) => el.type === MockExpoImage);
    expect(images.length).toBe(0);
  });

  it('always renders the title text', () => {
    const tree = EmptyState({
      visual: { kind: 'symbol', name: 'cart' },
      title: 'Nothing here yet',
    });
    expect(findByText(tree, 'Nothing here yet')).toBeDefined();
  });

  it('renders the subtitle only when provided', () => {
    const withSubtitle = EmptyState({
      visual: { kind: 'symbol', name: 'cart' },
      title: 'T',
      subtitle: 'Some hint',
    });
    expect(findByText(withSubtitle, 'Some hint')).toBeDefined();

    const withoutSubtitle = EmptyState({
      visual: { kind: 'symbol', name: 'cart' },
      title: 'T',
    });
    // No element should have "Some hint" as child when subtitle omitted
    expect(
      flatten(withoutSubtitle).find((el) => el.props.children === 'Some hint'),
    ).toBeUndefined();
  });

  it('renders the action button only when action provided and fires onPress', () => {
    const withoutAction = EmptyState({
      visual: { kind: 'symbol', name: 'cart' },
      title: 'T',
    });
    expect(findByText(withoutAction, 'Start')).toBeUndefined();

    const onPress = vi.fn();
    const withAction = EmptyState({
      visual: { kind: 'symbol', name: 'cart' },
      title: 'T',
      action: { label: 'Start', onPress },
    });
    const pressable = flatten(withAction).find(
      (el) => el.props.accessibilityRole === 'button',
    );
    expect(pressable).toBeDefined();
    expect(findByText(withAction, 'Start')).toBeDefined();

    // Invoke onPress handler directly — simulates the press
    pressable!.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
