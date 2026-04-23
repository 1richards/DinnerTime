import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scaleIngredient, formatQuantity } from '../../lib/scaleIngredient';
import type { ParsedIngredient } from '../../types/recipe';
import { colors } from '../../design/tokens';

interface ScaledIngredientListProps {
  ingredients: ParsedIngredient[];
  multiplier: number;
}

/**
 * Renders a scaled ingredient list using the Something New PreviewSheet
 * formatting — round brand-colored bullet, no horizontal separators, and
 * inline `notes` via an em-dash suffix. Shared by Recipe Box detail +
 * Something New preview so both surfaces match visually.
 */
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
        const primary =
          ing.quantity != null ? `${qtyStr}${unitStr}${ing.name}` : ing.name;
        const label = ing.notes ? `${primary} — ${ing.notes}` : primary;
        return (
          <View key={idx} style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.text}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand,
    marginTop: 8,
    marginRight: 10,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: '#3E332A',
    lineHeight: 20,
  },
});
