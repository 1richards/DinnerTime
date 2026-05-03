/**
 * OptionCard — 2-col grid tile primitive used by FocusPickerSheet and
 * RemixSheet's mode picker.
 *
 * Layout:
 *   [40pt tinted icon chip]
 *   [bold title — single line, auto-shrink]
 *   [optional sub line — single line, ellipsize tail]
 *   (selected → bottom-right checkmark.circle.fill overlay in success green)
 *
 * Variants:
 *   - default — white surface, 1pt border (colors.border), soft shadow
 *   - custom  — dashed border, no shadow (signals "type your own")
 *
 * States:
 *   - selected → 2pt brand border + warm cream fill (#FFF4E6) + checkmark overlay
 *   - disabled → opacity 0.45 + Pressable.disabled = true
 *
 * Width owned by caller — wrap in a `<View style={{width: '48%'}}>` (2-col
 * grid) or pass `style={{width: '31.5%'}}` for the rare 3-col case. The card
 * sets its own min height + paddings so callers don't need to coordinate.
 *
 * No new tokens introduced — only `colors.brand / surface / border / success
 * / textPrimary / textSecondary` and the documented '#FFF4E6' selected fill
 * (a brand-at-low-opacity wash already used inline in FocusPickerSheet +
 * RemixSheet pre-refactor).
 *
 * Visual contract: this is a SHEET tile, not a hero overlay. It does NOT
 * use the rgba(0,0,0,0.20) capsule pattern from HeroDayCard / RecipeCard /
 * RemixSheet variation cards (those wrap bare icon badges over a hero
 * photo); a sheet tile sits on a warm bg with a white surface.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import { SymbolIcon } from './SymbolIcon';
import { colors } from '../../design/tokens';

export interface OptionCardProps {
  label: string;
  /** Optional one-line description under the title. */
  sub?: string;
  /** SF Symbol name for the icon chip. */
  symbol: SymbolViewProps['name'];
  /** Tint hex used for the icon glyph + a 10% wash for the chip background. */
  tint: string;
  /** When true, renders a 2pt brand border + warm fill + checkmark overlay. */
  selected?: boolean;
  /** When true, opacity 0.45 + Pressable.disabled. */
  disabled?: boolean;
  /** 'default' = solid white surface w/ shadow; 'custom' = dashed, no shadow. */
  variant?: 'default' | 'custom';
  onPress: () => void;
  accessibilityLabel?: string;
  /** Caller-owned width override — usually `{width: '48%'}` for a 2-col grid. */
  style?: StyleProp<ViewStyle>;
}

const SELECTED_FILL = '#FFF4E6'; // brand-at-low-opacity, pre-existing in FocusPickerSheet + RemixSheet

export function OptionCard({
  label,
  sub,
  symbol,
  tint,
  selected = false,
  disabled = false,
  variant = 'default',
  onPress,
  accessibilityLabel,
  style,
}: OptionCardProps) {
  const isCustom = variant === 'custom';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      style={[
        styles.card,
        isCustom ? styles.cardCustom : null,
        selected ? styles.cardSelected : null,
        disabled ? styles.cardDisabled : null,
        style,
      ]}
    >
      <View style={[styles.chip, { backgroundColor: `${tint}1A` }]}>
        <SymbolIcon
          name={symbol}
          size="action"
          tintColor={tint}
          weight="semibold"
        />
      </View>
      <Text
        style={styles.title}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.9}
      >
        {label}
      </Text>
      {sub ? (
        <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
          {sub}
        </Text>
      ) : null}
      {selected ? (
        <View style={styles.checkOverlay} pointerEvents="none">
          <SymbolIcon
            name="checkmark.circle.fill"
            size="action"
            tintColor={colors.success}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
    // Position anchor for the absolute checkmark overlay.
    position: 'relative',
    overflow: 'hidden',
  },
  cardCustom: {
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: SELECTED_FILL,
  },
  cardDisabled: {
    opacity: 0.45,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.1,
    alignSelf: 'stretch',
  },
  sub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 15,
    alignSelf: 'stretch',
  },
  checkOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
});
