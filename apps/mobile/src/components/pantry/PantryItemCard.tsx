import React, { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SymbolIcon } from '../ui/SymbolIcon';
import { ItemRow } from '../ui/ItemRow';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';
import { usePantryStore } from '../../stores/pantryStore';
import { useShoppingStore } from '../../stores/shoppingStore';
import { colors } from '../../design/tokens';
import { LOCATION_SYMBOLS, FALLBACK_LOCATION_SYMBOL } from './locationSymbols';
import {
  deriveTrailingChip,
  isItemInShoppingCart,
  resolvePantryItemCardWrapperClasses,
} from './pantryItemCardHelpers';
import { formatQuantity } from '../../types/pantry';

interface PantryItemCardProps {
  item: EnrichedPantryItem;
  index?: number;
}

export function PantryItemCard({ item, index }: PantryItemCardProps) {
  const markItemDepleted = usePantryStore((s) => s.markItemDepleted);
  const addToShoppingList = useShoppingStore((s) => s.addItem);
  // Reactive subscription so the "In cart" chip appears the moment a Get-more
  // swipe optimistically appends to shoppingStore.items, and disappears when
  // the user removes the item from the shopping list.
  const shoppingItems = useShoppingStore((s) => s.items);
  const swipeRef = useRef<SwipeableMethods | null>(null);

  const isInCart = useMemo(
    () =>
      isItemInShoppingCart(
        item.name,
        shoppingItems.map((s) => s.name),
      ),
    [item.name, shoppingItems]
  );

  const handleGetMore = async () => {
    swipeRef.current?.close();
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

  const handleDelete = async () => {
    swipeRef.current?.close();
    try {
      await markItemDepleted(item.id);
    } catch (err) {
      // Surface the failure so the user understands the row didn't actually
      // delete (rolled back by the store on PATCH error). Without this Alert
      // the pantry just silently reverts and the user reports "delete
      // doesn't work" — see .planning/debug/resolved/pantry-trifecta.md.
      Alert.alert(
        'Could not delete item',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  };

  const locationIcon = LOCATION_SYMBOLS[item.source_location] ?? FALLBACK_LOCATION_SYMBOL;
  const formattedQty = formatQuantity(item.quantity, item.unit);
  const subtitleParts = [formattedQty || null, item.category].filter(Boolean);
  const wrapperCls = resolvePantryItemCardWrapperClasses(item);

  const renderLeftActions = () => (
    <View style={styles.actionWrapLeft}>
      <Pressable
        onPress={handleGetMore}
        style={[styles.action, styles.actionLeft]}
        accessibilityLabel={`Add ${item.name} to shopping list`}
        accessibilityRole="button"
        testID={
          typeof index === 'number' ? `pantry-item-getmore-${index}` : undefined
        }
      >
        <SymbolIcon name="cart.badge.plus" size={22} tintColor="#FFFFFF" />
        <Text style={styles.actionLabel}>Get more</Text>
      </Pressable>
    </View>
  );

  const renderRightActions = () => (
    <View style={styles.actionWrapRight}>
      <Pressable
        onPress={handleDelete}
        style={[styles.action, styles.actionRight]}
        accessibilityLabel={`Delete ${item.name}`}
        accessibilityRole="button"
        testID={
          typeof index === 'number' ? `pantry-item-delete-${index}` : undefined
        }
      >
        <SymbolIcon name="trash.fill" size={22} tintColor="#FFFFFF" />
        <Text style={styles.actionLabel}>Delete</Text>
      </Pressable>
    </View>
  );

  // Margins live OUTSIDE the swipeable so the action backgrounds align
  // exactly with the row's visible bounds — putting them inside meant
  // the action stretched to include the row's mb-2 gap, leaving an
  // 8pt taller-than-the-row strip on the side that read as broken.
  return (
    <View className={wrapperCls}>
      <ReanimatedSwipeable
        ref={swipeRef}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        leftThreshold={64}
        rightThreshold={64}
        overshootLeft={false}
        overshootRight={false}
        friction={2}
        // Fire the action when the user swipes past the threshold so a
        // confident drag commits without a second tap on the revealed
        // button (matches iOS Mail). Tapping the button still works
        // for users who prefer to peek + confirm.
        onSwipeableOpen={(direction) => {
          if (direction === 'left') {
            void handleGetMore();
          } else if (direction === 'right') {
            void handleDelete();
          }
        }}
      >
        <View style={styles.rowSurface}>
          <ItemRow
            leading={{ kind: 'icon', name: locationIcon, tint: colors.textSecondary }}
            title={item.name}
            subtitle={subtitleParts.join(' • ')}
            trailingChip={deriveTrailingChip(item, isInCart)}
          />
        </View>
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  rowSurface: {
    // Keep the row visually identical to its previous appearance —
    // ItemRow renders its own white background + padding, so this
    // wrapper is just a clipping boundary that matches the swipe
    // action heights pixel-for-pixel.
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  // Action wrappers exist so the colored fill spans the FULL row
  // height (the inner Pressable shrinks to its content + padding,
  // which would leave colored gaps at top/bottom otherwise).
  actionWrapLeft: {
    backgroundColor: colors.success,
    justifyContent: 'center',
  },
  actionWrapRight: {
    backgroundColor: colors.destructive,
    justifyContent: 'center',
  },
  action: {
    width: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  actionLeft: {
    backgroundColor: colors.success,
  },
  actionRight: {
    backgroundColor: colors.destructive,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
