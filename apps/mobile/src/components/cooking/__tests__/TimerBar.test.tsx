/**
 * Red test stub (Phase 16 Wave 0) — TimerBar is RETOKENED in 16-03.
 *
 * Unlike the other component tests, `../TimerBar` DOES exist today. This
 * test file asserts the Phase 16 retoken contract. Because the current
 * implementation still ships the hardcoded `#C2410C` and pre-Phase-19 sizes,
 * these assertions fail RED against HEAD. Wave 2 (plan 16-03) retokens to
 * satisfy them.
 *
 * Requirement: COOK-UX-03 (Phase 19 token adoption) + COOK-UX-04 (T-10s warn).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// Mock expo-symbols so the TimerBar import chain doesn't pull in
// expo-modules-core (which references the RN-only `__DEV__` global).
vi.mock('expo-symbols', () => ({
  SymbolView: (_props: unknown) => null,
}));

import TimerBar from '../TimerBar';

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

function collectStyles(tree: AnyEl): string {
  return flatten(tree)
    .map((el) => (el.props.style ? JSON.stringify(el.props.style) : ''))
    .join(' ');
}

describe('TimerBar — Phase 16 retoken contract', () => {
  it('no hardcoded #C2410C anywhere (className OR inline style)', () => {
    const tree = TimerBar({
      timers: [
        { id: 't1', label: '5 min', endsAt: Date.now() + 300_000, remainingMs: 300_000 },
      ],
      onCancel: () => {},
    });
    const classes = collectClassNames(tree);
    const styles = collectStyles(tree);
    expect(classes).not.toMatch(/#C2410C/i);
    expect(styles).not.toMatch(/#C2410C/i);
  });

  it('uses Phase 19 token keywords (brand or brandPressed) for accent surfaces', () => {
    const tree = TimerBar({
      timers: [
        { id: 't1', label: '5 min', endsAt: Date.now() + 300_000, remainingMs: 300_000 },
      ],
      onCancel: () => {},
    });
    const classes = collectClassNames(tree);
    const styles = collectStyles(tree);
    const combined = `${classes} ${styles}`;
    expect(combined).toMatch(/brand|brandPressed/);
  });

  it('transitions a chip to bg-warning/20 when remainingMs < 10000', () => {
    const tree = TimerBar({
      timers: [
        { id: 't1', label: '5 min', endsAt: Date.now() + 5_000, remainingMs: 5_000 },
      ],
      onCancel: () => {},
    });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\bbg-warning\/20\b/);
  });
});
