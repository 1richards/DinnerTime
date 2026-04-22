/**
 * Red test stub (Phase 23 Wave 0) — component ships in 23-05.
 *
 * Imports `../NetworkErrorBanner.js` which DOES NOT YET EXIST. Vitest will
 * report "Cannot find module '../NetworkErrorBanner.js'" — that is the red
 * signal.
 *
 * Wave 2 ships `apps/mobile/src/components/NetworkErrorBanner.tsx`:
 *   export function NetworkErrorBanner(props: {
 *     error: Error | null;
 *     onRetry?: () => void;
 *   }): JSX.Element | null;
 *   export function classifyNetworkError(
 *     err: unknown,
 *   ): 'offline' | 'timeout' | 'rate_limit' | 'server' | 'unknown';
 *
 * Requirement: NFR-13 (network errors + retry).
 */
import { describe, it, expect, vi } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-05)
const { NetworkErrorBanner, classifyNetworkError } = await import('../NetworkErrorBanner.js');

function walk(el: any, visit: (node: any) => void) {
  if (el == null || typeof el !== 'object') return;
  visit(el);
  if (typeof el.type === 'function') {
    try {
      const out = el.type(el.props);
      walk(out, visit);
    } catch {
      /* hook boundary */
    }
  }
  const kids = el.props?.children;
  if (Array.isArray(kids)) for (const k of kids) walk(k, visit);
  else if (kids) walk(kids, visit);
}

describe('classifyNetworkError', () => {
  it("returns 'offline' when error message mentions Network request failed", () => {
    expect(classifyNetworkError(new Error('Network request failed'))).toBe('offline');
  });

  it("returns 'timeout' for AbortError", () => {
    const err = new Error('The operation was aborted');
    (err as any).name = 'AbortError';
    expect(classifyNetworkError(err)).toBe('timeout');
  });

  it("returns 'rate_limit' when status is 429", () => {
    expect(classifyNetworkError({ status: 429 })).toBe('rate_limit');
  });

  it("returns 'server' for 5xx", () => {
    expect(classifyNetworkError({ status: 503 })).toBe('server');
  });

  it("returns 'unknown' for everything else", () => {
    expect(classifyNetworkError('who knows')).toBe('unknown');
  });
});

describe('NetworkErrorBanner', () => {
  it('returns null when error is null', () => {
    const out = NetworkErrorBanner({ error: null });
    expect(out).toBeNull();
  });

  it("renders 'offline' copy when classifyNetworkError says 'offline'", () => {
    const err = new Error('Network request failed');
    const tree: any = NetworkErrorBanner({ error: err });
    const strings: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c)) for (const x of c) if (typeof x === 'string') strings.push(x);
    });
    expect(strings.some((s) => /offline/i.test(s))).toBe(true);
  });

  it("renders 'busy' copy when error is rate_limit", () => {
    const err = { status: 429 };
    const tree: any = NetworkErrorBanner({ error: err as any });
    const strings: string[] = [];
    walk(tree, (n) => {
      const c = n.props?.children;
      if (typeof c === 'string') strings.push(c);
      else if (Array.isArray(c)) for (const x of c) if (typeof x === 'string') strings.push(x);
    });
    expect(strings.some((s) => /busy|rate|too many/i.test(s))).toBe(true);
  });

  it('fires onRetry callback when retry button pressed', () => {
    const onRetry = vi.fn();
    const err = new Error('Network request failed');
    const tree: any = NetworkErrorBanner({ error: err, onRetry });

    let retryPress: ((...a: unknown[]) => unknown) | undefined;
    walk(tree, (n) => {
      const c = n.props?.children;
      const text =
        typeof c === 'string'
          ? c
          : Array.isArray(c)
          ? c.find((x) => typeof x === 'string')
          : undefined;
      if (typeof text === 'string' && /retry|try again/i.test(text) && typeof n.props?.onPress === 'function') {
        retryPress = n.props.onPress;
      }
    });
    expect(retryPress).toBeTypeOf('function');
    (retryPress as any)();
    expect(onRetry).toHaveBeenCalled();
  });
});
