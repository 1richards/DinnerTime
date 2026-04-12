import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Animated,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
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
          backgroundColor: '#DC2626',
          justifyContent: 'center',
          alignItems: 'center',
          width: 84,
          marginVertical: 4,
          borderRadius: 12,
        }}
      >
        <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        <Text className="text-white text-xs font-semibold mt-1">Delete</Text>
      </RectButton>
    );
  };

  const qtyLabel =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : item.unit ?? '';

  if (editing) {
    return (
      <View className="flex-row items-center bg-white rounded-xl px-4 py-3 my-1 border border-orange-200">
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={commit}
          autoFocus
          className="flex-1 text-base text-warmGray-900 py-1"
          placeholder="Item name"
          returnKeyType="done"
          onSubmitEditing={commit}
        />
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          onBlur={commit}
          className="w-16 text-base text-warmGray-700 text-right py-1 ml-2"
          placeholder="qty"
          keyboardType="numeric"
          returnKeyType="done"
          onSubmitEditing={commit}
        />
        <Pressable onPress={cancelEdit} hitSlop={8} className="ml-3">
          <Ionicons name="close" size={20} color="#9CA3AF" />
        </Pressable>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
    >
      <Pressable
        onLongPress={() => setEditing(true)}
        delayLongPress={350}
        className="flex-row items-center bg-white rounded-xl px-4 py-3 my-1 active:bg-warmGray-50"
        style={{ minHeight: 52 }}
      >
        <Pressable
          onPress={onToggle}
          hitSlop={10}
          className={`w-7 h-7 rounded-full border-2 items-center justify-center ${
            item.checked
              ? 'bg-orange-500 border-orange-500'
              : 'border-warmGray-300 bg-white'
          }`}
        >
          {item.checked && (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          )}
        </Pressable>

        <View className="flex-1 ml-3">
          <Text
            className={`text-base ${
              item.checked
                ? 'line-through text-warmGray-400'
                : 'text-warmGray-900'
            }`}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {item.sources && item.sources.length > 0 && (
            <Text
              className="text-xs text-warmGray-400 mt-0.5"
              numberOfLines={1}
            >
              {item.sources.join(', ')}
            </Text>
          )}
        </View>

        {qtyLabel !== '' && (
          <Text
            className={`text-sm ml-2 ${
              item.checked ? 'text-warmGray-400' : 'text-warmGray-600'
            }`}
          >
            {qtyLabel}
          </Text>
        )}
      </Pressable>
    </Swipeable>
  );
}
