import React, { useState } from 'react';
import { View, Text, Pressable, ActionSheetIOS } from 'react-native';
import { SymbolIcon } from '../ui/SymbolIcon';
import { ItemRow, type ChipTone } from '../ui/ItemRow';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';
import { usePantryStore } from '../../stores/pantryStore';
import { colors } from '../../design/tokens';
import { LOCATION_SYMBOLS, FALLBACK_LOCATION_SYMBOL } from './locationSymbols';
import { resolvePantryItemCardWrapperClasses } from './pantryItemCardHelpers';
import { formatQuantity } from '../../types/pantry';

interface PantryItemCardProps {
  item: EnrichedPantryItem;
  /**
   * Phase 21-05: position in the containing list. Used for the
   * `testID="pantry-item-ellipsis-{index}"` contract that 21-06 Maestro flows
   * depend on (I2). Optional — consumers not wiring Maestro can omit.
   */
  index?: number;
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

export function PantryItemCard({ item, index }: PantryItemCardProps) {
  const markItemUsed = usePantryStore((s) => s.markItemUsed);
  const markItemDepleted = usePantryStore((s) => s.markItemDepleted);
  const markStaple = usePantryStore((s) => s.markStaple);
  const unmarkStaple = usePantryStore((s) => s.unmarkStaple);
  const isStapleFn = usePantryStore((s) => s.isStaple);
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

  // Phase 21-05: "Mark as staple" action via ActionSheetIOS. Mirrors the
  // Phase 15-04 HeaderEllipsis + ActionSheetIOS pattern but inline on the
  // card (the full HeaderEllipsis primitive is designed for navigation
  // headers; a card-row overflow is a bare Pressable + ActionSheetIOS).
  const canonicalId = item.canonical_ingredient_id;
  const hasCanonical = typeof canonicalId === 'string' && canonicalId.length > 0;
  const isStaple = hasCanonical && isStapleFn(canonicalId);

  const handleOpenSheet = () => {
    const actions: Array<{ label: string; onPress: () => void; destructive?: boolean }> = [
      { label: 'Mark used', onPress: handleMarkUsed },
      { label: 'Mark gone', onPress: handleMarkDepleted, destructive: true },
    ];
    if (hasCanonical && canonicalId) {
      actions.splice(0, 0, {
        label: isStaple ? 'Remove from staples' : 'Mark as staple',
        onPress: () => {
          if (isStaple) {
            unmarkStaple(canonicalId).catch(() => {});
          } else {
            markStaple(canonicalId, item.name).catch(() => {});
          }
        },
      });
    }
    const labels = actions.map((a) => a.label);
    const destructiveIdx = actions.findIndex((a) => a.destructive);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex: destructiveIdx >= 0 ? destructiveIdx : undefined,
      },
      (idx) => {
        if (idx != null && idx < actions.length) {
          actions[idx].onPress();
        }
      },
    );
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

  // Phase 21-04 stale treatment (21-CONTEXT ROADMAP #2): when confidence has
  // dropped below 0.5 (after 7-day decay), render a dashed muted wrapper so the
  // item fades into its natural group rather than getting a dedicated section.
  // The resolver is pure so PantryItemCard tests can assert without a renderer.
  const wrapperCls = resolvePantryItemCardWrapperClasses(item);

  return (
    <View className={wrapperCls}>
      <View className="flex-row items-center">
        <View className="flex-1">
          <ItemRow
            leading={{ kind: 'icon', name: locationIcon, tint: colors.textSecondary }}
            title={item.name}
            subtitle={subtitleParts.join(' \u2022 ')}
            trailingChip={deriveTrailingChip(item)}
            onPress={() => setExpanded(!expanded)}
          />
        </View>
        <Pressable
          testID={typeof index === 'number' ? `pantry-item-ellipsis-${index}` : undefined}
          onPress={handleOpenSheet}
          hitSlop={10}
          className="px-3 py-2"
          accessibilityLabel="Item actions"
        >
          <SymbolIcon name="ellipsis" size="body" weight="medium" tintColor={colors.textSecondary} />
        </Pressable>
      </View>

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
