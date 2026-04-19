/**
 * Phase 21-04 — 4-way pantry grouping (21-CONTEXT ROADMAP #2).
 *
 * Pure grouping helper + thin React hook wrapper. The pure fn `groupPantryItems`
 * is exported separately so vitest can assert over all 4 modes under node env
 * without pulling the React renderer — mirrors the Phase 19-03 `deriveStatusChips`
 * and Phase 24-06 `resolveFieldClass` patterns.
 *
 * Four modes:
 *   - 'location'      → Fridge / Pantry / Freezer sections in canonical order
 *   - 'category'      → One section per FoodCategory, items without a category
 *                       fall into 'Other'
 *   - 'staples'       → Staples / Other (driven by the user's staples Set)
 *   - 'recently-added'→ 'Last 7 days' / 'Older' (cutoff documented as 21-CONTEXT
 *                       Claude's Discretion; default 7, tunable in UAT)
 *
 * Empty sections are omitted so the SectionList doesn't render empty headers.
 */

import { useMemo } from 'react';
import type { EnrichedPantryItem } from './usePantryItems';
import type { SourceLocation } from '../types/pantry';

export type GroupingMode =
  | 'location'
  | 'category'
  | 'staples'
  | 'recently-added';

export interface PantrySection {
  title: string;
  items: EnrichedPantryItem[];
}

/** CONTEXT Claude's Discretion — default 7 days, tune in UAT. */
const RECENT_DAYS = 7;

const LOCATION_ORDER: SourceLocation[] = ['fridge', 'pantry', 'freezer'];
const LOCATION_LABELS: Record<SourceLocation, string> = {
  fridge: 'Fridge',
  pantry: 'Pantry',
  freezer: 'Freezer',
};

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function groupByLocation(items: EnrichedPantryItem[]): PantrySection[] {
  const buckets: Record<SourceLocation, EnrichedPantryItem[]> = {
    fridge: [],
    pantry: [],
    freezer: [],
  };
  for (const item of items) {
    if (item.source_location in buckets) {
      buckets[item.source_location].push(item);
    }
  }
  return LOCATION_ORDER.filter((loc) => buckets[loc].length > 0).map((loc) => ({
    title: LOCATION_LABELS[loc],
    items: buckets[loc],
  }));
}

function groupByCategory(items: EnrichedPantryItem[]): PantrySection[] {
  const buckets = new Map<string, EnrichedPantryItem[]>();
  for (const item of items) {
    const cat = (item.category && String(item.category).trim()) || 'other';
    const list = buckets.get(cat) ?? [];
    list.push(item);
    buckets.set(cat, list);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, list]) => ({
      title: capitalize(cat),
      items: list,
    }));
}

function groupByStaples(
  items: EnrichedPantryItem[],
  staples: Set<string>,
): PantrySection[] {
  const stapleItems: EnrichedPantryItem[] = [];
  const otherItems: EnrichedPantryItem[] = [];
  for (const item of items) {
    if (item.canonical_ingredient_id && staples.has(item.canonical_ingredient_id)) {
      stapleItems.push(item);
    } else {
      otherItems.push(item);
    }
  }
  const sections: PantrySection[] = [];
  if (stapleItems.length > 0) sections.push({ title: 'Staples', items: stapleItems });
  if (otherItems.length > 0) sections.push({ title: 'Other', items: otherItems });
  return sections;
}

function groupByRecentlyAdded(items: EnrichedPantryItem[]): PantrySection[] {
  const cutoffMs = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const recent: EnrichedPantryItem[] = [];
  const older: EnrichedPantryItem[] = [];
  for (const item of items) {
    const seenMs = new Date(item.last_seen_at).getTime();
    if (Number.isFinite(seenMs) && seenMs >= cutoffMs) {
      recent.push(item);
    } else {
      older.push(item);
    }
  }
  const sections: PantrySection[] = [];
  if (recent.length > 0) sections.push({ title: 'Last 7 days', items: recent });
  if (older.length > 0) sections.push({ title: 'Older', items: older });
  return sections;
}

/**
 * Pure grouping dispatcher. Exported for direct unit testing without renderer.
 */
export function groupPantryItems(
  items: EnrichedPantryItem[],
  mode: GroupingMode,
  staples: Set<string>,
): PantrySection[] {
  if (items.length === 0) return [];
  switch (mode) {
    case 'location':
      return groupByLocation(items);
    case 'category':
      return groupByCategory(items);
    case 'staples':
      return groupByStaples(items, staples);
    case 'recently-added':
      return groupByRecentlyAdded(items);
  }
}

/**
 * React hook wrapper. Memoizes grouping output on (items, mode, staples)
 * identity so a parent re-render with the same data doesn't re-scan the list.
 *
 * Note: consumers that mutate the staples Set in-place must hand us a fresh
 * Set reference — standard React immutability contract applies.
 */
export function usePantryItemsGrouped(
  items: EnrichedPantryItem[],
  mode: GroupingMode,
  staples: Set<string>,
): PantrySection[] {
  return useMemo(
    () => groupPantryItems(items, mode, staples),
    [items, mode, staples],
  );
}
