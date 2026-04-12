import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { useRecipeStore } from '../../stores/recipeStore';
import { supabase } from '../../lib/supabase';
import type { ParsedRecipe } from '../../types/recipe';

const getApiBaseUrl = (): string => {
  return process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
};

const getAuthToken = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error('Not authenticated');
  }
  return data.session.access_token;
};

type DiscoveredRecipe = ParsedRecipe & { _saved?: boolean };

export default function DiscoverScreen() {
  const saveRecipe = useRecipeStore((s) => s.saveRecipe);

  const [recipes, setRecipes] = useState<DiscoveredRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const fetchDiscover = useCallback(
    async (withPrompt?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const token = await getAuthToken();
        const body: { prompt?: string } = {};
        if (withPrompt && withPrompt.trim()) body.prompt = withPrompt.trim();
        const response = await fetch(
          `${getApiBaseUrl()}/api/v1/recipes/discover`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
          }
        );

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          setError(errBody.error ?? 'Failed to load suggestions');
          setRecipes([]);
          setIsLoading(false);
          return;
        }

        const json = await response.json();
        const list: ParsedRecipe[] = json.data ?? [];
        setRecipes(list.map((r) => ({ ...r, _saved: false })));
        setIsLoading(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load suggestions'
        );
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchDiscover();
  }, [fetchDiscover]);

  const handleSave = async (idx: number, recipe: DiscoveredRecipe) => {
    setSavingIdx(idx);
    try {
      const { _saved, ...parsed } = recipe;
      await saveRecipe({ ...parsed, source_type: 'ai' });
      const state = useRecipeStore.getState();
      if (state.error) {
        Alert.alert('Save Failed', state.error);
      } else {
        setRecipes((list) =>
          list.map((r, i) => (i === idx ? { ...r, _saved: true } : r))
        );
      }
    } finally {
      setSavingIdx(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 12 }}
      >
        <Text className="text-2xl font-bold text-warmGray-900 mb-1">
          Discover
        </Text>
        <Text className="text-sm text-warmGray-500 mb-4">
          AI-suggested recipes tailored to your household.
        </Text>

        <View className="flex-row gap-2 mb-4">
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="e.g. quick weeknight pastas"
            placeholderTextColor="#9CA3AF"
            className="flex-1 bg-warmGray-50 border border-warmGray-200 rounded-xl px-4 py-3 text-base text-warmGray-900"
            returnKeyType="search"
            onSubmitEditing={() => fetchDiscover(prompt)}
          />
          <Pressable
            onPress={() => fetchDiscover(prompt)}
            disabled={isLoading}
            className="px-4 rounded-xl bg-orange-500 items-center justify-center"
          >
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {isLoading && (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#F97316" />
            <Text className="text-sm text-warmGray-500 mt-3">
              Brewing ideas...
            </Text>
          </View>
        )}

        {!isLoading && error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <Text className="text-sm text-red-700 mb-3">{error}</Text>
            <Button
              title="Retry"
              variant="outline"
              onPress={() => fetchDiscover(prompt)}
            />
          </View>
        )}

        {!isLoading && !error && recipes.length === 0 && (
          <Text className="text-sm text-warmGray-500 text-center mt-8">
            No suggestions. Try a different prompt.
          </Text>
        )}

        {!isLoading &&
          recipes.map((recipe, idx) => {
            const totalTime =
              recipe.total_time_minutes ??
              (recipe.prep_time_minutes ?? 0) +
                (recipe.cook_time_minutes ?? 0);
            return (
              <View
                key={`${recipe.title}-${idx}`}
                className="bg-white rounded-xl p-4 mb-3 border border-warmGray-100"
              >
                <Text className="text-base font-semibold text-warmGray-900 mb-1">
                  {recipe.title}
                </Text>
                {recipe.description && (
                  <Text
                    className="text-sm text-warmGray-600 mb-2"
                    numberOfLines={3}
                  >
                    {recipe.description}
                  </Text>
                )}
                <View className="flex-row items-center gap-4 mb-3">
                  {totalTime > 0 && (
                    <View className="flex-row items-center">
                      <Ionicons name="time-outline" size={14} color="#6B7280" />
                      <Text className="text-xs text-warmGray-500 ml-1">
                        {totalTime} min
                      </Text>
                    </View>
                  )}
                  {recipe.servings != null && (
                    <View className="flex-row items-center">
                      <Ionicons
                        name="people-outline"
                        size={14}
                        color="#6B7280"
                      />
                      <Text className="text-xs text-warmGray-500 ml-1">
                        {recipe.servings} servings
                      </Text>
                    </View>
                  )}
                </View>
                {recipe._saved ? (
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text className="text-sm text-green-700 ml-1.5">
                      Saved to library
                    </Text>
                  </View>
                ) : (
                  <Button
                    title="Save to Library"
                    variant="outline"
                    onPress={() => handleSave(idx, recipe)}
                    loading={savingIdx === idx}
                  />
                )}
              </View>
            );
          })}
      </ScrollView>
    </SafeAreaView>
  );
}
