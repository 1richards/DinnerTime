/**
 * StepNavButtons tests — Done button finale wiring.
 *
 * Static-tree walk pattern (matches HandoffSheet/MonthGrid tests).
 * Covers the contract:
 *   - default render shows Next; Done is hidden.
 *   - disableNext alone keeps the disabled-Next button (back-compat).
 *   - disableNext + onDone swaps in the primary Done button.
 *   - tapping Done calls onDone, not onNext.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

import StepNavButtons from '../StepNavButtons';

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

// Match by NavButton's `label` prop — the static walk stops at the
// NavButton component boundary, so the inner Pressable's
// accessibilityLabel isn't reachable from this tree.
function findByLabel(tree: AnyEl, label: string): AnyEl | undefined {
  return flatten(tree).find((el) => el.props.label === label);
}

describe('StepNavButtons', () => {
  it('renders Next (not Done) when on a non-final step', () => {
    const tree = StepNavButtons({
      onBack: vi.fn(),
      onRepeat: vi.fn(),
      onNext: vi.fn(),
      disableBack: false,
      disableNext: false,
    }) as AnyEl;
    expect(findByLabel(tree, 'Next')).toBeDefined();
    expect(findByLabel(tree, 'Done')).toBeUndefined();
  });

  it('keeps the disabled Next button (no Done) when on the last step but no onDone is wired', () => {
    const tree = StepNavButtons({
      onBack: vi.fn(),
      onRepeat: vi.fn(),
      onNext: vi.fn(),
      disableBack: false,
      disableNext: true,
    }) as AnyEl;
    const nextBtn = findByLabel(tree, 'Next');
    expect(nextBtn).toBeDefined();
    // NavButton receives `disabled` prop directly.
    expect(nextBtn!.props.disabled).toBe(true);
    expect(findByLabel(tree, 'Done')).toBeUndefined();
  });

  it('swaps Next for a primary Done button on the last step when onDone is provided', () => {
    const tree = StepNavButtons({
      onBack: vi.fn(),
      onRepeat: vi.fn(),
      onNext: vi.fn(),
      disableBack: false,
      disableNext: true,
      onDone: vi.fn(),
    }) as AnyEl;
    expect(findByLabel(tree, 'Done')).toBeDefined();
    expect(findByLabel(tree, 'Next')).toBeUndefined();
  });

  it('tapping Done calls onDone, not onNext', () => {
    const onNext = vi.fn();
    const onDone = vi.fn();
    const tree = StepNavButtons({
      onBack: vi.fn(),
      onRepeat: vi.fn(),
      onNext,
      disableBack: false,
      disableNext: true,
      onDone,
    }) as AnyEl;
    const done = findByLabel(tree, 'Done');
    expect(done).toBeDefined();
    done!.props.onPress();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
