import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useUpdateProfile } from '../../hooks/usePreferences';
import { SKILL_LEVELS } from '../../data/dietary';
import type { SkillLevel } from '../../types/preferences';

interface SkillLevelSectionProps {
  profileId: string;
  onSaved?: () => void;
}

export function SkillLevelSection({ profileId, onSaved }: SkillLevelSectionProps) {
  const skillLevel = usePreferencesStore((s) => s.skillLevel);
  const { updateSkill } = useUpdateProfile();

  const handleSelect = (level: SkillLevel) => {
    if (level === skillLevel) return;
    updateSkill.mutate(
      { profileId, level },
      { onSuccess: () => onSaved?.() }
    );
  };

  return (
    <View>
      <Text className="text-lg font-bold text-warmGray-900 mb-3">
        Cooking Skill
      </Text>

      <View className="gap-2">
        {SKILL_LEVELS.map((option) => {
          const isSelected = skillLevel === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              className={`p-4 rounded-xl ${
                isSelected
                  ? 'bg-orange-50 border-l-4 border-orange-500'
                  : 'bg-white border border-warmGray-100'
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  isSelected ? 'text-orange-700' : 'text-warmGray-800'
                }`}
              >
                {option.label}
              </Text>
              <Text
                className={`text-sm mt-0.5 ${
                  isSelected ? 'text-orange-600' : 'text-warmGray-500'
                }`}
              >
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
