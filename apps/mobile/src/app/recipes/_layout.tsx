import { Stack } from 'expo-router';
import { HeaderCloseButton } from '../../components/ui/HeaderCloseButton';

export default function RecipesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#FFFBF5' },
        headerTintColor: '#1F2937',
        headerShadowVisible: false,
        headerBackTitle: '',
        headerTitleAlign: 'center',
        gestureEnabled: true,
        // NO blanket `presentation: 'modal'` — imports are modal, destinations
        // are push. See 15-RESEARCH.md "Recipe import flow" for the mapping.
      }}
    >
      {/* Import flow — modal */}
      <Stack.Screen
        name="import"
        options={{
          title: 'Import Recipe',
          presentation: 'modal',
          headerLeft: () => <HeaderCloseButton />,
        }}
      />
      <Stack.Screen
        name="import-url"
        options={{
          title: 'Paste URL',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="import-photo"
        options={{
          title: 'Take Photo',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="import-manual"
        options={{
          title: 'Type Recipe',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="review"
        options={{
          title: 'Review Recipe',
          presentation: 'modal',
          headerLeft: () => <HeaderCloseButton />,
        }}
      />

      {/* Destinations — push */}
      <Stack.Screen name="discover" options={{ title: 'Discover' }} />
      <Stack.Screen
        name="[id]/index"
        // Hero-image floating back pattern — legitimate exception per
        // 15-RESEARCH.md "Custom header boilerplate to remove". The screen
        // itself also sets `<Stack.Screen options={{ headerShown: false }} />`
        // as the source of truth; this registration is for completeness.
        options={{ headerShown: false }}
      />
      <Stack.Screen name="[id]/edit" options={{ title: 'Edit Recipe' }} />
      {/* [id]/cook sets its own headerShown:false + gestureEnabled:false inline */}
    </Stack>
  );
}
