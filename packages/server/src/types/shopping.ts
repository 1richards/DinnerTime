export type GroceryCategory =
  | 'produce'
  | 'dairy'
  | 'protein'
  | 'pantry'
  | 'bakery'
  | 'frozen'
  | 'beverages'
  | 'condiments'
  | 'spices'
  | 'other';

export interface ShoppingList {
  id: string;
  profile_id: string;
  meal_plan_id: string | null;
  title: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface ShoppingListItem {
  id: string;
  shopping_list_id: string;
  name: string;
  normalized_name: string;
  quantity: number | null;
  unit: string | null;
  category: GroceryCategory;
  sources: string[];
  checked: boolean;
  user_added: boolean;
  created_at: string;
}

export interface ShoppingOrder {
  id: string;
  profile_id: string;
  shopping_list_id: string | null;
  items_snapshot: InstacartLineItem[];
  instacart_url: string;
  expires_at: string | null;
  placed_at: string;
}

export interface ConsolidatedItem {
  name: string;
  normalizedName: string;
  quantity: number;
  unit: string | null;
  sources: string[];
  category?: GroceryCategory;
}

export interface InstacartLineItem {
  name: string;
  line_item_measurements?: Array<{ quantity: number; unit: string }>;
}

export interface VariationSuggestion {
  instead_of: string;
  swap: string;
  rationale: string;
}
