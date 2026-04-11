import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';

export default function HomeScreen() {
  const displayName = useAuthStore((s) => s.profile?.display_name);

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-4xl mb-4">🏠</Text>
        <Text className="text-2xl font-bold text-warmGray-900 mb-2">
          {displayName ? `Hey, ${displayName}!` : 'Your Dinner Dashboard'}
        </Text>
        <Text className="text-base text-warmGray-500 text-center leading-6">
          Your personalized dinner suggestions will appear here. Snap a photo
          of your fridge to get started!
        </Text>
      </View>
    </SafeAreaView>
  );
}
