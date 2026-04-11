import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CookScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🔥</Text>
        <Text className="text-2xl font-bold text-warmGray-900 mb-2">
          Hands-Free Cooking
        </Text>
        <Text className="text-base text-warmGray-500 text-center leading-6">
          Step-by-step voice-guided cooking. Just say "next step" and we'll
          walk you through the recipe.
        </Text>
      </View>
    </SafeAreaView>
  );
}
