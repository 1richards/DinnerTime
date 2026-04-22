/**
 * Red test stub (Phase 16 Wave 0) — component ships in 16-05.
 *
 * Imports `../VoiceWaveform` which DOES NOT YET EXIST.
 *
 * Requirement: COOK-UX-05 (listening-state indicator).
 * 3 variants: waveform bars (listening), pulse dot (idle+enabled), mic-slash (voice off).
 */
import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';

// @ts-expect-error — component does not exist yet (Wave 0 red stub; shipped 16-05)
import { VoiceWaveform } from '../VoiceWaveform';

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

describe('VoiceWaveform', () => {
  it('renders 3 animated bars when listening=true', () => {
    const tree = VoiceWaveform({ enabled: true, listening: true });
    const bars = flatten(tree).filter(
      (el) =>
        typeof el.props['data-role'] === 'string' &&
        el.props['data-role'] === 'waveform-bar'
    );
    expect(bars.length).toBe(3);
  });

  it('renders a single pulse dot when enabled=true && listening=false', () => {
    const tree = VoiceWaveform({ enabled: true, listening: false });
    const dots = flatten(tree).filter(
      (el) =>
        typeof el.props['data-role'] === 'string' &&
        el.props['data-role'] === 'pulse-dot'
    );
    expect(dots.length).toBe(1);
  });

  it('renders a mic-slash symbol when enabled=false', () => {
    const tree = VoiceWaveform({ enabled: false, listening: false });
    const slashes = flatten(tree).filter(
      (el) =>
        typeof el.props.name === 'string' &&
        el.props.name.includes('mic.slash')
    );
    expect(slashes.length).toBeGreaterThanOrEqual(1);
  });

  it('uses only Phase 19 tokens — no hardcoded hex', () => {
    const tree = VoiceWaveform({ enabled: true, listening: true });
    const classes = collectClassNames(tree);
    expect(classes).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});
