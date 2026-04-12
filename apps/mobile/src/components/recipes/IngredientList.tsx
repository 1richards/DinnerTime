import React from 'react';
import { View, Text } from 'react-native';
import type { ParsedIngredient } from '../../types/recipe';

interface IngredientListProps {
  ingredients: ParsedIngredient[];
}

function formatIngredient(ing: ParsedIngredient): string {
  const parts: string[] = [];
  if (ing.quantity != null) parts.push(String(ing.quantity));
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  return parts.join(' ');
}

export function IngredientList({ ingredients }: IngredientListProps) {
  if (!ingredients.length) {
    return (
      <Text className="text-sm text-warmGray-400 italic">
        No ingredients
      </Text>
    );
  }

  return (
    <View>
      {ingredients.map((ing, idx) => (
        <View
          key={`${ing.name}-${idx}`}
          className="flex-row items-start py-2 border-b border-warmGray-100"
        >
          <View className="w-2 h-2 rounded-full bg-orange-400 mt-2 mr-3" />
          <View className="flex-1">
            <Text className="text-base text-warmGray-900">
              {formatIngredient(ing)}
            </Text>
            {ing.notes && (
              <Text className="text-sm text-warmGray-500 mt-0.5">
                {ing.notes}
              </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
