import React, { useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Alert, Text, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, router } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { usePreferencesStore } from '../../stores/preferencesStore';
import { useCookingStore } from '../../stores/cookingStore';
import { useProgressionStore } from '../../stores/progressionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { deriveSkillTier } from '../../plan/skillTier';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { FamilyMembersSection } from '../../components/settings/FamilyMembersSection';
import { DietarySection } from '../../components/settings/DietarySection';
import { CuisineSection } from '../../components/settings/CuisineSection';
import { DislikesSection } from '../../components/settings/DislikesSection';
import { SkillLevelSection } from '../../components/settings/SkillLevelSection';
import { ShoppingHandoffSection } from '../../components/settings/ShoppingHandoffSection';
import { BiometricUnlockSection } from '../../components/settings/BiometricUnlockSection';
import { SymbolIcon } from '../../components/ui/SymbolIcon';
import { colors } from '../../design/tokens';

export default function SettingsScreen() {
  const profile = useAuthStore((s) => s.profile);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const signOut = useAuthStore((s) => s.signOut);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const isLoading = usePreferencesStore((s) => s.isLoading);
  // Phase 16-07: cooking preferences — dark-mode toggle. Persisted via the
  // cookingStore's partialize rule so the value survives app restarts.
  const darkMode = useCookingStore((s) => s.darkMode);
  const setDarkMode = useCookingStore((s) => s.setDarkMode);
  // Phase 22-05: Plan section inputs — skill tier is derived read-only from
  // progressionStore.cookStats (same helper the server uses), banner toggle
  // is a persisted settingsStore boolean defaulting to true.
  const cookStats = useProgressionStore((s) => s.cookStats);
  const planFocusBannerEnabled = useSettingsStore(
    (s) => s.planFocusBannerEnabled
  );
  const setPlanFocusBannerEnabled = useSettingsStore(
    (s) => s.setPlanFocusBannerEnabled
  );
  const { show, ToastComponent } = useToast();

  // If the user signs out while on this screen, kick them to login.
  // Settings is now inside the (tabs) group — the layout's redirect also
  // catches this, but keeping the guard here makes the behavior explicit.
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
        <ActivityIndicator size="large" color={colors.brand} />
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

        {/* Phase 21-05: Pantry intelligence management rows */}
        <View className="mb-2">
          <Text className="text-xs font-bold text-warmGray-500 uppercase tracking-wider mb-3">
            Pantry
          </Text>
          <Pressable
            onPress={() => router.push('/settings/pantry-rules')}
            className="flex-row items-center py-3 border-b border-warmGray-100"
            accessibilityRole="button"
          >
            <SymbolIcon name="slider.horizontal.3" size="body" tintColor={colors.textSecondary} />
            <Text className="flex-1 ml-3 text-base text-warmGray-900">Pantry Rules</Text>
            <SymbolIcon name="chevron.right" size="body" tintColor={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/settings/staples')}
            className="flex-row items-center py-3"
            accessibilityRole="button"
          >
            <SymbolIcon name="star" size="body" tintColor={colors.textSecondary} />
            <Text className="flex-1 ml-3 text-base text-warmGray-900">Staples</Text>
            <SymbolIcon name="chevron.right" size="body" tintColor={colors.textSecondary} />
          </Pressable>
        </View>

        <View className="border-b border-warmGray-100 my-4" />

        {/* Phase 16-07: Cooking preferences — dark-mode toggle per UI-SPEC
            §Copywriting "Dark mode toggle" + §Component Inventory "Settings
            additions". Wired to cookingStore.setDarkMode (persisted). */}
        <View className="mb-2">
          <Text className="text-label text-text-secondary uppercase mb-3">
            COOKING
          </Text>
          <View
            className="flex-row items-center justify-between py-4 border-b border-border"
            accessibilityRole="switch"
            accessibilityState={{ checked: darkMode }}
            accessibilityLabel="Dark cooking mode"
          >
            <View className="flex-1 pr-4">
              <Text className="text-body text-text-primary">
                Dark cooking mode
              </Text>
              <Text className="text-body text-text-secondary">
                Darker background while cooking. Matches Spotify's Now Playing feel.
              </Text>
            </View>
            <Switch value={darkMode} onValueChange={setDarkMode} />
          </View>
        </View>

        <View className="border-b border-warmGray-100 my-4" />

        {/* Phase 22-05: Plan — Skill Tier (read-only, derived from cook
            stats) + Weekly Skill Focus banner toggle. The tier display is
            a one-line signal showing where the user is on the
            beginner/intermediate/advanced ladder (threshold constants
            shared with the server via apps/mobile/src/plan/skillTier.ts).
            The toggle gates whether the FocusBanner renders at the top of
            the Plan tab. */}
        <View className="mb-2">
          <Text className="text-label text-text-secondary uppercase mb-3">
            PLAN
          </Text>
          <View
            className="flex-row items-center justify-between py-4 border-b border-border"
            accessibilityLabel="Skill tier"
          >
            <View className="flex-1 pr-4">
              <Text className="text-body text-text-primary">Skill Tier</Text>
              <Text className="text-body text-text-secondary">
                Derived from your cooking history. Unlocks advanced recipes as
                you cook.
              </Text>
            </View>
            {(() => {
              const tier = deriveSkillTier(cookStats);
              const label =
                tier === 1 ? 'Beginner' : tier === 2 ? 'Intermediate' : 'Advanced';
              return (
                <Text className="text-body text-text-primary font-semibold">
                  Tier {tier} · {label}
                </Text>
              );
            })()}
          </View>
          <View
            className="flex-row items-center justify-between py-4 border-b border-border"
            accessibilityRole="switch"
            accessibilityState={{ checked: planFocusBannerEnabled }}
            accessibilityLabel="Weekly Skill Focus banner"
          >
            <View className="flex-1 pr-4">
              <Text className="text-body text-text-primary">
                Weekly Skill Focus banner
              </Text>
              <Text className="text-body text-text-secondary">
                Show a banner at the top of Plan letting you set a theme to
                practice this week.
              </Text>
            </View>
            <Switch
              value={planFocusBannerEnabled}
              onValueChange={setPlanFocusBannerEnabled}
            />
          </View>
        </View>

        <View className="border-b border-warmGray-100 my-4" />

        {/* Phase 20-02 (SHOP-DC-05): hidden rollback toggle for the draft-cart
            handoff flow. Header + muted subtitle are the only visible surface
            for normal users; 5 taps within 1.5s on the "Shopping" header
            reveals the legacy-mode Switch. Placed above Account per CONTEXT
            D-03 (discreet, below existing content). */}
        <ShoppingHandoffSection />

        <View className="border-b border-warmGray-100 my-4" />

        {/* Phase 23-03 (NFR-07): Security — Face ID unlock toggle. Placed
            above Account so it groups with other auth-adjacent rows. Failure
            toasts route through the page's existing useToast. */}
        <BiometricUnlockSection showToast={show} />

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
            variant="destructive"
            onPress={handleSignOut}
          />
        </View>

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
