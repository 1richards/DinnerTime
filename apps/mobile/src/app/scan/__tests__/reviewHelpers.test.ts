import { describe, it, expect } from 'vitest';
import { deriveOverrideEvents } from '../reviewHelpers';
import type { ReviewItem } from '../../../types/pantry';

function makeItem(overrides: Partial<ReviewItem>): ReviewItem {
  return {
    id: 'review-x',
    name: 'Sample',
    quantity: 1,
    unit: 'ea',
    confidence: 0.9,
    category: 'other',
    source_location: 'pantry',
    aiLocation: 'pantry',
    accepted: true,
    userEdited: false,
    ...overrides,
  };
}

describe('deriveOverrideEvents', () => {
  it('returns [] when no items were edited', () => {
    const items = [
      makeItem({ id: 'a', userEdited: false }),
      makeItem({ id: 'b', userEdited: false }),
    ];
    expect(deriveOverrideEvents(items)).toEqual([]);
  });

  it('filters out items where userEdited is false even if location differs', () => {
    const items = [
      makeItem({
        id: 'a',
        userEdited: false,
        source_location: 'fridge',
        aiLocation: 'pantry',
      }),
    ];
    expect(deriveOverrideEvents(items)).toEqual([]);
  });

  it('filters out items where aiLocation is missing (manual-add items)', () => {
    const items = [
      makeItem({
        id: 'a',
        userEdited: true,
        source_location: 'fridge',
        aiLocation: undefined,
      }),
    ];
    expect(deriveOverrideEvents(items)).toEqual([]);
  });

  it('filters out no-op edits where source_location === aiLocation', () => {
    const items = [
      makeItem({
        id: 'a',
        userEdited: true,
        source_location: 'pantry',
        aiLocation: 'pantry',
      }),
    ];
    expect(deriveOverrideEvents(items)).toEqual([]);
  });

  it('emits one event per edited item with lowercased-trimmed item_name', () => {
    const items = [
      makeItem({
        id: 'a',
        name: '  Olive Oil  ',
        userEdited: true,
        source_location: 'pantry',
        aiLocation: 'fridge',
      }),
    ];
    expect(deriveOverrideEvents(items)).toEqual([
      { item_name: 'olive oil', ai_location: 'fridge', user_location: 'pantry' },
    ]);
  });

  it('handles multiple edited items preserving their individual ai/user pairs', () => {
    const items = [
      makeItem({
        id: 'a',
        name: 'butter',
        userEdited: true,
        source_location: 'fridge',
        aiLocation: 'pantry',
      }),
      makeItem({
        id: 'b',
        name: 'ice cream',
        userEdited: true,
        source_location: 'freezer',
        aiLocation: 'fridge',
      }),
      makeItem({ id: 'c', userEdited: false }), // should be filtered out
    ];
    expect(deriveOverrideEvents(items)).toEqual([
      { item_name: 'butter', ai_location: 'pantry', user_location: 'fridge' },
      { item_name: 'ice cream', ai_location: 'fridge', user_location: 'freezer' },
    ]);
  });
});
