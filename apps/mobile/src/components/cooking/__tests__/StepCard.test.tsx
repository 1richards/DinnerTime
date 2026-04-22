/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../StepCard` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-03 (typography + current-step emphasis).
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';

// @ts-expect-error — component does not exist yet (Wave 0 red stub; shipped 16-05)
import { StepCard } from '../StepCard';

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

describe('StepCard', () => {
  const baseProps = {
    stepNumber: 3,
    totalSteps: 7,
    text: 'Add diced onions and cook until translucent.',
  };

  it('when isCurrent=true, uses text-display typography + visible left rail', () => {
    const tree = StepCard({ ...baseProps, isCurrent: true });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\btext-display\b/);
    // Brand left rail renders only when current
    expect(classes).toMatch(/\bbg-brand\b/);
  });

  it('when isCurrent=false, uses text-title typography and NO brand left rail', () => {
    const tree = StepCard({ ...baseProps, isCurrent: false });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\btext-title\b/);
    // No brand rail surface on non-current cards. Accent is reserved.
    expect(classes).not.toMatch(/\bbg-brand\b/);
  });

  it('uses Phase 19 tokens and NO hardcoded hex', () => {
    const tree = StepCard({ ...baseProps, isCurrent: true });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\b(text-text-primary|text-text-secondary)\b/);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
