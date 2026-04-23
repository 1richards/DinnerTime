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
}

interface NavButtonProps {
  label: string;
  /** SF Symbol glyph name — kept as a string because expo-symbols has no typed glyph map. */
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

function NavButton({
  label,
  icon,
  onPress,
  disabled = false,
  testID,
}: NavButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`flex-1 flex-row items-center justify-center gap-2 bg-surface border border-border rounded-button ${
        disabled ? 'opacity-40' : ''
      }`}
      // 72pt deviation from Phase 19's 44pt minimum — see file header comment.
      style={{ height: 72 }}
    >
      <SymbolView
        name={icon as never}
        {...iconPropsForText('display')}
        tintColor={colors.textPrimary}
      />
      <Text className="text-body font-bold text-text-primary">{label}</Text>
    </Pressable>
  );
}

/**
 * 72pt Back / Repeat / Next bar, bottom-anchored inside cook.tsx.
 */
export default function StepNavButtons({
  onBack,
  onRepeat,
  onNext,
  disableBack,
  disableNext,
}: StepNavButtonsProps) {
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
      <NavButton
        label="Next"
        icon="arrow.right"
        onPress={onNext}
        disabled={disableNext}
        testID="cook-next"
      />
    </View>
  );
}
