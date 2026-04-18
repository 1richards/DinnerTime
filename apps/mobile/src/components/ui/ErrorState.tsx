import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from './SymbolIcon';

export type ErrorStateVariant = 'banner' | 'full';

export type ErrorStateProps = {
  title: string;
  message?: string;
  retry?: { label: string; onPress: () => void };
  variant?: ErrorStateVariant;
};

/**
 * Shared error primitive.
 *
 *   variant='full'   (default) — centered SF Symbol + title + message + retry button
 *   variant='banner'           — compact horizontal row (height <= 80) for inline failures
 */
export function ErrorState({
  title,
  message,
  retry,
  variant = 'full',
}: ErrorStateProps) {
  if (variant === 'banner') {
    return (
      <View
        className="flex-row items-center bg-warmGray-50 rounded-lg px-4 py-3"
        style={{ maxHeight: 80 }}
      >
        <SymbolIcon
          name={'exclamationmark.triangle' as never}
          size="title"
          weight="regular"
          tintColor="#9CA3AF"
        />
        <View className="flex-1 ml-3">
          <Text className="text-sm font-semibold text-warmGray-900">{title}</Text>
          {message ? (
            <Text className="text-xs text-warmGray-500 mt-0.5">{message}</Text>
          ) : null}
        </View>
        {retry ? (
          <Pressable
            onPress={retry.onPress}
            className="ml-3 px-3 py-1.5 rounded-md bg-brand"
            accessibilityRole="button"
            accessibilityLabel={retry.label}
          >
            <Text className="text-xs font-semibold text-white">{retry.label}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      <View className="mb-5">
        <SymbolIcon
          name={'exclamationmark.triangle' as never}
          size={56}
          weight="light"
          tintColor="#9CA3AF"
        />
      </View>
      <Text className="text-lg font-semibold text-warmGray-900 text-center">
        {title}
      </Text>
      {message ? (
        <Text className="text-sm text-warmGray-500 text-center mt-2">
          {message}
        </Text>
      ) : null}
      {retry ? (
        <Pressable
          onPress={retry.onPress}
          className="mt-6 px-6 py-3 bg-brand rounded-button"
          accessibilityRole="button"
          accessibilityLabel={retry.label}
        >
          <Text className="text-white font-semibold">{retry.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
