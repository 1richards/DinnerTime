import React from 'react';
import { View, Text } from 'react-native';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { Chip } from '../ui/Chip';

export function DislikesSection() {
  const members = usePreferencesStore((s) => s.members);

  // Aggregate all members' disliked ingredients
  const allDislikes = [...new Set(members.flatMap((m) => m.disliked_ingredients))].sort();
  const hasMembers = members.length > 0;

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-3">
        Disliked Ingredients
      </Text>

      {!hasMembers ? (
        <Text className="text-sm text-warmGray-500">
          Add family members to set ingredient dislikes
        </Text>
      ) : allDislikes.length === 0 ? (
        <Text className="text-sm text-warmGray-500">
          No disliked ingredients set. Edit individual members to add.
        </Text>
      ) : (
        <>
          <View className="flex-row flex-wrap gap-2">
            {allDislikes.map((item) => (
              <Chip
                key={item}
                kind="display"
                label={item}
              />
            ))}
          </View>
          <Text className="text-xs text-warmGray-400 mt-3">
            Edit individual family members to change dislikes
          </Text>
        </>
      )}
    </View>
  );
}
