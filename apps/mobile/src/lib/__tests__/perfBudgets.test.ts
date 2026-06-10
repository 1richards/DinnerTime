/**
 * TDD RED — perfBudgets helper for Phase 23-08 (NFR-18..21).
 *
 * Contract:
 *   - Named budget constants exported as numbers (see file).
 *   - `withBudget(name, budgetMs, fn)` is an async wrapper that:
 *       1. returns fn()'s resolved value unchanged
 *       2. warns when fn() exceeds budgetMs (dev only)
 *       3. does NOT warn when fn() is within budget
 *
 * Lazy-require of ../sentry keeps the native bridge out of the perf hot path —
 * tests below mock sentry via vi.mock to verify the breadcrumb call when over
 * budget.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { sentryMock } = vi.hoisted(() => ({
  sentryMock: {
    captureBreadcrumb: vi.fn(),
  },
}));

vi.mock('../sentry', () => sentryMock);

// Dynamic import AFTER the mock is registered so the lazy require() inside
// withBudget picks up the test mock.
import {
  STARTUP_COLD_MS,
  TAB_SWITCH_MS,
  SCAN_FEEDBACK_MS,
  SCAN_COMPLETE_MS,
  RECEIPT_COMPLETE_MS,
  IMAGE_MAX_MB,
  RECIPE_LOAD_MS,
  withBudget,
} from '../perfBudgets.js';

describe('perfBudgets constants (NFR-18..21)', () => {
  it('exports numeric budgets matching the 23-08 plan', () => {
    expect(STARTUP_COLD_MS).toBe(2000);
    expect(TAB_SWITCH_MS).toBe(16);
    expect(SCAN_FEEDBACK_MS).toBe(500);
    expect(SCAN_COMPLETE_MS).toBe(6000);
    expect(RECEIPT_COMPLETE_MS).toBe(8000);
    expect(IMAGE_MAX_MB).toBe(5);
  });

  // Phase 28 (T3): cold Recipe Box list-fetch budget.
  it('exports RECIPE_LOAD_MS as the 3.5s recipe-fetch ceiling', () => {
    expect(typeof RECIPE_LOAD_MS).toBe('number');
    expect(RECIPE_LOAD_MS).toBe(3500);
  });
});

describe('withBudget recipe.fetch (Phase 28 T3)', () => {
  it("returns the timed fn's resolved value unchanged", async () => {
    const out = await withBudget('recipe.fetch', RECIPE_LOAD_MS, async () => ({
      data: [1, 2, 3],
    }));
    expect(out).toEqual({ data: [1, 2, 3] });
  });
});

describe('withBudget', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // __DEV__ is a React Native global — default to true so warn path runs.
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns fn()s resolved value unchanged', async () => {
    const result = await withBudget('test', 1000, async () => 42);
    expect(result).toBe(42);
  });

  it('warns + records a sentry breadcrumb when fn() exceeds the budget', async () => {
    await withBudget('slow-op', 1, async () => {
      // Busy-wait just past 1ms so Date.now() diff is deterministic.
      const t0 = Date.now();
      while (Date.now() - t0 < 5) {
        // spin
      }
      return 'done';
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnMsg = warnSpy.mock.calls[0]?.[0] as string;
    expect(warnMsg).toContain('slow-op');
    expect(warnMsg).toContain('budget 1ms');
    expect(sentryMock.captureBreadcrumb).toHaveBeenCalledTimes(1);
    const [category, message, data] = sentryMock.captureBreadcrumb.mock
      .calls[0] as [string, string, Record<string, unknown>];
    expect(category).toBe('perf');
    expect(message).toMatch(/slow-op:over_budget/);
    expect(data).toMatchObject({ budget_ms: 1 });
    expect(typeof data.ms).toBe('number');
  });

  it('does NOT warn when fn() completes within budget', async () => {
    const result = await withBudget('fast-op', 60_000, async () => 'ok');
    expect(result).toBe('ok');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(sentryMock.captureBreadcrumb).not.toHaveBeenCalled();
  });
});
