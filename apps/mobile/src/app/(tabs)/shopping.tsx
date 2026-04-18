import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useShoppingStore } from '../../stores/shoppingStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { CategorySection } from '../../components/shopping/CategorySection';
import { AddItemSheet } from '../../components/shopping/AddItemSheet';
import { Button } from '../../components/ui/Button';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import type { GroceryCategory, ShoppingListItem } from '../../types/shopping';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
  LARGE_HEADER_HEIGHT,
} from '../../components/ui/useCollapsingHeader';

const CATEGORY_ORDER: GroceryCategory[] = [
  'produce', 'protein', 'dairy', 'pantry', 'bakery',
  'frozen', 'condiments', 'spices', 'beverages', 'other',
];

export default function ShoppingScreen() {
  const {
    currentList,
    items,
    loading,
    error,
    fetchCurrent,
    generateList,
    toggleChecked,
    addItem,
    editItem,
    removeItem,
    createOrder,
    fetchOrders,
  } = useShoppingStore();

  const {
    currentPlan,
    fetchCurrent: fetchCurrentPlan,
  } = useMealPlanStore();

  const [addVisible, setAddVisible] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const { onScroll, largeTitleOpacity, largeTitleTranslate, compactHeaderOpacity } =
    useCollapsingHeader();

  useEffect(() => {
    fetchCurrent();
    fetchCurrentPlan();
  }, [fetchCurrent, fetchCurrentPlan]);

  const grouped = useMemo(() => {
    const groups: Partial<Record<GroceryCategory, ShoppingListItem[]>> = {};
    for (const item of items) {
      const cat = item.category ?? 'other';
      (groups[cat] ??= []).push(item);
    }
    return groups;
  }, [items]);

  const handleGenerate = useCallback(async () => {
    if (!currentPlan?.id) {
      Alert.alert(
        'No meal plan',
        'Generate a meal plan for this week first — head over to the Plan tab.'
      );
      return;
    }
    await generateList(currentPlan.id);
  }, [currentPlan, generateList]);

  const handleOrder = useCallback(async () => {
    try {
      setOrdering(true);
      const { url } = await createOrder();
      await WebBrowser.openBrowserAsync(url);
      await fetchOrders();
    } catch {
      // error already captured in store
    } finally {
      setOrdering(false);
    }
  }, [createOrder, fetchOrders]);

  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = items.length > 0 && items.every((i) => i.checked);
  const orderDisabled = ordering || items.length === 0 || allChecked;

  if (loading && !currentList && items.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-sm text-warmGray-500 mt-3">Loading shopping list...</Text>
      </SafeAreaView>
    );
  }

  if (!currentList) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        {error && (
          <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}
        <EmptyState
          visual={{ kind: 'symbol', name: 'cart' }}
          title="No active shopping list"
          subtitle="Generate a list from your current meal plan — we'll consolidate ingredients and subtract what you already have."
          action={
            currentPlan?.id
              ? { label: 'Generate from Meal Plan', onPress: handleGenerate }
              : undefined
          }
        />
        {!currentPlan?.id && (
          <Text className="text-xs text-warmGray-400 mb-6 px-6 text-center">
            Create a meal plan in the Plan tab first.
          </Text>
        )}
      </SafeAreaView>
    );
  }

  const subtitle = `${items.length} item${items.length === 1 ? '' : 's'}${checkedCount > 0 ? ` · ${checkedCount} checked` : ''}`;

  const listHeader = (
    <Animated.View
      style={{
        opacity: largeTitleOpacity,
        transform: [{ translateY: largeTitleTranslate }],
      }}
    >
      <View style={styles.largeHeader}>
        <Text style={styles.largeTitle}>Shopping</Text>
        <Text style={styles.largeSubtitle}>{subtitle}</Text>
      </View>
    </Animated.View>
  );

  const listData = CATEGORY_ORDER.filter((cat) => (grouped[cat] ?? []).length > 0 || items.length === 0);

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['top', 'bottom']}>
      {/* Compact nav bar */}
      <Animated.View
        pointerEvents="box-none"
        style={[styles.compactHeader, { opacity: compactHeaderOpacity }]}
      >
        <Text style={styles.compactTitle}>Shopping</Text>
      </Animated.View>

      {/* Action row — orders icon */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push('/shopping/orders')}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="View orders"
        >
          <SymbolIcon name="doc.text" size={20} tintColor="#3E332A" />
        </Pressable>
      </View>

      {error && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-red-50 border border-red-200" style={{ marginTop: 52 }}>
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 200 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        {listHeader}
        {CATEGORY_ORDER.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            items={grouped[cat] ?? []}
            onToggle={toggleChecked}
            onEdit={editItem}
            onDelete={removeItem}
          />
        ))}
        {items.length === 0 && (
          <View className="px-6 py-12 items-center">
            <Text className="text-warmGray-400 text-sm">
              Your list is empty. Tap + to add items.
            </Text>
          </View>
        )}
      </Animated.ScrollView>

      <Pressable
        onPress={() => setAddVisible(true)}
        className="absolute right-5 bottom-24 w-14 h-14 rounded-full bg-orange-500 items-center justify-center active:bg-orange-600"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 6,
          elevation: 4,
        }}
        accessibilityLabel="Add item"
      >
        <SymbolIcon name="plus" size={28} tintColor="#FFFFFF" />
      </Pressable>

      <View className="absolute left-0 right-0 bottom-0 px-4 pb-4 pt-3 bg-warmWhite border-t border-warmGray-100">
        <Button
          title="Order on Instacart"
          onPress={handleOrder}
          loading={ordering}
          disabled={orderDisabled}
        />
      </View>

      <AddItemSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onSubmit={async (input) => {
          await addItem(input);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
});
