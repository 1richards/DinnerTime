/**
 * IngredientRow — Phase 16 Wave 2 (16-04) — checkable ingredient line for the
 * scrollable recipe body.
 *
 * Tap-to-check semantics:
 *   - Unchecked → empty circle, full-opacity body text.
 *   - Checked   → success-tinted check icon, strike-through + tertiary text.
 *
 * Why `success` and not `brand` for the check icon? UI-SPEC §Color "Accent
 * NEVER used for … ingredient-check icon — that is `success`". The brand
 * accent budget is already heavily reserved (rail + timer chip + waveform +
 * Stop + nav-pressed + toast strip) and `success` semantically reads as
 * "checked / done".
 *
 * Haptic contract (UI-SPEC §Haptic contract): Light impact on every tap.
 * `fireIngredientHaptic` is fire-and-forget — it never rejects.
 *
 * Phase 01-01 — optional missing-ingredient indicator. When `inPantry`,
 * `wasAdded`, and `onAddToShoppingList` are passed (by ScrollableRecipe
 * after the cooking-mode wiring), a trailing column renders:
 *   - inPantry === false && !wasAdded → cart.badge.plus Pressable (brand
 *     tint). Tap fires `onAddToShoppingList` so the parent can call
 *     `useShoppingStore.addItem` with try/catch + Alert.
 *   - wasAdded === true → cart.fill (success tint), non-pressable View.
 *   - inPantry === true → no trailing element (user has it; nothing to do).
 * The trailing block lives OUTSIDE the row's Pressable wrapper so RN's
 * nested-Pressable behavior doesn't surprise — the checkbox tap-target
 * stays exactly where it is.
 *
 * Props accept the flattened `{ name, quantity, unit }` shape (matches the
 * Wave 0 test stub exactly — do NOT repackage as a nested `ingredient` prop).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { fireIngredientHaptic } from '../../cooking/haptics';

export interface IngredientRowProps {
  id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  checked: boolean;
  onToggle: (id: string) => void;
  /**
   * Phase 01-01 missing-ingredient indicator props. All three are
   * optional — when undefined, the row renders exactly as today. When
   * `inPantry === false && !wasAdded`, the row renders a trailing
   * `cart.badge.plus` Pressable that calls `onAddToShoppingList` on tap.
   * When `wasAdded === true`, a non-pressable `cart.fill` (success tone)
   * marker renders instead. The parent (ScrollableRecipe) owns the
   * pantry/shopping store wiring + optimistic flip + Alert rollback.
   */
  inPantry?: boolean;
  wasAdded?: boolean;
  onAddToShoppingList?: () => void;
}

function formatQuantity(quantity: number): string {
  // Keep fractions readable without trailing zeros — "1.5" stays, "1.0" → "1".
  if (Number.isInteger(quantity)) return String(quantity);
  return String(quantity);
}

export function IngredientRow({
  id,
  name,
  quantity,
  unit,
  checked,
  onToggle,
  inPantry,
  wasAdded,
  onAddToShoppingList,
}: IngredientRowProps) {
  const qtyLabel =
    quantity != null
      ? `${formatQuantity(quantity)}${unit ? ` ${unit}` : ''}`
      : unit ?? '';

  // Cooking-mode UAT: ingredients render as a bullet list, not checkboxes
  // — the recipe pages use the same bullet shape and the checkable
  // affordance never landed in muscle memory. `checked` and `onToggle`
  // remain in the public prop contract for backward compat with existing
  // tests + cookingStore wiring; the row simply ignores them visually.
  void checked;
  void onToggle;
  void fireIngredientHaptic;

  const accessibilityLabel = `${qtyLabel ? `${qtyLabel} ` : ''}${name}`;

  // Phase 01-01 — only consider the indicator active when the parent
  // explicitly passes pantry-aware props. Reading just `inPantry` would
  // trigger on undefined-vs-true confusion; the explicit triple gate
  // keeps back-compat clean.
  const showAddBtn =
    inPantry === false && !wasAdded && typeof onAddToShoppingList === 'function';
  const showAddedMarker = wasAdded === true;

  return (
    <View
      className="flex-row items-center px-4 py-2 border-b border-border"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-center flex-1">
        <View className="w-5 items-center">
          {/* Bullet — small filled circle, matches recipe-detail ingredient list */}
          <Text className="text-body font-bold text-text-tertiary">•</Text>
        </View>
        <View className="flex-1 flex-row ml-3">
          {qtyLabel ? (
            <Text className="text-body font-bold mr-2 text-text-primary">
              {qtyLabel}
            </Text>
          ) : null}
          <Text className="text-body flex-1 text-text-primary">{name}</Text>
        </View>
      </View>

      {showAddBtn ? (
        <Pressable
          onPress={onAddToShoppingList}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Add ${name} to shopping list`}
          className="ml-2"
        >
          <SymbolIcon name="cart.badge.plus" size={20} tintColor={colors.brand} />
        </Pressable>
      ) : null}

      {showAddedMarker ? (
        <View
          className="ml-2"
          accessibilityLabel={`Added ${name} to shopping list`}
        >
          <SymbolIcon name="cart.fill" size={20} tintColor={colors.success} />
        </View>
      ) : null}
    </View>
  );
}

export default IngredientRow;
