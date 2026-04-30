import React from 'react';
import { View, Text } from 'react-native';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { Chip } from '../ui/Chip';

export function DietarySection() {
  const members = usePreferencesStore((s) => s.members);

  const allRestrictions = [...new Set(members.flatMap((m) => m.dietary_restrictions))];

  const hasMembers = members.length > 0;

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-3">
        Dietary Preferences
      </Text>

      {!hasMembers ? (
        <Text className="text-sm text-warmGray-500">
          Add family members to set dietary needs
        </Text>
      ) : (
        <>
          {allRestrictions.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {allRestrictions.map((restriction) => (
                <Chip
                  key={restriction}
                  kind="display"
                  label={restriction}
                />
              ))}
            </View>
          ) : (
            <Text className="text-xs text-warmGray-400">
              No dietary preferences set. Edit individual members to add.
            </Text>
          )}

          <Text className="text-xs text-warmGray-400 mt-3">
            Edit individual family members to change dietary settings
          </Text>
        </>
      )}
    </View>
  );
}
