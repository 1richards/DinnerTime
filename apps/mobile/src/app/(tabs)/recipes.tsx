import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RecipesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">📖</Text>
        <Text className="text-2xl font-bold text-warmGray-900 mb-2">
          Your Recipe Collection
        </Text>
        <Text className="text-base text-warmGray-500 text-center leading-6">
          Save and organize your favorite recipes. Browse by cuisine, cooking
          time, or ingredients you have on hand.
        </Text>
      </View>
    </SafeAreaView>
  );
}
