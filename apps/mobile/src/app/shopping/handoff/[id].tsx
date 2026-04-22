/**
 * Phase 20 Wave 4 (plan 20-04) — Instacart cart detail (formerly "order").
 *
 * Renamed from shopping/order/[id].tsx per 20-RESEARCH.md D-07 — UI-only
 * rename. The DB table remains `shopping_orders` and the `ShoppingOrder`
 * type name is unchanged; only user-visible copy reframes "Order" as
 * "Handoff" / "Instacart cart" to match the new draft-cart metaphor.
 *
 * The legacy `/shopping/order/[id]` route is preserved as a Redirect stub
 * in order/[id].tsx so deep links and Maestro flow 12 continue to resolve.
 *
 * Addresses SHOP-DC-01 UI reframing.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useShoppingStore } from '../../../stores/shoppingStore';
import { Button } from '../../../components/ui/Button';
import type {
  ShoppingOrderSnapshotItem,
  VariationSuggestion,
} from '../../../types/shopping';
import { colors } from '../../../design/tokens';

type SnapshotItem = ShoppingOrderSnapshotItem;

export default function HandoffDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    orders,
    variations,
    error,
    fetchOrders,
    reorder,
    fetchVariations,
  } = useShoppingStore();

  const [reordering, setReordering] = useState(false);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [localVariations, setLocalVariations] = useState<
    VariationSuggestion[] | null
  >(null);

  useEffect(() => {
    if (orders.length === 0) fetchOrders();
  }, [orders.length, fetchOrders]);

  const order = useMemo(
    () => orders.find((o) => o.id === id) ?? null,
    [orders, id]
  );

  const snapshotItems: SnapshotItem[] = useMemo(() => {
    if (!order) return [];
    return order.items_snapshot ?? [];
  }, [order]);

  const expired =
    order?.expires_at != null &&
    new Date(order.expires_at).getTime() < Date.now();

  const handleReorder = useCallback(async () => {
    if (!id) return;
    try {
      setReordering(true);
      await reorder(id);
      router.replace('/shopping');
    } catch {
      // store.error is set
    } finally {
      setReordering(false);
    }
  }, [id, reorder]);

  const handleFetchVariations = useCallback(async () => {
    if (!id) return;
    setLoadingVariations(true);
    const result = await fetchVariations(id);
    setLocalVariations(result);
    setLoadingVariations(false);
  }, [id, fetchVariations]);

  if (!order) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color={colors.brand} />
        <Text className="text-sm text-warmGray-500 mt-3">Loading cart...</Text>
      </SafeAreaView>
    );
  }

  const displayVariations = localVariations ?? variations;

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      {error && (
        <View className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200">
          <Text className="text-sm text-red-700">{error}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3 pb-2">
          <Text className="text-xl font-bold text-warmGray-900">
            Handoff details
          </Text>
          <Text className="text-sm text-warmGray-500 mt-0.5">
            Sent {new Date(order.placed_at).toLocaleDateString()}
          </Text>
          {expired && (
            <Text className="text-xs text-warmGray-400 mt-1">
              Original Instacart link expired — Resend creates a fresh cart.
            </Text>
          )}
        </View>

        <View className="px-4 mt-2">
          <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wide mb-2">
            Items ({snapshotItems.length})
          </Text>
          <View className="bg-white rounded-xl">
            {snapshotItems.length === 0 ? (
              <Text className="text-sm text-warmGray-400 p-4">
                No item snapshot available for this cart.
              </Text>
            ) : (
              snapshotItems.map((item, idx) => (
                <View
                  key={`${item.name}-${idx}`}
                  className={`px-4 py-3 flex-row justify-between items-center ${
                    idx < snapshotItems.length - 1
                      ? 'border-b border-warmGray-100'
                      : ''
                  }`}
                >
                  <Text className="text-base text-warmGray-900 flex-1">
                    {item.name}
                  </Text>
                  {item.quantity != null && (
                    <Text className="text-sm text-warmGray-500 ml-2">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ''}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        </View>

        <View className="px-4 mt-6">
          <Button
            title="Resend to Instacart"
            onPress={handleReorder}
            loading={reordering}
          />
          <View className="h-3" />
          <Button
            title={
              loadingVariations
                ? 'Loading suggestions...'
                : displayVariations.length > 0
                  ? 'Refresh variations'
                  : 'See variations'
            }
            variant="outline"
            onPress={handleFetchVariations}
            loading={loadingVariations}
          />
        </View>

        {displayVariations.length > 0 && (
          <View className="px-4 mt-6">
            <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wide mb-2">
              AI variation suggestions
            </Text>
            {displayVariations.map((v, idx) => (
              <View
                key={`${v.instead_of}-${idx}`}
                className="bg-white rounded-xl p-4 mb-2"
              >
                <Text className="text-sm text-warmGray-500">
                  Instead of{' '}
                  <Text className="font-semibold text-warmGray-900">
                    {v.instead_of}
                  </Text>
                </Text>
                <Text className="text-base font-semibold text-brand mt-1">
                  Try {v.swap}
                </Text>
                <Text className="text-sm text-warmGray-600 mt-1 leading-5">
                  {v.rationale}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
