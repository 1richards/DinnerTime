import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface MethodCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

function MethodCard({ icon, title, description, onPress }: MethodCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-white rounded-2xl p-6 mb-4 flex-row items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <View className="w-14 h-14 rounded-full bg-orange-100 items-center justify-center mr-4">
        <Ionicons name={icon} size={28} color="#F97316" />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-semibold text-warmGray-900 mb-1">
          {title}
        </Text>
        <Text className="text-sm text-warmGray-500">{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </Pressable>
  );
}

export default function ImportScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ScrollView className="flex-1 px-4 pt-6">
        <Text className="text-base text-warmGray-500 mb-6 px-2">
          Choose how you'd like to add your recipe
        </Text>

        <MethodCard
          icon="link-outline"
          title="Paste URL"
          description="Import from a recipe website"
          onPress={() => router.push('/recipes/import-url')}
        />
        <MethodCard
          icon="camera-outline"
          title="Take Photo"
          description="Snap a picture of a cookbook or card"
          onPress={() => router.push('/recipes/import-photo')}
        />
        <MethodCard
          icon="create-outline"
          title="Type It In"
          description="Paste or type a recipe in freeform text"
          onPress={() => router.push('/recipes/import-manual')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
