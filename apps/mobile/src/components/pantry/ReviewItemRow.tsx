import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { ReviewItem } from '../../types/pantry';
import { colors } from '../../design/tokens';

interface ReviewItemRowProps {
  item: ReviewItem;
  onUpdate: (id: string, updates: Partial<ReviewItem>) => void;
  onRemove: (id: string) => void;
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

export function ReviewItemRow({ item, onUpdate, onRemove }: ReviewItemRowProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const confidenceColor = getConfidenceColor(item.confidence);
  const confidenceLabel = getConfidenceLabel(item.confidence);

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
          <Pressable onPress={() => setIsEditingName(true)}>
            <Text
              className={`text-base font-medium ${
                item.accepted ? 'text-warmGray-900' : 'text-warmGray-400 line-through'
              }`}
            >
              {item.name}
            </Text>
          </Pressable>
        )}
        <Text className="text-sm text-warmGray-500 mt-0.5">
          {item.quantity} {item.unit} · {item.category}
        </Text>
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
