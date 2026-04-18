/**
 * ItemRow — shared row primitive for Shopping + Pantry (and generic) surfaces.
 *
 * Phase 19 D-06 decision: one row component, three leading-affordance variants
 * (checkbox for shopping, stepper for pantry, icon for generic). Shopping
 * strike-through + pantry staleness chips are both "row with leading
 * affordance, title, optional trailing signal" — a single primitive gets the
 * shared visual language for free.
 *
 * Pure className derivation lives in `itemRowHelpers.ts` so every variant's
 * styling is unit-testable without RNTL.
 *
 * NOTE on trailing chip: Plan 19-02 (Chip.tsx) had not landed when 19-03
 * executed, so the trailing chip is rendered inline here using tokenized
 * classes. Plan 19-05's sweep should swap this inline rendering for an
 * import-and-use of `<Chip kind="display" ... />` once Chip.tsx exists —
 * the ChipTone union here mirrors what Plan 19-02 documents.
 */

import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { colors } from '../../design/tokens';
import { iconPropsForText } from '../../design/icons';
import {
  resolveTitleClasses,
  resolveCheckboxBoxClasses,
  CONTAINER_CLASSES,
  STEPPER_BUTTON_CLASSES,
} from './itemRowHelpers';

export type ChipTone = 'default' | 'success' | 'warning' | 'destructive';

type ItemRowLeading =
  | { kind: 'checkbox'; checked: boolean; onToggle: () => void }
  | {
      kind: 'stepper';
      quantity: number;
      unit: string | null;
      onInc: () => void;
      onDec: () => void;
    }
  | { kind: 'icon'; name: SymbolViewProps['name']; tint?: string };

interface ItemRowProps {
  leading: ItemRowLeading;
  title: string;
  subtitle?: string;
  trailingChip?: { label: string; tone: ChipTone };
  onPress?: () => void;
  onLongPress?: () => void;
  /** Shopping checked state — applies line-through + 50% opacity to title. */
  struck?: boolean;
}

// Inline trailing-chip styles — replace with <Chip /> once 19-02 lands.
const TRAILING_CHIP_TONE_CLASSES: Record<ChipTone, { bg: string; text: string }> = {
  default: { bg: 'bg-surface-subtle', text: 'text-text-secondary' },
  success: { bg: 'bg-success/15', text: 'text-success' },
  warning: { bg: 'bg-warning/15', text: 'text-warning' },
  destructive: { bg: 'bg-destructive/15', text: 'text-destructive' },
};

function InlineTrailingChip({ label, tone }: { label: string; tone: ChipTone }) {
  const toneCls = TRAILING_CHIP_TONE_CLASSES[tone];
  return (
    <View className={`${toneCls.bg} px-3 h-8 rounded-pill items-center justify-center ml-2`}>
      <Text className={`${toneCls.text} text-caption`}>{label}</Text>
    </View>
  );
}

export function ItemRow({
  leading,
  title,
  subtitle,
  trailingChip,
  onPress,
  onLongPress,
  struck,
}: ItemRowProps) {
  const titleCls = resolveTitleClasses({ struck });
  const isInteractive = !!(onPress || onLongPress);
  const Container: React.ComponentType<any> = isInteractive ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      onLongPress={onLongPress}
      className={CONTAINER_CLASSES}
    >
      {/* Leading affordance */}
      <View className="mr-3">
        {leading.kind === 'checkbox' ? (
          <Pressable
            onPress={leading.onToggle}
            hitSlop={8}
            className={resolveCheckboxBoxClasses({ checked: leading.checked })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: leading.checked }}
          >
            {leading.checked ? (
              <SymbolView name="checkmark" size={14} weight="bold" tintColor="#FFFFFF" />
            ) : null}
          </Pressable>
        ) : leading.kind === 'stepper' ? (
          <View className="flex-row items-center">
            <Pressable
              onPress={leading.onDec}
              hitSlop={8}
              disabled={leading.quantity <= 0}
              className={STEPPER_BUTTON_CLASSES}
              accessibilityLabel="Decrease quantity"
            >
              <SymbolView
                name="minus"
                {...iconPropsForText('caption')}
                tintColor={colors.textPrimary}
              />
            </Pressable>
            <Text className="mx-2 text-body text-text-primary">
              {leading.quantity}
              {leading.unit ? ` ${leading.unit}` : ''}
            </Text>
            <Pressable
              onPress={leading.onInc}
              hitSlop={8}
              className={STEPPER_BUTTON_CLASSES}
              accessibilityLabel="Increase quantity"
            >
              <SymbolView
                name="plus"
                {...iconPropsForText('caption')}
                tintColor={colors.textPrimary}
              />
            </Pressable>
          </View>
        ) : (
          <SymbolView
            name={leading.name}
            {...iconPropsForText('body')}
            tintColor={leading.tint ?? colors.textSecondary}
          />
        )}
      </View>

      {/* Title + optional subtitle */}
      <View className="flex-1">
        <Text className={titleCls} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="text-caption text-text-secondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {/* Trailing chip (inline until Plan 19-02 lands Chip.tsx) */}
      {trailingChip ? (
        <InlineTrailingChip label={trailingChip.label} tone={trailingChip.tone} />
      ) : null}
    </Container>
  );
}
