import React, { useState } from 'react';
import { View, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { DeleteAccountSheet, performDelete } from '../../../components/settings/DeleteAccountSheet';

/**
 * Phase 23-02: /settings/account/delete screen (NFR-04).
 *
 * The screen IS the destructive flow — the DeleteAccountSheet primitive is
 * rendered inline, not as a floating modal. Back button is the only escape
 * route once you're here; that's deliberate.
 *
 * Flow on confirm:
 *   1. performDelete POSTs /account/delete with the optional reason.
 *      Server audit-logs + cascades auth.users deletion (30-day retention
 *      per account_deletions.scheduled_purge_at).
 *   2. authStore.signOut() fires inside performDelete on HTTP-ok.
 *   3. Alert confirms deletion + retention policy + navigates to the auth
 *      stack root on OK.
 *
 * Failure handling:
 *   - Non-ok response from performDelete → error Alert; user stays on screen
 *     for retry.
 *   - Exception (network, auth gate) → same error Alert. The server already
 *     has the audit row either way, so retries are safe.
 */

export default function DeleteAccountScreen() {
  const [submitting, setSubmitting] = useState(false);

  const onConfirm = async (reason: string | null) => {
    setSubmitting(true);
    try {
      const res = await performDelete({ reason });
      if (!res.ok) {
        Alert.alert(
          'Unable to delete',
          'We couldn’t complete the deletion. Please try again in a moment.',
        );
        return;
      }
      // performDelete already signed the user out. Surface the retention
      // policy one last time, then bounce to the auth stack.
      Alert.alert(
        'Account deleted',
        'Your data is retained for 30 days for audit, then purged forever.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login' as never),
          },
        ],
      );
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[delete-account] failed', err);
      }
      Alert.alert(
        'Unable to delete',
        'We couldn’t reach the server. Please try again in a moment.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Delete account' }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <DeleteAccountSheet
              onConfirm={onConfirm}
              onCancel={onCancel}
              submitting={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
