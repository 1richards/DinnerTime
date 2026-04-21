/**
 * PantryOnlyToggle — pill-style binary toggle for "Only what's in my pantry"
 * (CONTEXT D-04).
 *
 * Presentation-only. This component does NOT trigger a re-search — the
 * /search modal owns the actual submit. When mounted inside kitchen.tsx's
 * Something New header, it reflects the persisted `pantryOnly` value from
 * useSuggestionsStore and lets users toggle it as a sticky preference.
 *
 * accessibilityRole="switch" + accessibilityState.checked gives VoiceOver
 * the same semantics as an iOS native Switch while keeping the visual
 * language consistent with the rest of the chip/pill surfaces on the
 * segment (recent-query chips, search pill).
 */

import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';

interface PantryOnlyToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel?: string;
}

export function PantryOnlyToggle({
  value,
  onChange,
  accessibilityLabel = "Only what's in my pantry",
}: PantryOnlyToggleProps) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.pill, value ? styles.pillOn : styles.pillOff]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      {value ? (
        <SymbolIcon
          name="checkmark.circle.fill"
          size="body"
          tintColor="#FFFFFF"
        />
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
      <Text style={[styles.label, value ? styles.labelOn : styles.labelOff]}>
        Only what's in my pantry
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
    gap: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
  },
  pillOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  pillOff: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  iconPlaceholder: {
    width: 17,
    height: 17,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  labelOn: {
    color: '#FFFFFF',
  },
  labelOff: {
    color: colors.textPrimary,
  },
});
