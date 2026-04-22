/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../CommandToast` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-05 (voice-command confirmation toast).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactElement } from 'react';

// @ts-expect-error — component does not exist yet (Wave 0 red stub; shipped 16-05)
import { CommandToast } from '../CommandToast';

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

describe('CommandToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the message text', () => {
    const tree = CommandToast({
      message: 'Next step',
      id: 't-1',
      onClear: vi.fn(),
    });
    const hit = flatten(tree).some((el) => el.props.children === 'Next step');
    expect(hit).toBe(true);
  });

  it('marks the toast root with accessibilityLiveRegion="polite"', () => {
    const tree = CommandToast({
      message: 'Repeating',
      id: 't-2',
      onClear: vi.fn(),
    });
    const withLive = flatten(tree).find(
      (el) => el.props.accessibilityLiveRegion === 'polite'
    );
    expect(withLive).toBeDefined();
  });

  it('uses Phase 19 tokens — no hardcoded hex', () => {
    const tree = CommandToast({
      message: 'Next step',
      id: 't-1',
      onClear: vi.fn(),
    });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\b(bg-surface|bg-bg)\b/);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('auto-clears by calling onClear after 1.5s (via internal timer)', async () => {
    // Functional components cannot be invoked directly for effect timing.
    // We assert the shipped component owns the 1500ms timer by rendering,
    // advancing, and expecting onClear to fire. In Wave 0 the import is
    // undefined so this case is red; Wave 1 flips it green.
    const onClear = vi.fn();
    CommandToast({
      message: 'Next step',
      id: 't-1',
      onClear,
    });
    await vi.advanceTimersByTimeAsync(1_500);
    // NOTE: this is a Wave-0 contract — the green implementation must fire.
    expect(onClear).toHaveBeenCalled();
  });
});
