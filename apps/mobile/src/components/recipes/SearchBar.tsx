import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

// Icon-swap only — Phase 19 will rewrite the search-bar pattern overall.
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-warmGray-100 rounded-xl px-3 py-2">
      <SymbolIcon name="magnifyingglass" size={18} tintColor="#6B7280" />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? 'Search recipes'}
        placeholderTextColor="#9CA3AF"
        className="flex-1 ml-2 text-base text-warmGray-900"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8} accessibilityLabel="Clear search">
          <SymbolIcon name="xmark.circle.fill" size={18} tintColor="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
}
