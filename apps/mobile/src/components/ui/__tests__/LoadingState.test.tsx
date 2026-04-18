import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ActivityIndicator } from 'react-native';

import { LoadingState } from '../LoadingState';

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

describe('LoadingState', () => {
  it("renders an ActivityIndicator by default (variant='spinner')", () => {
    const tree = LoadingState();
    const spinners = flatten(tree).filter((el) => el.type === ActivityIndicator);
    expect(spinners.length).toBe(1);
  });

  it("renders an ActivityIndicator when variant='spinner' is explicit", () => {
    const tree = LoadingState({ variant: 'spinner' });
    const spinners = flatten(tree).filter((el) => el.type === ActivityIndicator);
    expect(spinners.length).toBe(1);
  });

  it("renders a skeleton View (no spinner) when variant='skeleton'", () => {
    const tree = LoadingState({ variant: 'skeleton' });
    const spinners = flatten(tree).filter((el) => el.type === ActivityIndicator);
    expect(spinners.length).toBe(0);
    // Root node carries the skeleton className
    expect(tree.props.className).toMatch(/bg-warmGray-100/);
    expect(tree.props.className).toMatch(/rounded/);
  });

  it('renders a Text label under the spinner when label is provided', () => {
    const tree = LoadingState({ variant: 'spinner', label: 'Loading recipes' });
    expect(findByText(tree, 'Loading recipes')).toBeDefined();
  });

  it('does not render a Text label when label is omitted (spinner variant)', () => {
    const tree = LoadingState({ variant: 'spinner' });
    // No child element should have the string "Loading recipes"
    expect(
      flatten(tree).find((el) => el.props.children === 'Loading recipes'),
    ).toBeUndefined();
  });
});
