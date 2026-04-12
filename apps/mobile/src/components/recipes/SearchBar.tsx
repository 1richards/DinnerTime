import React from 'react';
import { View, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-warmGray-100 rounded-xl px-3 py-2">
      <Ionicons name="search" size={18} color="#6B7280" />
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
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color="#9CA3AF" />
        </Pressable>
      )}
    </View>
  );
}
