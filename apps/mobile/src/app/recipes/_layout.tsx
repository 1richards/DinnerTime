import { Stack } from 'expo-router';

export default function RecipesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="import" options={{ title: 'Import Recipe' }} />
      <Stack.Screen name="import-url" options={{ title: 'Paste URL' }} />
      <Stack.Screen name="import-photo" options={{ title: 'Take Photo' }} />
      <Stack.Screen name="import-manual" options={{ title: 'Type Recipe' }} />
      <Stack.Screen name="review" options={{ title: 'Review Recipe' }} />
    </Stack>
  );
}
