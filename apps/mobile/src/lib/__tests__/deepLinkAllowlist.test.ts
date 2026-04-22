/**
 * Red test stub (Phase 23 Wave 0) — module ships in 23-07.
 *
 * Imports `../deepLinkAllowlist.js` which DOES NOT YET EXIST. Vitest will
 * report "Cannot find module '../deepLinkAllowlist.js'" — that is the red
 * signal.
 *
 * Wave 3 ships `apps/mobile/src/lib/deepLinkAllowlist.ts`:
 *   export function isDeepLinkAllowed(url: string): boolean;
 *   export const ALLOWED_DEEP_LINK_PATHS: readonly string[];
 *
 * Accepts:
 *   /recipes/<id>          (view recipe)
 *   /scan/*                (pantry scan deep-link)
 *   /auth/reset-password/* (Supabase email link)
 *   /plan/<iso-date>       (plan day drill-down)
 *
 * Rejects everything else. Handles both dinnertime:// scheme and the
 * exp+dinnertime://expo-development-client/?url=... dev-client form.
 *
 * Requirement: NFR-24 (deep-link allowlist).
 */
import { describe, it, expect } from 'vitest';

// @ts-expect-error — module does not exist yet (Wave 0 red stub; ships in 23-07)
const { isDeepLinkAllowed, ALLOWED_DEEP_LINK_PATHS } = await import('../deepLinkAllowlist.js');

describe('ALLOWED_DEEP_LINK_PATHS', () => {
  it('is a non-empty readonly array of allowed path patterns', () => {
    expect(Array.isArray(ALLOWED_DEEP_LINK_PATHS)).toBe(true);
    expect(ALLOWED_DEEP_LINK_PATHS.length).toBeGreaterThan(0);
  });
});

describe('isDeepLinkAllowed — allowed paths', () => {
  it('allows /recipes/<id>', () => {
    expect(isDeepLinkAllowed('dinnertime:///recipes/123')).toBe(true);
    expect(isDeepLinkAllowed('dinnertime://recipes/abc-uuid')).toBe(true);
  });

  it('allows /scan/review', () => {
    expect(isDeepLinkAllowed('dinnertime://scan/review')).toBe(true);
  });

  it('allows /auth/reset-password/<token>', () => {
    expect(
      isDeepLinkAllowed('dinnertime://auth/reset-password/xyz-token'),
    ).toBe(true);
  });

  it('allows /plan/<iso>', () => {
    expect(isDeepLinkAllowed('dinnertime://plan/2026-05-01')).toBe(true);
  });

  it('tolerates query strings', () => {
    expect(
      isDeepLinkAllowed('dinnertime://recipes/123?source=email'),
    ).toBe(true);
  });
});

describe('isDeepLinkAllowed — rejected paths', () => {
  it('rejects arbitrary unknown paths', () => {
    expect(isDeepLinkAllowed('dinnertime://arbitrary-path')).toBe(false);
  });

  it('rejects javascript: URIs', () => {
    expect(isDeepLinkAllowed('javascript:alert(1)')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isDeepLinkAllowed('')).toBe(false);
  });

  it('rejects hostile nested routes', () => {
    expect(
      isDeepLinkAllowed('dinnertime://recipes/../admin/secrets'),
    ).toBe(false);
  });
});
