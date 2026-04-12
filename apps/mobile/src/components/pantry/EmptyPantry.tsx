import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../ui/Button';

export function EmptyPantry() {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="text-6xl mb-4">📷</Text>
      <Text className="text-2xl font-bold text-warmGray-900 mb-2">
        Your kitchen is empty
      </Text>
      <Text className="text-base text-warmGray-500 text-center leading-6 mb-8">
        Take a photo of your fridge, pantry, or freezer to get started
      </Text>
      <Button
        title="Scan Now"
        onPress={() => router.push('/scan')}
        className="w-full"
      />
    </View>
  );
}
