import React from 'react';
import { View, Text } from 'react-native';
import { useNetworkStore } from '../stores/networkStore';

/**
 * Global offline indicator. Renders nothing when online; renders an
 * amber pill when offline. Mounted near the top of the root navigator
 * (apps/mobile/src/app/_layout.tsx).
 */
export function OfflineBanner(): React.ReactElement | null {
  const isOnline = useNetworkStore((s) => s.isOnline);

  if (isOnline) return null;

  return (
    <View
      testID="offline-banner"
      className="bg-amber-100 border-b border-amber-200 py-2 px-4"
    >
      <Text className="text-center text-sm font-medium text-amber-900">
        You're offline — changes will sync when you're back online
      </Text>
    </View>
  );
}

export default OfflineBanner;
