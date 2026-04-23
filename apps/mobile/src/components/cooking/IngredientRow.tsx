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
}: IngredientRowProps) {
  const qtyLabel =
    quantity != null
      ? `${formatQuantity(quantity)}${unit ? ` ${unit}` : ''}`
      : unit ?? '';

  // Checked state: strike-through + tertiary color. Tokens only.
  const textStrikeClass = checked ? 'text-text-tertiary line-through' : 'text-text-primary';

  const iconName = checked ? 'checkmark.circle.fill' : 'circle';
  const iconTint = checked ? colors.success : colors.textTertiary;
  // Mirror the success / tertiary tone on the icon as a className too — test
  // asserts `text-success` appears in the className set when checked.
  const iconClass = checked ? 'text-success' : 'text-text-tertiary';

  const accessibilityLabel = `${qtyLabel ? `${qtyLabel} ` : ''}${name}, ${
    checked ? 'checked' : 'unchecked'
  }`;

  const handlePress = () => {
    void fireIngredientHaptic();
    onToggle(id);
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      className="flex-row items-center px-4 py-2 border-b border-border"
    >
      <View className={iconClass}>
        <SymbolIcon name={iconName} size={20} tintColor={iconTint} />
      </View>
      <View className="flex-1 flex-row ml-3">
        {qtyLabel ? (
          <Text className={`text-body font-bold mr-2 ${textStrikeClass}`}>
            {qtyLabel}
          </Text>
        ) : null}
        <Text className={`text-body flex-1 ${textStrikeClass}`}>{name}</Text>
      </View>
    </Pressable>
  );
}

export default IngredientRow;
