import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { scaleIngredient, formatQuantity } from '../../lib/scaleIngredient';
import { isIngredientInPantry } from './ingredientHelpers';
import type { ParsedIngredient } from '../../types/recipe';
import { colors } from '../../design/tokens';

interface ScaledIngredientListProps {
  ingredients: ParsedIngredient[];
  multiplier: number;
  /**
   * When provided, the component renders a per-row trailing
   * missing-ingredient indicator. Each non-staple ingredient that does
   * NOT match a pantry name (bidirectional substring match via
   * `isIngredientInPantry`) renders a `cart.badge.plus` Pressable; tap
   * fires `onAddIngredient`. Pantry list MUST already be filtered to
   * `status === 'available'` by the caller (Bug 3 contract — see
   * 01-CONTEXT.md > Match Logic).
   *
   * Omitting this prop preserves the pre-Phase-01 render shape (no
   * trailing icon column) for any caller that doesn't want the
   * indicator.
   */
  pantryNames?: readonly string[];
  /**
   * Trim+lowercased ingredient names the user already added to the
   * shopping list this session. Rows in this set render a non-pressable
   * `cart.fill` (success tone) marker instead of the `cart.badge.plus`
   * Pressable.
   */
  addedNames?: ReadonlySet<string>;
  /**
   * Tapped on a missing ingredient. Receives the ORIGINAL (unscaled)
   * ingredient so the caller's POST body lines up with the user's
   * pantry-vocabulary identity (scaling is render-only).
   */
  onAddIngredient?: (ing: ParsedIngredient) => void;
}

/**
 * Renders a scaled ingredient list using the Something New PreviewSheet
 * formatting — round brand-colored bullet, no horizontal separators, and
 * inline `notes` via an em-dash suffix. Shared by Recipe Box detail +
 * Something New preview + Plan day modal so all three surfaces match
 * visually.
 *
 * Phase 01-01 — when `pantryNames` is provided, every non-staple row
 * that doesn't match the pantry exposes a trailing `cart.badge.plus`
 * Pressable; tapping invokes `onAddIngredient(originalIngredient)`. The
 * caller owns optimistic add + rollback (see PreviewSheet wiring in
 * `apps/mobile/src/app/recipes/discover.tsx`). Omitting `pantryNames`
 * keeps the legacy render shape — no icon column, no behavior change.
 *
 * Implementation note (vitest-node compat): The previous version used
 * `useMemo` to memoize the scaled list, but Phase 01-01 tests invoke
 * this component as a plain function (no React renderer) per the
 * static-tree-walk pattern that landed today. `useMemo` throws
 * "Invalid hook call" outside a renderer, so we compute the scaled
 * list inline. `scaleIngredient` is fast (single Fraction.mul per
 * ingredient) — the memo was premature optimization.
 */
export function ScaledIngredientList({
  ingredients,
  multiplier,
  pantryNames,
  addedNames,
  onAddIngredient,
}: ScaledIngredientListProps) {
  const indicatorEnabled = pantryNames !== undefined;

  return (
    <View>
      {ingredients.map((ing, idx) => {
        const scaled = scaleIngredient(ing, multiplier);
        const qtyStr =
          scaled.quantity != null ? `${formatQuantity(scaled.quantity)} ` : '';
        const unitStr = scaled.unit ? `${scaled.unit} ` : '';
        const primary =
          scaled.quantity != null
            ? `${qtyStr}${unitStr}${scaled.name}`
            : scaled.name;
        const label = scaled.notes ? `${primary} — ${scaled.notes}` : primary;

        // Identity (for pantry match + addedNames lookup) reads the
        // ORIGINAL name — quantity scaling does not affect identity.
        const key = ing.name.trim().toLowerCase();
        const wasAdded = addedNames?.has(key) ?? false;
        const inPantry = indicatorEnabled
          ? isIngredientInPantry(ing.name, pantryNames as readonly string[])
          : true; // suppress when indicator is off

        return (
          <View key={idx} style={styles.row}>
            <View style={styles.bullet} />
            <Text style={styles.text}>{label}</Text>
            {indicatorEnabled && wasAdded ? (
              <View
                style={styles.trailing}
                accessibilityLabel={`Added ${ing.name} to shopping list`}
              >
                <SymbolIcon
                  name="cart.fill"
                  size={20}
                  tintColor={colors.success}
                />
              </View>
            ) : null}
            {indicatorEnabled && !wasAdded && !inPantry ? (
              <Pressable
                onPress={() => onAddIngredient?.(ing)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Add ${ing.name} to shopping list`}
                style={styles.trailing}
              >
                <SymbolIcon
                  name="cart.badge.plus"
                  size={20}
                  tintColor={colors.brand}
                />
              </Pressable>
            ) : null}
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
  trailing: {
    marginLeft: 8,
    marginTop: 2,
  },
});
