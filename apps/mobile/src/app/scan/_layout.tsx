import { Stack } from 'expo-router';
import { HeaderCloseButton } from '../../components/ui/HeaderCloseButton';

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
        headerBackTitle: '',
        headerTitleAlign: 'center',
        gestureEnabled: true,
        // Modal cascades to every screen; sub-screens (review) override to
        // 'card' so they push inside the modal instead of presenting as a
        // nested modal. See 15-RESEARCH.md Pitfall 2.
        presentation: 'modal',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Scan Your Kitchen',
          headerLeft: () => <HeaderCloseButton />,
        }}
      />
      <Stack.Screen
        name="review"
        options={{
          title: 'Review Items',
          // Push inside the modal (not a nested modal). Back chevron auto-provided.
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="receipt"
        options={{
          title: 'Scan Receipt',
          headerLeft: () => <HeaderCloseButton />,
        }}
      />
      <Stack.Screen
        name="instacart"
        options={{
          title: 'Import from Instacart',
          headerLeft: () => <HeaderCloseButton />,
        }}
      />
    </Stack>
  );
}
