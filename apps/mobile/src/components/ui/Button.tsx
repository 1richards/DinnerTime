import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
} from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { variantStyles, type ButtonVariant } from './buttonStyles';
import { iconPropsForText } from '../../design/icons';

/**
 * Legacy variant alias. The pre-Phase-19 Button shipped `primary | outline | ghost`.
 * CONTEXT D-02 locked a new 5-variant system (`primary | secondary | ghost | destructive | iconOnly`)
 * where `outline` conceptually maps to `secondary`. Plan 05's sweep migrates call sites
 * (~23 files) to `variant="secondary"` explicitly; until then we accept `outline` as an
 * alias at the prop-type boundary and resolve it to `secondary` internally.
 */
type ButtonVariantInput = ButtonVariant | 'outline';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  /** Required for non-iconOnly variants. */
  title?: string;
  variant?: ButtonVariantInput;
  loading?: boolean;
  /** Required when variant='iconOnly'. */
  icon?: SymbolViewProps['name'];
  className?: string;
}

function resolveVariant(v: ButtonVariantInput | undefined): ButtonVariant {
  if (v === 'outline') return 'secondary';
  return v ?? 'primary';
}

export function Button({
  title,
  variant,
  loading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}: ButtonProps) {
  const resolved = resolveVariant(variant);
  const s = variantStyles[resolved];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      className={`${s.container} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      disabled={isDisabled}
      accessibilityRole="button"
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={s.spinnerColor} size="small" />
      ) : resolved === 'iconOnly' && icon ? (
        <SymbolView
          name={icon}
          {...iconPropsForText('body')}
          tintColor={s.spinnerColor}
        />
      ) : (
        <Text className={s.text}>{title}</Text>
      )}
    </Pressable>
  );
}

export type { ButtonVariant };
