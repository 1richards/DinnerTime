/**
 * Red test stub (Phase 23 Wave 0) — module ships in 23-06.
 *
 * Imports `../sentry.js` which DOES NOT YET EXIST. Vitest will report
 * "Cannot find module '../sentry.js'" — that is the red signal.
 *
 * Wave 2 ships `apps/mobile/src/lib/sentry.ts`:
 *   export function initSentry(dsn: string | undefined): void;
 *   export function setSentryUser(userId: string | null): void;
 *   export function captureBreadcrumb(
 *     category: string,
 *     message: string,
 *     data?: Record<string, unknown>,
 *   ): void;
 *   export function captureException(err: unknown, context?: unknown): void;
 *
 * Requirement: NFR-15 (Sentry error reporting).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { sentry } = vi.hoisted(() => ({
  sentry: {
    init: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
    captureException: vi.fn(),
    withScope: vi.fn((cb: (scope: { setUser: (u: unknown) => void }) => void) =>
      cb({ setUser: vi.fn() }),
    ),
  },
}));

vi.mock('@sentry/react-native', () => sentry);

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-06)
const { initSentry, setSentryUser, captureBreadcrumb, captureException } =
  await import('../sentry.js');

describe('initSentry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when DSN is undefined (dev without Sentry)', () => {
    initSentry(undefined);
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('is a no-op when DSN is empty string', () => {
    initSentry('');
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it('calls Sentry.init with the DSN when provided', () => {
    initSentry('https://public@example.ingest.sentry.io/123');
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const call = sentry.init.mock.calls[0][0];
    expect(call.dsn).toBe('https://public@example.ingest.sentry.io/123');
  });
});

describe('setSentryUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Sentry.setUser with { id } when userId is a string', () => {
    setSentryUser('user-123');
    expect(sentry.setUser).toHaveBeenCalledWith({ id: 'user-123' });
  });

  it('calls Sentry.setUser(null) to clear the user on sign-out', () => {
    setSentryUser(null);
    expect(sentry.setUser).toHaveBeenCalledWith(null);
  });
});

describe('captureBreadcrumb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a breadcrumb with category + message + optional data', () => {
    captureBreadcrumb('nav', 'Entered plan tab', { from: 'home' });
    expect(sentry.addBreadcrumb).toHaveBeenCalledTimes(1);
    const call = sentry.addBreadcrumb.mock.calls[0][0];
    expect(call.category).toBe('nav');
    expect(call.message).toBe('Entered plan tab');
    expect(call.data).toEqual({ from: 'home' });
  });
});

describe('captureException', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards to Sentry.captureException', () => {
    const err = new Error('boom');
    captureException(err);
    expect(sentry.captureException).toHaveBeenCalled();
  });
});
