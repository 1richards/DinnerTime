/**
 * Red test stub (Phase 23 Wave 0) — component ships in 23-01.
 *
 * Imports `../AboutSection.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../AboutSection.js'" — that is the red signal.
 *
 * Wave 1 ships `apps/mobile/src/components/settings/AboutSection.tsx`:
 *   export function AboutSection(): JSX.Element;
 *
 * Renders:
 *   - Version (from Constants.expoConfig.version / app.json extra.version)
 *   - Build number (from native — may be a placeholder in simulator)
 *   - Privacy Policy link → https://dinnertime.app/privacy
 *   - Terms of Service link → https://dinnertime.app/terms
 *   - Support email → mailto:support@dinnertime.app
 *
 * Requirement: NFR-07 / app-store readiness.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
      ios: { buildNumber: '42' },
    },
  },
}));

vi.mock('expo-web-browser', () => ({
  openBrowserAsync: vi.fn(async () => ({ type: 'cancel' })),
}));

const { AboutSection } = await import('../AboutSection.js');

function walk(el: any, visit: (node: any) => void) {
  if (el == null || typeof el !== 'object') return;
  visit(el);
  if (typeof el.type === 'function') {
    try {
      const out = el.type(el.props);
      walk(out, visit);
    } catch {
      /* hook boundary — fall through to children */
    }
  }
  const kids = el.props?.children;
  if (Array.isArray(kids)) for (const k of kids) walk(k, visit);
  else if (kids) walk(kids, visit);
}

describe('AboutSection', () => {
  it('renders version from Constants.expoConfig', () => {
    const tree: any = AboutSection();
    const strings: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c))
        for (const x of c) if (typeof x === 'string') strings.push(x);
    });
    expect(strings.some((s) => s.includes('1.0.0'))).toBe(true);
  });

  it('renders build number from Constants.expoConfig.ios.buildNumber', () => {
    const tree: any = AboutSection();
    const strings: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c))
        for (const x of c) if (typeof x === 'string') strings.push(x);
    });
    expect(strings.some((s) => s.includes('42'))).toBe(true);
  });

  it('renders Privacy Policy and Terms labels', () => {
    const tree: any = AboutSection();
    const strings: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c))
        for (const x of c) if (typeof x === 'string') strings.push(x);
    });
    expect(strings.some((s) => /privacy/i.test(s))).toBe(true);
    expect(strings.some((s) => /terms/i.test(s))).toBe(true);
  });

  it('renders support contact', () => {
    const tree: any = AboutSection();
    const strings: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c))
        for (const x of c) if (typeof x === 'string') strings.push(x);
    });
    // Either support@dinnertime.app or a "Support" row label.
    expect(
      strings.some((s) => /support/i.test(s)) ||
        strings.some((s) => /support@dinnertime\.app/i.test(s)),
    ).toBe(true);
  });
});
