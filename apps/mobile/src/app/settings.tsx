import React, { useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { FamilyMembersSection } from '../components/settings/FamilyMembersSection';
import { DietarySection } from '../components/settings/DietarySection';
import { CuisineSection } from '../components/settings/CuisineSection';
import { DislikesSection } from '../components/settings/DislikesSection';
import { SkillLevelSection } from '../components/settings/SkillLevelSection';

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const signOut = useAuthStore((s) => s.signOut);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const isLoading = usePreferencesStore((s) => s.isLoading);
  const { show, ToastComponent } = useToast();

  // If the user signs out while on this screen, kick them to login.
  // Settings lives outside the (tabs) group so the group's redirect guard
  // doesn't apply here.
  if (!isLoggedIn) return <Redirect href="/(auth)/login" />;

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You\u2019ll need to sign back in to use DinnerTime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          // Explicit navigation in case the <Redirect> above doesn't fire
          // fast enough when the modal dismiss animation is still running.
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

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

        <View className="border-b border-warmGray-100 my-4" />

        {/* Account */}
        <View className="mt-2 mb-2">
          <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-3">
            Account
          </Text>
          {profile?.display_name ? (
            <Text className="text-sm text-warmGray-600 mb-4">
              Signed in as {profile.display_name}
            </Text>
          ) : null}
          <Button
            title="Sign Out"
            variant="outline"
            onPress={handleSignOut}
          />
        </View>

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
