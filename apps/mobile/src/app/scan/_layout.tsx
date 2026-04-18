import { Stack } from 'expo-router';

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Scan Your Kitchen' }}
      />
      <Stack.Screen
        name="review"
        options={{ title: 'Review Items' }}
      />
      <Stack.Screen
        name="receipt"
        options={{ title: 'Scan Receipt' }}
      />
      <Stack.Screen
        name="instacart"
        options={{ title: 'Import from Instacart' }}
      />
    </Stack>
  );
}
