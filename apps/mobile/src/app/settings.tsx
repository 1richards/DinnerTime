import React, { useEffect } from 'react';
import { View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useToast } from '../components/ui/Toast';
import { FamilyMembersSection } from '../components/settings/FamilyMembersSection';
import { DietarySection } from '../components/settings/DietarySection';
import { CuisineSection } from '../components/settings/CuisineSection';
import { DislikesSection } from '../components/settings/DislikesSection';
import { SkillLevelSection } from '../components/settings/SkillLevelSection';

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const isLoading = usePreferencesStore((s) => s.isLoading);
  const { show, ToastComponent } = useToast();

  useEffect(() => {
    if (profile?.id) {
      loadPreferences(profile.id);
    }
  }, [profile?.id, loadPreferences]);

  if (!profile) return null;

  const handleSaved = () => {
    show('Saved');
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite items-center justify-center" edges={['bottom']}>
        <ActivityIndicator size="large" color="#F97316" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warmWhite" edges={['bottom']}>
      <ToastComponent />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-6"
        keyboardShouldPersistTaps="handled"
      >
        {/* Family Members */}
        <FamilyMembersSection
          profileId={profile.id}
          onMemberChanged={handleSaved}
        />

        <View className="border-b border-warmGray-100 my-4" />

        {/* Dietary & Allergies */}
        <DietarySection />

        <View className="border-b border-warmGray-100 my-4" />

        {/* Cuisine Preferences */}
        <CuisineSection profileId={profile.id} onSaved={handleSaved} />

        <View className="border-b border-warmGray-100 my-4" />

        {/* Disliked Ingredients */}
        <DislikesSection />

        <View className="border-b border-warmGray-100 my-4" />

        {/* Cooking Skill */}
        <SkillLevelSection profileId={profile.id} onSaved={handleSaved} />

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
