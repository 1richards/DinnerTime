import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const CUISINE_OPTIONS = [
  'Italian',
  'Mexican',
  'Chinese',
  'Japanese',
  'Indian',
  'Thai',
  'Mediterranean',
  'American',
  'Korean',
  'French',
];

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut Allergy',
  'Keto',
  'Paleo',
];

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [householdSize, setHouseholdSize] = useState(2);
  const [hasKids, setHasKids] = useState(false);
  const [kidCount, setKidCount] = useState(1);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [dietary, setDietary] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const user = useAuthStore((s) => s.user);

  const toggleItem = (
    item: string,
    list: string[],
    setList: (v: string[]) => void
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleComplete = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim() || null,
          household_size: householdSize,
          cuisine_preferences: cuisines,
          dietary_preferences: dietary,
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', 'Could not save your preferences. Please try again.');
        return;
      }

      // Update local state so routing reacts
      useAuthStore.setState({ isOnboarded: true });
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return displayName.trim().length > 0;
    return true;
  };

  return (
    <SafeAreaView className="flex-1 bg-warmWhite">
      <ScrollView
        contentContainerClassName="flex-grow px-6 py-8"
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress dots */}
        <View className="flex-row justify-center mb-8 gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${
                i === step
                  ? 'w-8 bg-orange-500'
                  : i < step
                    ? 'w-2 bg-orange-300'
                    : 'w-2 bg-warmGray-200'
              }`}
            />
          ))}
        </View>

        {/* Step 0: Welcome & Display Name */}
        {step === 0 && (
          <View>
            <Text className="text-3xl font-bold text-warmGray-900 text-center mb-2">
              Welcome to DinnerTime!
            </Text>
            <Text className="text-base text-warmGray-500 text-center mb-8">
              Let's get to know you so we can suggest meals you'll love.
            </Text>

            <Input
              label="What should we call you?"
              placeholder="Your name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
            />
          </View>
        )}

        {/* Step 1: Household */}
        {step === 1 && (
          <View>
            <Text className="text-3xl font-bold text-warmGray-900 text-center mb-2">
              Your Household
            </Text>
            <Text className="text-base text-warmGray-500 text-center mb-8">
              This helps us size our recipe suggestions.
            </Text>

            <Text className="text-sm font-medium text-warmGray-700 mb-3">
              How many people are you cooking for?
            </Text>

            <View className="flex-row flex-wrap gap-3 mb-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setHouseholdSize(n)}
                  className={`w-12 h-12 rounded-xl items-center justify-center ${
                    householdSize === n
                      ? 'bg-orange-500'
                      : 'bg-warmGray-100 border border-warmGray-200'
                  }`}
                >
                  <Text
                    className={`text-lg font-semibold ${
                      householdSize === n
                        ? 'text-white'
                        : 'text-warmGray-700'
                    }`}
                  >
                    {n === 8 ? '8+' : n}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Kids toggle */}
            <Pressable
              onPress={() => setHasKids(!hasKids)}
              className={`flex-row items-center justify-between p-4 rounded-xl border ${
                hasKids
                  ? 'bg-orange-50 border-orange-300'
                  : 'bg-warmGray-50 border-warmGray-200'
              }`}
            >
              <Text className="text-base text-warmGray-800">
                We have kids
              </Text>
              <View
                className={`w-6 h-6 rounded-md border-2 items-center justify-center ${
                  hasKids
                    ? 'bg-orange-500 border-orange-500'
                    : 'border-warmGray-300'
                }`}
              >
                {hasKids && (
                  <Text className="text-white text-xs font-bold">
                    ✓
                  </Text>
                )}
              </View>
            </Pressable>

            {hasKids && (
              <View className="mt-4">
                <Text className="text-sm font-medium text-warmGray-700 mb-3">
                  How many kids?
                </Text>
                <View className="flex-row gap-3">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      onPress={() => setKidCount(n)}
                      className={`w-12 h-12 rounded-xl items-center justify-center ${
                        kidCount === n
                          ? 'bg-orange-500'
                          : 'bg-warmGray-100 border border-warmGray-200'
                      }`}
                    >
                      <Text
                        className={`text-lg font-semibold ${
                          kidCount === n
                            ? 'text-white'
                            : 'text-warmGray-700'
                        }`}
                      >
                        {n === 5 ? '5+' : n}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Step 2: Preferences */}
        {step === 2 && (
          <View>
            <Text className="text-3xl font-bold text-warmGray-900 text-center mb-2">
              Your Preferences
            </Text>
            <Text className="text-base text-warmGray-500 text-center mb-8">
              Pick your favorites -- you can always change these later.
            </Text>

            <Text className="text-sm font-medium text-warmGray-700 mb-3">
              Cuisines you enjoy
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {CUISINE_OPTIONS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => toggleItem(c, cuisines, setCuisines)}
                  className={`px-4 py-2 rounded-full ${
                    cuisines.includes(c)
                      ? 'bg-orange-500'
                      : 'bg-warmGray-100 border border-warmGray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      cuisines.includes(c)
                        ? 'text-white'
                        : 'text-warmGray-700'
                    }`}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-sm font-medium text-warmGray-700 mb-3">
              Any dietary needs?
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {DIETARY_OPTIONS.map((d) => (
                <Pressable
                  key={d}
                  onPress={() => toggleItem(d, dietary, setDietary)}
                  className={`px-4 py-2 rounded-full ${
                    dietary.includes(d)
                      ? 'bg-orange-500'
                      : 'bg-warmGray-100 border border-warmGray-200'
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      dietary.includes(d)
                        ? 'text-white'
                        : 'text-warmGray-700'
                    }`}
                  >
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Spacer */}
        <View className="flex-1" />

        {/* Navigation buttons */}
        <View className="flex-row gap-3 mt-8">
          {step > 0 && (
            <Button
              title="Back"
              variant="ghost"
              onPress={() => setStep(step - 1)}
              className="flex-1"
            />
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button
              title="Next"
              onPress={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="flex-1"
            />
          ) : (
            <Button
              title="Get Started"
              onPress={handleComplete}
              loading={saving}
              className="flex-1"
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
