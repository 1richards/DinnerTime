/**
 * AddMealSheet — modal that lists saved Recipe Box entries so the user
 * can drop one onto an empty day in the plan. Opens when an empty
 * placeholder day row is tapped.
 *
 * Selection commits via mealPlanStore.addToPlan (POST /entries/assign)
 * with the chosen recipe + the targeted ISO date. Parent owns the
 * close + day context; this sheet is presentation-only.
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { useRecipeStore } from '../../stores/recipeStore';
import { getRecipeImage } from '../../constants/foodImages';
import type { Recipe } from '../../types/recipe';

export interface AddMealSheetProps {
  visible: boolean;
  /** ISO date the chosen recipe will be assigned to. */
  isoDate: string | null;
  /** Friendly label for the header — "MON · APR 27", etc. */
  dayLabel: string | null;
  onSelect: (recipe: Recipe) => Promise<void>;
  onClose: () => void;
}

export function AddMealSheet({
  visible,
  isoDate,
  dayLabel,
  onSelect,
  onClose,
}: AddMealSheetProps) {
  const recipes = useRecipeStore((s) => s.recipes);
  const [query, setQuery] = useState('');
  const [committingId, setCommittingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, query]);

  const handlePick = async (recipe: Recipe) => {
    if (!isoDate) return;
    setCommittingId(recipe.id);
    try {
      await onSelect(recipe);
      onClose();
      setQuery('');
    } finally {
      setCommittingId(null);
    }
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
            <Text style={styles.kicker}>ADD A MEAL</Text>
            <Text style={styles.title}>
              {dayLabel ? `Pick a recipe for ${dayLabel}` : 'Pick a recipe'}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
            <SymbolIcon name="xmark" size="action" tintColor={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.searchWrap}>
          <SymbolIcon name="magnifyingglass" size={16} tintColor={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your recipes"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <SymbolIcon name="xmark.circle.fill" size="action" tintColor={colors.textTertiary} />
            </Pressable>
          )}
        </View>

        {recipes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No saved recipes yet. Save something from Something New first.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recipes match “{query}”.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const heroUri = getRecipeImage(
                `recipe-box-${item.id}`,
                item.image_url,
                item.title,
              );
              const isCommitting = committingId === item.id;
              const isDisabled = committingId !== null && !isCommitting;
              return (
                <Pressable
                  onPress={() => void handlePick(item)}
                  disabled={committingId !== null}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && !isDisabled ? { opacity: 0.85 } : null,
                    isDisabled ? { opacity: 0.4 } : null,
                  ]}
                  accessibilityLabel={`Add ${item.title}`}
                >
                  <View style={styles.thumbWrap}>
                    {heroUri ? (
                      <Image
                        source={{ uri: heroUri }}
                        style={styles.thumb}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                      />
                    ) : (
                      <View style={[styles.thumb, { backgroundColor: '#F1EAE0' }]} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
                    {item.total_time_minutes != null && (
                      <Text style={styles.rowMeta}>{item.total_time_minutes} min</Text>
                    )}
                  </View>
                  {isCommitting ? (
                    <ActivityIndicator size="small" color={colors.brand} />
                  ) : (
                    <SymbolIcon
                      name="plus.circle.fill"
                      size="action"
                      tintColor={colors.brand}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        )}
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
    paddingBottom: 14,
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
    fontSize: 20,
    fontWeight: '900',
    color: '#1A140F',
    letterSpacing: -0.3,
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1EAE0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A140F',
    padding: 0,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#7A6651',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1EAE0',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A140F',
  },
  rowMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
