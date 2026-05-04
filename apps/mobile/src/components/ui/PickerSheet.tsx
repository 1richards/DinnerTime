/**
 * PickerSheet — shared modal shell for "pick a steering option for the AI"
 * surfaces (FocusPickerSheet for weekly skill focus, RemixSheet's mode
 * picker for recipe variation modes).
 *
 * Provides:
 *   - iOS pageSheet Modal with slide animation
 *   - 36×4pt drag-indicator pill above the header
 *   - Kicker (small caps brand-tinted) + Title (bold dark) + optional Subtitle
 *   - 36pt circular close button (xmark) — onClose fires when pressed
 *   - heroSlot above the body grid (e.g. RemixSheet's Surprise card +
 *     custom-instructions row)
 *   - children = the body grid (caller renders OptionCards in a flex-row-wrap
 *     container with rowGap 12 and width: '48%')
 *   - footerSlot below the body grid (e.g. FocusPickerSheet's "Clear focus"
 *     outline button when a theme is set)
 *
 * Visual notes:
 *   - sheet uses colors.bg ('#FAF7F2') — both pickers now share the canonical
 *     warm app background. FocusPickerSheet's old '#FFFBF5' was a one-off.
 *   - Hairline below the header uses colors.borderSubtle.
 *   - Close button bg uses colors.surfaceSubtle.
 *
 * NOT included (caller-owned):
 *   - Body width sizing (caller wraps OptionCards with width: '48%').
 *   - Spacing/padding inside the grid container — varies by caller.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SymbolIcon } from './SymbolIcon';
import { colors } from '../../design/tokens';

export interface PickerSheetProps {
  /** Modal visibility — bound through to react-native Modal's visible prop. */
  visible: boolean;
  /** Small-caps brand-tinted line above the title (e.g. 'WEEKLY FOCUS'). */
  kicker: string;
  /** Bold dark heading (e.g. 'Pick a skill to practice'). */
  title: string;
  /** Optional helper copy under the title. */
  subtitle?: string;
  /** Fired when user taps the close (X) button or iOS swipe-to-dismiss. */
  onClose: () => void;
  /** Renders above the body grid. e.g. Surprise hero + custom-instructions row. */
  heroSlot?: React.ReactNode;
  /** Renders below the body grid. e.g. "Clear focus" outline button. */
  footerSlot?: React.ReactNode;
  /** The body grid — caller renders OptionCards in a flex-row-wrap container. */
  children: React.ReactNode;
}

export function PickerSheet({
  visible,
  kicker,
  title,
  subtitle,
  onClose,
  heroSlot,
  footerSlot,
  children,
}: PickerSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Drag-indicator pill — pure visual affordance for the swipe-down
            dismiss. iOS already animates the pageSheet handle when you drag,
            but having a stationary visual cue at the top of the surface
            prevents the screen from feeling like a full-screen takeover. */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityLabel="Close"
            accessibilityRole="button"
          >
            <SymbolIcon
              name="xmark"
              size="action"
              tintColor={colors.textPrimary}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {heroSlot ? <View style={styles.heroSlot}>{heroSlot}</View> : null}
          {children}
          {footerSlot ? (
            <View style={styles.footerSlot}>{footerSlot}</View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  handleRow: {
    paddingTop: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceSubtle,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.brand,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heroSlot: {
    marginBottom: 16,
  },
  footerSlot: {
    marginTop: 16,
  },
});
