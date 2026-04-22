/**
 * Phase 20 Wave 0 shared test fixture.
 *
 * 4 shopping-list items across 2 categories (produce + protein), 1 checked +
 * 3 unchecked, every row carrying quantity+unit. Shape mirrors the Phase 8
 * `ShoppingList` / `ShoppingListItem` types exactly — do NOT invent fields.
 *
 * Consumers:
 *   - HandoffSheet.test.tsx (success state item-count assertion)
 *   - shopping/__tests__/telemetry.test.ts (payload sanitizer item_count key)
 *   - future 20-01/20-02/20-03 wave tests that need a realistic list snapshot
 */
import type { ShoppingList, ShoppingListItem } from '../../types/shopping';

export interface FixtureShoppingList {
  list: ShoppingList;
  items: ShoppingListItem[];
}

export function makeFixtureList(): FixtureShoppingList {
  const list: ShoppingList = {
    id: 'list-fixture-20',
    profile_id: 'user-fixture-20',
    meal_plan_id: 'plan-fixture-20',
    title: 'DinnerTime — week of Apr 20',
    generated_at: '2026-04-20T10:00:00Z',
    created_at: '2026-04-20T10:00:00Z',
    updated_at: '2026-04-20T10:00:00Z',
  };

  const items: ShoppingListItem[] = [
    {
      id: 'item-fixture-1',
      shopping_list_id: list.id,
      name: 'chicken thighs',
      normalized_name: 'chicken thighs',
      quantity: 2,
      unit: 'pound',
      category: 'protein',
      sources: ['recipe-chicken-rice'],
      checked: false,
      user_added: false,
      created_at: '2026-04-20T10:00:01Z',
    },
    {
      id: 'item-fixture-2',
      shopping_list_id: list.id,
      name: 'yellow onion',
      normalized_name: 'yellow onion',
      quantity: 1,
      unit: 'each',
      category: 'produce',
      sources: ['recipe-chicken-rice', 'recipe-tacos'],
      checked: false,
      user_added: false,
      created_at: '2026-04-20T10:00:02Z',
    },
    {
      id: 'item-fixture-3',
      shopping_list_id: list.id,
      name: 'garlic',
      normalized_name: 'garlic',
      quantity: 1,
      unit: 'head',
      category: 'produce',
      sources: ['recipe-chicken-rice'],
      checked: true,
      user_added: false,
      created_at: '2026-04-20T10:00:03Z',
    },
    {
      id: 'item-fixture-4',
      shopping_list_id: list.id,
      name: 'ground beef',
      normalized_name: 'ground beef',
      quantity: 1,
      unit: 'pound',
      category: 'protein',
      sources: ['recipe-tacos'],
      checked: false,
      user_added: false,
      created_at: '2026-04-20T10:00:04Z',
    },
  ];

  return { list, items };
}
