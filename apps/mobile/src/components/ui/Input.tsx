import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { colors } from '../../design/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  /** Error message string. Truthy value switches border to destructive and renders the error text below. */
  error?: string;
  containerClassName?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, containerClassName = '', secureTextEntry, ...props },
  ref,
) {
  const [isFocused, setIsFocused] = useState(false);

  const borderCls = error
    ? 'border-destructive'
    : isFocused
      ? 'border-brand'
      : 'border-border';

  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && (
        <Text className="text-caption text-text-secondary mb-1.5">
          {label}
        </Text>
      )}
      <TextInput
        ref={ref}
        className={`bg-surface border rounded-button px-4 py-3.5 text-body text-text-primary ${borderCls}`}
        placeholderTextColor={colors.textTertiary}
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
        <Text className="text-caption text-destructive mt-1">{error}</Text>
      )}
    </View>
  );
});
