import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';

/**
 * Root entry — redirect into the right group based on auth state.
 */
export default function Index() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);

  if (!isLoggedIn) return <Redirect href="/(auth)/login" />;
  if (!isOnboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/kitchen" />;
}
