import { View, Text, ActivityIndicator } from 'react-native';
import { colors } from '../../design/tokens';

export type LoadingStateVariant = 'spinner' | 'skeleton';

export type LoadingStateProps = {
  variant?: LoadingStateVariant;
  label?: string;
};

/**
 * Shared loading primitive.
 *
 *   variant='spinner'  (default) — centered ActivityIndicator for short waits
 *   variant='skeleton'           — neutral rounded block for list content
 *
 * Keep the API intentionally tiny; Phase 19's token pass retints the skeleton
 * block without rewriting the component.
 */
export function LoadingState({
  variant = 'spinner',
  label,
}: LoadingStateProps = {}) {
  if (variant === 'skeleton') {
    return (
      <View
        className="bg-warmGray-100 rounded-lg w-full h-20"
        accessibilityRole="progressbar"
        accessibilityLabel={label ?? 'Loading'}
      />
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center py-8"
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ActivityIndicator size="small" color={colors.brand} />
      {label ? (
        <Text className="text-sm text-warmGray-500 mt-3">{label}</Text>
      ) : null}
    </View>
  );
}
