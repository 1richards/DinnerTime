import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EnrichedPantryItem } from '../../hooks/usePantryItems';
import { usePantryStore } from '../../stores/pantryStore';

const locationIcons: Record<string, string> = {
  fridge: '🧊',
  pantry: '🗄️',
  freezer: '❄️',
};

interface PantryItemCardProps {
  item: EnrichedPantryItem;
}

export function PantryItemCard({ item }: PantryItemCardProps) {
  const { markItemUsed, markItemDepleted } = usePantryStore();
  const [expanded, setExpanded] = useState(false);

  const daysSinceLastSeen = Math.floor(
    (Date.now() - new Date(item.last_seen_at).getTime()) / (1000 * 60 * 60 * 24)
  );

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

  return (
    <Pressable
      onPress={() => setExpanded(!expanded)}
      className={`bg-white rounded-xl px-4 py-3 mb-2 mx-4 ${
        item.isUncertain ? 'opacity-60' : ''
      }`}
    >
      <View className="flex-row items-center">
        {/* Location icon */}
        <Text className="text-lg mr-3">
          {locationIcons[item.source_location] ?? '📦'}
        </Text>

        {/* Item info */}
        <View className="flex-1">
          <Text className="text-base font-medium text-warmGray-900">
            {item.name}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <Text className="text-sm text-warmGray-500">
              {item.quantity} {item.unit}
            </Text>
            {item.isUncertain && (
              <View className="flex-row items-center ml-2">
                <Ionicons name="time-outline" size={14} color="#9CA3AF" />
                <Text className="text-xs text-warmGray-400 ml-1">
                  Not seen in {daysSinceLastSeen} days
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Category badge */}
        <View className="bg-warmGray-100 px-2 py-1 rounded-full">
          <Text className="text-xs text-warmGray-600 capitalize">
            {item.category}
          </Text>
        </View>
      </View>

      {/* Expanded actions */}
      {expanded && (
        <View className="flex-row mt-3 pt-3 border-t border-warmGray-100 gap-3">
          <Pressable
            onPress={handleMarkUsed}
            className="flex-1 flex-row items-center justify-center bg-green-50 rounded-lg py-2.5"
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#16A34A" />
            <Text className="text-sm font-medium text-green-700 ml-1.5">Used</Text>
          </Pressable>
          <Pressable
            onPress={handleMarkDepleted}
            className="flex-1 flex-row items-center justify-center bg-red-50 rounded-lg py-2.5"
          >
            <Ionicons name="trash-outline" size={18} color="#DC2626" />
            <Text className="text-sm font-medium text-red-700 ml-1.5">Gone</Text>
          </Pressable>
        </View>
      )}
    </Pressable>
  );
}
