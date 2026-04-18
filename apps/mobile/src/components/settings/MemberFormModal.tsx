import React, { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { IngredientSearch } from './IngredientSearch';
import { DIETARY_OPTIONS, AGE_RANGES } from '../../data/dietary';
import { useAddMember, useUpdateMember } from '../../hooks/usePreferences';
import type { HouseholdMember, MemberType, AgeRange, DietaryOption } from '../../types/preferences';

interface MemberFormModalProps {
  visible: boolean;
  onClose: () => void;
  member?: HouseholdMember | null;
  profileId: string;
  onSaved?: () => void;
}

export function MemberFormModal({
  visible,
  onClose,
  member,
  profileId,
  onSaved,
}: MemberFormModalProps) {
  const [name, setName] = useState('');
  const [memberType, setMemberType] = useState<MemberType>('adult');
  const [ageRange, setAgeRange] = useState<AgeRange | null>(null);
  const [dietaryRestrictions, setDietaryRestrictions] = useState<DietaryOption[]>([]);
  const [dietaryAllergies, setDietaryAllergies] = useState<DietaryOption[]>([]);
  const [dislikedIngredients, setDislikedIngredients] = useState<string[]>([]);

  const addMember = useAddMember();
  const updateMember = useUpdateMember();

  const isEditing = !!member;
  const isSaving = addMember.isPending || updateMember.isPending;

  // Pre-populate when editing
  useEffect(() => {
    if (member) {
      setName(member.name);
      setMemberType(member.member_type);
      setAgeRange(member.age_range);
      setDietaryRestrictions([...member.dietary_restrictions]);
      setDietaryAllergies([...member.dietary_allergies]);
      setDislikedIngredients([...member.disliked_ingredients]);
    } else {
      resetForm();
    }
  }, [member, visible]);

  const resetForm = () => {
    setName('');
    setMemberType('adult');
    setAgeRange(null);
    setDietaryRestrictions([]);
    setDietaryAllergies([]);
    setDislikedIngredients([]);
  };

  const toggleDietary = (option: DietaryOption) => {
    setDietaryRestrictions((prev) =>
      prev.includes(option)
        ? prev.filter((d) => d !== option)
        : [...prev, option]
    );
  };

  const toggleAllergy = (option: DietaryOption) => {
    setDietaryAllergies((prev) =>
      prev.includes(option)
        ? prev.filter((d) => d !== option)
        : [...prev, option]
    );
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const memberData = {
      profile_id: profileId,
      name: trimmedName,
      member_type: memberType,
      age_range: memberType === 'kid' ? ageRange : null,
      dietary_restrictions: dietaryRestrictions,
      dietary_allergies: dietaryAllergies,
      disliked_ingredients: dislikedIngredients,
    };

    try {
      if (isEditing && member) {
        await updateMember.mutateAsync({
          id: member.id,
          updates: memberData,
        });
      } else {
        await addMember.mutateAsync(memberData);
      }
      onSaved?.();
      onClose();
    } catch {
      // Error is handled by mutation state
    }
  };

  const handleAddIngredient = (item: string) => {
    if (!dislikedIngredients.includes(item)) {
      setDislikedIngredients((prev) => [...prev, item]);
    }
  };

  const handleRemoveIngredient = (item: string) => {
    setDislikedIngredients((prev) => prev.filter((i) => i !== item));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-warmWhite"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b border-warmGray-100">
          <Pressable onPress={onClose} hitSlop={8}>
            <Text className="text-base text-warmGray-500">Cancel</Text>
          </Pressable>
          <Text className="text-lg font-bold text-warmGray-900">
            {isEditing ? 'Edit Member' : 'Add Member'}
          </Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          className="flex-1 px-6"
          contentContainerClassName="py-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <Input
            label="Name"
            placeholder="Family member name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {/* Member type toggle */}
          <Text className="text-sm font-medium text-warmGray-700 mb-2">Type</Text>
          <View className="flex-row gap-3 mb-4">
            <Pressable
              onPress={() => setMemberType('adult')}
              className={`flex-1 py-3 rounded-xl items-center ${
                memberType === 'adult'
                  ? 'bg-brand'
                  : 'bg-warmGray-100 border border-warmGray-200'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  memberType === 'adult' ? 'text-white' : 'text-warmGray-700'
                }`}
              >
                Adult
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMemberType('kid')}
              className={`flex-1 py-3 rounded-xl items-center ${
                memberType === 'kid'
                  ? 'bg-brand'
                  : 'bg-warmGray-100 border border-warmGray-200'
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  memberType === 'kid' ? 'text-white' : 'text-warmGray-700'
                }`}
              >
                Kid
              </Text>
            </Pressable>
          </View>

          {/* Age range (only for kids) */}
          {memberType === 'kid' && (
            <View className="mb-4">
              <Text className="text-sm font-medium text-warmGray-700 mb-2">Age Range</Text>
              <View className="flex-row flex-wrap gap-2">
                {AGE_RANGES.map((range) => (
                  <Chip
                    key={range.value}
                    kind="filter"
                    label={`${range.label} (${range.range})`}
                    selected={ageRange === range.value}
                    onPress={() => setAgeRange(range.value)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Dietary preferences (soft) */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-warmGray-700 mb-1">
              Dietary Preferences
            </Text>
            <Text className="text-xs text-warmGray-400 mb-2">
              Soft preferences -- will prefer to avoid these
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <Chip
                  key={`pref-${option.value}`}
                  kind="filter"
                  label={option.label}
                  selected={dietaryRestrictions.includes(option.value)}
                  onPress={() => toggleDietary(option.value)}
                />
              ))}
            </View>
          </View>

          {/* Allergies (hard blocks) */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-warmGray-700 mb-1">
              Allergies
            </Text>
            <Text className="text-xs text-warmGray-400 mb-2">
              Hard blocks -- will never suggest recipes with these
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {DIETARY_OPTIONS.map((option) => (
                <Chip
                  key={`allergy-${option.value}`}
                  kind="filter"
                  label={option.label}
                  selected={dietaryAllergies.includes(option.value)}
                  onPress={() => toggleAllergy(option.value)}
                />
              ))}
            </View>
          </View>

          {/* Disliked ingredients */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-warmGray-700 mb-2">
              Disliked Ingredients
            </Text>
            <IngredientSearch
              selectedItems={dislikedIngredients}
              onAdd={handleAddIngredient}
              onRemove={handleRemoveIngredient}
            />
          </View>
        </ScrollView>

        {/* Footer buttons */}
        <View className="flex-row gap-3 px-6 pb-8 pt-4 border-t border-warmGray-100">
          <Button
            title="Cancel"
            variant="ghost"
            onPress={onClose}
            className="flex-1"
          />
          <Button
            title={isEditing ? 'Save Changes' : 'Add Member'}
            onPress={handleSave}
            loading={isSaving}
            disabled={!name.trim()}
            className="flex-1"
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
