/**
 * Red test stub (Phase 20 Wave 0) — component ships in 20-03.
 *
 * Imports `../HandoffSheet` which is currently a stub rendering a single
 * <Text>stub</Text>. Wave 3 (plan 20-03) ships the real three-state sheet:
 *
 *   - kind='sending' → spinner + "Sending to Instacart cart"
 *   - kind='success' → "{n} items added to cart" + "Open in Instacart" primary CTA
 *                      + "View shopping list" secondary + onOpenCart plumbing
 *   - kind='error'   → variant-specific copy + "Try again" retry CTA
 *
 * Uses the Phase 16 / Phase 19 static-inspection pattern (flatten React tree,
 * assert by text / props) — the project does not depend on
 * @testing-library/react-native.
 *
 * Requirements: SHOP-DC-01, SHOP-DC-02, SHOP-DC-06.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

import { HandoffSheet } from '../HandoffSheet';

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

function findText(tree: AnyEl, pattern: RegExp): AnyEl | undefined {
  return flatten(tree).find((el) => {
    const c = el.props.children;
    if (typeof c === 'string') return pattern.test(c);
    if (Array.isArray(c)) {
      return c.some((p) => typeof p === 'string' && pattern.test(p));
    }
    return false;
  });
}

function findByTestId(tree: AnyEl, id: string): AnyEl | undefined {
  return flatten(tree).find((el) => el.props.testID === id);
}

describe('HandoffSheet', () => {
  describe('kind=sending', () => {
    it('renders the "Sending to Instacart cart" copy', () => {
      const tree = HandoffSheet({
        state: { kind: 'sending' },
      }) as AnyEl;
      expect(findText(tree, /Sending to Instacart cart/i)).toBeDefined();
    });

    it('renders a spinner testID (handoff-sending-spinner) OR ActivityIndicator role', () => {
      const tree = HandoffSheet({
        state: { kind: 'sending' },
      }) as AnyEl;
      const byTestId = findByTestId(tree, 'handoff-sending-spinner');
      const byAria = flatten(tree).find(
        (el) => el.props.accessibilityRole === 'progressbar',
      );
      expect(byTestId !== undefined || byAria !== undefined).toBe(true);
    });
  });

  describe('kind=success', () => {
    it('renders "{itemCount} items added to cart" for itemCount=4', () => {
      const tree = HandoffSheet({
        state: {
          kind: 'success',
          url: 'https://www.instacart.com/store/recipes/abc',
          itemCount: 4,
          appInstalled: false,
        },
      }) as AnyEl;
      expect(findText(tree, /4 items added to cart/i)).toBeDefined();
    });

    it('renders a primary CTA labeled "Open in Instacart"', () => {
      const tree = HandoffSheet({
        state: {
          kind: 'success',
          url: 'https://www.instacart.com/store/recipes/abc',
          itemCount: 4,
          appInstalled: true,
        },
      }) as AnyEl;
      expect(findText(tree, /Open in Instacart/i)).toBeDefined();
    });

    it('renders a secondary CTA labeled "View shopping list"', () => {
      const tree = HandoffSheet({
        state: {
          kind: 'success',
          url: 'https://www.instacart.com/store/recipes/abc',
          itemCount: 4,
          appInstalled: false,
        },
      }) as AnyEl;
      expect(findText(tree, /View shopping list/i)).toBeDefined();
    });

    it('primary CTA press invokes onOpenCart prop', () => {
      const onOpenCart = vi.fn();
      const tree = HandoffSheet({
        state: {
          kind: 'success',
          url: 'https://www.instacart.com/store/recipes/abc',
          itemCount: 4,
          appInstalled: false,
        },
        onOpenCart,
      }) as AnyEl;
      // Locate the pressable that owns the "Open in Instacart" label.
      const openLabel = findText(tree, /Open in Instacart/i);
      expect(openLabel).toBeDefined();
      // Walk parents via flattened tree: find any pressable whose subtree
      // includes the label's text.
      const pressable = flatten(tree).find((el) => {
        const isPressable =
          typeof el.props.onPress === 'function' &&
          flatten(el.props.children).some((c) => {
            const txt = c.props.children;
            return (
              (typeof txt === 'string' && /Open in Instacart/i.test(txt)) ||
              (Array.isArray(txt) &&
                txt.some(
                  (p) => typeof p === 'string' && /Open in Instacart/i.test(p),
                ))
            );
          });
        return isPressable;
      });
      expect(pressable).toBeDefined();
      pressable!.props.onPress();
      expect(onOpenCart).toHaveBeenCalledTimes(1);
    });
  });

  describe('kind=error', () => {
    it('variant=network renders retry CTA labeled "Try again" that invokes onRetry', () => {
      const onRetry = vi.fn();
      const tree = HandoffSheet({
        state: { kind: 'error', variant: 'network' },
        onRetry,
      }) as AnyEl;
      const tryAgain = findText(tree, /Try again/i);
      expect(tryAgain).toBeDefined();

      const pressable = flatten(tree).find((el) => {
        if (typeof el.props.onPress !== 'function') return false;
        const kids = flatten(el.props.children);
        return kids.some((c) => {
          const txt = c.props.children;
          return (
            (typeof txt === 'string' && /Try again/i.test(txt)) ||
            (Array.isArray(txt) &&
              txt.some((p) => typeof p === 'string' && /Try again/i.test(p)))
          );
        });
      });
      expect(pressable).toBeDefined();
      pressable!.props.onPress();
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('variant=auth renders distinct copy from variant=network', () => {
      const net = HandoffSheet({
        state: { kind: 'error', variant: 'network' },
      }) as AnyEl;
      const auth = HandoffSheet({
        state: { kind: 'error', variant: 'auth' },
      }) as AnyEl;
      const netText = flatten(net)
        .map((el) =>
          typeof el.props.children === 'string' ? el.props.children : '',
        )
        .join(' ');
      const authText = flatten(auth)
        .map((el) =>
          typeof el.props.children === 'string' ? el.props.children : '',
        )
        .join(' ');
      expect(authText).not.toBe(netText);
      // Auth copy should mention sign-in / authentication.
      expect(authText).toMatch(/sign in|auth|log in|login/i);
    });

    it('variant=instacart_api renders distinct copy from variant=network', () => {
      const net = HandoffSheet({
        state: { kind: 'error', variant: 'network' },
      }) as AnyEl;
      const api = HandoffSheet({
        state: { kind: 'error', variant: 'instacart_api' },
      }) as AnyEl;
      const netText = flatten(net)
        .map((el) =>
          typeof el.props.children === 'string' ? el.props.children : '',
        )
        .join(' ');
      const apiText = flatten(api)
        .map((el) =>
          typeof el.props.children === 'string' ? el.props.children : '',
        )
        .join(' ');
      expect(apiText).not.toBe(netText);
      // API copy should mention Instacart / unavailable / try later.
      expect(apiText).toMatch(/Instacart|unavailable|try|temporar/i);
    });
  });
});
