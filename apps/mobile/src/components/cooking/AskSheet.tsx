/**
 * AskSheet — Phase 16 Wave 2 (16-05).
 *
 * Retokened from Phase 9:
 *   - All hardcoded warmGray-* / warmWhite classes replaced with Phase 19
 *     tokens (bg-surface, text-text-primary, text-text-secondary, border).
 *   - Typography normalized to body role (17pt). No font-size literals.
 *   - Added error state (renders ErrorState primitive) per UI-SPEC §Error
 *     States: "Couldn't reach the kitchen assistant. Try again in a moment."
 *   - Incremental answer rendering: when `answer` prop updates while the
 *     sheet is visible, the inner <Text> node re-renders with the new value.
 *     No typewriter effect, no cursor — just React's normal prop diff. This
 *     is the SSE streaming contract — 16-02 shipped the streamAsk client,
 *     16-06 wires cook.tsx to forward deltas into this prop.
 *
 * Loading state: Shows a spinner ONLY when `loading && !answer` — once any
 * delta has arrived (answer is a non-empty string), the spinner hides and
 * the Text renders whatever has streamed in so far.
 */
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { ErrorState } from '../ui/ErrorState';
import { colors } from '../../design/tokens';

export interface AskSheetProps {
  visible: boolean;
  /** User's recognized question — shown as the recap header. */
  question: string;
  /** Streaming answer; updates incrementally during SSE. `null` while pending. */
  answer: string | null;
  /** True while awaiting the first delta; auto-clears once `answer` has content. */
  loading: boolean;
  /** Non-null when the /ask request failed — renders ErrorState instead of the body. */
  error?: string | null;
  onClose: () => void;
}

export function AskSheet({
  visible,
  question,
  answer,
  loading,
  error = null,
  onClose,
}: AskSheetProps) {
  const showSpinner = loading && (answer === null || answer.length === 0);
  const showAnswer = !error && answer !== null && answer.length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable onPress={onClose} className="flex-1 bg-black/40 justify-end">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="bg-surface rounded-t-3xl px-6 pt-6 pb-10"
          style={{ maxHeight: '70%' }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-body font-bold text-text-primary flex-1 mr-3">
              You asked
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <SymbolIcon
                name="xmark"
                size="title"
                tintColor={colors.textSecondary}
              />
            </Pressable>
          </View>

          {question ? (
            <View className="mb-4 p-4 rounded-xl bg-surface-subtle">
              <Text className="text-body italic text-text-secondary">
                "{question}"
              </Text>
            </View>
          ) : null}

          {error ? (
            <ErrorState
              title="Couldn't reach the kitchen assistant."
              message="Try again in a moment."
              variant="banner"
            />
          ) : showSpinner ? (
            <View className="items-center py-6">
              <ActivityIndicator size="large" color={colors.brand} />
              <Text className="text-caption text-text-tertiary mt-2">
                Thinking…
              </Text>
            </View>
          ) : showAnswer ? (
            <ScrollView className="mb-4" style={{ maxHeight: 240 }}>
              <Text className="text-body text-text-primary">{answer}</Text>
            </ScrollView>
          ) : null}

          <Button title="Close" onPress={onClose} variant="secondary" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default AskSheet;
