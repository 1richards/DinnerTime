/**
 * Typed React Native TextStyle objects keyed by typography token.
 *
 * Use this for `<Text style={textStyles.body}>` inside components that cannot
 * use NativeWind className (e.g., StyleSheet.create consumers in
 * useCollapsingHeader, native header options that require raw style objects).
 *
 * Migration of those consumers is owned by Plan 19-05. New code should prefer
 * NativeWind classes (`text-body`, `text-title`, etc.) which resolve through
 * tailwind.config.js -> global.css.
 */

import type { TextStyle } from 'react-native';
import { colors, typography } from './tokens';

export const textStyles: Record<keyof typeof typography, TextStyle> = {
  display: { ...typography.display, color: colors.textPrimary },
  title: { ...typography.title, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textPrimary },
  caption: { ...typography.caption, color: colors.textSecondary },
  label: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase' as const,
  },
};
