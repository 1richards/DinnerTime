import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { ItemRow, type ChipTone } from '../ui/ItemRow';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';
import { usePantryStore } from '../../stores/pantryStore';
import { colors } from '../../design/tokens';
import { LOCATION_SYMBOLS, FALLBACK_LOCATION_SYMBOL } from './locationSymbols';
import { formatQuantity } from '../../types/pantry';

interface PantryItemCardProps {
  item: EnrichedPantryItem;
}

/**
 * Stale/low-confidence trailing chip derived from effectiveConfidence.
 * Uncertain items (decayed or low-confidence) surface a "stale" chip; the
 * <Chip> component isn't reused here because ItemRow's trailingChip is inline
 * and token-driven (matches destructive / warning / success / default tones).
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

export function PantryItemCard({ item }: PantryItemCardProps) {
  const { markItemUsed, markItemDepleted } = usePantryStore();
  const [expanded, setExpanded] = useState(false);

  const handleMarkUsed = async () => {
    try {
      await markItemUsed(item.id);
    } catch {
      // Rollback handled by store
    }
  };

  const handleMarkDepleted = async () => {
    try {
      await markItemDepleted(item.id);
    } catch {
      // Rollback handled by store
    }
  };

  const locationIcon = LOCATION_SYMBOLS[item.source_location] ?? FALLBACK_LOCATION_SYMBOL;

  // Plan 19-05 deviation note: plan specifies a stepper leading for pantry,
  // but the pantry store has no updateItemQuantity mutation (scope = Phase 21
  // pantry intelligence). Using leading=icon preserves existing interactions
  // (mark-used / mark-depleted via expand-to-act) and the visual identity of
  // an ItemRow. Quantity + unit are surfaced in the subtitle.
  // Phase 24a: quantity is now a Quantity object ({value, unit, system}) on
  // new rows and may still be a legacy number on pre-migration rows cached in
  // AsyncStorage. `formatQuantity` tolerates both, plus null/undefined.
  const formattedQty = formatQuantity(item.quantity, item.unit);
  const subtitleParts = [formattedQty || null, item.category].filter(Boolean);

  return (
    <View className={`mb-2 mx-4 ${item.isUncertain ? 'opacity-60' : ''}`}>
      <ItemRow
        leading={{ kind: 'icon', name: locationIcon, tint: colors.textSecondary }}
        title={item.name}
        subtitle={subtitleParts.join(' \u2022 ')}
        trailingChip={deriveTrailingChip(item)}
        onPress={() => setExpanded(!expanded)}
      />

      {/* Expand-to-act: used / gone actions */}
      {expanded && (
        <View className="flex-row mt-2 gap-3 px-4">
          <Pressable
            onPress={handleMarkUsed}
            className="flex-1 flex-row items-center justify-center bg-success/15 rounded-button py-2.5"
            accessibilityLabel="Mark used"
          >
            <SymbolIcon name="checkmark.circle" size={18} tintColor={colors.success} />
            <Text className="text-caption font-semibold text-success ml-1.5">Used</Text>
          </Pressable>
          <Pressable
            onPress={handleMarkDepleted}
            className="flex-1 flex-row items-center justify-center bg-destructive/15 rounded-button py-2.5"
            accessibilityLabel="Mark gone"
          >
            <SymbolIcon name="trash" size={18} tintColor={colors.destructive} />
            <Text className="text-caption font-semibold text-destructive ml-1.5">Gone</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
