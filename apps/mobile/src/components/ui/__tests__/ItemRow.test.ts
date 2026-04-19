import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// Sentinel mocks for native modules so React.createElement captures identifiable shapes.
// Hoist refs so vi.mock factories have access to them.
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));

vi.mock('expo-symbols', () => ({
  SymbolView: mocks.MockSymbolView,
}));

// Pure helpers under test
import {
  CONTAINER_CLASSES_DEFAULT,
  CONTAINER_CLASSES_COMPACT,
  resolveContainerClasses,
  resolveTitleClasses,
  resolveCheckboxBoxClasses,
} from '../itemRowHelpers';
import { ItemRow } from '../ItemRow';

type AnyEl = ReactElement<any>;

/** Recursively flatten a React element tree into a flat array. */
function flatten(node: unknown): AnyEl[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'object' && node !== null && 'props' in (node as AnyEl)) {
    const el = node as AnyEl;
    return [el, ...flatten(el.props.children)];
  }
  return [];
}

describe('itemRowHelpers — container class resolvers', () => {
  it('CONTAINER_CLASSES_DEFAULT contains py-3 (existing Phase 19 density)', () => {
    expect(CONTAINER_CLASSES_DEFAULT).toContain('py-3');
    expect(CONTAINER_CLASSES_DEFAULT).not.toContain('py-2');
  });

  it('CONTAINER_CLASSES_COMPACT contains py-2 and NOT py-3 (Phase 21 compact variant)', () => {
    expect(CONTAINER_CLASSES_COMPACT).toContain('py-2');
    expect(CONTAINER_CLASSES_COMPACT).not.toContain('py-3');
  });

  it("resolveContainerClasses() defaults to default density", () => {
    expect(resolveContainerClasses()).toBe(CONTAINER_CLASSES_DEFAULT);
    expect(resolveContainerClasses('default')).toBe(CONTAINER_CLASSES_DEFAULT);
  });

  it("resolveContainerClasses('compact') returns the compact variant", () => {
    expect(resolveContainerClasses('compact')).toBe(CONTAINER_CLASSES_COMPACT);
  });
});

describe('itemRowHelpers — existing resolvers (regression guard)', () => {
  it('resolveTitleClasses respects struck=true', () => {
    const cls = resolveTitleClasses({ struck: true });
    expect(cls).toContain('line-through');
    expect(cls).toContain('opacity-50');
  });

  it('resolveCheckboxBoxClasses applies brand bg when checked', () => {
    const cls = resolveCheckboxBoxClasses({ checked: true });
    expect(cls).toContain('bg-brand');
  });
});

describe('ItemRow — size prop wires container classes', () => {
  it('defaults to default density (py-3) when size is omitted', () => {
    const tree = ItemRow({
      leading: { kind: 'icon', name: 'cube' as any },
      title: 'Milk',
    });
    // The outer Container is the root element.
    expect(typeof tree).toBe('object');
    const root = tree as AnyEl;
    expect(root.props.className).toContain('py-3');
    expect(root.props.className).not.toContain('py-2');
  });

  it("uses compact density (py-2) when size='compact'", () => {
    const tree = ItemRow({
      leading: { kind: 'icon', name: 'cube' as any },
      title: 'Milk',
      size: 'compact',
    });
    const root = tree as AnyEl;
    expect(root.props.className).toContain('py-2');
    expect(root.props.className).not.toContain('py-3');
  });

  it('still renders the title when compact', () => {
    const tree = ItemRow({
      leading: { kind: 'icon', name: 'cube' as any },
      title: 'Milk',
      size: 'compact',
    });
    const titles = flatten(tree).filter((el) => el.props.children === 'Milk');
    expect(titles.length).toBeGreaterThan(0);
  });
});
