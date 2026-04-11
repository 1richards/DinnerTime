import React from 'react';
import { View, Text, TextInput, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIngredientSearch } from '../../hooks/useIngredientSearch';
import { ChipToggle } from '../ui/ChipToggle';

interface IngredientSearchProps {
  selectedItems: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
}

export function IngredientSearch({
  selectedItems,
  onAdd,
  onRemove,
}: IngredientSearchProps) {
  const { query, setQuery, results } = useIngredientSearch(selectedItems);

  const handleSelect = (item: string) => {
    onAdd(item);
    setQuery('');
  };

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed.length >= 2 && results.length === 0) {
      onAdd(trimmed);
      setQuery('');
    }
  };

  return (
    <View>
      {/* Search input */}
      <View className="flex-row items-center bg-warmGray-50 border border-warmGray-200 rounded-xl px-3 py-2.5">
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          className="flex-1 ml-2 text-base text-warmGray-900"
          placeholder="Search ingredients..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        )}
      </View>

      {/* Search results dropdown */}
      {query.length >= 2 && (
        <View className="bg-white border border-warmGray-200 rounded-xl mt-1 max-h-48">
          {results.length > 0 ? (
            <FlatList
              data={results.slice(0, 10)}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handleSelect(item)}
                  className="px-4 py-3 border-b border-warmGray-50"
                >
                  <Text className="text-sm text-warmGray-800">{item}</Text>
                </Pressable>
              )}
            />
          ) : (
            <Pressable onPress={handleSubmit} className="px-4 py-3">
              <Text className="text-sm text-warmGray-500">
                No matches. Tap to add "{query}" as custom item.
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Selected items */}
      {selectedItems.length > 0 && (
        <View className="flex-row flex-wrap gap-2 mt-3">
          {selectedItems.map((item) => (
            <ChipToggle
              key={item}
              label={item}
              selected
              onToggle={() => onRemove(item)}
              variant="removable"
            />
          ))}
        </View>
      )}
    </View>
  );
}
