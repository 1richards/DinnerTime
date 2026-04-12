import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../ui/Button';

interface EmptyPlanStateProps {
  onGenerate: () => void;
  loading?: boolean;
}

export function EmptyPlanState({ onGenerate, loading = false }: EmptyPlanStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="w-24 h-24 rounded-full bg-orange-50 items-center justify-center mb-6">
        <Ionicons name="calendar-outline" size={56} color="#F97316" />
      </View>
      <Text className="text-2xl font-bold text-warmGray-900 text-center">
        No plan yet
      </Text>
      <Text className="text-base text-warmGray-500 text-center mt-2 mb-8">
        Generate a 7-day dinner plan from your pantry
      </Text>
      <Button
        title={loading ? 'Generating...' : 'Generate this week'}
        onPress={onGenerate}
        loading={loading}
        className="w-full"
      />
    </View>
  );
}
