import React from 'react';
import { View, Text } from 'react-native';
import { ShoppingItemRow } from './ShoppingItemRow';
import type { GroceryCategory, ShoppingListItem } from '../../types/shopping';

interface CategorySectionProps {
  category: GroceryCategory;
  items: ShoppingListItem[];
  onToggle: (id: string) => void;
  onEdit: (
    id: string,
    patch: { name?: string; quantity?: number | null }
  ) => void;
  onDelete: (id: string) => void;
}

const CATEGORY_LABELS: Record<GroceryCategory, string> = {
  produce: 'Produce',
  protein: 'Protein',
  dairy: 'Dairy',
  pantry: 'Pantry',
  bakery: 'Bakery',
  frozen: 'Frozen',
  condiments: 'Condiments',
  spices: 'Spices',
  beverages: 'Beverages',
  other: 'Other',
};

export function CategorySection({
  category,
  items,
  onToggle,
  onEdit,
  onDelete,
}: CategorySectionProps) {
  if (items.length === 0) return null;

  return (
    <View className="mb-1">
      <View className="flex-row items-center justify-between px-4 py-1.5">
        <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wide">
          {CATEGORY_LABELS[category]}
        </Text>
        <Text className="text-xs text-warmGray-400">{items.length}</Text>
      </View>
      <View className="px-3">
        {items.map((item) => (
          <ShoppingItemRow
            key={item.id}
            item={item}
            onToggle={() => onToggle(item.id)}
            onEdit={(patch) => onEdit(item.id, patch)}
            onDelete={() => onDelete(item.id)}
          />
        ))}
      </View>
    </View>
  );
}
