/**
 * StepNavButtons — Phase 16 Wave 2 (16-05).
 *
 * UI-SPEC §Spacing §Exceptions: 72pt tap target (not Phase 19's 44pt) —
 * cooking-hands accessibility for wet/greasy fingertips. Tokens (color,
 * radius, typography, icon sizing via `iconPropsForText('display')`) stay
 * Phase-19-compliant; only HEIGHT is overridden. This is a deliberate,
 * scoped deviation — everywhere else in the app follows the 44pt minimum.
 *
 * Interface (Phase 16):
 *   - { onBack, onRepeat, onNext, disableBack, disableNext }
 *
 * Semantics are the INVERSE of the Phase 9 `canGoBack`/`canGoNext` props.
 * The 16-06 cook.tsx integration plan updates the callsite accordingly
 * (current cook.tsx still passes canGoBack/canGoNext — TypeScript will
 * flag this on rebuild and 16-06 will fix it).
 *
 * Why hand-roll the Pressable rather than use the Phase 19 `Button`? The
 * Button primitive enforces 44pt height in its variantStyles; passing a
 * height override would either require a new prop or bypass the variant
 * contract. Keeping the 72pt deviation local to this component keeps the
 * Button primitive's invariants intact.
 */
import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { iconPropsForText } from '../../design/icons';
import { colors } from '../../design/tokens';

export interface StepNavButtonsProps {
  onBack: () => void;
  onRepeat: () => void;
  onNext: () => void;
  disableBack: boolean;
  disableNext: boolean;
  /** When provided AND disableNext is true (i.e. user is on the last
      step), the Next button is replaced with a primary brand-colored
      "Done" button. Tap fires onDone — cook.tsx wires it to markCooked
      + celebration overlay + nav to Plan. Optional for backward compat
      with any caller that hasn't migrated. */
  onDone?: () => void;
}

interface NavButtonProps {
  label: string;
  /** SF Symbol glyph name — kept as a string because expo-symbols has no typed glyph map. */
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** Render the brand-orange filled variant (white icon + label on
      brand bg). Used by the Done button on the last step so the
      finale CTA reads as the primary action. */
  primary?: boolean;
}

function NavButton({
  label,
  icon,
  onPress,
  disabled = false,
  testID,
  primary = false,
}: NavButtonProps) {
  // Wrap the Pressable in a View when primary so the brand bg paints
  // reliably on iOS 26 / Fabric (mirrors the Surprise me hero fix in
  // RemixSheet). Inner Pressable still owns the touch + opacity press
  // behavior. Plain (non-primary) buttons use the existing inline
  // surface bg, which paints fine on Pressable.
  if (primary) {
    return (
      <View
        className="flex-1 rounded-button"
        style={{ height: 72, backgroundColor: colors.brand }}
      >
        <Pressable
          onPress={disabled ? undefined : onPress}
          disabled={disabled}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          className={`flex-1 flex-row items-center justify-center gap-2 ${
            disabled ? 'opacity-40' : ''
          }`}
        >
          <SymbolView
            name={icon as never}
            {...iconPropsForText('display')}
            tintColor="#FFFFFF"
          />
          <Text className="text-body font-bold text-white">{label}</Text>
        </Pressable>
      </View>
    );
  }
  const tint = colors.textPrimary;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`flex-1 flex-row items-center justify-center gap-2 bg-surface rounded-button ${
        disabled ? 'opacity-40' : ''
      }`}
      // 72pt deviation from Phase 19's 44pt minimum — see file header comment.
      style={{
        height: 72,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <SymbolView
        name={icon as never}
        {...iconPropsForText('display')}
        tintColor={tint}
      />
      <Text className="text-body font-bold" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * 72pt Back / Repeat / Next bar, bottom-anchored inside cook.tsx.
 *
 * On the last step (disableNext=true) AND when an `onDone` is provided,
 * the Next slot is replaced with a primary "Done" button that closes
 * the cooking flow. Without onDone the old disabled-Next behavior holds.
 */
export default function StepNavButtons({
  onBack,
  onRepeat,
  onNext,
  disableBack,
  disableNext,
  onDone,
}: StepNavButtonsProps) {
  const showDone = disableNext && typeof onDone === 'function';
  return (
    <View
      className="flex-row items-center justify-between gap-3 px-4 bg-bg border-t border-border"
      // Explicit 72pt height mirrors the nav bar band in UI-SPEC §Layout.
      style={{ height: 72 }}
    >
      <NavButton
        label="Back"
        icon="arrow.left"
        onPress={onBack}
        disabled={disableBack}
        testID="cook-back"
      />
      <NavButton
        label="Repeat"
        icon="arrow.clockwise"
        onPress={onRepeat}
        testID="cook-repeat"
      />
      {showDone ? (
        <NavButton
          label="Done"
          icon="checkmark.circle.fill"
          onPress={onDone!}
          testID="cook-done"
          primary
        />
      ) : (
        <NavButton
          label="Next"
          icon="arrow.right"
          onPress={onNext}
          disabled={disableNext}
          testID="cook-next"
        />
      )}
    </View>
  );
}
