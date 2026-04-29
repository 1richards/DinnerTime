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
import { useSettingsStore } from '../../stores/settingsStore';
import { CategorySection } from '../../components/shopping/CategorySection';
import { AddItemSheet } from '../../components/shopping/AddItemSheet';
import {
  HandoffSheet,
  type HandoffState,
} from '../../components/shopping/HandoffSheet';
import { Button } from '../../components/ui/Button';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { EmptyState } from '../../components/ui/EmptyState';
import type { GroceryCategory, ShoppingListItem } from '../../types/shopping';
import {
  useCollapsingHeader,
  collapsingHeaderStyles,
  LARGE_HEADER_HEIGHT,
} from '../../components/ui/useCollapsingHeader';
import { colors } from '../../design/tokens';
import { logShoppingEvent, sanitizePayload } from '../../shopping/telemetry';
import { openInstacartCart } from '../../shopping/openInstacartCart';
import { classifyHandoffError } from '../../shopping/classifyHandoffError';

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
  const [handoffState, setHandoffState] = useState<HandoffState>({ kind: 'idle' });
  const [handoffSessionId, setHandoffSessionId] = useState<string>('');

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
    // Read the feature flag at tap time (not module load) — per
    // 20-RESEARCH.md Pitfall 4, flipping the toggle from Settings should
    // affect the VERY NEXT tap without requiring a remount.
    const mode = useSettingsStore.getState().shoppingHandoffMode;
    const unchecked = items.filter((i) => !i.checked);
    const itemCount = unchecked.length;
    const listId = currentList?.id ?? null;

    // LEGACY PATH — Phase 8 inline WebBrowser. Feature-flag gated rollback
    // (SHOP-DC-05). Preserved verbatim so flipping shoppingHandoffMode to
    // 'legacy' in Settings produces the exact Phase-8 behavior.
    if (mode === 'legacy') {
      try {
        setHandoffState({ kind: 'sending' });
        const { url } = await createOrder();
        await WebBrowser.openBrowserAsync(url);
        await fetchOrders();
      } catch {
        // error already captured in shoppingStore.error
      } finally {
        setHandoffState({ kind: 'idle' });
      }
      return;
    }

    // DRAFT-CART PATH — Phase 20 HandoffSheet flow. Emits 3 telemetry events
    // (started/succeeded/failed). `handoff_opened_{app|web}` is fired inside
    // openInstacartCart when the user taps the primary CTA on success.
    const sessionId =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `sh-${Date.now()}`;
    setHandoffSessionId(sessionId);
    setHandoffState({ kind: 'sending' });
    logShoppingEvent({
      name: 'shopping.draft_cart_started',
      session_id: sessionId,
      shopping_list_id: listId,
      payload: sanitizePayload({ item_count: itemCount, list_id: listId }),
    });

    try {
      const { url, order_id } = await createOrder();
      setHandoffState({
        kind: 'success',
        url,
        itemCount,
        appInstalled: false, // per 20-RESEARCH.md Pitfall 2, skip canOpenURL probe
      });
      logShoppingEvent({
        name: 'shopping.draft_cart_succeeded',
        session_id: sessionId,
        shopping_list_id: listId,
        shopping_order_id: order_id,
        payload: sanitizePayload({
          item_count: itemCount,
          list_id: listId,
          order_id,
        }),
      });
      // Refresh the orders list in the background so /shopping/handoffs
      // reflects the new row next time the user navigates there.
      void fetchOrders();
    } catch (err) {
      const variant = classifyHandoffError(err);
      setHandoffState({ kind: 'error', variant });
      logShoppingEvent({
        name: 'shopping.draft_cart_failed',
        session_id: sessionId,
        shopping_list_id: listId,
        payload: sanitizePayload({
          error_code: variant,
          variant,
          list_id: listId,
        }),
      });
    }
  }, [createOrder, fetchOrders, currentList, items]);

  const handleOpenCart = useCallback(async () => {
    if (handoffState.kind !== 'success') return;
    const url = handoffState.url;
    // openInstacartCart fires handoff_opened_{app|web} telemetry internally
    // (20-01 Task 2). Parent only supplies session context.
    await openInstacartCart(url, {
      sessionId: handoffSessionId,
    });
    setHandoffState({ kind: 'idle' });
  }, [handoffState, handoffSessionId]);

  const handleRetry = useCallback(() => {
    // Simpler than auto-reissuing the Instacart call — user re-taps the
    // Order button to retry. Per 20-RESEARCH.md anti-pattern
    // "Calling Instacart twice".
    setHandoffState({ kind: 'idle' });
  }, []);

  const handleDismiss = useCallback(() => {
    if (handoffState.kind === 'success' || handoffState.kind === 'error') {
      logShoppingEvent({
        name: 'shopping.handoff_dismissed',
        session_id: handoffSessionId,
        shopping_list_id: currentList?.id ?? null,
        payload: sanitizePayload({
          variant: handoffState.kind === 'error' ? handoffState.variant : undefined,
        }),
      });
    }
    setHandoffState({ kind: 'idle' });
  }, [handoffState, handoffSessionId, currentList]);

  const checkedCount = items.filter((i) => i.checked).length;
  const allChecked = items.length > 0 && items.every((i) => i.checked);
  const sending = handoffState.kind === 'sending';
  const orderDisabled = sending || items.length === 0 || allChecked;

  if (loading && !currentList && items.length === 0) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <ActivityIndicator size="large" color={colors.brand} />
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

      {/* Action row — handoffs (past carts) icon */}
      <View style={styles.actionRow} pointerEvents="box-none">
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => router.push('/shopping/handoffs')}
          style={styles.actionBtn}
          hitSlop={8}
          accessibilityLabel="View Instacart carts"
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
        className="absolute right-5 bottom-24 w-14 h-14 rounded-full bg-brand items-center justify-center active:bg-brand-pressed"
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
          title="Add to Instacart Order"
          onPress={handleOrder}
          loading={sending}
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

      <HandoffSheet
        state={handoffState}
        onOpenCart={handleOpenCart}
        onRetry={handleRetry}
        onDismiss={handleDismiss}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ...collapsingHeaderStyles,
});
