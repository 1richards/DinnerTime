/**
 * Parity + shape guard for the Phase 19 design-token foundation.
 *
 * Layers covered:
 *   1. global.css <-> tokens.ts — every --color-* RGB maps to matching hex.
 *   2. tailwind.config.js shape — every semantic color, fontSize, borderRadius
 *      key present (text parse only; we do NOT `require()` tailwind.config.js
 *      because its `nativewind/preset` import doesn't resolve outside Metro's
 *      module graph and produces false REDs here).
 *   3. typography shape — 5 keys, positive numerics.
 *   4. spacing/radius — exact 8pt grid + canonical radius names.
 *
 * Why vitest/node is OK here: src/design is node-pure (no RN imports). The
 * vitest.config.ts exclude list is 'src/components/!(ui)/**' and does NOT touch
 * src/design, so these tests pick up under the default node env.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { colors, typography, spacing, radius } from './tokens';

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

function kebabToCamel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

describe('design tokens parity (global.css <-> tokens.ts)', () => {
  const cssPath = join(__dirname, '..', 'global.css');
  const css = readFileSync(cssPath, 'utf-8');
  // Only parse the active :root block — the dark-mode block is commented out
  // but we strip block comments defensively so we never match values inside one.
  const cssActive = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const varRegex = /--color-([a-z-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g;
  const cssVars: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = varRegex.exec(cssActive))) {
    cssVars[kebabToCamel(m[1])] = rgbToHex(+m[2], +m[3], +m[4]);
  }

  it('parses at least one --color-* declaration from global.css', () => {
    expect(Object.keys(cssVars).length).toBeGreaterThan(0);
  });

  it('every global.css --color-* has a matching tokens.ts colors entry with same hex', () => {
    for (const [name, hex] of Object.entries(cssVars)) {
      expect(colors).toHaveProperty(name);
      expect((colors as Record<string, string>)[name].toUpperCase()).toBe(hex);
    }
  });

  it('every tokens.ts colors entry has a matching global.css --color-*', () => {
    for (const name of Object.keys(colors)) {
      expect(cssVars).toHaveProperty(name);
    }
  });
});

describe('tailwind.config.js shape (text parse — no require)', () => {
  const twPath = join(__dirname, '..', '..', 'tailwind.config.js');
  const src = readFileSync(twPath, 'utf-8');

  const requiredColors = [
    'brand',
    'brand-pressed',
    'bg',
    'surface',
    'surface-subtle',
    'text-primary',
    'text-secondary',
    'text-tertiary',
    'success',
    'warning',
    'destructive',
    'info',
    'border',
    'border-subtle',
  ];
  const requiredFontSize = ['display', 'title', 'body', 'caption', 'label'];
  const requiredRadius = ['button', 'card', 'chip', 'pill'];

  it.each(requiredColors)('tailwind extends color token: %s', (name) => {
    // Accept bare or quoted key forms: `brand:` or `'brand-pressed':`
    const keyPattern = new RegExp(
      `(['"\`]?)${name}\\1\\s*:\\s*['"\`]rgb\\(var\\(--color-${name}\\)`,
    );
    expect(src).toMatch(keyPattern);
  });

  it.each(requiredFontSize)('tailwind extends fontSize token: %s', (name) => {
    expect(src).toMatch(new RegExp(`${name}\\s*:\\s*\\[`));
  });

  it.each(requiredRadius)('tailwind extends borderRadius token: %s', (name) => {
    expect(src).toMatch(new RegExp(`${name}\\s*:\\s*['"\`]`));
  });
});

describe('typography scale shape', () => {
  it('has 5 expected keys (display, title, body, caption, label)', () => {
    expect(Object.keys(typography).sort()).toEqual([
      'body',
      'caption',
      'display',
      'label',
      'title',
    ]);
  });

  it('every step has positive fontSize and lineHeight', () => {
    for (const t of Object.values(typography)) {
      expect(t.fontSize).toBeGreaterThan(0);
      expect(t.lineHeight).toBeGreaterThan(0);
    }
  });
});

describe('spacing + radius', () => {
  it('spacing follows 8pt grid: 4/8/12/16/24/32/48', () => {
    expect(spacing).toEqual({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48 });
  });

  it('radius exposes button/card/chip/pill', () => {
    expect(Object.keys(radius).sort()).toEqual(['button', 'card', 'chip', 'pill']);
  });
});
