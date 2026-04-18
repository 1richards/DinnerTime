import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { SourceLocation } from '../../types/pantry';

interface LocationOption {
  value: SourceLocation;
  label: string;
  // SF Symbol name. Per 15-RESEARCH Open Question #3, fridge and freezer
  // both use 'snowflake' (the 'refrigerator' symbol is iOS 17+ only and
  // we target iOS 15+).
  symbol: string;
}

const locations: LocationOption[] = [
  { value: 'fridge', label: 'Fridge', symbol: 'snowflake' },
  { value: 'pantry', label: 'Pantry', symbol: 'archivebox' },
  { value: 'freezer', label: 'Freezer', symbol: 'snowflake' },
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
            accessibilityLabel={loc.label}
            accessibilityState={{ selected: isSelected }}
          >
            <View className="mb-2">
              <SymbolIcon
                name={loc.symbol as never}
                size={28}
                tintColor={isSelected ? '#F97316' : '#9CA3AF'}
              />
            </View>
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
