import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from './SymbolIcon';

/**
 * Discriminated union so the caller picks between a photographic empty state
 * (image from FOOD_IMAGES) OR a monochrome SF Symbol illustration.
 */
export type EmptyStateVisual =
  | { kind: 'image'; uri: string }
  | { kind: 'symbol'; name: string };

export type EmptyStateProps = {
  visual: EmptyStateVisual;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ visual, title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-12">
      {visual.kind === 'image' ? (
        <Image
          source={{ uri: visual.uri }}
          style={{ width: 140, height: 140, borderRadius: 70, marginBottom: 20 }}
          contentFit="cover"
        />
      ) : (
        <View className="mb-5">
          {/* size={56} is intentionally a raw pixel — the empty-state glyph
              is purely decorative and sits above the type-scale tokens. */}
          <SymbolIcon
            name={visual.name as never}
            size={56}
            weight="light"
            tintColor="#9CA3AF"
          />
        </View>
      )}
      <Text className="text-lg font-semibold text-warmGray-900 text-center">
        {title}
      </Text>
      {subtitle ? (
        <Text className="text-sm text-warmGray-500 text-center mt-2">
          {subtitle}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          className="mt-6 px-6 py-3 bg-brand rounded-button"
          accessibilityRole="button"
          accessibilityLabel={action.label}
        >
          <Text className="text-white font-semibold">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
