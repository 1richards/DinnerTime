/**
 * Button variantStyles — pure, token-driven, no React / RN imports.
 *
 * Separated from Button.tsx so vitest can assert className strings without
 * pulling the RN renderer. See 19-02-PLAN.md Task 1 and 19-VALIDATION.md.
 */

import { colors } from '../../design/tokens';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'iconOnly';

export interface VariantStyle {
  /** Pressable className — layout, size, background. Always includes h-11 (44pt tap target). */
  container: string;
  /** Text className. Empty string for iconOnly (no label). */
  text: string;
  /** Pressed-state className. Applied additively when Pressable is active. */
  pressed: string;
  /** Hex color passed to ActivityIndicator / SymbolView tintColor on loading / icon content. */
  spinnerColor: string;
}

export const variantStyles: Record<ButtonVariant, VariantStyle> = {
  primary: {
    container: 'bg-brand rounded-button h-11 px-6 justify-center items-center',
    text: 'text-white text-body font-semibold text-center',
    pressed: 'bg-brand-pressed',
    spinnerColor: '#FFFFFF',
  },
  secondary: {
    container:
      'bg-surface border border-border rounded-button h-11 px-6 justify-center items-center',
    text: 'text-text-primary text-body font-semibold text-center',
    pressed: 'bg-surface-subtle',
    spinnerColor: colors.textPrimary,
  },
  ghost: {
    container: 'bg-transparent rounded-button h-11 px-6 justify-center items-center',
    text: 'text-brand text-body font-semibold text-center',
    pressed: 'bg-brand/10',
    spinnerColor: colors.brand,
  },
  destructive: {
    container: 'bg-destructive rounded-button h-11 px-6 justify-center items-center',
    text: 'text-white text-body font-semibold text-center',
    pressed: 'opacity-80',
    spinnerColor: '#FFFFFF',
  },
  iconOnly: {
    container:
      'bg-transparent rounded-button h-11 w-11 items-center justify-center',
    text: '',
    pressed: 'bg-surface-subtle',
    spinnerColor: colors.textPrimary,
  },
};
