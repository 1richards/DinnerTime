import React, { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReviewItem } from '../../types/pantry';

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
      <Pressable onPress={handleToggleAccepted} hitSlop={8} className="mr-3">
        <Ionicons
          name={item.accepted ? 'checkbox' : 'square-outline'}
          size={24}
          color={item.accepted ? '#F97316' : '#9CA3AF'}
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
            className="text-base text-warmGray-900 font-medium border-b border-orange-400 pb-0.5"
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
      </View>

      {/* Confidence badge */}
      <View className={`px-2 py-1 rounded-full ml-2 ${confidenceColor.split(' ')[0]}`}>
        <Text className={`text-xs font-semibold ${confidenceColor.split(' ')[1]}`}>
          {confidenceLabel}
        </Text>
      </View>

      {/* Remove button */}
      <Pressable onPress={() => onRemove(item.id)} hitSlop={8} className="ml-2">
        <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
      </Pressable>
    </View>
  );
}
