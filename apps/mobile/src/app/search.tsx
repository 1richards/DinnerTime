/**
 * Search modal (Phase 19 D-03).
 *
 * StickySearchPill navigates here via router.push('/search?context=...').
 * This screen is a placeholder until Phase 17 (Something New) ships the
 * real search surface. For now it echoes the context query param so we can
 * visually verify the modal mount + wiring from every tab that hosts a pill.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function SearchModal() {
  const { context } = useLocalSearchParams<{ context?: string }>();
  return (
    <View className="flex-1 bg-bg p-4">
      <Text className="text-title text-text-primary">Search</Text>
      <Text className="text-body text-text-secondary mt-2">
        Context: {context ?? 'unknown'}
      </Text>
      <Text className="text-caption text-text-tertiary mt-4">
        Full search UI ships in Phase 17 (Something New).
      </Text>
    </View>
  );
}
