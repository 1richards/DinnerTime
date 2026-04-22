/**
 * Red test stub (Phase 23 Wave 0) — component ships in 23-05.
 *
 * Imports `../ErrorBoundary.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../ErrorBoundary.js'" — that is the red signal.
 *
 * Wave 2 ships `apps/mobile/src/components/ErrorBoundary.tsx`:
 *   export class ErrorBoundary extends React.Component<
 *     { children: React.ReactNode },
 *     { error: Error | null }
 *   > {}
 *
 * On error:
 *   - captureException(error) fires via ../lib/sentry.js
 *   - Fallback UI renders "Something went wrong" + "Restart" + "Report issue"
 *
 * Requirement: NFR-13 (global error handling).
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

vi.mock('../../lib/sentry', () => ({
  captureException,
  captureBreadcrumb: vi.fn(),
  initSentry: vi.fn(),
  setSentryUser: vi.fn(),
}));

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-05)
const { ErrorBoundary } = await import('../ErrorBoundary.js');

describe('ErrorBoundary', () => {
  it('renders children when no error has been caught', () => {
    const child = React.createElement('div' as any, null, 'hello');
    const boundary = new (ErrorBoundary as any)({ children: child });
    // Initial state: no error.
    expect(boundary.state?.error ?? null).toBeNull();

    const rendered = boundary.render();
    // Passes through children when error is null.
    expect(rendered).toEqual(child);
  });

  it('renders fallback UI with Restart + Report issue when error is set', () => {
    const child = React.createElement('div' as any, null, 'hello');
    const boundary = new (ErrorBoundary as any)({ children: child });
    boundary.state = { error: new Error('boom') };

    const rendered: any = boundary.render();
    // Walk the rendered tree flattening string children.
    const labels: string[] = [];
    function walk(el: any) {
      if (el == null || typeof el !== 'object') {
        if (typeof el === 'string') labels.push(el);
        return;
      }
      const c = el.props?.children;
      if (typeof c === 'string') labels.push(c);
      else if (Array.isArray(c)) for (const k of c) walk(k);
      else if (c) walk(c);
    }
    walk(rendered);

    expect(labels.some((l) => /something went wrong/i.test(l))).toBe(true);
    expect(labels.some((l) => /restart/i.test(l))).toBe(true);
    expect(labels.some((l) => /report/i.test(l))).toBe(true);
  });

  it('componentDidCatch calls captureException with the error', () => {
    const boundary = new (ErrorBoundary as any)({ children: null });
    const err = new Error('render-boom');
    boundary.componentDidCatch(err, { componentStack: 'stack' });
    expect(captureException).toHaveBeenCalledWith(err, expect.anything());
  });
});
