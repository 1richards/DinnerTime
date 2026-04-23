/**
 * Red test stub (Phase 20 Wave 0) — production module ships in 20-01.
 *
 * Imports `../classifyHandoffError` which is currently a stub that always
 * returns 'network'. Wave 1 (plan 20-01) ships the real discriminator:
 *   - TypeError with /network|fetch/i → 'network'
 *   - { status: 5xx }                  → 'instacart_api'
 *   - { status: 401 | 403 }            → 'auth'
 *   - unknown shape                    → 'network' (default)
 *
 * Requirement: SHOP-DC-06 (error classification).
 */
import { describe, it, expect } from 'vitest';

import { classifyHandoffError } from '../classifyHandoffError';

describe('classifyHandoffError', () => {
  it('maps a TypeError mentioning "network" to "network"', () => {
    expect(classifyHandoffError(new TypeError('network request failed'))).toBe(
      'network',
    );
  });

  it('maps a TypeError mentioning "fetch" to "network"', () => {
    expect(classifyHandoffError(new TypeError('failed to fetch'))).toBe(
      'network',
    );
  });

  it('maps { status: 502 } to "instacart_api"', () => {
    expect(classifyHandoffError({ status: 502 })).toBe('instacart_api');
  });

  it('maps { status: 500 } to "instacart_api"', () => {
    expect(classifyHandoffError({ status: 500 })).toBe('instacart_api');
  });

  it('maps { status: 401 } to "auth"', () => {
    expect(classifyHandoffError({ status: 401 })).toBe('auth');
  });

  it('maps { status: 403 } to "auth"', () => {
    expect(classifyHandoffError({ status: 403 })).toBe('auth');
  });

  it('defaults to "network" for unknown shapes', () => {
    expect(classifyHandoffError(undefined)).toBe('network');
    expect(classifyHandoffError({ foo: 'bar' })).toBe('network');
    expect(classifyHandoffError('some string')).toBe('network');
  });
});
