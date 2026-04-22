/**
 * Phase 20 Wave 4 (plan 20-04) — Past Instacart carts (formerly "orders").
 *
 * Renamed from shopping/orders.tsx per 20-RESEARCH.md D-07 — UI-only
 * rename. The DB table remains `shopping_orders` and the `ShoppingOrder`
 * type name is unchanged; only user-visible copy reframes "order" as
 * "Instacart cart" to match the new draft-cart handoff metaphor.
 *
 * Navigation to per-item detail pushes `/shopping/handoff/:id` (was
 * `/shopping/order/:id`). The old `/shopping/orders` + `/shopping/order/:id`
 * routes are kept as Redirect stubs so deep links and Maestro flow 12
 * continue to resolve.
 *
 * Addresses SHOP-DC-01 UI reframing.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useShoppingStore } from '../../stores/shoppingStore';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import type { ShoppingOrder } from '../../types/shopping';
import { colors } from '../../design/tokens';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function HandoffsScreen() {
  const { orders, loading, error, fetchOrders } = useShoppingStore();

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const sorted = [...orders].sort(
    (a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
  );

  if (loading && orders.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (sorted.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
        {error && (
          <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}
        <EmptyState
          visual={{ kind: 'symbol', name: 'shippingbox' }}
          title="No Instacart carts yet"
          subtitle="Handoffs to Instacart appear here."
        />
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: ShoppingOrder }) => {
    const expired =
      item.expires_at != null && new Date(item.expires_at).getTime() < Date.now();
    return (
      <Pressable
        onPress={() => router.push(`/shopping/handoff/${item.id}`)}
        className="bg-white rounded-xl px-4 py-4 mx-4 my-1 flex-row items-center active:bg-warmGray-50"
      >
        <View className="w-10 h-10 rounded-full bg-brand/10 items-center justify-center mr-3">
          <SymbolIcon name="cart" size={20} tintColor={colors.brand} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-warmGray-900">
            Instacart cart
          </Text>
          <Text className="text-xs text-warmGray-500 mt-0.5">
            Sent {formatDate(item.placed_at)}
            {expired ? ' · link expired' : ''}
          </Text>
        </View>
        <SymbolIcon name="chevron.forward" size={20} tintColor="#9CA3AF" />
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {error && (
        <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}
      <FlatList
        data={sorted}
        keyExtractor={(o) => o.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 8 }}
      />
    </SafeAreaView>
  );
}
