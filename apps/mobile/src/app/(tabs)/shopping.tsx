import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ShoppingScreen() {
  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🛒</Text>
        <Text className="text-2xl font-bold text-warmGray-900 mb-2">
          Shopping Lists
        </Text>
        <Text className="text-base text-warmGray-500 text-center leading-6">
          Auto-generated shopping lists from your meal plans. Order groceries
          directly through Instacart.
        </Text>
      </View>
    </SafeAreaView>
  );
}
