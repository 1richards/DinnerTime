/**
 * Reset password screen (Phase 23-04, NFR-09).
 *
 * Landing page for the Supabase password-recovery deep link. The link
 * format is:
 *
 *   dinnertime://auth/reset-password#access_token=…&refresh_token=…&type=recovery
 *
 * Tokens live in the URL HASH FRAGMENT (per Supabase's default recovery
 * template). We parse them in a useEffect (using expo-linking's `useURL`
 * hook) and exchange them via `supabase.auth.setSession` to mint an
 * authenticated session for this device. The user then enters a new
 * password twice; on submit we call `supabase.auth.updateUser({ password })`
 * and redirect into the tabs.
 *
 * Edge cases:
 *   - No tokens in URL → show a "This link is expired or invalid" panel
 *     with a Back-to-sign-in CTA.
 *   - Password < 8 chars → inline validation, no network call.
 *   - Passwords don't match → inline validation.
 *   - Supabase updateUser error → inline error banner.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useURL } from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { colors } from '../../design/tokens';

interface RecoveryTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Parse the hash-fragment tokens out of a recovery URL.
 *
 * Supabase's recovery email produces URLs whose tokens live in the hash
 * fragment (after `#`) — `access_token`, `refresh_token`, `type=recovery`.
 * The iOS deep-link handler delivers the URL unchanged, so we can parse
 * naively with string splits. Exported pure for easier testing later.
 */
export function parseRecoveryUrl(url: string | null): RecoveryTokens | null {
  if (!url) return null;
  const hashIdx = url.indexOf('#');
  if (hashIdx < 0) return null;
  const fragment = url.slice(hashIdx + 1);
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export default function ResetPasswordScreen() {
  const currentUrl = useURL();
  const tokens = useMemo(() => parseRecoveryUrl(currentUrl), [currentUrl]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (!tokens) return;
    (async () => {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
      if (sessionError) {
        setError('This reset link has expired. Request a new one.');
        return;
      }
      setSessionReady(true);
    })();
  }, [tokens]);

  const handleSubmit = async () => {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.replace('/(tabs)/kitchen');
    } finally {
      setLoading(false);
    }
  };

  // Invalid / missing tokens — show a dead-link panel.
  if (!tokens) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View style={styles.body}>
          <Text style={styles.title}>Reset link invalid</Text>
          <Text style={styles.subtitle}>
            This link is expired or missing recovery tokens. Request a new
            password-reset email from the sign-in screen.
          </Text>
          <Button
            title="Back to sign in"
            onPress={() => router.replace('/(auth)/login')}
            className="mt-4"
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerClassName="flex-grow"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.body}>
            <Text style={styles.title}>Set a new password</Text>
            <Text style={styles.subtitle}>
              Choose a password with at least 8 characters. You'll be signed
              in automatically when you save.
            </Text>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="New password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="password-new"
            />
            <Input
              label="Confirm new password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />

            <Button
              title="Save new password"
              onPress={handleSubmit}
              loading={loading}
              disabled={!sessionReady}
              className="mt-2"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  errorBanner: {
    backgroundColor: 'rgba(220,38,38,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.25)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    textAlign: 'center',
  },
});
