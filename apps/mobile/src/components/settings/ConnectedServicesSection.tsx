import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { colors } from '../../design/tokens';
import { useToast } from '../ui/Toast';

/**
 * Phase 23-01: Connected Services placeholder section.
 *
 * v1 ships a single Instacart row showing "Not connected" because the current
 * grocery handoff flow is anonymous link-based (per CONTEXT D-05 — Instacart
 * Developer Platform's link-based API doesn't require per-user OAuth). The
 * row exists so users can see the account surface is alive; tapping it fires
 * a toast explaining that the handoff happens contextually from Shopping.
 *
 * A future phase (likely post-v1) that switches to authenticated cart-based
 * handoff replaces this stub with connect/disconnect affordances.
 *
 * Requirement: NFR-05 (connected services list present).
 */

export function ConnectedServicesSection() {
  const { show, ToastComponent } = useToast();

  const handleTap = () => {
    show('Instacart link handoff happens in Shopping.');
  };

  return (
    <View className="mb-2">
      <ToastComponent />
      <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-3">
        CONNECTED SERVICES
      </Text>
      <Pressable
        onPress={handleTap}
        className="flex-row items-center py-3"
        accessibilityRole="button"
        accessibilityLabel="Instacart"
      >
        <SymbolIcon name="cart" size="body" tintColor={colors.textSecondary} />
        <View className="flex-1 ml-3">
          <Text className="text-base text-warmGray-900">Instacart</Text>
          <Text className="text-sm text-warmGray-600">
            Not connected — handoff happens in Shopping
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
