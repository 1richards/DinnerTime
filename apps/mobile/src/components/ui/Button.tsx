import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';

type ButtonVariant = 'primary' | 'outline' | 'ghost';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  className?: string;
}

const variantStyles: Record<
  ButtonVariant,
  { container: string; text: string; pressed: string }
> = {
  primary: {
    container: 'bg-orange-500 rounded-xl py-4 px-6',
    text: 'text-white text-base font-semibold text-center',
    pressed: 'bg-orange-600',
  },
  outline: {
    container:
      'border-2 border-orange-500 rounded-xl py-4 px-6 bg-transparent',
    text: 'text-orange-500 text-base font-semibold text-center',
    pressed: 'bg-orange-50',
  },
  ghost: {
    container: 'rounded-xl py-4 px-6 bg-transparent',
    text: 'text-orange-500 text-base font-semibold text-center',
    pressed: 'bg-orange-50',
  },
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled = false,
  className = '',
  ...props
}: ButtonProps) {
  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={`${styles.container} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#FFFFFF' : '#F97316'}
          size="small"
        />
      ) : (
        <Text className={styles.text}>{title}</Text>
      )}
    </Pressable>
  );
}
