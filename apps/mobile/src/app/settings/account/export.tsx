import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
// expo-file-system v19 refactored the top-level API into Paths + File classes,
// but the v18-style function API (cacheDirectory + writeAsStringAsync +
// EncodingType) is still exported from the /legacy subpath. We use it here
// because it's a simpler call surface for a one-off "write a text file"
// operation that doesn't need the new streaming/Blob affordances.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { authedFetch } from '../../../lib/authedFetch';

/**
 * Phase 23-02: /settings/account/export screen (NFR-03).
 *
 * Flow:
 *   1. User taps "Download export".
 *   2. GET /api/v1/account/export via authedFetch (handles Bearer + 401
 *      refresh automatically).
 *   3. Response body is a large JSON document — we DON'T parse it here; we
 *      just read it as text + write it to a file in the cache directory.
 *   4. Open the iOS share sheet via Sharing.shareAsync — the user chooses
 *      Save to Files, Mail, AirDrop, etc.
 *   5. On any failure: toast + stay on the screen so the user can retry.
 *
 * Why a file + share sheet (not a direct download or raw Blob):
 *   - iOS has no browser-style "download to disk" affordance inside a native
 *     app. Sharing.shareAsync is the canonical primitive for "hand this file
 *     to another app" on iOS — it surfaces Files, Mail, Messages, AirDrop,
 *     plus any third-party share extensions installed.
 *   - Writing to FileSystem.cacheDirectory (not documentDirectory) keeps the
 *     raw export out of the user's iCloud Drive backup and lets iOS purge it
 *     if disk pressure spikes. A copy the user chose to save via Files /
 *     Mail is durable; the cache copy is ephemeral.
 */

const EXPORT_FILENAME = 'dinnertime-export.json';

export default function ExportDataScreen() {
  const [submitting, setSubmitting] = useState(false);
  const { show, ToastComponent } = useToast();

  const onDownload = async () => {
    setSubmitting(true);
    try {
      const res = await authedFetch('/api/v1/account/export', {
        method: 'GET',
      });

      if (!res.ok) {
        show('Couldn’t prepare your export — try again.', 'error');
        return;
      }

      const body = await res.text();
      const fileUri = `${FileSystem.cacheDirectory ?? ''}${EXPORT_FILENAME}`;
      await FileSystem.writeAsStringAsync(fileUri, body, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        // Should never happen on iOS, but the expo-sharing contract requires
        // the probe. Degrade gracefully with a toast rather than silently
        // writing a file the user can't see.
        show('Sharing isn’t available on this device.', 'error');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export DinnerTime data',
        UTI: 'public.json',
      });
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[export] failed', err);
      }
      show('Network error — try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Export data' }} />
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
          <Text className="text-base text-warmGray-700 mb-4">
            Download a JSON copy of your profile, pantry, recipes, meal plans,
            and cook history.
          </Text>
          <Text className="text-sm text-warmGray-500 mb-6">
            We’ll prepare the file and then open iOS share sheet so you can
            save it to Files, email it to yourself, or AirDrop it to another
            device.
          </Text>
          <View className="mt-2">
            <Button
              title="Download export"
              onPress={onDownload}
              loading={submitting}
              disabled={submitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
