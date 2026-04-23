/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../StopTTSButton` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-05 (TTS interrupt).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

// @ts-expect-error — component does not exist yet (Wave 0 red stub; shipped 16-05)
import { StopTTSButton } from '../StopTTSButton';

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

describe('StopTTSButton', () => {
  it('has accessibilityLabel "Stop reading"', () => {
    const tree = StopTTSButton({ onPress: vi.fn() });
    const hit = flatten(tree).find(
      (el) => el.props.accessibilityLabel === 'Stop reading'
    );
    expect(hit).toBeDefined();
  });

  it('fires onPress when the button is pressed', () => {
    const onPress = vi.fn();
    const tree = StopTTSButton({ onPress });
    const pressable = flatten(tree).find(
      (el) => el.props.accessibilityRole === 'button'
    );
    expect(pressable).toBeDefined();
    pressable!.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses Phase 19 tokens — no hardcoded hex', () => {
    const tree = StopTTSButton({ onPress: vi.fn() });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\bbg-brand\b/);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
