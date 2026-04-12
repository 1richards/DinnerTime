import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useShoppingStore } from '../../stores/shoppingStore';
import { useMealPlanStore } from '../../stores/mealPlanStore';
import { CategorySection } from '../../components/shopping/CategorySection';
import { AddItemSheet } from '../../components/shopping/AddItemSheet';
import { Button } from '../../components/ui/Button';
import type { GroceryCategory, ShoppingListItem } from '../../types/shopping';

const CATEGORY_ORDER: GroceryCategory[] = [
  'produce',
  'protein',
  'dairy',
  'pantry',
  'bakery',
  'frozen',
  'condiments',
  'spices',
  'beverages',
  'other',
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
      // error is already captured in store.error and shown in banner
    } finally {
      setOrdering(false);
    }
  }, [createOrder, fetchOrders]);

  const allChecked =
    items.length > 0 && items.every((i) => i.checked);
  const orderDisabled = ordering || items.length === 0 || allChecked;

  // Loading skeleton
  if (loading && !currentList && items.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-sm text-warmGray-500 mt-3">
          Loading shopping list...
        </Text>
      </SafeAreaView>
    );
  }

  // Empty state
  if (!currentList) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        {error && (
          <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-5xl mb-4">🛒</Text>
          <Text className="text-2xl font-bold text-warmGray-900 mb-2">
            No active shopping list
          </Text>
          <Text className="text-base text-warmGray-500 text-center leading-6 mb-8">
            Generate a list from your current meal plan — we&apos;ll consolidate
            ingredients and subtract what you already have.
          </Text>
          <View className="w-full">
            <Button
              title="Generate from Meal Plan"
              onPress={handleGenerate}
              loading={loading}
              disabled={!currentPlan?.id}
            />
          </View>
          {!currentPlan?.id && (
            <Text className="text-xs text-warmGray-400 mt-3 text-center">
              Create a meal plan in the Plan tab first.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <View className="px-4 pt-2 pb-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-2xl font-bold text-warmGray-900">
              {currentList.title}
            </Text>
            <Text className="text-sm text-warmGray-500 mt-0.5">
              {items.length} item{items.length === 1 ? '' : 's'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/shopping/orders')}
            hitSlop={8}
            className="flex-row items-center px-3 py-2 rounded-full bg-orange-50 border border-orange-200 active:bg-orange-100"
          >
            <Ionicons name="receipt-outline" size={14} color="#B45309" />
            <Text className="text-xs font-semibold text-amber-800 ml-1">
              Orders
            </Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View className="mx-4 mb-2 p-3 rounded-xl bg-red-50 border border-red-200">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 140 }}
      >
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
      </ScrollView>

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
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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
