import React from 'react';
import { Pressable, View, Text } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  resolveChipClasses,
  type ChipKind,
  type ChipTone,
} from './chipStyles';
import { iconPropsForText } from '../../design/icons';
import { colors } from '../../design/tokens';

interface ChipProps {
  label: string;
  kind: ChipKind;
  /** filter kind only. */
  selected?: boolean;
  /** filter kind only. */
  onPress?: () => void;
  /** display kind only; defaults to 'default'. */
  tone?: ChipTone;
  leadingIcon?: SymbolViewProps['name'];
}

export function Chip({
  label,
  kind,
  selected,
  onPress,
  tone,
  leadingIcon,
}: ChipProps) {
  const { container, label: labelCls } = resolveChipClasses({
    kind,
    selected,
    tone,
  });
  const isInteractive = kind === 'filter' && typeof onPress === 'function';

  const iconTint =
    kind === 'filter' && selected ? '#FFFFFF' : colors.textSecondary;

  const content = (
    <>
      {leadingIcon ? (
        <SymbolView
          name={leadingIcon}
          {...iconPropsForText('caption')}
          tintColor={iconTint}
          style={{ marginRight: 4 }}
        />
      ) : null}
      <Text className={labelCls}>{label}</Text>
    </>
  );

  if (isInteractive) {
    return (
      <Pressable
        onPress={onPress}
        className={container}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View className={container}>{content}</View>;
}

export type { ChipKind, ChipTone };
