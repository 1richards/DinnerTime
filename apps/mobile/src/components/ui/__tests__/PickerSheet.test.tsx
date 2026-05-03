import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { Modal } from 'react-native';

// Mock expo-symbols sentinel so SymbolIcon's SymbolView leaf is identifiable.
// Mirrors SymbolIcon.test.tsx pattern.
const mocks = vi.hoisted(() => ({
  MockSymbolView: (_props: unknown) => null,
}));
vi.mock('expo-symbols', () => ({ SymbolView: mocks.MockSymbolView }));

import { PickerSheet } from '../PickerSheet';

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

/** Find first element whose children prop strictly equals text. */
function findByText(tree: AnyEl, text: string): AnyEl | undefined {
  return flatten(tree).find((el) => el.props.children === text);
}

describe('PickerSheet — Modal binding', () => {
  it('renders a Modal element with visible=true when visible prop is true', () => {
    const tree = PickerSheet({
      visible: true,
      kicker: 'WEEKLY FOCUS',
      title: 'Pick a skill to practice',
      onClose: () => {},
      children: null,
    });
    const modals = flatten(tree).filter((el) => el.type === Modal);
    expect(modals.length).toBe(1);
    expect(modals[0]!.props.visible).toBe(true);
  });

  it('passes visible=false through to the underlying Modal', () => {
    const tree = PickerSheet({
      visible: false,
      kicker: 'REMIX',
      title: 'Some title',
      onClose: () => {},
      children: null,
    });
    const modals = flatten(tree).filter((el) => el.type === Modal);
    expect(modals.length).toBe(1);
    expect(modals[0]!.props.visible).toBe(false);
  });

  it('uses animationType="slide" and presentationStyle="pageSheet"', () => {
    const tree = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      onClose: () => {},
      children: null,
    });
    const modal = flatten(tree).find((el) => el.type === Modal)!;
    expect(modal.props.animationType).toBe('slide');
    expect(modal.props.presentationStyle).toBe('pageSheet');
  });
});

describe('PickerSheet — header', () => {
  it('renders the kicker and title strings from props', () => {
    const tree = PickerSheet({
      visible: true,
      kicker: 'WEEKLY FOCUS',
      title: 'Pick a skill to practice',
      onClose: () => {},
      children: null,
    });
    expect(findByText(tree, 'WEEKLY FOCUS')).toBeDefined();
    expect(findByText(tree, 'Pick a skill to practice')).toBeDefined();
  });

  it('renders subtitle when provided and omits it when undefined', () => {
    const withSubtitle = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      subtitle: 'Some helper copy',
      onClose: () => {},
      children: null,
    });
    expect(findByText(withSubtitle, 'Some helper copy')).toBeDefined();

    const withoutSubtitle = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      onClose: () => {},
      children: null,
    });
    // No leaf element should carry that string as its children prop.
    expect(
      flatten(withoutSubtitle).find((el) => el.props.children === 'Some helper copy'),
    ).toBeUndefined();
  });

  it('invokes onClose when the close button onPress fires', () => {
    const onClose = vi.fn();
    const tree = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      onClose,
      children: null,
    });
    const closeBtn = flatten(tree).find(
      (el) => el.props.accessibilityLabel === 'Close',
    );
    expect(closeBtn).toBeDefined();
    closeBtn!.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('PickerSheet — slot composition', () => {
  it('renders the heroSlot when provided', () => {
    const heroSlot = { type: 'div', props: { children: 'HERO' }, key: null } as unknown as ReactElement;
    const tree = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      onClose: () => {},
      heroSlot,
      children: null,
    });
    expect(findByText(tree, 'HERO')).toBeDefined();
  });

  it('renders the footerSlot when provided', () => {
    const footerSlot = { type: 'div', props: { children: 'FOOTER' }, key: null } as unknown as ReactElement;
    const tree = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      onClose: () => {},
      footerSlot,
      children: null,
    });
    expect(findByText(tree, 'FOOTER')).toBeDefined();
  });

  it('renders children (body grid) verbatim', () => {
    const child = { type: 'div', props: { children: 'GRID-BODY' }, key: null } as unknown as ReactElement;
    const tree = PickerSheet({
      visible: true,
      kicker: 'X',
      title: 'Y',
      onClose: () => {},
      children: child,
    });
    expect(findByText(tree, 'GRID-BODY')).toBeDefined();
  });
});
