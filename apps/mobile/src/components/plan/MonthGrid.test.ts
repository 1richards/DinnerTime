/**
 * Phase 22-03 — MonthGrid tests.
 *
 * Static JSX-tree walk (mirrors HandoffSheet.test.tsx pattern) — vitest-node
 * can't mount React hooks, but the component's render output is a plain
 * JSX tree we can inspect. Assertions:
 *   - 35 Pressable cells are rendered (or 35 Views in loading=true).
 *   - Day-of-month text rendering is present for the first/last cell.
 *   - The day-header row renders 7 column labels.
 *   - Pressable onPress / onLongPress are wired when loading=false.
 */
import { describe, it, expect, vi } from 'vitest';
import type { ReactElement } from 'react';

import { MonthGrid } from './MonthGrid';
import type { MealPlanEntry } from '../../types/mealPlan';

type AnyEl = ReactElement<any>;

function flatten(node: unknown): AnyEl[] {
  if (node === null || node === undefined || typeof node === 'boolean') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node === 'object' && node !== null && 'props' in (node as AnyEl)) {
    const el = node as AnyEl;
    return [el, ...flatten(el.props.children)];
  }
  return [];
}

const makeEntry = (day: number, overrides: Partial<MealPlanEntry> = {}): MealPlanEntry => ({
  id: `e-${day}`,
  meal_plan_id: 'plan-1',
  day_of_week: day,
  recipe_id: null,
  title: `Day ${day}`,
  description: null,
  ingredients: [],
  ingredients_needed: [],
  estimated_time_minutes: 30,
  difficulty: 'easy',
  kid_friendly: true,
  why_suggested: null,
  status: 'planned',
  cooked_at: null,
  created_at: '2026-05-11T00:00:00Z',
  ...overrides,
});

describe('MonthGrid', () => {
  it('renders a row of 7 day-of-week header labels (M/T/W/T/F/S/S)', () => {
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map(),
    }) as AnyEl;
    const all = flatten(tree);
    // Header labels are Text with single-char string children.
    const headerTexts = all.filter((el) => {
      const c = el.props.children;
      return typeof c === 'string' && /^[MTWFS]$/.test(c);
    });
    // Exactly 7 single-char header labels — M, T, W, T, F, S, S.
    expect(headerTexts).toHaveLength(7);
  });

  it('renders 35 Pressable cells when loading=false', () => {
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map(),
      loading: false,
    }) as AnyEl;
    // Pressable type reference from mock `react-native` is a function.
    // We filter by accessibilityRole="button" to capture cell pressables
    // (not any other elements).
    const pressables = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button'
    );
    expect(pressables).toHaveLength(35);
  });

  it('when loading=true, renders 35 non-Pressable cells (zero button roles)', () => {
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map(),
      loading: true,
    }) as AnyEl;
    const pressables = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button'
    );
    expect(pressables).toHaveLength(0);
  });

  it('first cell displays day-of-month 11 for 2026-05-11', () => {
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map(),
    }) as AnyEl;
    const texts = flatten(tree).filter(
      (el) => typeof el.props.children === 'number'
    );
    // First numeric Text is the day number of the first cell.
    expect(texts[0]!.props.children).toBe(11);
  });

  it('last cell displays day-of-month 14 (June 14) for start 2026-05-11', () => {
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map(),
    }) as AnyEl;
    const texts = flatten(tree).filter(
      (el) => typeof el.props.children === 'number'
    );
    // Last numeric Text is the day number of the 35th cell → 2026-06-14 = 14.
    expect(texts[texts.length - 1]!.props.children).toBe(14);
  });

  it('cells with entries carry accessibilityLabel including status', () => {
    const entry = makeEntry(0, { status: 'cooked' });
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map([['2026-05-11', entry]]),
    }) as AnyEl;
    const pressables = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button'
    );
    const first = pressables[0]!;
    expect(first.props.accessibilityLabel).toMatch(/2026-05-11 cooked/);
  });

  it('invokes onPinCell for empty cell tap', () => {
    const onPinCell = vi.fn();
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map(),
      onPinCell,
    }) as AnyEl;
    const pressables = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button'
    );
    // Tap first cell — it's empty; expect onPinCell called with '2026-05-11'.
    pressables[0]!.props.onPress();
    expect(onPinCell).toHaveBeenCalledWith('2026-05-11');
  });

  it('invokes onEntryPress with the entry when a cell with an entry is tapped', () => {
    const entry = makeEntry(0, { status: 'planned' });
    const onEntryPress = vi.fn();
    const onPinCell = vi.fn();
    const tree = MonthGrid({
      fromWeekStart: '2026-05-11',
      entriesByIso: new Map([['2026-05-11', entry]]),
      onEntryPress,
      onPinCell,
    }) as AnyEl;
    const pressables = flatten(tree).filter(
      (el) => el.props.accessibilityRole === 'button'
    );
    pressables[0]!.props.onPress();
    expect(onEntryPress).toHaveBeenCalledWith(entry);
    expect(onPinCell).not.toHaveBeenCalled();
  });
});
