import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/ui/Button';
import { SymbolIcon } from '../../../components/ui/SymbolIcon';
import { useDirtyFormGuard } from '../../../components/ui/useDirtyFormGuard';
import { useRecipeStore } from '../../../stores/recipeStore';
import type { ParsedIngredient, Recipe } from '../../../types/recipe';

function numOrNull(text: string): number | null {
  const n = parseFloat(text);
  return Number.isFinite(n) ? n : null;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium text-warmGray-700 mb-1.5 mt-4">
      {children}
    </Text>
  );
}

function BaseInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#9CA3AF"
      {...props}
      className={`bg-warmGray-50 border border-warmGray-200 rounded-xl px-4 py-3 text-base text-warmGray-900 ${props.className ?? ''}`}
    />
  );
}

type Draft = Pick<
  Recipe,
  | 'title'
  | 'description'
  | 'ingredients'
  | 'steps'
  | 'prep_time_minutes'
  | 'cook_time_minutes'
  | 'servings'
>;

export default function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipes, updateRecipe, error } = useRecipeStore();
  const recipe = recipes.find((r) => r.id === id);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  // Dirty flag flipped on any user edit (see markDirty). Keeps the guard
  // decoupled from deep-equality on the recipe snapshot.
  const [touched, setTouched] = useState(false);
  useDirtyFormGuard(touched && !saving);

  // Wrap setDraft so ANY edit flips `touched` once. Initial hydration from
  // `recipe` runs inside useEffect (below) and must NOT trigger the guard —
  // that's why we use a separate `setDraft` call there.
  const editDraft: typeof setDraft = (updater) => {
    setTouched(true);
    setDraft(updater);
  };

  useEffect(() => {
    if (recipe && !draft) {
      setDraft({
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        prep_time_minutes: recipe.prep_time_minutes,
        cook_time_minutes: recipe.cook_time_minutes,
        servings: recipe.servings,
      });
    }
  }, [recipe, draft]);

  if (!recipe || !draft) {
    return (
      <SafeAreaView
        className="flex-1 bg-warmWhite items-center justify-center"
        edges={['bottom']}
      >
        <Text className="text-warmGray-500">Loading...</Text>
      </SafeAreaView>
    );
  }

  const updateIngredient = (
    idx: number,
    patch: Partial<ParsedIngredient>
  ) => {
    editDraft((d) => {
      if (!d) return d;
      const next = [...d.ingredients];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, ingredients: next };
    });
  };

  const removeIngredient = (idx: number) => {
    editDraft((d) =>
      d ? { ...d, ingredients: d.ingredients.filter((_, i) => i !== idx) } : d
    );
  };

  const addIngredient = () => {
    editDraft((d) =>
      d
        ? {
            ...d,
            ingredients: [
              ...d.ingredients,
              { name: '', quantity: null, unit: null, notes: null },
            ],
          }
        : d
    );
  };

  const updateStep = (idx: number, value: string) => {
    editDraft((d) => {
      if (!d) return d;
      const next = [...d.steps];
      next[idx] = value;
      return { ...d, steps: next };
    });
  };

  const removeStep = (idx: number) => {
    editDraft((d) =>
      d ? { ...d, steps: d.steps.filter((_, i) => i !== idx) } : d
    );
  };

  const addStep = () => {
    editDraft((d) => (d ? { ...d, steps: [...d.steps, ''] } : d));
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      Alert.alert('Missing Title', 'Please provide a recipe title.');
      return;
    }
    setSaving(true);
    const cleaned: Partial<Recipe> = {
      title: draft.title.trim(),
      description: draft.description,
      ingredients: draft.ingredients.filter((i) => i.name.trim()),
      steps: draft.steps.filter((s) => s.trim()),
      prep_time_minutes: draft.prep_time_minutes,
      cook_time_minutes: draft.cook_time_minutes,
      servings: draft.servings,
    };
    await updateRecipe(recipe.id, cleaned);
    setSaving(false);
    const state = useRecipeStore.getState();
    if (!state.error) {
      router.back();
    }
  };

  const handleCancel = () => router.back();

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 160 }}
          keyboardShouldPersistTaps="handled"
        >
          <FieldLabel>Title</FieldLabel>
          <BaseInput
            value={draft.title}
            onChangeText={(v) => editDraft({ ...draft, title: v })}
            placeholder="Recipe title"
          />

          <FieldLabel>Description</FieldLabel>
          <BaseInput
            value={draft.description ?? ''}
            onChangeText={(v) =>
              editDraft({ ...draft, description: v || null })
            }
            placeholder="Short description"
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <FieldLabel>Prep (min)</FieldLabel>
              <BaseInput
                value={
                  draft.prep_time_minutes != null
                    ? String(draft.prep_time_minutes)
                    : ''
                }
                onChangeText={(v) =>
                  editDraft({ ...draft, prep_time_minutes: numOrNull(v) })
                }
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View className="flex-1">
              <FieldLabel>Cook (min)</FieldLabel>
              <BaseInput
                value={
                  draft.cook_time_minutes != null
                    ? String(draft.cook_time_minutes)
                    : ''
                }
                onChangeText={(v) =>
                  editDraft({ ...draft, cook_time_minutes: numOrNull(v) })
                }
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View className="flex-1">
              <FieldLabel>Servings</FieldLabel>
              <BaseInput
                value={draft.servings != null ? String(draft.servings) : ''}
                onChangeText={(v) =>
                  editDraft({ ...draft, servings: numOrNull(v) })
                }
                keyboardType="numeric"
                placeholder="4"
              />
            </View>
          </View>

          <FieldLabel>Ingredients</FieldLabel>
          {draft.ingredients.map((ing, idx) => (
            <View
              key={idx}
              className="bg-white rounded-xl p-3 mb-2 border border-warmGray-100"
            >
              <View className="flex-row gap-2 mb-2">
                <View className="flex-1">
                  <BaseInput
                    value={ing.quantity != null ? String(ing.quantity) : ''}
                    onChangeText={(v) =>
                      updateIngredient(idx, { quantity: numOrNull(v) })
                    }
                    placeholder="Qty"
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <BaseInput
                    value={ing.unit ?? ''}
                    onChangeText={(v) =>
                      updateIngredient(idx, { unit: v || null })
                    }
                    placeholder="Unit"
                  />
                </View>
                <Pressable
                  onPress={() => removeIngredient(idx)}
                  className="px-2 justify-center"
                >
                  <SymbolIcon name="trash" size="body" tintColor="#EF4444" />
                </Pressable>
              </View>
              <BaseInput
                value={ing.name}
                onChangeText={(v) => updateIngredient(idx, { name: v })}
                placeholder="Ingredient name"
              />
              <View className="mt-2">
                <BaseInput
                  value={ing.notes ?? ''}
                  onChangeText={(v) =>
                    updateIngredient(idx, { notes: v || null })
                  }
                  placeholder="Notes (optional)"
                />
              </View>
            </View>
          ))}
          <Button
            title="+ Add Ingredient"
            variant="outline"
            onPress={addIngredient}
            className="mt-2"
          />

          <FieldLabel>Steps</FieldLabel>
          {draft.steps.map((step, idx) => (
            <View key={idx} className="flex-row items-start mb-2">
              <View className="w-8 h-8 rounded-full bg-orange-100 items-center justify-center mr-2 mt-1">
                <Text className="text-sm font-semibold text-orange-700">
                  {idx + 1}
                </Text>
              </View>
              <View className="flex-1">
                <BaseInput
                  value={step}
                  onChangeText={(v) => updateStep(idx, v)}
                  placeholder={`Step ${idx + 1}`}
                  multiline
                  style={{ minHeight: 60, textAlignVertical: 'top' }}
                />
              </View>
              <Pressable
                onPress={() => removeStep(idx)}
                className="px-2 py-3"
              >
                <SymbolIcon name="trash" size="body" tintColor="#EF4444" />
              </Pressable>
            </View>
          ))}
          <Button
            title="+ Add Step"
            variant="outline"
            onPress={addStep}
            className="mt-2"
          />

          {error && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
              <Text className="text-sm text-red-700">{error}</Text>
            </View>
          )}
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 bg-warmWhite border-t border-warmGray-200 px-4 py-3 pb-8">
          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            className="mb-2"
          />
          <Button title="Cancel" variant="ghost" onPress={handleCancel} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
