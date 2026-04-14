import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';

export default function AuthLayout() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  // Once the user is authenticated, kick them out of the auth group
  // to the appropriate next destination.
  if (isLoggedIn && !isOnboarded) {
    return <Redirect href="/onboarding" />;
  }
  if (isLoggedIn && isOnboarded) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFBF5' },
        animation: 'slide_from_right',
      }}
    />
  );
}
