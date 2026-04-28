import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolIcon } from '../ui/SymbolIcon';
import { ItemRow, type ChipTone } from '../ui/ItemRow';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';
import { usePantryStore } from '../../stores/pantryStore';
import { useShoppingStore } from '../../stores/shoppingStore';
import { colors } from '../../design/tokens';
import { LOCATION_SYMBOLS, FALLBACK_LOCATION_SYMBOL } from './locationSymbols';
import { resolvePantryItemCardWrapperClasses } from './pantryItemCardHelpers';
import { formatQuantity } from '../../types/pantry';

interface PantryItemCardProps {
  item: EnrichedPantryItem;
  /**
   * Phase 21-05: position in the containing list. Preserved for testID
   * stability although the ellipsis it originally pointed at is gone —
   * Maestro flows can still target the row by index if needed.
   */
  index?: number;
}

/**
 * Stale/low-confidence trailing chip derived from effectiveConfidence.
 */
function deriveTrailingChip(
  item: EnrichedPantryItem
): { label: string; tone: ChipTone } | undefined {
  if (item.isUncertain) {
    const days = Math.floor(
      (Date.now() - new Date(item.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    return { label: `${days}d`, tone: 'destructive' };
  }
  if (item.effectiveConfidence < 0.6) {
    return { label: 'Low', tone: 'warning' };
  }
  return undefined;
}

export function PantryItemCard({ item, index }: PantryItemCardProps) {
  const markItemDepleted = usePantryStore((s) => s.markItemDepleted);
  const addToShoppingList = useShoppingStore((s) => s.addItem);

  // Swipe-right reveals "Get more" on the left side of the row → drops the
  // item into the active shopping list. Mirrors the pantry → cart hand-off
  // users were previously doing through the (now-removed) overflow sheet.
  const handleGetMore = async () => {
    try {
      await addToShoppingList({
        name: item.name,
        quantity: typeof item.quantity === 'number' ? item.quantity : null,
        unit: item.unit ?? null,
      });
    } catch (err) {
      Alert.alert(
        'Could not add to shopping list',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  // Swipe-left reveals "Delete" on the right side → marks the item depleted
  // so it disappears from the active pantry view. The store action also
  // strips it from the in-memory items array so the row vanishes
  // immediately rather than waiting for a refetch.
  const handleDelete = async () => {
    try {
      await markItemDepleted(item.id);
    } catch {
      // Rollback handled by store
    }
  };

  const locationIcon = LOCATION_SYMBOLS[item.source_location] ?? FALLBACK_LOCATION_SYMBOL;
  const formattedQty = formatQuantity(item.quantity, item.unit);
  const subtitleParts = [formattedQty || null, item.category].filter(Boolean);
  const wrapperCls = resolvePantryItemCardWrapperClasses(item);

  const renderLeftActions = () => (
    <Pressable
      onPress={handleGetMore}
      style={[styles.action, { backgroundColor: colors.success }]}
      accessibilityLabel={`Add ${item.name} to shopping list`}
      accessibilityRole="button"
      testID={
        typeof index === 'number' ? `pantry-item-getmore-${index}` : undefined
      }
    >
      <SymbolIcon name="cart.badge.plus" size={22} tintColor="#FFFFFF" />
      <Text style={styles.actionLabel}>Get more</Text>
    </Pressable>
  );

  const renderRightActions = () => (
    <Pressable
      onPress={handleDelete}
      style={[styles.action, { backgroundColor: colors.destructive }]}
      accessibilityLabel={`Delete ${item.name}`}
      accessibilityRole="button"
      testID={
        typeof index === 'number' ? `pantry-item-delete-${index}` : undefined
      }
    >
      <SymbolIcon name="trash.fill" size={22} tintColor="#FFFFFF" />
      <Text style={styles.actionLabel}>Delete</Text>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      leftThreshold={64}
      rightThreshold={64}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      <View className={wrapperCls}>
        <ItemRow
          leading={{ kind: 'icon', name: locationIcon, tint: colors.textSecondary }}
          title={item.name}
          subtitle={subtitleParts.join(' • ')}
          trailingChip={deriveTrailingChip(item)}
        />
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
