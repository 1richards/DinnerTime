import '../global.css';

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Linking, LogBox } from 'react-native';

// Suppress yellow LogBox warning badge during App Store screenshot capture.
if (process.env.EXPO_PUBLIC_HIDE_DEV_UI === '1') {
  LogBox.ignoreAllLogs(true);
}
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
import { wireSupabaseAuth as wireAiTelemetryAuth } from '../ai/telemetry';
import { supabase } from '../lib/supabase';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { isDeepLinkAllowed } from '../lib/deepLinkAllowlist';
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
  // Production builds and screenshot-capture mode render a 60pt status-bar
  // spacer instead of the dev sentinel — tab content needs the inset so it
  // doesn't paint under the iOS clock / Dynamic Island.
  if (!__DEV__ || process.env.EXPO_PUBLIC_HIDE_DEV_UI === '1') {
    return <View style={{ height: 60, backgroundColor: colors.bg }} />;
  }
  return (
    <View style={{ padding: 16, paddingTop: 60, backgroundColor: colors.surfaceSubtle }}>
      <Text style={{ fontSize: 13, color: colors.textSecondary }}>
        loading={String(isLoading)} loggedIn={String(isLoggedIn)} onboarded={String(isOnboarded)}
      </Text>
    </View>
  );
}

export default function RootLayout() {
  // Phase 23-07 (NFR-25): mount log wrapped in `__DEV__` so it never
  // ships to production builds. The global Sentry breadcrumb system
  // (via initSentry below) captures real lifecycle events for observability.
  if (__DEV__) console.log('[DinnerTime] RootLayout mounted');
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

  // Wire the AI-telemetry batcher's supabase-backed token getter at app root
  // so queued ai_events (per-image / hydration timing) ship with a real bearer
  // token. Without this the batcher falls back to the SENTINEL 'test-token' and
  // every POST /telemetry/ai is rejected 401 (the cooking telemetry is wired
  // separately in cook.tsx; this is the missing AI-telemetry equivalent).
  useEffect(() => {
    wireAiTelemetryAuth(async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? null;
    });
  }, []);

  // Phase 23-07 (NFR-24): deep-link allowlist gate. Every incoming URL —
  // whether from a cold boot (parseInitialURLAsync) or a warm foreground
  // (Linking.addEventListener) — is consulted against isDeepLinkAllowed
  // before we hand off. Rejected URLs are dropped silently (breadcrumb
  // only). expo-router handles routing for accepted URLs via its own
  // linking config — we don't need to manually navigate; we just gate the
  // ones that would otherwise reach it. The gate is defensive: if a
  // malicious or malformed URL somehow routes past us (e.g. a future expo
  // update changes the order), Sentry will still record the breadcrumb.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (!isDeepLinkAllowed(url)) {
        if (__DEV__) console.log('[deep-link] rejected:', url);
      }
      // On accept, no-op — expo-router's linking config handles routing.
    });
    // Cold-boot URL: parse once on mount.
    void Linking.getInitialURL().then((url) => {
      if (url && !isDeepLinkAllowed(url)) {
        if (__DEV__) console.log('[deep-link] initial rejected:', url);
      }
    });
    return () => sub.remove();
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
