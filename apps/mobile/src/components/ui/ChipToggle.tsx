import React from 'react';
import { Pressable, Text } from 'react-native';

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  variant?: 'default' | 'removable';
  colorScheme?: 'orange' | 'red';
}

export function ChipToggle({
  label,
  selected,
  onToggle,
  variant = 'default',
  colorScheme = 'orange',
}: ChipToggleProps) {
  const selectedBg = colorScheme === 'red' ? 'bg-red-100' : 'bg-orange-500';
  const selectedText = colorScheme === 'red' ? 'text-red-700' : 'text-white';

  return (
    <Pressable
      onPress={onToggle}
      className={`px-4 py-2 rounded-full ${
        selected
          ? selectedBg
          : 'bg-warmGray-100 border border-warmGray-200'
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          selected ? selectedText : 'text-warmGray-700'
        }`}
      >
        {label}
        {variant === 'removable' && selected ? ' \u00d7' : ''}
      </Text>
    </Pressable>
  );
}
