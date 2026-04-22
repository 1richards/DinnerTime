/**
 * Forgot password screen (Phase 23-04, NFR-09).
 *
 * Collects the user's email and fires `supabase.auth.resetPasswordForEmail`
 * with `redirectTo: 'dinnertime://auth/reset-password'`. Supabase mails a
 * link that bounces the user into /(auth)/reset-password with the recovery
 * token in the URL fragment. On success the form is replaced by a static
 * "Check your email" panel so the user has an obvious next step.
 *
 * Design decisions (23-CONTEXT D-09):
 *   - No rate-limit UI here — Supabase enforces server-side throttling.
 *   - "Back to sign in" CTA uses router.back() so the history stack stays
 *     clean and the login screen re-mounts with its pre-filled state intact
 *     (when the user came in via the "Forgot password?" link).
 */
import { useState } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { colors } from '../../design/tokens';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: 'dinnertime://auth/reset-password' },
      );
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

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
            <Text style={styles.title}>Reset your password</Text>
            <Text style={styles.subtitle}>
              Enter the email you use for DinnerTime and we'll send a link to
              set a new password.
            </Text>

            {sent ? (
              <View style={styles.successPanel}>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successBody}>
                  Tap the reset link to continue. The link expires in 1 hour.
                </Text>
                <Button
                  title="Back to sign in"
                  onPress={() => router.back()}
                  className="mt-4"
                />
              </View>
            ) : (
              <>
                {error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <Input
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  autoComplete="email"
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                />

                <Button
                  title="Send reset email"
                  onPress={handleSubmit}
                  loading={loading}
                  className="mt-2"
                />

                <View style={styles.backRow}>
                  <Text
                    style={styles.backLink}
                    onPress={() => router.back()}
                    accessibilityRole="link"
                  >
                    Back to sign in
                  </Text>
                </View>
              </>
            )}
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
  successPanel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 20,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  successBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  backRow: {
    marginTop: 24,
    alignItems: 'center',
  },
  backLink: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '600',
  },
});
