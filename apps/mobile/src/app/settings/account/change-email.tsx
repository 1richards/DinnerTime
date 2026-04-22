import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';

/**
 * Phase 23-01: /settings/account/change-email screen.
 *
 * Flow:
 *   1. User enters new email.
 *   2. Client-side regex sanity check (keeps the error inline before the
 *      server round-trip).
 *   3. POST /api/v1/account/change-email with Bearer access token.
 *   4. 200 → success toast "Confirmation email sent to <new email>. Your
 *      current email stays active until you confirm." + router.back().
 *
 * Supabase handles the confirmation email itself (NFR-02); the old address
 * remains the login identity until the user clicks the confirmation link.
 *
 * TODO-23-04: switch the inline fetch to `authedFetch` once 23-04 lands.
 */

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

// Intentionally relaxed — the server does the definitive RFC-5322 validation
// via zod's `.email()`. Client check is purely a first-pass UX safeguard.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen() {
  const currentEmail = useAuthStore((s) => s.user?.email);
  const [newEmail, setNewEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const { show, ToastComponent } = useToast();

  const onSubmit = async () => {
    setEmailError(undefined);

    if (!EMAIL_REGEX.test(newEmail.trim())) {
      setEmailError('Enter a valid email address');
      return;
    }

    const trimmed = newEmail.trim();
    if (
      currentEmail &&
      trimmed.toLowerCase() === currentEmail.toLowerCase()
    ) {
      setEmailError('That’s already your current email');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        show('You’re signed out. Sign back in to change your email.', 'error');
        return;
      }

      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/account/change-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ newEmail: trimmed }),
        },
      );

      if (res.status === 200) {
        show(`Confirmation sent to ${trimmed}. Old email stays active until you confirm.`);
        setTimeout(() => router.back(), 400);
        return;
      }

      if (res.status === 400) {
        setEmailError('Server rejected that email — try another');
        return;
      }

      show('Couldn’t send confirmation — try again.', 'error');
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[change-email] failed', err);
      }
      show('Network error — try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Change email' }} />
      <ToastComponent />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 py-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-base text-warmGray-700 mb-2">
            We’ll send a confirmation link to your new email. Your current
            address stays signed in until you click the link.
          </Text>
          {currentEmail ? (
            <Text className="text-sm text-warmGray-500 mb-6">
              Current email: {currentEmail}
            </Text>
          ) : (
            <View className="h-6" />
          )}
          <Input
            label="New email"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            error={emailError}
          />
          <View className="mt-2">
            <Button
              title="Send confirmation"
              onPress={onSubmit}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
