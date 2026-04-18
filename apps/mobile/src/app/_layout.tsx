import '../global.css';

import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { OfflineBanner } from '../components/OfflineBanner';
import { colors } from '../design/tokens';
// Importing networkStore here ensures its module-side-effect NetInfo
// listener is wired at app boot even before any screen mounts.
import '../stores/networkStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  },
});

function RootNavigator() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isLoading = useAuthStore((s) => s.isLoading);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    const cleanup = initialize();
    return cleanup;
  }, [initialize]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false, headerBackTitle: '' }}>
          <Stack.Screen
            name="settings"
            options={{
              headerShown: true,
              title: 'Settings',
              headerStyle: { backgroundColor: colors.bg },
              headerTintColor: colors.textPrimary,
              headerShadowVisible: false,
              headerBackTitle: '',
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              presentation: 'modal',
              headerShown: true,
              title: 'Search',
            }}
          />
        </Stack>
      </View>
    </View>
  );
}

function AuthStateBanner() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const isLoading = useAuthStore((s) => s.isLoading);
  // Dev-only sentinel banner — uses bg-brand/15 + text-brand tokens via inline style
  // (can't use className on StyleSheet-style View backgroundColor).
  return (
    <View style={{ padding: 16, paddingTop: 60, backgroundColor: colors.surfaceSubtle }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
        loading={String(isLoading)} loggedIn={String(isLoggedIn)} onboarded={String(isOnboarded)}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  console.log('[DinnerTime] RootLayout mounted');
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1 }}>
          <AuthStateBanner />
          <View style={{ flex: 1 }}>
            <RootNavigator />
          </View>
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
