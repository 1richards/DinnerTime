import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { SourceLocation } from '../../types/pantry';

interface LocationOption {
  value: SourceLocation;
  label: string;
  emoji: string;
}

const locations: LocationOption[] = [
  { value: 'fridge', label: 'Fridge', emoji: '🧊' },
  { value: 'pantry', label: 'Pantry', emoji: '🗄️' },
  { value: 'freezer', label: 'Freezer', emoji: '❄️' },
];

interface LocationPickerProps {
  selected: SourceLocation;
  onSelect: (location: SourceLocation) => void;
}

export function LocationPicker({ selected, onSelect }: LocationPickerProps) {
  return (
    <View className="flex-row justify-between px-4 gap-3">
      {locations.map((loc) => {
        const isSelected = selected === loc.value;
        return (
          <Pressable
            key={loc.value}
            onPress={() => onSelect(loc.value)}
            className={`flex-1 items-center justify-center py-5 rounded-2xl border-2 ${
              isSelected
                ? 'border-orange-500 bg-orange-50'
                : 'border-warmGray-200 bg-white'
            }`}
          >
            <Text className="text-3xl mb-2">{loc.emoji}</Text>
            <Text
              className={`text-base font-semibold ${
                isSelected ? 'text-orange-600' : 'text-warmGray-600'
              }`}
            >
              {loc.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
