/**
 * LabelsEditor — inline editor for a recipe's free-form labels.
 *
 * Used inside the Recipe Box detail (SavedRecipeDetail wrapper around
 * PreviewSheet). Each label renders as a removable chip; the user
 * types a new label into the inline input and submits with Return
 * or the + button. Labels persist via mealPlanStore...wait, recipe
 * store: useRecipeStore.updateRecipe(id, { labels: next }).
 *
 * Stays presentation-only — the parent owns persistence so this can
 * be used from anywhere a Recipe is editable.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';

interface LabelsEditorProps {
  labels: string[];
  onChange: (next: string[]) => Promise<void> | void;
}

export function LabelsEditor({ labels, onChange }: LabelsEditorProps) {
  const [draft, setDraft] = useState('');

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const titled = trimmed.replace(/\b\w/g, (c) => c.toUpperCase());
    if (labels.some((l) => l.toLowerCase() === titled.toLowerCase())) {
      setDraft('');
      return;
    }
    await onChange([...labels, titled]);
    setDraft('');
  };

  const remove = async (label: string) => {
    await onChange(labels.filter((l) => l !== label));
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>LABELS</Text>
      <View style={styles.chipsRow}>
        {labels.map((label) => (
          <Pressable
            key={label}
            onPress={() => void remove(label)}
            style={({ pressed }) => [
              styles.chip,
              pressed ? { opacity: 0.7 } : null,
            ]}
            accessibilityLabel={`Remove ${label} label`}
          >
            <Text style={styles.chipLabel}>{label}</Text>
            <SymbolIcon name="xmark" size={11} tintColor={colors.brand} weight="bold" />
          </Pressable>
        ))}
        {labels.length === 0 && (
          <Text style={styles.empty}>
            Add labels like “tacos” or “game nights” to organize your library.
          </Text>
        )}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a label"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => void commit()}
        />
        <Pressable
          onPress={() => void commit()}
          disabled={draft.trim().length === 0}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addBtn,
            (draft.trim().length === 0) && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
          accessibilityLabel="Add label"
        >
          <SymbolIcon name="plus.circle.fill" size="action" tintColor={colors.brand} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A6651',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFF4E6',
    borderWidth: 1,
    borderColor: 'rgba(192,90,0,0.3)',
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C05A00',
  },
  empty: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F1EAE0',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1A140F',
    padding: 0,
  },
  addBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
