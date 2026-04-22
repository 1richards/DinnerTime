import React, { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../components/ui/Toast';
import { supabase } from '../../../lib/supabase';

/**
 * Phase 23-01: /settings/account/change-password screen.
 *
 * Flow:
 *   1. User enters current password + new password + confirm new password.
 *   2. Client-side: new must equal confirm, new must be ≥ 8 chars.
 *   3. POST /api/v1/account/change-password with Bearer access token.
 *   4. 200 → success toast + router.back()
 *      401 → inline error "Current password incorrect"
 *      other → toast "Couldn't change password — try again."
 *
 * TODO-23-04: switch the inline fetch to `authedFetch` from
 * `apps/mobile/src/lib/authedFetch.ts` once 23-04 lands. That wrapper handles
 * the 401→refresh→retry→ReAuthModal dance; here we surface 401 as a password
 * error because the server responds 401 only for wrong-current-password, not
 * for token expiry.
 */

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentError, setCurrentError] = useState<string | undefined>(undefined);
  const [newError, setNewError] = useState<string | undefined>(undefined);
  const { show, ToastComponent } = useToast();

  const onSubmit = async () => {
    setCurrentError(undefined);
    setNewError(undefined);

    if (!currentPassword) {
      setCurrentError('Enter your current password');
      return;
    }
    if (newPassword.length < 8) {
      setNewError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setNewError('New password and confirmation don’t match');
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        show('You’re signed out. Sign back in to change your password.', 'error');
        return;
      }

      const res = await fetch(
        `${getApiBaseUrl()}/api/v1/account/change-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        },
      );

      if (res.status === 200) {
        show('Password updated');
        // Small delay so the user sees the toast before the screen pops.
        setTimeout(() => router.back(), 400);
        return;
      }

      if (res.status === 401) {
        setCurrentError('Current password incorrect');
        return;
      }

      if (res.status === 400) {
        setNewError('New password doesn’t meet requirements');
        return;
      }

      show('Couldn’t change password — try again.', 'error');
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[change-password] failed', err);
      }
      show('Network error — try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Change password' }} />
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
          <Text className="text-base text-warmGray-700 mb-6">
            Enter your current password, then choose a new password of at least
            8 characters.
          </Text>
          <Input
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            error={currentError}
          />
          <Input
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            error={newError}
          />
          <Input
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <View className="mt-2">
            <Button
              title="Update password"
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
