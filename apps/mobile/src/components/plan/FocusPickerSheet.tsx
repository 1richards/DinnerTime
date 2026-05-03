/**
 * FocusPickerSheet — modal picker that replaces the previous
 * Alert.prompt for setting the weekly skill focus theme.
 *
 * The list is curated: each card surfaces a skill area + a one-line
 * description + a couple of recipe types that exercise it, so the
 * user has a concrete sense of what choosing the focus will steer
 * future plan generations toward.
 *
 * Tap a card → fires onSelect(themeKey) and the parent hands it to
 * mealPlanStore.setFocusTheme. A "Custom focus" tile at the bottom
 * preserves the free-form path for users who want their own theme.
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { Button } from '../ui/Button';
import { colors } from '../../design/tokens';
import type { SymbolViewProps } from 'expo-symbols';

interface FocusOption {
  key: string;
  label: string;
  blurb: string;
  examples: string;
  symbol: SymbolViewProps['name'];
  tint: string;
}

const FOCUS_OPTIONS: FocusOption[] = [
  {
    key: 'knife skills',
    label: 'Knife skills',
    blurb: 'Speed up prep with cleaner cuts and better technique.',
    examples: 'Fine dice, julienne, chiffonade',
    symbol: 'scissors',
    tint: colors.brand,
  },
  {
    key: 'pan sauces',
    label: 'Pan sauces',
    blurb: 'Turn a fond into a restaurant-quality finish in 5 minutes.',
    examples: 'Beurre blanc, red wine reduction, agrodolce',
    symbol: 'flame.fill',
    tint: colors.brand,
  },
  {
    key: 'braising',
    label: 'Braising',
    blurb: 'Low-and-slow techniques that turn cheap cuts into magic.',
    examples: 'Short ribs, coq au vin, ropa vieja',
    symbol: 'thermometer.medium',
    tint: colors.warning,
  },
  {
    key: 'stir-frying',
    label: 'Wok / stir-fry',
    blurb: 'Get the wok-hei char and timing right for snappy veg + protein.',
    examples: 'Beef and broccoli, dan dan noodles, mapo tofu',
    symbol: 'flame.circle.fill',
    tint: colors.destructive,
  },
  {
    key: 'plant-forward',
    label: 'Plant-forward',
    blurb: 'Lead with vegetables and legumes; meat is a garnish at most.',
    examples: 'Mushroom ragu, chickpea curry, charred broccoli',
    symbol: 'leaf.fill',
    tint: colors.success,
  },
  {
    key: 'pasta from scratch',
    label: 'Pasta from scratch',
    blurb: 'Hand-rolled, cut, or shaped pasta paired with a real sauce.',
    examples: 'Cacio e pepe, pappardelle al ragù, hand-cut tagliatelle',
    symbol: 'fork.knife',
    tint: colors.brand,
  },
  {
    key: 'global flavors',
    label: 'Global flavors',
    blurb: 'Stretch your palate with cuisines you don’t cook often.',
    examples: 'Thai, Korean, Ethiopian, Lebanese',
    symbol: 'globe',
    tint: colors.brand,
  },
  {
    key: 'baking & breads',
    label: 'Baking & breads',
    blurb: 'Build confidence with doughs, ferments, and oven temps.',
    examples: 'Focaccia, no-knead loaves, pizza dough',
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
  // Falls back to currentTheme until the user picks. Resets when the sheet
  // is reopened (otherwise a previously-selected-then-cancelled theme would
  // appear pre-checked).
  const [optimisticTheme, setOptimisticTheme] = useState<string | null>(
    currentTheme,
  );

  useEffect(() => {
    if (visible) setOptimisticTheme(currentTheme);
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

  const handleCustom = () => {
    Alert.prompt(
      'Custom focus',
      'What do you want to practice this week?',
      async (value) => {
        const trimmed = (value ?? '').trim();
        if (trimmed.length === 0) return;
        await commit(trimmed);
      },
      'plain-text',
      currentTheme ?? '',
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>WEEKLY FOCUS</Text>
            <Text style={styles.title}>Pick a skill to practice</Text>
            <Text style={styles.subtitle}>
              We’ll bias this week’s meals toward recipes that stretch
              you in this direction.
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size="action" tintColor={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {FOCUS_OPTIONS.map((opt) => {
            const isCurrent = optimisticTheme === opt.key;
            const isCommitting = committing === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => void commit(opt.key)}
                disabled={committing !== null}
                style={({ pressed }) => [
                  styles.card,
                  isCurrent && styles.cardSelected,
                  pressed && committing == null ? { opacity: 0.85 } : null,
                  committing !== null && !isCommitting ? { opacity: 0.5 } : null,
                ]}
                accessibilityLabel={`Focus on ${opt.label}`}
              >
                <View style={[styles.cardChip, { backgroundColor: `${opt.tint}1A` }]}>
                  <SymbolIcon name={opt.symbol} size="action" tintColor={opt.tint} weight="semibold" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{opt.label}</Text>
                  <Text style={styles.cardBlurb}>{opt.blurb}</Text>
                  <Text style={styles.cardExamples}>{opt.examples}</Text>
                </View>
                {isCurrent && (
                  <SymbolIcon
                    name="checkmark.circle.fill"
                    size="action"
                    tintColor={colors.success}
                  />
                )}
              </Pressable>
            );
          })}

          <Pressable
            onPress={handleCustom}
            disabled={committing !== null}
            style={({ pressed }) => [
              styles.card,
              styles.cardCustom,
              pressed && committing == null ? { opacity: 0.85 } : null,
            ]}
            accessibilityLabel="Set a custom focus theme"
          >
            <View style={[styles.cardChip, { backgroundColor: `${colors.textPrimary}10` }]}>
              <SymbolIcon name="pencil" size="action" tintColor={colors.textPrimary} weight="semibold" />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Custom focus</Text>
              <Text style={styles.cardBlurb}>Type your own skill or theme.</Text>
            </View>
          </Pressable>

          {currentTheme && (
            <View style={{ marginTop: 16 }}>
              <Button
                title="Clear focus for this week"
                variant="outline"
                onPress={() => void commit(null)}
                loading={committing === '__clear__'}
                disabled={committing !== null}
              />
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#FFFBF5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1EAE0',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C05A00',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1A140F',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: '#7A6651',
    marginTop: 6,
    lineHeight: 18,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1EAE0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    // Larger inter-card gap + a soft border so each option reads as a
    // distinct row even when none is selected (mirrors DayRow tiles in
    // the weekly Plan view). Previous 10pt gap + 6% shadow blended the
    // cards into one visual blob.
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1EAE0',
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: '#FFF4E6',
  },
  cardCustom: {
    borderWidth: 1,
    borderColor: '#E5D9CA',
    borderStyle: 'dashed',
    shadowOpacity: 0,
  },
  cardChip: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A140F',
    letterSpacing: -0.2,
  },
  cardBlurb: {
    fontSize: 13,
    color: '#3E332A',
    lineHeight: 18,
  },
  cardExamples: {
    fontSize: 12,
    color: '#7A6651',
    marginTop: 2,
    fontStyle: 'italic',
  },
});
