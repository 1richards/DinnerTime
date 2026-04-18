import { Stack } from 'expo-router';

export default function ShoppingLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="orders" options={{ title: 'Orders' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
    </Stack>
  );
}
