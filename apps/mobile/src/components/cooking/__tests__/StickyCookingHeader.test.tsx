/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../StickyCookingHeader` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-04 (sticky timer header) + COOK-UX-05 (voice + Stop).
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';
import { TEST_RECIPE } from '../../../cooking/__fixtures__/recipe';

// @ts-expect-error — component does not exist yet (Wave 0 red stub; shipped 16-05)
import { StickyCookingHeader } from '../StickyCookingHeader';

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

describe('StickyCookingHeader', () => {
  const baseProps = {
    recipe: TEST_RECIPE,
    timers: [],
    voiceEnabled: true,
    listening: false,
    ttsSpeaking: false,
    onExit: vi.fn(),
    onToggleVoice: vi.fn(),
    onStopTTS: vi.fn(),
  };

  it('renders the recipe title', () => {
    const tree = StickyCookingHeader(baseProps);
    const titleHit = flatten(tree).some(
      (el) => el.props.children === TEST_RECIPE.title
    );
    expect(titleHit).toBe(true);
  });

  it('renders the timer chip band only when timers.length > 0', () => {
    const emptyTree = StickyCookingHeader({ ...baseProps, timers: [] });
    const emptyClasses = collectClassNames(emptyTree);
    // With no timers the 48pt timer-chip band must not render (no brand/15 chip surface)
    // (we scan for the chip-specific token; absence confirms no band)

    const withTimers = StickyCookingHeader({
      ...baseProps,
      timers: [{ id: 't1', label: '5 min', endsAt: 0, remainingMs: 300_000 }],
    });
    const withClasses = collectClassNames(withTimers);
    expect(withClasses).toMatch(/\bbg-brand\/15\b/);
    // And confirm the empty variant has fewer of those tokens.
    const withCount = (withClasses.match(/bg-brand\/15/g) ?? []).length;
    const emptyCount = (emptyClasses.match(/bg-brand\/15/g) ?? []).length;
    expect(withCount).toBeGreaterThan(emptyCount);
  });

  it('renders StopTTSButton only when ttsSpeaking=true', () => {
    const quiet = StickyCookingHeader({ ...baseProps, ttsSpeaking: false });
    const quietElements = flatten(quiet);
    const quietStopHit = quietElements.some(
      (el) => el.props.accessibilityLabel === 'Stop reading'
    );
    expect(quietStopHit).toBe(false);

    const speaking = StickyCookingHeader({ ...baseProps, ttsSpeaking: true });
    const speakingElements = flatten(speaking);
    const speakingStopHit = speakingElements.some(
      (el) => el.props.accessibilityLabel === 'Stop reading'
    );
    expect(speakingStopHit).toBe(true);
  });

  it('uses Phase 19 tokens only — no hardcoded hex', () => {
    const tree = StickyCookingHeader({
      ...baseProps,
      timers: [{ id: 't1', label: '5 min', endsAt: 0, remainingMs: 300_000 }],
      ttsSpeaking: true,
    });
    const classes = collectClassNames(tree);
    expect(classes).toMatch(/\b(bg-surface|bg-bg)\b/);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
