import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import type { HouseholdMember } from '../../types/preferences';
import { AGE_RANGES } from '../../data/dietary';

interface MemberCardProps {
  member: HouseholdMember;
  onPress: () => void;
  onDelete: () => void;
}

function getTypeBadge(member: HouseholdMember) {
  if (member.member_type === 'adult') {
    return { label: 'Adult', bg: 'bg-warmGray-200', text: 'text-warmGray-700' };
  }
  const ageLabel = AGE_RANGES.find((a) => a.value === member.age_range)?.label ?? 'Kid';
  const isYoung = member.age_range === 'toddler' || member.age_range === 'young_kid';
  return {
    label: ageLabel,
    bg: isYoung ? 'bg-brand/15' : 'bg-warning/15',
    text: isYoung ? 'text-brand-pressed' : 'text-warning',
  };
}

export function MemberCard({ member, onPress, onDelete }: MemberCardProps) {
  const badge = getTypeBadge(member);
  const dietaryCount = member.dietary_restrictions.length + member.dietary_allergies.length;
  const dislikeCount = member.disliked_ingredients.length;

  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-3 border border-warmGray-100 flex-row items-center"
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-base font-semibold text-warmGray-900">
            {member.name}
          </Text>
          <View className={`px-2 py-0.5 rounded-full ${badge.bg}`}>
            <Text className={`text-xs font-medium ${badge.text}`}>
              {badge.label}
            </Text>
          </View>
        </View>

        <View className="flex-row gap-3">
          {dietaryCount > 0 && (
            <Text className="text-xs text-warmGray-500">
              {dietaryCount} dietary {dietaryCount === 1 ? 'item' : 'items'}
            </Text>
          )}
          {dislikeCount > 0 && (
            <Text className="text-xs text-warmGray-500">
              {dislikeCount} {dislikeCount === 1 ? 'dislike' : 'dislikes'}
            </Text>
          )}
          {member.dietary_allergies.length > 0 && (
            <Text className="text-xs text-red-500 font-medium">
              {member.dietary_allergies.length} {member.dietary_allergies.length === 1 ? 'allergy' : 'allergies'}
            </Text>
          )}
        </View>
      </View>

      <Pressable
        onPress={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-2 ml-2"
        hitSlop={8}
        accessibilityLabel="Delete member"
      >
        <SymbolIcon name="trash" size={20} tintColor="#9CA3AF" />
      </Pressable>
    </Pressable>
  );
}
