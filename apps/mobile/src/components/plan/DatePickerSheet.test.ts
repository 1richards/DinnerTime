/**
 * Phase 22 Wave 0 — DatePickerSheet primitive tests.
 *
 * The sheet is a stateful React component that wraps
 * @react-native-community/datetimepicker's inline calendar. Vitest under
 * node env can't mount the real React Native renderer, so we test the
 * pure helpers (todayUtcMidnight, addDays, toIso) — which carry the
 * contract guarantees — plus the module exports.
 *
 * The visual/interactive behavior is covered by Maestro flow 31
 * (.maestro/31-addtoplan-datepicker.yaml) which downstream plan 22-01
 * fills in.
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the native module before import — its autolinked native binding
// can't load under vitest.
vi.mock('@react-native-community/datetimepicker', () => ({
  default: (_props: unknown) => null,
}));

import {
  DatePickerSheet,
  todayUtcMidnight,
  addDays,
  toIso,
} from './DatePickerSheet';

describe('DatePickerSheet — pure helpers', () => {
  it('todayUtcMidnight returns a Date at UTC 00:00:00', () => {
    const t = todayUtcMidnight();
    expect(t).toBeInstanceOf(Date);
    expect(t.getUTCHours()).toBe(0);
    expect(t.getUTCMinutes()).toBe(0);
    expect(t.getUTCSeconds()).toBe(0);
    expect(t.getUTCMilliseconds()).toBe(0);
  });

  it('todayUtcMidnight matches today (UTC) to the day', () => {
    const now = new Date();
    const t = todayUtcMidnight();
    expect(t.getUTCFullYear()).toBe(now.getUTCFullYear());
    expect(t.getUTCMonth()).toBe(now.getUTCMonth());
    expect(t.getUTCDate()).toBe(now.getUTCDate());
  });

  it('addDays advances by N days without mutating input', () => {
    const start = new Date('2026-05-01T00:00:00Z');
    const plus10 = addDays(start, 10);
    expect(toIso(plus10)).toBe('2026-05-11');
    // input untouched
    expect(toIso(start)).toBe('2026-05-01');
  });

  it('addDays negative days goes backwards', () => {
    const start = new Date('2026-05-15T00:00:00Z');
    expect(toIso(addDays(start, -14))).toBe('2026-05-01');
  });

  it('toIso emits a 10-char YYYY-MM-DD string', () => {
    expect(toIso(new Date('2026-05-14T12:34:56Z'))).toBe('2026-05-14');
    expect(toIso(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01-01');
    expect(toIso(new Date('2026-12-31T23:59:59Z')).length).toBe(10);
  });

  it('default maximumDate derivation: today+60d is a valid ISO date', () => {
    const max = addDays(todayUtcMidnight(), 60);
    const iso = toIso(max);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 60 days ahead is 60 days later in UTC.
    const diffMs = max.getTime() - todayUtcMidnight().getTime();
    expect(Math.round(diffMs / 86_400_000)).toBe(60);
  });

  it('default maximumDate is always > default minimumDate (bounds sane)', () => {
    const min = addDays(todayUtcMidnight(), -60);
    const max = addDays(todayUtcMidnight(), 60);
    expect(max.getTime()).toBeGreaterThan(min.getTime());
  });
});

describe('DatePickerSheet — module shape', () => {
  it('exports a function-component named DatePickerSheet', () => {
    expect(typeof DatePickerSheet).toBe('function');
    expect(DatePickerSheet.name).toBe('DatePickerSheet');
  });
});
