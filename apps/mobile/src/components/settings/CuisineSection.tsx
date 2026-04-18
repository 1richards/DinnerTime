import React from 'react';
import { View, Text } from 'react-native';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useUpdateProfile } from '../../hooks/usePreferences';
import { CUISINE_OPTIONS } from '../../data/dietary';
import { Chip } from '../ui/Chip';
import type { CuisineOption } from '../../types/preferences';

interface CuisineSectionProps {
  profileId: string;
  onSaved?: () => void;
}

export function CuisineSection({ profileId, onSaved }: CuisineSectionProps) {
  const cuisinePreferences = usePreferencesStore((s) => s.cuisinePreferences);
  const { updateCuisine } = useUpdateProfile();

  const handleToggle = (cuisine: CuisineOption) => {
    const newPrefs = cuisinePreferences.includes(cuisine)
      ? cuisinePreferences.filter((c) => c !== cuisine)
      : [...cuisinePreferences, cuisine];

    updateCuisine.mutate(
      { profileId, prefs: newPrefs },
      { onSuccess: () => onSaved?.() }
    );
  };

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-3">
        Cuisine Preferences
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {CUISINE_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            kind="filter"
            label={option.label}
            selected={cuisinePreferences.includes(option.value)}
            onPress={() => handleToggle(option.value)}
          />
        ))}
      </View>
    </View>
  );
}
