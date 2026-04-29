import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { SymbolIcon } from '../ui/SymbolIcon';
import { ItemRow } from '../ui/ItemRow';
import { colors } from '../../design/tokens';
import type { ShoppingListItem } from '../../types/shopping';

interface ShoppingItemRowProps {
  item: ShoppingListItem;
  onToggle: () => void;
  onEdit: (patch: { name?: string; quantity?: number | null }) => void;
  onDelete: () => void;
}

export function ShoppingItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: ShoppingItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(
    item.quantity != null ? String(item.quantity) : ''
  );
  const swipeableRef = useRef<Swipeable>(null);

  const commit = useCallback(() => {
    const trimmedName = name.trim();
    const nextQty = quantity.trim() === '' ? null : Number(quantity);
    const patch: { name?: string; quantity?: number | null } = {};
    if (trimmedName && trimmedName !== item.name) patch.name = trimmedName;
    if (
      (nextQty === null && item.quantity !== null) ||
      (nextQty !== null &&
        !Number.isNaN(nextQty) &&
        nextQty !== item.quantity)
    ) {
      patch.quantity = nextQty;
    }
    if (Object.keys(patch).length > 0) onEdit(patch);
    setEditing(false);
  }, [name, quantity, item.name, item.quantity, onEdit]);

  const cancelEdit = useCallback(() => {
    setName(item.name);
    setQuantity(item.quantity != null ? String(item.quantity) : '');
    setEditing(false);
  }, [item.name, item.quantity]);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>
  ) => {
    return (
      <RectButton
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        style={{
          backgroundColor: colors.destructive,
          justifyContent: 'center',
          alignItems: 'center',
          width: 84,
          marginVertical: 2,
          borderRadius: 8,
        }}
      >
        <SymbolIcon name="trash" size={22} tintColor="#FFFFFF" />
        <Text className="text-white text-caption font-semibold mt-1">Delete</Text>
      </RectButton>
    );
  };

  // Editing mode keeps the inline text input affordance — ItemRow doesn't
  // support inline edit, so editing mode renders a bespoke row that matches
  // ItemRow's visual language via tokens.
  if (editing) {
    return (
      <View className="flex-row items-center bg-surface rounded-card px-4 py-2 my-0.5 border border-brand">
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={commit}
          autoFocus
          className="flex-1 text-body text-text-primary py-1"
          placeholder="Item name"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="done"
          onSubmitEditing={commit}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          onBlur={commit}
          className="w-16 text-body text-text-secondary text-right py-1 ml-2"
          placeholder="qty"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={commit}
        />
        <Pressable onPress={cancelEdit} hitSlop={8} className="ml-3" accessibilityLabel="Cancel edit">
          <SymbolIcon name="xmark" size="action" tintColor={colors.textTertiary} />
        </Pressable>
      </View>
    );
  }

  // Per-recipe attribution (item.sources) was previously stuffed into the
  // subtitle alongside qty/unit, leaving rows wrapped to two lines just to
  // tell users which recipe asked for the can of tomatoes — noise for a
  // glance-and-check task. Subtitle is now just qty/unit, leaving the
  // row at the same compact height as a Reminders item.
  const trailingMeta =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : item.unit ?? undefined;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <ItemRow
        leading={{ kind: 'checkbox', checked: !!item.checked, onToggle }}
        title={item.name}
        subtitle={trailingMeta || undefined}
        struck={!!item.checked}
        onLongPress={() => setEditing(true)}
        size="compact"
      />
    </Swipeable>
  );
}
