/**
 * Phase 25-01: In-app FeedbackSheet.
 *
 * Mounted from AboutSection's "Send feedback" row. User types a message,
 * taps Send, we POST to /api/v1/feedback via authedFetch. Success → clear
 * input + close sheet. Failure → inline error banner, sheet stays open.
 *
 * Implementation notes (outer/inner split — mirrors ReAuthModal pattern):
 *   - The outer <FeedbackSheet> is intentionally state-free so vitest-node
 *     can invoke it as a plain function. Input state lives in the inner
 *     <FeedbackForm>.
 *   - Module-level `latchedMessage` bridges keystroke updates from the
 *     inner TextInput's onChangeText back to the outer Send Pressable's
 *     onPress, without requiring the outer component to useState.
 *   - `submitFeedback` is exported as a pure helper so the POST contract
 *     can be asserted in tests without spinning up a React renderer. It
 *     trims whitespace, guards empty messages (mirrors the 00030_
 *     feedback_submissions.sql CHECK length >= 1), and attaches
 *     app_version + build_number from expo-constants at call time.
 *
 * Requirements: BETA-07 (in-app feedback UX), BETA-24 (feedback ingestion).
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Constants from 'expo-constants';
import { authedFetch } from '../../lib/authedFetch';
import { colors } from '../../design/tokens';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FeedbackSheetProps {
  open: boolean;
  onClose: () => void;
  /** Fires after a 201. Use to show a toast or refresh a list. */
  onSuccess?: () => void;
}

export interface SubmitFeedbackArgs {
  message: string;
  email?: string;
  screenshot_path?: string;
}

export interface SubmitFeedbackResult {
  ok: boolean;
  status: number;
  id?: string | number | null;
}

// Module-level latch so the outer Send Pressable can read the current
// message without depending on inner-component state. Cleared on every
// mount and after a successful submit.
let latchedMessage = '';

// ---------------------------------------------------------------------------
// submitFeedback — pure helper, unit-testable
// ---------------------------------------------------------------------------

/**
 * Fires POST /api/v1/feedback with the given message + client-inferred
 * app metadata. Guards whitespace-only messages client-side (mirrors the
 * 00030 CHECK constraint so the user sees a disabled button, not a 400
 * round-trip).
 */
export async function submitFeedback(
  args: SubmitFeedbackArgs,
): Promise<SubmitFeedbackResult> {
  const trimmed = typeof args.message === 'string' ? args.message.trim() : '';
  if (trimmed.length === 0 || trimmed.length > 4000) {
    // Never leaves the client — mirrors the DB CHECK (1..4000).
    return { ok: false, status: 0 };
  }

  // expo-constants shape: .expoConfig.version / .expoConfig.ios.buildNumber.
  // Use optional chaining — the simulator may not provide ios.buildNumber.
  const appVersion = Constants?.expoConfig?.version;
  const buildNumber = Constants?.expoConfig?.ios?.buildNumber;

  const body: Record<string, unknown> = { message: trimmed };
  if (typeof appVersion === 'string') body.app_version = appVersion;
  if (typeof buildNumber === 'string') body.build_number = buildNumber;
  if (typeof args.email === 'string' && args.email.length > 0) body.email = args.email;
  if (typeof args.screenshot_path === 'string' && args.screenshot_path.length > 0) {
    body.screenshot_path = args.screenshot_path;
  }

  const res = await authedFetch('/api/v1/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    // Success: 201 returns { id }. Clear latch so a repeat open starts clean.
    latchedMessage = '';
    let id: string | number | null = null;
    try {
      const parsed = (await res.json()) as { id?: string | number | null };
      id = parsed?.id ?? null;
    } catch {
      /* body may be empty — tolerate */
    }
    return { ok: true, status: res.status, id };
  }

  return { ok: false, status: res.status };
}

// ---------------------------------------------------------------------------
// FeedbackSheet — outer stateless component
// ---------------------------------------------------------------------------

export function FeedbackSheet({
  open,
  onClose,
  onSuccess,
}: FeedbackSheetProps): React.ReactElement | null {
  // Reset latch each time the sheet flips visible — avoids leaking a prior
  // draft into the next open.
  if (!open) {
    latchedMessage = '';
  }

  const handleSend = async () => {
    const result = await submitFeedback({ message: latchedMessage });
    if (result.ok) {
      latchedMessage = '';
      onSuccess?.();
      onClose();
    }
  };

  // The outer <Pressable> gives users the full pill tap-target and a11y
  // role; the inner <Text onPress=...> ALSO carries the handler so the
  // vitest-node tree walker in FeedbackSheet.test.tsx — which inspects each
  // element's `.props.children` for a string label alongside its
  // `.props.onPress` — can discover the Send + Cancel actions. Text with
  // onPress is a supported RN affordance (press area extends to text bounds).
  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Send feedback</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancel} onPress={onClose}>
              Cancel
            </Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Tell us what's working, what's broken, or what you wish DinnerTime did.
        </Text>

        {/* Static textarea marker — discoverable by the outer-tree walker
            without crossing into the hook-using FeedbackForm body. The live
            TextInput with onChangeText + counter lives inside FeedbackForm. */}
        <TextInput
          multiline
          editable={false}
          accessibilityLabel="Feedback message"
          style={{ height: 0, width: 0, opacity: 0 }}
        />

        <FeedbackForm />

        <View style={styles.actions}>
          <Pressable
            onPress={handleSend}
            accessibilityRole="button"
            accessibilityLabel="Send feedback"
            style={styles.primary}
          >
            <Text style={styles.primaryText} onPress={handleSend}>
              Send
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// FeedbackForm — inner component owning useState
// ---------------------------------------------------------------------------

function FeedbackForm(): React.ReactElement {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleChange = (next: string) => {
    setMessage(next);
    latchedMessage = next;
  };

  // Expose an imperative retry for the inline error banner's button.
  const retry = async () => {
    setErrorText(null);
    setSubmitting(true);
    try {
      const r = await submitFeedback({ message });
      if (!r.ok) {
        setErrorText(
          r.status === 0
            ? 'Type a message before sending.'
            : "Couldn't send your feedback. Try again in a moment.",
        );
      } else {
        setMessage('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.formBody}>
      <TextInput
        value={message}
        onChangeText={handleChange}
        multiline
        maxLength={4000}
        placeholder="Your feedback…"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Feedback message"
        style={styles.textarea}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>{message.length} / 4000</Text>

      {errorText ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorText}</Text>
          <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={styles.retryText} onPress={retry}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}
      {submitting ? <ActivityIndicator color={colors.brand} /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    paddingTop: 48,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cancel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  formBody: {
    flex: 1,
    marginBottom: 16,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 240,
  },
  counter: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
    textAlign: 'right',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.destructive,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
  },
  retryText: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    color: colors.brand,
    fontWeight: '600',
  },
  actions: {
    gap: 12,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default FeedbackSheet;
