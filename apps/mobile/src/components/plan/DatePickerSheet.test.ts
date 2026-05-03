/**
 * Phase 22 Wave 0 — DatePickerSheet primitive tests.
 *
 * The sheet is a stateful React component that wraps
 * @react-native-community/datetimepicker's inline calendar. Vitest under
 * node env can't mount the real React Native renderer, so we test the
 * pure helpers (todayLocalMidnight, addDays, toIso) — which carry the
 * contract guarantees — plus the module exports.
 *
 * Helpers operate in **local time** because the iOS native picker
 * interprets value/onChange dates in local time. Tests use the
 * (year, month, day) Date constructor (which is local-time) so they're
 * timezone-independent.
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
  todayLocalMidnight,
  addDays,
  toIso,
} from './DatePickerSheet';

describe('DatePickerSheet — pure helpers', () => {
  it('todayLocalMidnight returns a Date at local 00:00:00', () => {
    const t = todayLocalMidnight();
    expect(t).toBeInstanceOf(Date);
    expect(t.getHours()).toBe(0);
    expect(t.getMinutes()).toBe(0);
    expect(t.getSeconds()).toBe(0);
    expect(t.getMilliseconds()).toBe(0);
  });

  it('todayLocalMidnight matches today (local) to the day', () => {
    const now = new Date();
    const t = todayLocalMidnight();
    expect(t.getFullYear()).toBe(now.getFullYear());
    expect(t.getMonth()).toBe(now.getMonth());
    expect(t.getDate()).toBe(now.getDate());
  });

  it('addDays advances by N days without mutating input', () => {
    const start = new Date(2026, 4, 1); // May 1, 2026 local
    const plus10 = addDays(start, 10);
    expect(toIso(plus10)).toBe('2026-05-11');
    // input untouched
    expect(toIso(start)).toBe('2026-05-01');
  });

  it('addDays negative days goes backwards', () => {
    const start = new Date(2026, 4, 15); // May 15, 2026 local
    expect(toIso(addDays(start, -14))).toBe('2026-05-01');
  });

  it('toIso emits a 10-char YYYY-MM-DD string in local time', () => {
    expect(toIso(new Date(2026, 4, 14, 12, 34, 56))).toBe('2026-05-14');
    expect(toIso(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toIso(new Date(2026, 11, 31, 23, 59, 59)).length).toBe(10);
  });

  it('default maximumDate derivation: today+60d is a valid ISO date', () => {
    const max = addDays(todayLocalMidnight(), 60);
    const iso = toIso(max);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // 60 days ahead is 60 days later (allowing 1h slack for any DST
    // transition crossed in the +60d window).
    const diffMs = max.getTime() - todayLocalMidnight().getTime();
    expect(Math.round(diffMs / 86_400_000)).toBe(60);
  });

  it('default maximumDate is always > default minimumDate (bounds sane)', () => {
    const min = addDays(todayLocalMidnight(), -60);
    const max = addDays(todayLocalMidnight(), 60);
    expect(max.getTime()).toBeGreaterThan(min.getTime());
  });
});

describe('DatePickerSheet — module shape', () => {
  it('exports a function-component named DatePickerSheet', () => {
    expect(typeof DatePickerSheet).toBe('function');
    expect(DatePickerSheet.name).toBe('DatePickerSheet');
  });
});
