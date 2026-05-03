/**
 * FocusPickerSheet — modal picker for the weekly skill focus theme.
 *
 * Refactored in quick-8 to consume the shared PickerSheet shell and
 * OptionCard primitives so the page reads as a sibling of RemixSheet's
 * mode picker. Visual deltas vs. the previous implementation:
 *   - Vertical list of tall cards → 2-col grid of OptionCards
 *   - Italic "examples" line dropped (the blurb already conveys the idea)
 *   - Custom focus uses an inline TextInput row mirroring RemixSheet's
 *     customInputRow — no more Alert.prompt
 *   - Sheet background switched from #FFFBF5 (one-off) to colors.bg
 *
 * The FocusBanner contract is unchanged: this sheet does NOT close on
 * select. The parent (FocusBanner) flips visible=false from its Alert.alert
 * callback after the user chooses Regenerate / Not now.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { PickerSheet } from '../ui/PickerSheet';
import { OptionCard } from '../ui/OptionCard';
import { colors } from '../../design/tokens';
import type { SymbolViewProps } from 'expo-symbols';

interface FocusOption {
  key: string;
  label: string;
  blurb: string;
  symbol: SymbolViewProps['name'];
  tint: string;
}

const FOCUS_OPTIONS: FocusOption[] = [
  {
    key: 'knife skills',
    label: 'Knife skills',
    blurb: 'Speed up prep with cleaner cuts.',
    symbol: 'scissors',
    tint: colors.brand,
  },
  {
    key: 'pan sauces',
    label: 'Pan sauces',
    blurb: 'Restaurant finish in 5 minutes.',
    symbol: 'flame.fill',
    tint: colors.brand,
  },
  {
    key: 'braising',
    label: 'Braising',
    blurb: 'Low-and-slow cuts done right.',
    symbol: 'thermometer.medium',
    tint: colors.warning,
  },
  {
    key: 'stir-frying',
    label: 'Wok / stir-fry',
    blurb: 'Wok-hei char and timing.',
    symbol: 'flame.circle.fill',
    tint: colors.destructive,
  },
  {
    key: 'plant-forward',
    label: 'Plant-forward',
    blurb: 'Vegetables lead, meat garnishes.',
    symbol: 'leaf.fill',
    tint: colors.success,
  },
  {
    key: 'pasta from scratch',
    label: 'Pasta from scratch',
    blurb: 'Hand-rolled pasta + real sauce.',
    symbol: 'fork.knife',
    tint: colors.brand,
  },
  {
    key: 'global flavors',
    label: 'Global flavors',
    blurb: 'Cuisines you don’t cook often.',
    symbol: 'globe',
    tint: colors.brand,
  },
  {
    key: 'baking & breads',
    label: 'Baking & breads',
    blurb: 'Doughs, ferments, oven temps.',
    symbol: 'oven.fill',
    tint: colors.warning,
  },
];

export interface FocusPickerSheetProps {
  visible: boolean;
  currentTheme: string | null;
  onSelect: (theme: string | null) => Promise<void>;
  onClose: () => void;
}

export function FocusPickerSheet({
  visible,
  currentTheme,
  onSelect,
  onClose,
}: FocusPickerSheetProps) {
  const [committing, setCommitting] = useState<string | null>(null);
  // Optimistic checkmark — populated synchronously on tap so the user sees
  // their selection register before the PATCH round-trip completes (~1-2s).
  const [optimisticTheme, setOptimisticTheme] = useState<string | null>(
    currentTheme,
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState('');

  useEffect(() => {
    if (visible) {
      setOptimisticTheme(currentTheme);
      setCustomOpen(false);
      setCustomDraft('');
    }
  }, [visible, currentTheme]);

  // Parent (FocusBanner) is responsible for closing the sheet — it presents
  // the Regenerate Alert on top of the still-visible sheet, then calls
  // setPickerVisible(false) once the user chooses. Closing here would race
  // the Alert presentation and lose the modal slot on iOS.
  const commit = async (theme: string | null) => {
    setOptimisticTheme(theme);
    setCommitting(theme ?? '__clear__');
    try {
      await onSelect(theme);
    } finally {
      setCommitting(null);
    }
  };

  const submitCustom = () => {
    const trimmed = customDraft.trim();
    if (trimmed.length === 0) return;
    void commit(trimmed);
    setCustomOpen(false);
    setCustomDraft('');
  };

  const footerSlot = currentTheme ? (
    <Button
      title="Clear focus for this week"
      variant="outline"
      onPress={() => void commit(null)}
      loading={committing === '__clear__'}
      disabled={committing !== null}
    />
  ) : undefined;

  return (
    <PickerSheet
      visible={visible}
      kicker="WEEKLY FOCUS"
      title="Pick a skill to practice"
      subtitle="We’ll bias this week’s meals toward recipes that stretch you in this direction."
      onClose={onClose}
      footerSlot={footerSlot}
    >
      <View style={styles.grid}>
        {FOCUS_OPTIONS.map((opt) => {
          const isCurrent = optimisticTheme === opt.key;
          return (
            <View key={opt.key} style={styles.cell}>
              <OptionCard
                label={opt.label}
                sub={opt.blurb}
                symbol={opt.symbol}
                tint={opt.tint}
                selected={isCurrent}
                disabled={committing !== null && committing !== opt.key}
                onPress={() => void commit(opt.key)}
                accessibilityLabel={`Focus on ${opt.label}`}
              />
            </View>
          );
        })}

        <View style={styles.cell}>
          <OptionCard
            variant="custom"
            label="Custom"
            sub="Type your own…"
            symbol="pencil"
            tint={colors.textPrimary}
            onPress={() => setCustomOpen(true)}
            accessibilityLabel="Set a custom focus theme"
          />
        </View>
      </View>

      {customOpen ? (
        <View style={styles.customInputRow}>
          <SymbolIcon
            name="pencil"
            size={18}
            tintColor={colors.textSecondary}
            weight="semibold"
          />
          <TextInput
            style={styles.customInput}
            value={customDraft}
            onChangeText={setCustomDraft}
            placeholder="Type your own focus…"
            placeholderTextColor={colors.textTertiary}
            returnKeyType="go"
            onSubmitEditing={submitCustom}
            autoFocus
            multiline={false}
          />
          {customDraft.length > 0 ? (
            <>
              <Pressable
                onPress={() => setCustomDraft('')}
                hitSlop={8}
                accessibilityLabel="Clear custom focus draft"
              >
                <SymbolIcon
                  name="xmark.circle.fill"
                  size={18}
                  tintColor={colors.textTertiary}
                />
              </Pressable>
              <Pressable
                onPress={submitCustom}
                hitSlop={8}
                accessibilityLabel="Submit custom focus"
                style={({ pressed }) => [
                  styles.customSubmitBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <SymbolIcon
                  name="arrow.up.circle.fill"
                  size={28}
                  tintColor={colors.brand}
                />
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </PickerSheet>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cell: {
    width: '48%',
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  customInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  customSubmitBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
