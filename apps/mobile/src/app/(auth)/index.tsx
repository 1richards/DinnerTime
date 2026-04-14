import { Redirect } from 'expo-router';

/**
 * (auth) group default — sends to login.
 */
export default function AuthIndex() {
  return <Redirect href="/(auth)/login" />;
}
