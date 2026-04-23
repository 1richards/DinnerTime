/**
 * TDD RED — classifier pure helper for Phase 23-05 (NFR-13).
 *
 * Verifies that `classifyWithNetwork(err, isOnline)` is a pure, test-injectable
 * function with deterministic precedence. `classifyNetworkError(err)` is the
 * store-reading wrapper — exported for app consumers but not exercised here so
 * these tests stay free of Zustand initialization.
 *
 * Precedence (highest → lowest):
 *   1. offline  — TypeError with "network" in message, OR isOnline === false
 *   2. rate_limit — err.status === 429
 *   3. timeout — err.status === 408 OR err.name === 'AbortError'
 *   4. server — 500 ≤ err.status ≤ 599
 *   5. unknown — default fallback
 */
import { describe, it, expect } from 'vitest';

import { classifyWithNetwork } from '../classifyNetworkError.js';

describe('classifyWithNetwork', () => {
  it("returns 'offline' when isOnline=false, regardless of error shape", () => {
    expect(classifyWithNetwork({ status: 429 }, false)).toBe('offline');
  });

  it("returns 'offline' for TypeError with /network/i in message", () => {
    const err = new TypeError('Network request failed');
    expect(classifyWithNetwork(err, true)).toBe('offline');
  });

  it("returns 'rate_limit' when status is 429 and isOnline=true", () => {
    expect(classifyWithNetwork({ status: 429 }, true)).toBe('rate_limit');
  });

  it("returns 'timeout' for status 408", () => {
    expect(classifyWithNetwork({ status: 408 }, true)).toBe('timeout');
  });

  it("returns 'timeout' for AbortError", () => {
    const err = new Error('aborted');
    (err as Error & { name: string }).name = 'AbortError';
    expect(classifyWithNetwork(err, true)).toBe('timeout');
  });

  it("returns 'server' for 5xx status", () => {
    expect(classifyWithNetwork({ status: 503 }, true)).toBe('server');
  });

  it("returns 'unknown' for string/object with no recognizable shape", () => {
    expect(classifyWithNetwork('who knows', true)).toBe('unknown');
    expect(classifyWithNetwork({}, true)).toBe('unknown');
  });

  it('precedence: offline wins over rate_limit even when status=429', () => {
    expect(classifyWithNetwork({ status: 429 }, false)).toBe('offline');
  });
});
