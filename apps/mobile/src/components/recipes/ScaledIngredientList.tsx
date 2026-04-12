import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { scaleIngredient, formatQuantity } from '../../lib/scaleIngredient';
import type { ParsedIngredient } from '../../types/recipe';

interface ScaledIngredientListProps {
  ingredients: ParsedIngredient[];
  multiplier: number;
}

export function ScaledIngredientList({
  ingredients,
  multiplier,
}: ScaledIngredientListProps) {
  const scaled = useMemo(
    () => ingredients.map((ing) => scaleIngredient(ing, multiplier)),
    [ingredients, multiplier]
  );

  return (
    <View>
      {scaled.map((ing, idx) => {
        const qtyStr =
          ing.quantity != null ? `${formatQuantity(ing.quantity)} ` : '';
        const unitStr = ing.unit ? `${ing.unit} ` : '';
        const label =
          ing.quantity != null ? `${qtyStr}${unitStr}${ing.name}` : ing.name;
        return (
          <View
            key={idx}
            className="flex-row items-start py-2 border-b border-warmGray-100"
          >
            <Text className="text-warmGray-400 mr-2">•</Text>
            <Text className="flex-1 text-base text-warmGray-800">{label}</Text>
          </View>
        );
      })}
    </View>
  );
}
