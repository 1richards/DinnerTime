import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { usePantryStore } from '../../stores/pantryStore';
import { SuggestionList } from '../../components/suggestions/SuggestionList';

export default function HomeScreen() {
  const displayName = useAuthStore((s) => s.profile?.display_name);
  const profileId = useAuthStore((s) => s.profile?.id);
  const pantryItems = usePantryStore((s) => s.items);
  const loadItems = usePantryStore((s) => s.loadItems);

  // Load pantry items on mount if not already loaded
  useEffect(() => {
    if (profileId && pantryItems.length === 0) {
      loadItems(profileId);
    }
  }, [profileId, pantryItems.length, loadItems]);

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {/* Header */}
      <View className="px-4 pt-4 pb-2">
        <Text className="text-2xl font-bold text-warmGray-900">
          {displayName ? `Hey, ${displayName}!` : 'Your Dinner Dashboard'}
        </Text>
        <Text className="text-sm text-warmGray-500 mt-1">
          What should we cook tonight?
        </Text>
      </View>

      {/* Suggestions */}
      <SuggestionList />
    </SafeAreaView>
  );
}
