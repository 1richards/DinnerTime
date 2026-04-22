import '../global.css';

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { OfflineBanner } from '../components/OfflineBanner';
import { BiometricGate } from '../components/BiometricGate';
import { ReAuthModal } from '../auth/ReAuthModal';
import { setReAuthHandler } from '../auth/sessionRefresh';
import { colors } from '../design/tokens';
import { initSentry, setSentryUser } from '../lib/sentry';
import { ErrorBoundary } from '../components/ErrorBoundary';
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
  // Phase 23-04 (NFR-08, NFR-12): re-auth modal. authedFetch calls
  // triggerReAuth() after a hard 401 that silent-refresh couldn't recover,
  // which flips showReAuth true and paints the modal over whatever screen
  // the user was on. On success the modal dismisses and the user's
  // navigation state is preserved.
  const [showReAuth, setShowReAuth] = useState(false);
  useEffect(() => {
    setReAuthHandler(() => setShowReAuth(true));
    return () => setReAuthHandler(null);
  }, []);

  // Phase 23-06 (NFR-15): observability wiring. Init Sentry once (no-op
  // when EXPO_PUBLIC_SENTRY_DSN is unset — safe for local dev without a
  // Sentry project). Subscribe to authStore so every subsequent event is
  // correlated to the authed user id on sign-in and cleared on sign-out.
  // No email or display name ever leaves the device — only the UUID.
  useEffect(() => {
    initSentry(process.env.EXPO_PUBLIC_SENTRY_DSN);
    // Seed once with the current user (in case hydration already happened).
    setSentryUser(useAuthStore.getState().user?.id ?? null);
    const unsub = useAuthStore.subscribe((s) => {
      setSentryUser(s.user?.id ?? null);
    });
    return unsub;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1 }}>
          {/* Phase 23-05 (NFR-12): global ErrorBoundary wraps the whole
              navigable tree — including the AuthStateBanner and the root
              Stack — so any render-time throw inside any screen shows a
              friendly fallback instead of the RN white-screen-of-death.
              BiometricGate + ReAuthModal live OUTSIDE the boundary so the
              Face ID overlay and re-auth modal still paint even if the
              underlying screen's render threw. */}
          <ErrorBoundary>
            <AuthStateBanner />
            <View style={{ flex: 1 }}>
              <RootNavigator />
            </View>
          </ErrorBoundary>
          {/* Phase 23-03 (NFR-07): Face ID unlock overlay. Sibling to the
              RootNavigator container (NOT nested inside it) with absolute
              positioning + zIndex so it paints over every tab and modal when
              the feature is enabled and the app has just foregrounded. */}
          <BiometricGate />
          {/* Phase 23-04 (NFR-08, NFR-12): hard-401 re-auth prompt. */}
          <ReAuthModal
            visible={showReAuth}
            onDismiss={() => setShowReAuth(false)}
            onSuccess={() => setShowReAuth(false)}
          />
        </View>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
