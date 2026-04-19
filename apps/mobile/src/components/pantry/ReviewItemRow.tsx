import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { ReviewItem } from '../../types/pantry';
import { formatQuantity } from '../../types/pantry';
import { colors } from '../../design/tokens';
import { LocationChip } from './LocationChip';
import {
  resolveFieldClass,
  resolveFieldAccessibilityHint,
} from './reviewItemRowHelpers';

// Re-export so callers can reach the helpers through ReviewItemRow if they
// already depend on the component for related concerns.
export {
  resolveFieldClass,
  resolveFieldAccessibilityHint,
  LOW_CONFIDENCE_THRESHOLD,
} from './reviewItemRowHelpers';

interface ReviewItemRowProps {
  item: ReviewItem;
  onUpdate: (id: string, updates: Partial<ReviewItem>) => void;
  onRemove: (id: string) => void;
  /**
   * Fires when the user taps the item's LocationChip. Parent owns the
   * open-sheet state; this row just forwards the item id upward.
   */
  onLocationPress?: (itemId: string) => void;
}

function getConfidenceColor(confidence: number): string {
  if (confidence > 0.8) return 'bg-green-100 text-green-700';
  if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence > 0.8) return 'High';
  if (confidence >= 0.5) return 'Med';
  return 'Low';
}

export function ReviewItemRow({
  item,
  onUpdate,
  onRemove,
  onLocationPress,
}: ReviewItemRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const confidenceColor = getConfidenceColor(item.confidence);
  const confidenceLabel = getConfidenceLabel(item.confidence);

  // Phase 24-06: inline low-confidence treatment. The quantity display renders
  // BOTH the numeric value and the unit, so flag it when EITHER quantity OR
  // unit is below threshold. Merge into a synthetic field that stays < 0.7 if
  // either underlying field is low-confidence.
  const fc = item.fieldConfidence;
  const mergedQuantityUnit = fc
    ? { ...fc, quantity: Math.min(fc.quantity, fc.unit) }
    : undefined;
  const nameLowClass = resolveFieldClass(fc, 'name');
  const nameHint = resolveFieldAccessibilityHint(fc, 'name');
  const qtyLowClass = resolveFieldClass(mergedQuantityUnit, 'quantity');
  const qtyHint = resolveFieldAccessibilityHint(mergedQuantityUnit, 'quantity');
  const categoryLowClass = resolveFieldClass(fc, 'category');
  const categoryHint = resolveFieldAccessibilityHint(fc, 'category');

  const handleToggleAccepted = () => {
    onUpdate(item.id, { accepted: !item.accepted });
  };

  const handleNameSubmit = () => {
    setIsEditingName(false);
    if (editName.trim() && editName !== item.name) {
      onUpdate(item.id, { name: editName.trim(), userEdited: true });
    } else {
      setEditName(item.name);
    }
  };

  return (
    <View
      className={`flex-row items-center px-4 py-3 bg-white rounded-xl mb-2 mx-4 ${
        !item.accepted ? 'opacity-50' : ''
      }`}
    >
      {/* Checkbox */}
      <Pressable
        onPress={handleToggleAccepted}
        hitSlop={8}
        className="mr-3"
        accessibilityLabel={item.accepted ? 'Unselect item' : 'Select item'}
      >
        <SymbolIcon
          name={item.accepted ? 'checkmark.square.fill' : 'square'}
          size={24}
          tintColor={item.accepted ? colors.brand : colors.textTertiary}
        />
      </Pressable>

      {/* Item details */}
      <View className="flex-1">
        {isEditingName ? (
          <TextInput
            value={editName}
            onChangeText={setEditName}
            onBlur={handleNameSubmit}
            onSubmitEditing={handleNameSubmit}
            autoFocus
            className="text-base text-warmGray-900 font-medium border-b border-brand pb-0.5"
          />
        ) : (
          <Pressable onPress={() => setIsEditingName(true)} accessibilityHint={nameHint}>
            <Text
              className={`text-base font-medium self-start ${
                item.accepted ? 'text-warmGray-900' : 'text-warmGray-400 line-through'
              } ${nameLowClass}`}
            >
              {item.name}
            </Text>
          </Pressable>
        )}
        {/* Phase 24-06: quantity + category rendered as separate spans so the
            inline low-confidence dashed underline can hug each field
            independently. Keeps a bullet separator between them for density. */}
        <View className="flex-row flex-wrap items-center mt-0.5">
          <Text
            className={`text-sm text-warmGray-500 ${qtyLowClass}`}
            accessibilityHint={qtyHint}
          >
            {formatQuantity(item.quantity)}
          </Text>
          <Text className="text-sm text-warmGray-500"> · </Text>
          <Text
            className={`text-sm text-warmGray-500 ${categoryLowClass}`}
            accessibilityHint={categoryHint}
          >
            {item.category}
          </Text>
        </View>
        {/* Phase 18-03: per-item location chip. Tap opens the sheet in the
            parent screen (review.tsx owns the open-item state). */}
        <View className="mt-1 flex-row">
          <LocationChip
            value={item.source_location}
            onPress={() => onLocationPress?.(item.id)}
          />
        </View>
        {item.probableDupe && (
          <Text className="text-xs text-brand font-medium mt-1">
            Already in pantry — tap to add anyway
          </Text>
        )}
      </View>

      {/* Confidence badge */}
      <View className={`px-2 py-1 rounded-full ml-2 ${confidenceColor.split(' ')[0]}`}>
        <Text className={`text-xs font-semibold ${confidenceColor.split(' ')[1]}`}>
          {confidenceLabel}
        </Text>
      </View>

      {/* Remove button */}
      <Pressable
        onPress={() => onRemove(item.id)}
        hitSlop={8}
        className="ml-2"
        accessibilityLabel="Remove item"
      >
        <SymbolIcon name="xmark.circle" size={22} tintColor="#EF4444" />
      </Pressable>
    </View>
  );
}
