/**
 * Phase 23-02: Delete-account confirmation sheet + performDelete helper.
 *
 * NFR-04 (App Store privacy): delete-account must be a deliberate two-step
 * confirm — user types "DELETE" (case-sensitive) AND taps a red destructive
 * button. Neither step alone is sufficient.
 *
 * The sheet is an INLINE controlled component, not a floating modal: the
 * parent screen (/settings/account/delete) renders it as the whole body of
 * the screen so the destructive action is the user's explicit arrival, not a
 * misfire from anywhere else in the app.
 *
 * performDelete is exported separately so it can be unit-tested without
 * spinning up a React renderer. It POSTs to /account/delete via authedFetch
 * (which handles base-URL prepend + Bearer attach + 401/refresh dance), then
 * calls useAuthStore.getState().signOut() so subsequent screens can't see
 * stale session state. The server already cascade-deleted the auth.users row,
 * so any next request would 401 anyway — signing out client-side just keeps
 * the UI honest.
 */

import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Input } from '../ui/Input';
import { colors } from '../../design/tokens';
import { authedFetch } from '../../lib/authedFetch';
import { useAuthStore } from '../../stores/authStore';

// ---------------------------------------------------------------------------
// Pure helpers (unit-testable without React)
// ---------------------------------------------------------------------------

/**
 * Returns true iff the user typed the exact literal "DELETE".
 * Case-sensitive, no whitespace, no near-matches — the red button stays
 * disabled until this returns true.
 */
export function canConfirmDelete(input: string): boolean {
  return input === 'DELETE';
}

export interface PerformDeleteArgs {
  reason?: string | null;
}

export interface PerformDeleteResult {
  ok: boolean;
  status: number;
}

/**
 * Fires the DELETE request + signs the user out on success.
 *
 * On non-2xx the auth session is LEFT intact so the user can retry. authedFetch
 * handles the 401/refresh dance internally; the only errors that reach us here
 * are either network drops or 5xx/500 responses.
 */
export async function performDelete(
  args: PerformDeleteArgs = {},
): Promise<PerformDeleteResult> {
  const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
  const res = await authedFetch('/api/v1/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason.length > 0 ? reason : null }),
  });

  if (res.ok) {
    // Clear the session. The auth.users row is already gone server-side; this
    // just keeps the client-side auth state honest.
    await useAuthStore.getState().signOut();
  }

  return { ok: res.ok, status: res.status };
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

export interface DeleteAccountSheetProps {
  /**
   * Called after the user has typed DELETE and tapped the red button. Parent
   * handles the performDelete call + navigation (so the screen can show an
   * Alert and then router.replace to /(auth)/login).
   */
  onConfirm: (reason: string | null) => void | Promise<void>;
  /** Called when the user taps Cancel. */
  onCancel?: () => void;
  /** While a delete is in flight the parent sets this to true to disable the button + show loading copy. */
  submitting?: boolean;
}

export function DeleteAccountSheet({
  onConfirm,
  onCancel,
  submitting = false,
}: DeleteAccountSheetProps) {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const canSubmit = !submitting && canConfirmDelete(confirmText);

  const onDeletePress = () => {
    if (!canSubmit) return;
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
  };

  return (
    <View className="px-6 py-6">
      {/* Red warning block — the visual anchor of the destructive flow. */}
      <View
        className="rounded-button p-4 mb-6"
        style={{ backgroundColor: `${colors.destructive}15` }}
      >
        <Text className="text-base font-semibold text-destructive mb-1">
          Delete your DinnerTime account?
        </Text>
        <Text className="text-sm text-warmGray-700">
          This permanently deletes your account. Your data is retained for 30
          days for audit, then purged forever.
        </Text>
      </View>

      <Input
        label="Help us improve — why are you leaving? (optional)"
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={3}
        autoCapitalize="sentences"
      />

      <Input
        label="Type DELETE to confirm"
        value={confirmText}
        onChangeText={setConfirmText}
        autoCapitalize="characters"
        autoCorrect={false}
      />

      {/* Destructive Pressable — NOT the Button component on purpose. The
          text + onPress live on the same leaf so future test tree-walkers
          (DeleteAccountSheet.test.ts pattern) can match them cleanly. */}
      <Pressable
        onPress={onDeletePress}
        disabled={!canSubmit}
        accessibilityRole="button"
        accessibilityLabel="Delete my account"
        className={`rounded-button py-3.5 items-center mb-3 ${
          canSubmit ? '' : 'opacity-50'
        }`}
        style={{ backgroundColor: colors.destructive }}
      >
        <Text className="text-white font-semibold text-base">
          {submitting ? 'Deleting…' : 'Delete my account'}
        </Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        className="rounded-button py-3.5 items-center"
      >
        <Text className="text-base text-warmGray-700">Cancel</Text>
      </Pressable>
    </View>
  );
}

export default DeleteAccountSheet;
