import React from 'react';
import { View, Text } from 'react-native';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { ChipToggle } from '../ui/ChipToggle';

export function DietarySection() {
  const members = usePreferencesStore((s) => s.members);

  // Aggregate all members' dietary data
  const allAllergies = [...new Set(members.flatMap((m) => m.dietary_allergies))];
  const allRestrictions = [...new Set(members.flatMap((m) => m.dietary_restrictions))];

  const hasMembers = members.length > 0;

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-3">
        Dietary & Allergies
      </Text>

      {!hasMembers ? (
        <Text className="text-sm text-warmGray-500">
          Add family members to set dietary needs
        </Text>
      ) : (
        <>
          {/* Allergies (hard blocks) */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-warmGray-700 mb-2">
              Allergies (hard blocks)
            </Text>
            {allAllergies.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {allAllergies.map((allergy) => (
                  <ChipToggle
                    key={allergy}
                    label={allergy}
                    selected
                    onToggle={() => {}}
                    colorScheme="red"
                  />
                ))}
              </View>
            ) : (
              <Text className="text-xs text-warmGray-400">
                No allergies set. Edit individual members to add.
              </Text>
            )}
          </View>

          {/* Preferences (soft) */}
          <View>
            <Text className="text-sm font-medium text-warmGray-700 mb-2">
              Preferences (soft)
            </Text>
            {allRestrictions.length > 0 ? (
              <View className="flex-row flex-wrap gap-2">
                {allRestrictions.map((restriction) => (
                  <ChipToggle
                    key={restriction}
                    label={restriction}
                    selected
                    onToggle={() => {}}
                  />
                ))}
              </View>
            ) : (
              <Text className="text-xs text-warmGray-400">
                No dietary preferences set. Edit individual members to add.
              </Text>
            )}
          </View>

          <Text className="text-xs text-warmGray-400 mt-3">
            Edit individual family members to change dietary settings
          </Text>
        </>
      )}
    </View>
  );
}
