import { Stack } from 'expo-router';

/**
 * Phase 21-05: nested stack for Settings sub-routes (Pantry Rules + Staples).
 * Follows Phase 15-02 card-presentation push convention (not modal) so Back
 * returns to the Settings tab root.
 */
export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
        headerBackTitle: '',
      }}
    >
      <Stack.Screen name="pantry-rules" options={{ title: 'Pantry Rules' }} />
      <Stack.Screen name="staples" options={{ title: 'Staples' }} />
    </Stack>
  );
}
