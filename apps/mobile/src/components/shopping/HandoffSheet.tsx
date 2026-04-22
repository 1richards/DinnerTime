/**
 * Phase 20 Wave 3 (plan 20-03) — Apple-Pay-style Instacart handoff sheet.
 *
 * Renders a modal bottom-sheet with three visible states driven by a
 * discriminated-union `state` prop:
 *
 *   - 'sending' → brand-tinted spinner + "Sending to Instacart cart…" copy.
 *                 Backdrop tap is a no-op while in-flight (see 20-RESEARCH
 *                 Pattern 1) so users can't dismiss before we know the
 *                 outcome.
 *   - 'success' → checkmark.circle.fill + "{n} items ready" + primary
 *                 "Open in Instacart" CTA (parent calls openInstacartCart)
 *                 + secondary "View shopping list" CTA (dismisses sheet).
 *   - 'error'   → exclamation-triangle + variant-specific copy
 *                 (network | instacart_api | auth) + "Try again" retry CTA
 *                 + "Cancel" dismiss CTA.
 *
 * The component is a pure consumer: no store writes, no network calls, no
 * telemetry. Parent (shopping.tsx in 20-04) owns the state transitions and
 * wires `onOpenCart` / `onRetry` / `onDismiss`. This keeps the sheet
 * trivially testable in isolation and safe to reuse from both the shopping
 * tab and the recipe-detail order button.
 *
 * CTAs are rendered as Pressable + Text primitives (NOT via the Button
 * component) on purpose: the Wave 0 HandoffSheet.test.tsx flattens the
 * returned element tree statically (no React renderer), so a <Button/>
 * component reference would be opaque to its pressable-by-label search.
 * Both CTAs reuse the Phase 19-02 `variantStyles` map (imported from
 * components/ui/buttonStyles) so spacing/typography/color tokens stay
 * single-sourced and any design refresh to Button propagates here for
 * free.
 *
 * Requirements: SHOP-DC-01 (replaces inline WebBrowser flow), SHOP-DC-02
 * (3 visible states via discriminated union), SHOP-DC-06 (variant-specific
 * error copy + retry affordance).
 */

import {
  Modal,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { variantStyles } from '../ui/buttonStyles';
import { colors } from '../../design/tokens';
import type { HandoffErrorVariant } from '../../shopping/classifyHandoffError';

export type HandoffState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | {
      kind: 'success';
      url: string;
      itemCount: number;
      appInstalled: boolean;
    }
  | {
      kind: 'error';
      variant: HandoffErrorVariant;
      url?: string;
    };

export interface HandoffSheetProps {
  state: HandoffState;
  /** Success state primary CTA — parent opens the returned Instacart URL. */
  onOpenCart?: () => void;
  /** Error state retry CTA — parent re-runs the handoff. */
  onRetry?: () => void;
  /** Backdrop tap, secondary CTA, and close (X) button all funnel here. */
  onDismiss?: () => void;
}

const ERROR_COPY: Record<HandoffErrorVariant, { title: string; subtitle: string }> = {
  network: {
    title: "Can't reach Instacart",
    subtitle: 'Check your connection and try again.',
  },
  instacart_api: {
    title: 'Instacart is temporarily unavailable',
    subtitle: 'Their servers are returning errors. Try again in a minute.',
  },
  auth: {
    title: 'You need to sign in again',
    subtitle: 'Your Instacart link expired. Try again to refresh it.',
  },
};

const noop = () => {};

export function HandoffSheet({
  state,
  onOpenCart,
  onRetry,
  onDismiss,
}: HandoffSheetProps) {
  const visible = state.kind !== 'idle';
  const dismissable = state.kind !== 'sending';

  const handleDismiss = onDismiss ?? noop;
  const handleOpenCart = onOpenCart ?? noop;
  const handleRetry = onRetry ?? noop;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissable ? handleDismiss : noop}
      accessibilityLabel={`Instacart handoff ${state.kind}`}
    >
      {/* Outer container is a plain View (no onPress) so the Wave 0 test's
          static tree-walk finds the inner CTA Pressable as the FIRST match
          of "typeof onPress === 'function' && children include label" — if
          this were a Pressable, the .find() would return this outer one
          instead and invoke the wrong handler. The dismiss affordances are
          explicit: a sibling Pressable backdrop (behind the sheet) + the
          close-button Pressable in the top-right + the secondary CTA. */}
      <View style={styles.backdropContainer}>
        {dismissable && (
          <Pressable
            onPress={handleDismiss}
            style={styles.backdropTouch}
            accessibilityLabel="Dismiss Instacart handoff"
          />
        )}
        <View style={styles.sheet} className="bg-warmWhite">
          {state.kind === 'sending' && (
            <View style={styles.body}>
              <ActivityIndicator
                testID="handoff-sending-spinner"
                accessibilityRole="progressbar"
                size="large"
                color={colors.brand}
              />
              <Text style={styles.title} className="text-warmGray-900">
                Sending to Instacart cart…
              </Text>
              <Text style={styles.subtitle} className="text-warmGray-500">
                Pushing items to your draft cart
              </Text>
            </View>
          )}

          {state.kind === 'success' && (
            <View style={styles.body}>
              <Pressable
                onPress={handleDismiss}
                style={styles.closeBtn}
                hitSlop={12}
                accessibilityLabel="Dismiss"
              >
                <SymbolIcon
                  name="xmark"
                  size={18}
                  tintColor={colors.textTertiary}
                />
              </Pressable>
              <SymbolIcon
                name="checkmark.circle.fill"
                size={56}
                tintColor={colors.brand}
              />
              <Text style={styles.title} className="text-warmGray-900">
                {`${state.itemCount} items ready`}
              </Text>
              <Text style={styles.subtitle} className="text-warmGray-500">
                Continue in Instacart to pick a delivery window and check out.
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={handleOpenCart}
                  accessibilityRole="button"
                  accessibilityLabel="Open in Instacart"
                  className={variantStyles.primary.container}
                >
                  <Text className={variantStyles.primary.text}>
                    Open in Instacart
                  </Text>
                </Pressable>
                <View style={styles.actionsGap} />
                <Pressable
                  onPress={handleDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="View shopping list"
                  className={variantStyles.ghost.container}
                >
                  <Text className={variantStyles.ghost.text}>
                    View shopping list
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {state.kind === 'error' && (
            <View style={styles.body}>
              <Pressable
                onPress={handleDismiss}
                style={styles.closeBtn}
                hitSlop={12}
                accessibilityLabel="Dismiss"
              >
                <SymbolIcon
                  name="xmark"
                  size={18}
                  tintColor={colors.textTertiary}
                />
              </Pressable>
              <SymbolIcon
                name="exclamationmark.triangle"
                size={48}
                tintColor={colors.brand}
              />
              <Text style={styles.title} className="text-warmGray-900">
                {ERROR_COPY[state.variant].title}
              </Text>
              <Text style={styles.subtitle} className="text-warmGray-500">
                {ERROR_COPY[state.variant].subtitle}
              </Text>
              <View style={styles.actions}>
                <Pressable
                  onPress={handleRetry}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  className={variantStyles.primary.container}
                >
                  <Text className={variantStyles.primary.text}>Try again</Text>
                </Pressable>
                <View style={styles.actionsGap} />
                <Pressable
                  onPress={handleDismiss}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  className={variantStyles.ghost.container}
                >
                  <Text className={variantStyles.ghost.text}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// StyleSheet is reserved for positioning, dimensions, and backdrop overlay
// (properties NativeWind cannot express on `Pressable`/`View` reliably in RN
// 0.83 without extra config). Colored surfaces use NativeWind className when
// possible; SF Symbol tint props use colors.brand / colors.textTertiary
// (no raw hex) — see 20-CONTEXT Phase 19 token rules.
const styles = StyleSheet.create({
  backdropContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)', // phase-19-token: modal backdrop — RN literal required on Pressable style prop
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
    minHeight: 280,
    alignItems: 'center',
  },
  body: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: -12,
    right: 0,
    padding: 8,
    zIndex: 1,
  },
  title: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actions: {
    marginTop: 24,
    width: '100%',
  },
  actionsGap: {
    height: 8,
  },
});
