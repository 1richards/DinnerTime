import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CookTabScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🔥</Text>
        <Text className="text-2xl font-bold text-warmGray-900 mb-2 text-center">
          Hands-Free Cooking
        </Text>
        <Text className="text-base text-warmGray-500 text-center leading-6 mb-6">
          Pick a recipe from your library and tap{' '}
          <Text className="font-semibold text-warmGray-700">Start Cooking</Text>{' '}
          to open the voice-guided cooking mode.
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/recipes')}
          className="flex-row items-center bg-orange-500 rounded-xl px-5 py-3"
        >
          <Ionicons name="book-outline" size={20} color="#FFFFFF" />
          <Text className="ml-2 text-white font-semibold text-base">
            Open Recipes
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
