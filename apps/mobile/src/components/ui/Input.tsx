import React, { useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export function Input({
  label,
  error,
  containerClassName = '',
  secureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && (
        <Text className="text-sm font-medium text-warmGray-700 mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        className={`bg-warmGray-50 border rounded-xl px-4 py-3.5 text-base text-warmGray-900 ${
          error
            ? 'border-red-400'
            : isFocused
              ? 'border-orange-400'
              : 'border-warmGray-200'
        }`}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={secureTextEntry}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="text-sm text-red-500 mt-1">{error}</Text>
      )}
    </View>
  );
}
