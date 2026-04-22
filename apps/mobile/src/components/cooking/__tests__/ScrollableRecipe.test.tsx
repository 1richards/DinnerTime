/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../ScrollableRecipe` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-03 (Apple-HIG polished UI), COOK-UX-04 (at-a-glance info).
 * Uses the Phase-19 static-inspection pattern (no testing-library).
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { TEST_RECIPE } from '../../../cooking/__fixtures__/recipe';

// @ts-expect-error — component does not exist yet (Wave 0 red stub; shipped 16-05)
import { ScrollableRecipe } from '../ScrollableRecipe';

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

describe('ScrollableRecipe', () => {
  it('renders the recipe title and all ingredient + step sections', () => {
    const tree = ScrollableRecipe({
      recipe: TEST_RECIPE,
      currentStepIndex: 2,
    });
    const elements = flatten(tree);
    // Must surface the recipe title somewhere
    const titleHit = elements.some((el) => el.props.children === TEST_RECIPE.title);
    expect(titleHit).toBe(true);
  });

  it('uses Phase 19 tokens (bg-bg, bg-surface, text-text-primary) — NO hardcoded hex', () => {
    const tree = ScrollableRecipe({
      recipe: TEST_RECIPE,
      currentStepIndex: 0,
    });
    const classes = collectClassNames(tree);
    // Token keywords must appear somewhere
    expect(classes).toMatch(/\bbg-bg\b/);
    expect(classes).toMatch(/\bbg-surface\b/);
    expect(classes).toMatch(/\btext-text-primary\b/);
    // No hardcoded hex color literals allowed in cooking className strings.
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
